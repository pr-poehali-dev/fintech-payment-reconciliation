import json
import os
import psycopg2
from datetime import datetime, timezone
from typing import Dict, Any
from zoneinfo import ZoneInfo

SCHEMA = 't_p83864310_fintech_payment_reco'

PROVIDER_TYPE_LABELS = {
    'tbank': 'Касса (эквайринг)',
    'tochka': 'Касса (эквайринг)',
    'yookassa': 'Касса (эквайринг)',
    'bitrix24': 'CRM',
    'amocrm': 'CRM',
    'ofdru': 'ОФД',
    'ecomkassa': 'Касса (Екомкасса)',
    'tbank_account': 'Банк (расчётный счёт)',
    'tochka_account': 'Банк (расчётный счёт)',
    'modulbank_account': 'Банк (расчётный счёт)'
}

ORDER_TYPE_LABELS = {'VCHR': 'Чек', 'INVC': 'Счёт', 'CORD': 'Заказ'}

# Унифицированная категория события для бэйджа "Тип" в интерфейсе - platform-
# независимая (в отличие от provider_type, который называет конкретного
# провайдера вроде "Касса (эквайринг)"/"Банк (расчётный счёт)"). Определяется
# однозначно по тому, из какого источника/блока данных пришло событие - это
# и есть категория интеграции (Платежи/Кассы/ОФД/Банки/CRM), см. распределение
# по блокам ниже: платёж эквайринга или шлюза Екомкассы -> 'payment', чек
# кассы Екомкассы или ОФД -> 'receipt', курьерский заказ Екомкассы -> 'receipt_order',
# операция по расчётному счёту -> 'money', хук CRM -> 'crm'.
TRANSACTION_TYPE_LABELS = {
    'payment': 'Платёж',
    'receipt': 'Чек',
    'receipt_order': 'Заказ',
    'money': 'Деньги',
    'crm': 'CRM'
}


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Единая лента событий компании: сырые данные по КАЖДОМУ источнику ОТДЕЛЬНО,
    как он есть - платежи эквайринга (webhook_payments), документы Екомкассы
    (ecomkassa_receipts), чеки ОФД (ofd_receipts), сделки CRM (webhook_events),
    операции по расчётному счёту (bank_statement_transactions). Группировка
    ВСЕГДА только ВНУТРИ одного источника по одному заказу/сделке (повторные
    вебхуки одного платежа или сделки схлопываются в одну строку с историей
    в webhook_history) - НИКОГДА между разными источниками, даже если у них
    общий uuid документа (напр. чек кассы Екомкассы и её же платёж через шлюз
    по одному order_id остаются двумя раздельными строками). Кросс-источниковая
    связка (платёж + чек кассы + чек ОФД в одну сущность) - это смысл ДРУГОГО
    раздела, "Транзакции" (подготовка данных перед сверкой), а не "Событий"
    (сырая лента по источникам, где видно расхождения именно ПОТОМУ ЧТО
    источники не смешаны).
    Args: company_id (обязателен), integration_id, provider_slug, payment_provider, limit, offset,
    date_from/date_to (YYYY-MM-DD, день события в часовом поясе компании) - опционально.
    payment_provider - дискриминатор конкретной платёжной системы внутри шлюза
    Екомкассы (invoice_payload.provider из report(), например "ЮKassa") - у одной
    кассы может быть подключено больше 10 видов оплат, фильтр сужает до одного.
    Returns: events[] с полями created_at, integration_name, provider_type,
    transaction_type (унифицированная категория для бэйджа "Тип" в интерфейсе -
    payment/receipt/receipt_order/money/crm, однозначно определяется по блоку-
    источнику события, см. TRANSACTION_TYPE_LABELS), payment_provider,
    event_number, summary, raw
    '''

    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }

    if method != 'GET':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'}),
            'isBase64Encoded': False
        }

    params = event.get('queryStringParameters', {}) or {}
    company_id = params.get('company_id')
    integration_id = params.get('integration_id')
    provider_slug = params.get('provider_slug')
    payment_provider = params.get('payment_provider')
    limit = int(params.get('limit', 100))
    offset = int(params.get('offset', 0))
    date_from = params.get('date_from') or None
    date_to = params.get('date_to') or None
    has_date_filter = bool(date_from or date_to)

    if not company_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'company_id required'}),
            'isBase64Encoded': False
        }

    dsn = os.environ['DATABASE_URL']
    conn = psycopg2.connect(dsn)
    cur = conn.cursor()

    try:
        events = []

        # 1. Платежи эквайринга (Т-Банк, шлюз Екомкассы и т.д.) - группируем
        # по заказу (order_id, либо payment_id, если заказа нет), как сделки
        # CRM группируются по external_deal_id. Каждый входящий вебхук об
        # изменении статуса платежа попадает в webhook_history этой группы -
        # в интерфейсе это раскрывающийся список со статусом, датой и raw
        # каждого отдельного вебхука. Группировка ВСЕГДА только внутри одного
        # источника (одной таблицы) по одному заказу - платёж НЕ склеивается
        # с чеком кассы или чеком ОФД, это разные источники данных, даже если
        # у них общий uuid документа Екомкассы. Кросс-источниковая связка -
        # смысл отдельного раздела "Транзакции" (подготовка перед сверкой),
        # а не "Событий" (сырая лента по каждому источнику как он есть).
        # Дата события - COALESCE(receipt.doc_datetime, payment.created_at):
        # синтетический платёж, досозданный дозагрузкой исторических заказов
        # (ecomkassa-fetch-orders/save_synthetic_payment), получает created_at
        # в момент, когда пользователь нажал "Дозагрузить" - это может быть
        # много позже реальной оплаты (напр. чек за декабрь, дозагруженный
        # сегодня, иначе показывал бы сегодняшнюю дату). У такого платежа уже
        # есть receipt_id - берём doc_datetime его чека, это и есть настоящее
        # время фискальной операции. У "живых" платежей (пришедших вебхуком в
        # реальном времени) receipt_id обычно ещё нет на момент колбэка -
        # тогда используется их собственный created_at, как и раньше.
        pay_where = 'WHERE wp.company_id = %s AND wp.removed_at IS NULL'
        pay_params = [company_id]
        if integration_id:
            pay_where += ' AND wp.integration_id = %s'
            pay_params.append(integration_id)
        if provider_slug:
            pay_where += ' AND p.slug = %s'
            pay_params.append(provider_slug)
        if payment_provider:
            pay_where += ' AND wp.payment_provider = %s'
            pay_params.append(payment_provider)

        cur.execute(f'''
            SELECT
                wp.id, COALESCE(er.doc_datetime, wp.created_at) AS event_at,
                p.slug, wp.payment_id, wp.order_id,
                wp.amount, wp.status, wp.raw_data, ui.integration_name, p.name,
                wp.payment_provider
            FROM t_p83864310_fintech_payment_reco.webhook_payments wp
            JOIN t_p83864310_fintech_payment_reco.user_integrations ui ON ui.id = wp.integration_id
            JOIN t_p83864310_fintech_payment_reco.integration_providers p ON p.id = ui.provider_id
            LEFT JOIN t_p83864310_fintech_payment_reco.ecomkassa_receipts er ON er.id = wp.receipt_id
            {pay_where}
            ORDER BY event_at ASC
        ''', pay_params)

        pay_groups: Dict[Any, Dict[str, Any]] = {}
        for row in cur.fetchall():
            (pay_id, created_at, p_slug, payment_id, order_id, amount, status,
             raw_data, integration_name, provider_name, payment_provider_value) = row

            group_key = order_id or payment_id
            if group_key not in pay_groups:
                pay_groups[group_key] = {
                    'payment_id': payment_id,
                    'order_id': order_id,
                    'amount': amount,
                    'p_slug': p_slug,
                    'integration_name': integration_name,
                    'provider_name': provider_name,
                    'payment_provider': payment_provider_value,
                    'history': []
                }
            if payment_provider_value:
                pay_groups[group_key]['payment_provider'] = payment_provider_value
            pay_groups[group_key]['history'].append({
                'id': pay_id,
                'status': status,
                'error_message': None,
                'created_at': created_at.isoformat() if created_at else None,
                'raw': raw_data,
                'event_type': 'payment_status_changed'
            })

        for group_key, group in pay_groups.items():
            history = group['history']
            latest = history[-1]
            amount_str = f'{float(group["amount"]):.2f} ₽' if group['amount'] is not None else ''
            provider_str = f' [{group["payment_provider"]}]' if group['payment_provider'] else ''
            summary = f'Платёж #{group["payment_id"]}{provider_str} · {latest["status"]} {amount_str}'.strip()
            if len(history) > 1:
                summary += f' ({len(history)} хуков)'

            events.append({
                'id': f'paygrp_{group_key}',
                'source': 'payment',
                'created_at': latest['created_at'],
                'provider_slug': group['p_slug'],
                'provider_type': PROVIDER_TYPE_LABELS.get(group['p_slug'], group['provider_name']),
                'transaction_type': 'payment',
                'integration_name': group['integration_name'],
                'payment_provider': group['payment_provider'],
                'event_type': 'payment_status_changed',
                'status': latest['status'],
                'error_message': None,
                'event_number': str(group['payment_id']),
                'summary': summary,
                'raw': latest['raw'],
                'webhook_history': history
            })

        # 2. Документы Екомкассы (чеки кассы, счета, курьерские заказы) -
        # свой источник (ecomkassa_receipts), группировки с чужими источниками
        # (платежом шлюза, чеком ОФД) здесь НЕТ - это разные таблицы, их
        # кросс-связку показывает раздел "Транзакции", а не лента "Событий".
        # Сама таблица хранит только ТЕКУЩЕЕ состояние документа по uuid
        # (ON CONFLICT DO UPDATE по order_id) - на один uuid всегда ровно одна
        # строка, поэтому у каждого документа своя запись без webhook_history.
        ekr_where = 'WHERE ekr.company_id = %s AND ekr.removed_at IS NULL'
        ekr_params = [company_id]
        if integration_id:
            ekr_where += ' AND ekr.integration_id = %s'
            ekr_params.append(integration_id)
        if provider_slug and provider_slug == 'ecomkassa':
            pass
        elif provider_slug:
            ekr_where += ' AND FALSE'

        cur.execute(f'''
            SELECT
                ekr.id, ekr.order_id, COALESCE(ekr.doc_datetime, ekr.created_at) AS event_at,
                ekr.status, ekr.total_sum,
                ekr.order_type, ekr.payment_provider, ekr.raw_data,
                ui.integration_name
            FROM {SCHEMA}.ecomkassa_receipts ekr
            JOIN {SCHEMA}.user_integrations ui ON ui.id = ekr.integration_id
            {ekr_where}
            ORDER BY event_at ASC
        ''', ekr_params)

        for row in cur.fetchall():
            (ekr_id, order_id, event_at, status, total_sum, order_type, payment_provider_value,
             raw_data, integration_name) = row

            doc_label = ORDER_TYPE_LABELS.get(order_type, 'Документ')
            amount_str = f'{float(total_sum):.2f} ₽' if total_sum is not None else ''
            # payment_provider (СБП/ЮKassa и т.п.) - атрибут ПЛАТЕЖА (каким
            # способом оплатили), а не самого чека, поэтому здесь намеренно НЕ
            # попадает ни в summary, ни в поле события - иначе в ленте "Чек"
            # выглядел бы как будто это платёж со своим провайдером, хотя
            # провайдер платежа уже отдельно виден на строке типа 'payment'
            # (см. блок 1 выше). ekr.payment_provider как поле в БД остаётся -
            # используется для сопоставления чек<->платёж в разделе "Транзакции".
            summary = f'{doc_label} #{order_id} · {status} {amount_str}'.strip()

            events.append({
                'id': f'ekr_{ekr_id}',
                'source': 'ecomkassa',
                'created_at': event_at.isoformat() if event_at else None,
                'provider_slug': 'ecomkassa',
                'provider_type': PROVIDER_TYPE_LABELS.get('ecomkassa', 'Касса (Екомкасса)'),
                'transaction_type': 'receipt_order' if order_type == 'CORD' else 'receipt',
                'integration_name': integration_name,
                'payment_provider': None,
                'event_type': 'ecomkassa_document',
                'status': status,
                'error_message': None,
                'event_number': str(order_id),
                'summary': summary,
                'raw': raw_data
            })

        # 3. Чеки ОФД - свой источник (ofd_receipts), группировки с чеком
        # кассы Екомкассы здесь тоже НЕТ (см. комментарий к блоку 2) - у ОФД
        # нет вебхуков (только периодическая дозагрузка через API), и у
        # каждого чека свой уникальный receipt_id, поэтому дублей внутри
        # самого источника физически не бывает - каждый чек ОФД отдельной
        # строкой без группировки.
        ofd_where = 'WHERE o.company_id = %s AND o.removed_at IS NULL'
        ofd_params = [company_id]
        if integration_id:
            ofd_where += ' AND o.integration_id = %s'
            ofd_params.append(integration_id)
        if provider_slug and provider_slug != 'ofdru':
            ofd_where += ' AND FALSE'

        cur.execute(f'''
            SELECT o.id, o.receipt_id, o.created_at, o.operation_type, o.total_sum,
                   o.raw_data, ui.integration_name, o.raw_data->>'FnsStatus' AS fns_status
            FROM {SCHEMA}.ofd_receipts o
            JOIN {SCHEMA}.user_integrations ui ON ui.id = o.integration_id
            {ofd_where}
            ORDER BY o.created_at ASC
        ''', ofd_params)

        for row in cur.fetchall():
            ofd_id, receipt_id, created_at, operation_type, total_sum, raw_data, integration_name, fns_status = row

            amount_str = f'{float(total_sum):.2f} ₽' if total_sum is not None else ''
            summary = f'Чек ОФД #{receipt_id} · {operation_type or ""} {amount_str}'.strip()

            events.append({
                'id': f'ofd_{ofd_id}',
                'source': 'ofd',
                'created_at': created_at.isoformat() if created_at else None,
                'provider_slug': 'ofdru',
                'provider_type': PROVIDER_TYPE_LABELS.get('ofdru', 'ОФД'),
                'transaction_type': 'receipt',
                'integration_name': integration_name,
                'event_type': 'ofd_receipt',
                # status здесь - статус ПРОБИТИЯ чека в ФНС (FnsStatus:
                # Success/Fail), а не тип операции (Income/Expense и т.п.,
                # OperationType) - тип операции уже виден в тексте summary
                # выше. Ранее сюда попадал operation_type, из-за чего бейдж
                # "Статус" в ленте событий вводил в заблуждение, показывая
                # тип документа вместо факта его успешной регистрации в ФНС.
                'status': fns_status,
                'error_message': None,
                'event_number': str(receipt_id),
                'summary': summary,
                'raw': raw_data
            })

        # 4. События CRM (Битрикс24, AmoCRM) - группируем по сделке (integration_id +
        # external_deal_id), как платежи группируются по order_id. Каждый входящий
        # хук по сделке попадает в webhook_history этой группы - в интерфейсе это
        # раскрывающийся список со статусом, датой и raw каждого отдельного хука,
        # а не отдельная строка в общей ленте. Хуки без распознанного ID сделки
        # не группируются - у каждого своя запись.
        crm_where = "WHERE we.company_id = %s AND we.provider_slug IN ('bitrix24', 'amocrm')"
        crm_params = [company_id]
        if integration_id:
            crm_where += ' AND we.integration_id = %s'
            crm_params.append(integration_id)
        if provider_slug:
            crm_where += ' AND we.provider_slug = %s'
            crm_params.append(provider_slug)

        cur.execute(f'''
            SELECT
                we.id, we.integration_id, we.created_at, we.provider_slug, we.event_type,
                we.status, we.error_message, we.external_deal_id, we.raw_payload,
                ui.integration_name, p.name
            FROM t_p83864310_fintech_payment_reco.webhook_events we
            JOIN t_p83864310_fintech_payment_reco.user_integrations ui ON ui.id = we.integration_id
            JOIN t_p83864310_fintech_payment_reco.integration_providers p ON p.id = ui.provider_id
            {crm_where}
            ORDER BY we.created_at ASC
        ''', crm_params)

        crm_raw_rows = cur.fetchall()

        deals_where = 'WHERE company_id = %s'
        deals_params = [company_id]
        cur.execute(f'''
            SELECT integration_id, external_deal_id, title, stage, amount, currency
            FROM t_p83864310_fintech_payment_reco.crm_deals
            {deals_where}
        ''', deals_params)
        deals_info = {(row[0], row[1]): row for row in cur.fetchall()}

        crm_groups: Dict[Any, Dict[str, Any]] = {}
        for row in crm_raw_rows:
            (ev_id, ev_integration_id, created_at, p_slug, event_type, status,
             error_message, external_deal_id, raw_payload, integration_name, provider_name) = row

            group_key = (ev_integration_id, external_deal_id) if external_deal_id else ('single', ev_id)
            if group_key not in crm_groups:
                crm_groups[group_key] = {
                    'integration_id': ev_integration_id,
                    'p_slug': p_slug,
                    'external_deal_id': external_deal_id,
                    'integration_name': integration_name,
                    'provider_name': provider_name,
                    'history': []
                }
            crm_groups[group_key]['history'].append({
                'id': ev_id,
                'status': status,
                'error_message': error_message,
                'created_at': created_at.isoformat() if created_at else None,
                'raw': raw_payload,
                'event_type': event_type
            })

        for group_key, group in crm_groups.items():
            history = group['history']
            latest = history[-1]
            p_slug = group['p_slug']
            external_deal_id = group['external_deal_id']
            noun = 'Сделка' if p_slug == 'bitrix24' else 'Лид'

            deal_info = deals_info.get((group['integration_id'], external_deal_id)) if external_deal_id else None

            if deal_info:
                _, _, title, stage, amount, currency = deal_info
                amount_str = f' · {float(amount):.2f} {currency or "₽"}' if amount is not None else ''
                summary = f'{noun} #{external_deal_id} · {title or stage or ""}{amount_str}'.strip()
            elif external_deal_id:
                summary = f'{noun} #{external_deal_id}'
            else:
                summary = f'Не удалось распознать хук {group["provider_name"]}'

            if len(history) > 1:
                summary += f' ({len(history)} хуков)'

            events.append({
                'id': f'crmgrp_{group_key[0]}_{group_key[1]}',
                'source': 'crm',
                'created_at': latest['created_at'],
                'provider_slug': p_slug,
                'provider_type': PROVIDER_TYPE_LABELS.get(p_slug, group['provider_name']),
                'transaction_type': 'crm',
                'integration_name': group['integration_name'],
                'event_type': latest['event_type'],
                'status': latest['status'],
                'error_message': latest['error_message'],
                'event_number': str(external_deal_id) if external_deal_id else None,
                'summary': summary,
                'raw': latest['raw'],
                'webhook_history': history
            })

        # 5. Операции по расчётному счёту - второй слой обработки (дозагрузка,
        # не вебхук), но по смыслу тоже событие, которое нужно видеть в ленте.
        bank_where = 'WHERE bst.company_id = %s'
        bank_params = [company_id]
        if integration_id:
            bank_where += ' AND bst.integration_id = %s'
            bank_params.append(integration_id)
        if provider_slug:
            bank_where += ' AND bst.provider_slug = %s'
            bank_params.append(provider_slug)

        cur.execute(f'''
            SELECT
                bst.id, bst.created_at, bst.provider_slug, bst.external_transaction_id,
                bst.amount, bst.direction, bst.counterparty_name, bst.purpose,
                bst.raw_data, ui.integration_name, p.name
            FROM t_p83864310_fintech_payment_reco.bank_statement_transactions bst
            JOIN t_p83864310_fintech_payment_reco.user_integrations ui ON ui.id = bst.integration_id
            JOIN t_p83864310_fintech_payment_reco.integration_providers p ON p.id = ui.provider_id
            {bank_where}
            ORDER BY bst.created_at DESC
            LIMIT %s OFFSET %s
        ''', bank_params + [100000 if has_date_filter else limit, 0 if has_date_filter else offset])

        for row in cur.fetchall():
            (tx_id, created_at, p_slug, external_tx_id, amount, direction,
             counterparty_name, purpose, raw_data, integration_name, provider_name) = row

            direction_label = 'Поступление' if direction == 'in' else 'Списание'
            amount_str = f'{float(amount):.2f} ₽' if amount is not None else ''
            summary = f'{direction_label} {amount_str} · {counterparty_name or purpose or ""}'.strip()

            events.append({
                'id': f'bst_{tx_id}',
                'source': 'bank_statement',
                'created_at': created_at.isoformat() if created_at else None,
                'provider_slug': p_slug,
                'provider_type': PROVIDER_TYPE_LABELS.get(p_slug, provider_name),
                'transaction_type': 'money',
                'integration_name': integration_name,
                'event_type': 'bank_transaction',
                'status': 'processed',
                'error_message': None,
                'event_number': external_tx_id,
                'summary': summary,
                'raw': raw_data
            })

        # Фильтр по периоду - по календарному дню события в часовом поясе
        # компании (даты в БД хранятся в UTC), оба конца включительно.
        if has_date_filter:
            cur.execute(
                'SELECT timezone FROM t_p83864310_fintech_payment_reco.companies WHERE id = %s',
                (company_id,)
            )
            tz_row = cur.fetchone()
            try:
                tz = ZoneInfo(tz_row[0]) if tz_row and tz_row[0] else ZoneInfo('Europe/Moscow')
            except Exception:
                tz = ZoneInfo('Europe/Moscow')

            def event_day(e):
                if not e.get('created_at'):
                    return None
                dt = datetime.fromisoformat(e['created_at'])
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt.astimezone(tz).date().isoformat()

            events = [
                e for e in events
                if (d := event_day(e)) and (not date_from or d >= date_from) and (not date_to or d <= date_to)
            ]

        events.sort(key=lambda e: e['created_at'] or '', reverse=True)
        events = events[:limit]

        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'events': events, 'total': len(events)}),
            'isBase64Encoded': False
        }

    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }
    finally:
        cur.close()
        conn.close()