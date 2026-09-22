import json
import os
import psycopg2
from typing import Dict, Any

PROVIDER_TYPE_LABELS = {
    'tbank': 'Касса (эквайринг)',
    'tochka': 'Касса (эквайринг)',
    'yookassa': 'Касса (эквайринг)',
    'bitrix24': 'CRM',
    'amocrm': 'CRM',
    'ofdru': 'ОФД',
    'tbank_account': 'Банк (расчётный счёт)',
    'tochka_account': 'Банк (расчётный счёт)',
    'modulbank_account': 'Банк (расчётный счёт)'
}


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Единая лента событий компании: платежи эквайринга (webhook_payments),
    события CRM из inbox-таблицы webhook_events и операции по расчётному
    счёту (второй слой обработки, приходит не вебхуком, а дозагрузкой).
    Для каждого события отдаётся человекочитаемый номер (ID платежа/сделки/
    операции) и краткое summary для отображения в таблице без раскрытия деталей.
    Args: company_id (обязателен), integration_id, provider_slug, limit, offset (опционально)
    Returns: events[] с полями created_at, integration_name, provider_type, event_number, summary, raw
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
    limit = int(params.get('limit', 100))
    offset = int(params.get('offset', 0))

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

        # 1. Платежи эквайринга (Т-Банк и т.д.) - каждая строка это отдельный
        # входящий вебхук об изменении статуса платежа, с уже разобранными полями.
        pay_where = 'WHERE wp.company_id = %s'
        pay_params = [company_id]
        if integration_id:
            pay_where += ' AND wp.integration_id = %s'
            pay_params.append(integration_id)
        if provider_slug:
            pay_where += ' AND p.slug = %s'
            pay_params.append(provider_slug)

        cur.execute(f'''
            SELECT
                wp.id, wp.created_at, p.slug, wp.payment_id, wp.order_id,
                wp.amount, wp.status, wp.raw_data, ui.integration_name, p.name
            FROM t_p83864310_fintech_payment_reco.webhook_payments wp
            JOIN t_p83864310_fintech_payment_reco.user_integrations ui ON ui.id = wp.integration_id
            JOIN t_p83864310_fintech_payment_reco.integration_providers p ON p.id = ui.provider_id
            {pay_where}
            ORDER BY wp.created_at DESC
            LIMIT %s OFFSET %s
        ''', pay_params + [limit, offset])

        for row in cur.fetchall():
            (pay_id, created_at, p_slug, payment_id, order_id, amount, status,
             raw_data, integration_name, provider_name) = row

            amount_str = f'{float(amount):.2f} ₽' if amount is not None else ''
            summary = f'Платёж #{payment_id} · {status} {amount_str}'.strip()

            events.append({
                'id': f'wp_{pay_id}',
                'source': 'payment',
                'created_at': created_at.isoformat() if created_at else None,
                'provider_slug': p_slug,
                'provider_type': PROVIDER_TYPE_LABELS.get(p_slug, provider_name),
                'integration_name': integration_name,
                'event_type': 'payment_status_changed',
                'status': status,
                'error_message': None,
                'event_number': str(payment_id),
                'summary': summary,
                'raw': raw_data
            })

        # 2. События CRM (Битрикс24, AmoCRM) - сырые входящие вебхуки из inbox.
        crm_where = 'WHERE we.company_id = %s AND we.provider_slug IN (\'bitrix24\', \'amocrm\')'
        crm_params = [company_id]
        if integration_id:
            crm_where += ' AND we.integration_id = %s'
            crm_params.append(integration_id)
        if provider_slug:
            crm_where += ' AND we.provider_slug = %s'
            crm_params.append(provider_slug)

        cur.execute(f'''
            SELECT
                we.id, we.created_at, we.provider_slug, we.event_type, we.status,
                we.error_message, we.raw_payload, ui.integration_name, p.name
            FROM t_p83864310_fintech_payment_reco.webhook_events we
            JOIN t_p83864310_fintech_payment_reco.user_integrations ui ON ui.id = we.integration_id
            JOIN t_p83864310_fintech_payment_reco.integration_providers p ON p.id = ui.provider_id
            {crm_where}
            ORDER BY we.created_at DESC
            LIMIT %s OFFSET %s
        ''', crm_params + [limit, offset])

        for row in cur.fetchall():
            (event_id, created_at, p_slug, event_type, status, error_message,
             raw_payload, integration_name, provider_name) = row

            event_number = None
            if p_slug == 'bitrix24':
                fields = raw_payload.get('data', {}).get('FIELDS', {}) if isinstance(raw_payload.get('data'), dict) else {}
                event_number = fields.get('ID') if isinstance(fields, dict) else None
                summary = f'Сделка #{event_number}' if event_number else 'Событие Битрикс24'
            else:
                leads = raw_payload.get('leads', {})
                if isinstance(leads, dict):
                    for key in ('update', 'add', 'status'):
                        entries = leads.get(key)
                        if isinstance(entries, dict) and entries:
                            first = next(iter(entries.values()))
                            event_number = first.get('id') if isinstance(first, dict) else None
                        elif isinstance(entries, list) and entries:
                            event_number = entries[0].get('id') if isinstance(entries[0], dict) else None
                        if event_number:
                            break
                summary = f'Лид #{event_number}' if event_number else 'Событие AmoCRM'

            events.append({
                'id': f'we_{event_id}',
                'source': 'crm',
                'created_at': created_at.isoformat() if created_at else None,
                'provider_slug': p_slug,
                'provider_type': PROVIDER_TYPE_LABELS.get(p_slug, provider_name),
                'integration_name': integration_name,
                'event_type': event_type,
                'status': status,
                'error_message': error_message,
                'event_number': str(event_number) if event_number else None,
                'summary': summary,
                'raw': raw_payload
            })

        # 3. Операции по расчётному счёту - второй слой обработки (дозагрузка,
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
        ''', bank_params + [limit, offset])

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
                'integration_name': integration_name,
                'event_type': 'bank_transaction',
                'status': 'processed',
                'error_message': None,
                'event_number': external_tx_id,
                'summary': summary,
                'raw': raw_data
            })

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
