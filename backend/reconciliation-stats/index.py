import json
import os
import psycopg2
from typing import Dict, Any, Optional
from datetime import datetime, date, timedelta

SCHEMA = 't_p83864310_fintech_payment_reco'

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
}


def parse_date(value: str, fallback: date) -> date:
    if not value:
        return fallback
    try:
        return datetime.strptime(value, '%Y-%m-%d').date()
    except ValueError:
        return fallback


def classify_receipt_sign(operation_type: Optional[str]) -> int:
    '''
    Знак вклада фискального документа в выручку по его типу операции (54-ФЗ) -
    та же классификация, что в transactions-list/compute_signed_amount, чтобы
    раздел "Сверка" и раздел "Транзакции" показывали одинаковые нетто-суммы.
    Income/приход = +, Refund income/возврат прихода = -, Expense/расход = -,
    Refund expense/возврат расхода = +. Неизвестный тип по умолчанию = приход.
    '''
    if not operation_type:
        return 1
    t = operation_type.strip().lower()
    is_refund = 'возврат' in t or 'refund' in t
    is_expense = 'расход' in t or 'expense' in t
    if is_refund and is_expense:
        return 1
    if is_refund:
        return -1
    if is_expense:
        return -1
    return 1


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Сверка трёх точек контроля выручки компании за выбранный период:
    1) платежи, пришедшие вебхуками из интеграций эквайринга (webhook_payments,
       провайдеры категории "payments") - берём последний статус по каждому
       payment_id. Количество (payments_count) считается по числу платёжных
       документов вне зависимости от статуса, а сумма - НЕТТО: платёж вносит
       вклад только пока он реально "жив" деньгами (AUTHORIZED/CONFIRMED),
       возврат (REFUNDED) или отмена дают 0 - деньги пришли и ушли обратно,
       либо вообще не двигались.
    2) чеки из кассы (ecomkassa_receipts) и ОФД (ofd_receipts) - количество
       считается по числу документов, сумма - НЕТТО с учётом знака операции
       (Income/+, Refund income/-, по 54-ФЗ). У чека кассы нет собственного
       поля типа операции - знак берётся из связанного чека ОФД (по триплету
       фискальных реквизитов ФН+ФД+ФПД), если пара найдена; без пары считается
       продажей (+), как и в разделе "Транзакции".
    3) реальные деньги, поступившие и списанные с расчётного счёта
       (bank_statement_transactions) - эти операции уже отфильтрованы по
       ключевым словам назначения платежа на этапе синхронизации выписки
       (это все "наши" операции терминала/счёта). Количество считается по
       числу операций, сумма - НЕТТО: direction='in' даёт +amount (плюс
       известная комиссия эквайринга, если появится), 'out' (например,
       возврат клиенту со счёта) вычитается.
    Результат сохраняется снапшотом в reconciliation_snapshots (upsert по
    company_id+period), чтобы не пересчитывать и в будущем показать детализацию.
    День "сегодня" в расчёт не берётся - сверяем только полностью закрытые дни,
    поэтому period_to не может быть позже вчера.
    Args: company_id (обязателен), date_from, date_to (YYYY-MM-DD, опционально)
    Returns: totals по трём точкам (НЕТТО-суммы, count - число документов),
    daily[] для графика, details для детализации
    '''

    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': '', 'isBase64Encoded': False}

    if method != 'GET':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'}),
            'isBase64Encoded': False
        }

    params = event.get('queryStringParameters', {}) or {}
    company_id = params.get('company_id')

    if not company_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'company_id required'}),
            'isBase64Encoded': False
        }

    yesterday = date.today() - timedelta(days=1)
    date_from = parse_date(params.get('date_from'), yesterday - timedelta(days=6))
    date_to = parse_date(params.get('date_to'), yesterday)

    # "Сегодня" в сверку никогда не попадает - сверяем только полностью
    # закрытые дни, за которые уже могли прийти и чек, и банковская выписка.
    if date_to > yesterday:
        date_to = yesterday
    if date_from > date_to:
        date_from = date_to

    dsn = os.environ['DATABASE_URL']
    conn = psycopg2.connect(dsn)
    cur = conn.cursor()

    try:
        # 1. Платежи: последний статус по каждому payment_id. Дата платежа -
        # первое появление вебхука (когда платёж был создан), а не дата
        # последнего обновления статуса.
        cur.execute(f'''
            WITH latest AS (
                SELECT
                    wp.integration_id,
                    wp.payment_id,
                    MAX(wp.amount) AS amount,
                    MIN(wp.created_at)::date AS payment_date,
                    (array_agg(wp.status ORDER BY wp.created_at DESC))[1] AS latest_status,
                    (array_agg(wp.payment_provider ORDER BY wp.created_at DESC))[1] AS payment_provider
                FROM {SCHEMA}.webhook_payments wp
                JOIN {SCHEMA}.user_integrations ui ON ui.id = wp.integration_id
                JOIN {SCHEMA}.integration_providers p ON p.id = ui.provider_id
                JOIN {SCHEMA}.integration_categories c ON c.id = p.category_id
                WHERE wp.company_id = %s AND c.slug = 'payments'
                GROUP BY wp.integration_id, wp.payment_id
            )
            SELECT payment_date, latest_status, amount, payment_provider
            FROM latest
            WHERE payment_date BETWEEN %s AND %s
        ''', (company_id, date_from, date_to))

        payments_rows = cur.fetchall()
        payments_total = 0.0
        payments_count = 0
        payments_by_status: Dict[str, int] = {}
        daily_payments: Dict[str, float] = {}
        # Детализация по видам оплат внутри шлюза Екомкассы (ЮKassa, СБП и т.п.) -
        # только по успешным платежам, у одной кассы их может быть больше 10.
        payments_by_provider: Dict[str, Dict[str, float]] = {}

        for payment_date, latest_status, amount, payment_provider in payments_rows:
            payments_by_status[latest_status] = payments_by_status.get(latest_status, 0) + 1
            # Количество - по числу документов вне зависимости от статуса
            # (возврат тоже был платежом и должен быть виден в счётчике).
            payments_count += 1

            amount_f = float(amount) if amount else 0.0
            # Сумма - нетто: вклад в выручку только у реально подтверждённых
            # денег, возврат/отмена дают 0 (деньги не задержались на счету).
            contribution = amount_f if latest_status in ('AUTHORIZED', 'CONFIRMED') else 0.0
            payments_total += contribution

            day_key = payment_date.isoformat()
            daily_payments[day_key] = daily_payments.get(day_key, 0.0) + contribution

            if latest_status in ('AUTHORIZED', 'CONFIRMED'):
                provider_key = payment_provider or 'Без указания провайдера'
                if provider_key not in payments_by_provider:
                    payments_by_provider[provider_key] = {'amount': 0.0, 'count': 0}
                payments_by_provider[provider_key]['amount'] += amount_f
                payments_by_provider[provider_key]['count'] += 1

        # 2. Чеки: касса (ecomkassa_receipts) + ОФД (ofd_receipts). Знак чека
        # кассы берётся из связанного чека ОФД (тот же fiscal_triplet матчинг,
        # что и в transactions-list), без пары - считается продажей.
        cur.execute(f'''
            SELECT
                ekr.doc_datetime::date AS receipt_date,
                ekr.total_sum,
                om.operation_type AS linked_ofd_status
            FROM {SCHEMA}.ecomkassa_receipts ekr
            LEFT JOIN LATERAL (
                SELECT ofd.operation_type
                FROM {SCHEMA}.ofd_receipts ofd
                WHERE ofd.company_id = ekr.company_id
                  AND (ekr.raw_data->'payload'->>'fn_number') IS NOT NULL
                  AND (ekr.raw_data->'payload'->>'fiscal_document_number') IS NOT NULL
                  AND (ekr.raw_data->'payload'->>'fiscal_document_attribute') IS NOT NULL
                  AND ofd.fn_number = (ekr.raw_data->'payload'->>'fn_number')
                  AND ofd.doc_number = (ekr.raw_data->'payload'->>'fiscal_document_number')
                  AND (ofd.raw_data->>'DecimalFiscalSign') = (ekr.raw_data->'payload'->>'fiscal_document_attribute')
                LIMIT 1
            ) om ON true
            WHERE ekr.company_id = %s
              AND ekr.status IS DISTINCT FROM 'cancelled'
              AND ekr.doc_datetime::date BETWEEN %s AND %s
            UNION ALL
            SELECT
                ofd.doc_datetime::date AS receipt_date,
                ofd.total_sum,
                ofd.operation_type AS linked_ofd_status
            FROM {SCHEMA}.ofd_receipts ofd
            WHERE ofd.company_id = %s
              AND ofd.doc_datetime::date BETWEEN %s AND %s
        ''', (company_id, date_from, date_to, company_id, date_from, date_to))

        receipts_rows = cur.fetchall()
        receipts_total = 0.0
        receipts_count = 0
        daily_receipts: Dict[str, float] = {}

        for receipt_date, total_sum, linked_ofd_status in receipts_rows:
            amount_f = float(total_sum) if total_sum else 0.0
            signed = amount_f * classify_receipt_sign(linked_ofd_status)
            receipts_total += signed
            receipts_count += 1
            if receipt_date:
                day_key = receipt_date.isoformat()
                daily_receipts[day_key] = daily_receipts.get(day_key, 0.0) + signed

        # 3. Деньги на р/с: обе стороны (in/out) - выписка уже отфильтрована по
        # ключевым словам назначения платежа на этапе синхронизации (это все
        # "наши" операции терминала/счёта). in = +amount (плюс известная
        # комиссия эквайринга, если появится), out = -amount (например,
        # возврат клиенту прямо со счёта).
        cur.execute(f'''
            SELECT
                bst.operation_date::date AS op_date,
                bst.amount,
                bst.direction,
                COALESCE(bst.commission_amount, 0) AS commission_amount,
                bst.commission_source
            FROM {SCHEMA}.bank_statement_transactions bst
            JOIN {SCHEMA}.user_integrations ui ON ui.id = bst.integration_id
            JOIN {SCHEMA}.integration_providers p ON p.id = ui.provider_id
            JOIN {SCHEMA}.integration_categories c ON c.id = p.category_id
            WHERE bst.company_id = %s AND c.slug = 'banks'
              AND bst.operation_date::date BETWEEN %s AND %s
        ''', (company_id, date_from, date_to))

        bank_rows = cur.fetchall()
        bank_raw_total = 0.0
        bank_commission_total = 0.0
        bank_count = 0
        bank_with_known_commission = 0
        daily_bank: Dict[str, float] = {}

        for op_date, amount, direction, commission_amount, commission_source in bank_rows:
            amount_f = float(amount) if amount else 0.0
            is_in = direction == 'in'
            signed_amount = amount_f if is_in else -amount_f
            # Комиссия учитывается только для поступлений - это удержание
            # эквайринга при выплате, к списаниям (возвратам) отношения не имеет.
            commission_f = float(commission_amount) if (commission_amount and is_in) else 0.0

            bank_raw_total += signed_amount
            bank_commission_total += commission_f
            bank_count += 1
            if commission_source == 'registry':
                bank_with_known_commission += 1
            if op_date:
                day_key = op_date.isoformat()
                daily_bank[day_key] = daily_bank.get(day_key, 0.0) + signed_amount + commission_f

        bank_total = bank_raw_total + bank_commission_total

        # Единая ось дат для графика - каждый день периода, даже если по нему
        # нет данных ни по одной из трёх точек (столбец останется нулевым).
        daily = []
        cursor_date = date_from
        while cursor_date <= date_to:
            day_key = cursor_date.isoformat()
            daily.append({
                'date': day_key,
                'payments': round(daily_payments.get(day_key, 0.0), 2),
                'receipts': round(daily_receipts.get(day_key, 0.0), 2),
                'bank': round(daily_bank.get(day_key, 0.0), 2)
            })
            cursor_date += timedelta(days=1)

        payments_by_provider_rounded = {
            provider: {'amount': round(data['amount'], 2), 'count': data['count']}
            for provider, data in payments_by_provider.items()
        }

        details = {
            'payments_by_status': payments_by_status,
            'payments_by_provider': payments_by_provider_rounded,
            'bank_transactions_total': bank_count,
            'bank_transactions_with_registry_commission': bank_with_known_commission,
            'bank_commission_note': (
                'Комиссия эквайринга неизвестна ни по одной операции - суммы банка '
                'взяты как есть из выписки. Точная сверка станет доступна после '
                'подключения реестра платежей терминала эквайринга.'
                if bank_with_known_commission == 0 and bank_count > 0 else None
            )
        }

        payments_total = round(payments_total, 2)
        receipts_total = round(receipts_total, 2)
        bank_raw_total = round(bank_raw_total, 2)
        bank_commission_total = round(bank_commission_total, 2)
        bank_total = round(bank_total, 2)

        cur.execute(f'''
            INSERT INTO {SCHEMA}.reconciliation_snapshots (
                company_id, period_from, period_to,
                payments_total, payments_count,
                receipts_total, receipts_count,
                bank_raw_total, bank_commission_total, bank_total, bank_count,
                details, calculated_at
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
            ON CONFLICT (company_id, period_from, period_to) DO UPDATE SET
                payments_total = EXCLUDED.payments_total,
                payments_count = EXCLUDED.payments_count,
                receipts_total = EXCLUDED.receipts_total,
                receipts_count = EXCLUDED.receipts_count,
                bank_raw_total = EXCLUDED.bank_raw_total,
                bank_commission_total = EXCLUDED.bank_commission_total,
                bank_total = EXCLUDED.bank_total,
                bank_count = EXCLUDED.bank_count,
                details = EXCLUDED.details,
                calculated_at = NOW()
        ''', (
            company_id, date_from, date_to,
            payments_total, payments_count,
            receipts_total, receipts_count,
            bank_raw_total, bank_commission_total, bank_total, bank_count,
            json.dumps(details)
        ))
        conn.commit()

        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'success': True,
                'period': {'date_from': date_from.isoformat(), 'date_to': date_to.isoformat()},
                'totals': {
                    'payments': {'amount': payments_total, 'count': payments_count},
                    'receipts': {'amount': receipts_total, 'count': receipts_count},
                    'bank': {
                        'amount': bank_total,
                        'raw_amount': bank_raw_total,
                        'commission_amount': bank_commission_total,
                        'count': bank_count
                    }
                },
                'daily': daily,
                'details': details
            }),
            'isBase64Encoded': False
        }

    except Exception as e:
        conn.rollback()
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }
    finally:
        cur.close()
        conn.close()
