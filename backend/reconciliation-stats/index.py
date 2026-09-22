import json
import os
import psycopg2
from typing import Dict, Any
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


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Сверка трёх точек контроля выручки компании за выбранный период:
    1) платежи, пришедшие вебхуками из интеграций эквайринга (webhook_payments,
       провайдеры категории "payments") - берём последний статус по каждому
       payment_id и считаем успешным AUTHORIZED/CONFIRMED;
    2) чеки из кассы (ecomkassa_receipts) и ОФД (ofd_receipts) с типом Income;
    3) реальные деньги, поступившие на расчётный счёт (bank_statement_transactions,
       направление in) - эти операции уже отфильтрованы по ключевым словам на
       этапе синхронизации выписки. Так как банк может выплачивать сумму за
       вычетом комиссии эквайринга, к каждой операции прибавляется известная
       комиссия (commission_amount, заполняется когда появится загрузка реестра
       платежей терминала - пока для всех операций NULL, то есть 0).
    Результат сохраняется снапшотом в reconciliation_snapshots (upsert по
    company_id+period), чтобы не пересчитывать и в будущем показать детализацию.
    День "сегодня" в расчёт не берётся - сверяем только полностью закрытые дни,
    поэтому period_to не может быть позже вчера.
    Args: company_id (обязателен), date_from, date_to (YYYY-MM-DD, опционально)
    Returns: totals по трём точкам, daily[] для графика, details для будущей детализации
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
        # 1. Платежи: последний статус по каждому payment_id, считаем успешным
        # AUTHORIZED/CONFIRMED. Дата платежа - первое появление вебхука (когда
        # платёж был создан), а не дата последнего обновления статуса.
        cur.execute(f'''
            WITH latest AS (
                SELECT
                    wp.integration_id,
                    wp.payment_id,
                    MAX(wp.amount) AS amount,
                    MIN(wp.created_at)::date AS payment_date,
                    (array_agg(wp.status ORDER BY wp.created_at DESC))[1] AS latest_status
                FROM {SCHEMA}.webhook_payments wp
                JOIN {SCHEMA}.user_integrations ui ON ui.id = wp.integration_id
                JOIN {SCHEMA}.integration_providers p ON p.id = ui.provider_id
                JOIN {SCHEMA}.integration_categories c ON c.id = p.category_id
                WHERE wp.company_id = %s AND c.slug = 'payments'
                GROUP BY wp.integration_id, wp.payment_id
            )
            SELECT payment_date, latest_status, amount
            FROM latest
            WHERE payment_date BETWEEN %s AND %s
        ''', (company_id, date_from, date_to))

        payments_rows = cur.fetchall()
        payments_total = 0.0
        payments_count = 0
        payments_by_status: Dict[str, int] = {}
        daily_payments: Dict[str, float] = {}

        for payment_date, latest_status, amount in payments_rows:
            payments_by_status[latest_status] = payments_by_status.get(latest_status, 0) + 1
            if latest_status in ('AUTHORIZED', 'CONFIRMED'):
                amount_f = float(amount) if amount else 0.0
                payments_total += amount_f
                payments_count += 1
                day_key = payment_date.isoformat()
                daily_payments[day_key] = daily_payments.get(day_key, 0.0) + amount_f

        # 2. Чеки: касса (ecomkassa_receipts) + ОФД (ofd_receipts), только приход.
        cur.execute(f'''
            SELECT doc_datetime::date AS receipt_date, total_sum
            FROM {SCHEMA}.ecomkassa_receipts
            WHERE company_id = %s
              AND status IS DISTINCT FROM 'cancelled'
              AND doc_datetime::date BETWEEN %s AND %s
            UNION ALL
            SELECT doc_datetime::date AS receipt_date, total_sum
            FROM {SCHEMA}.ofd_receipts
            WHERE company_id = %s
              AND operation_type = 'Income'
              AND doc_datetime::date BETWEEN %s AND %s
        ''', (company_id, date_from, date_to, company_id, date_from, date_to))

        receipts_rows = cur.fetchall()
        receipts_total = 0.0
        receipts_count = 0
        daily_receipts: Dict[str, float] = {}

        for receipt_date, total_sum in receipts_rows:
            amount_f = float(total_sum) if total_sum else 0.0
            receipts_total += amount_f
            receipts_count += 1
            if receipt_date:
                day_key = receipt_date.isoformat()
                daily_receipts[day_key] = daily_receipts.get(day_key, 0.0) + amount_f

        # 3. Деньги на р/с: только поступления (direction = in). Операции уже
        # отфильтрованы по ключевым словам назначения платежа на этапе
        # синхронизации выписки (bank-statement-sync). Комиссия эквайринга,
        # удержанная банком при выплате, прибавляется обратно, если она известна
        # (появится, когда будет реализована загрузка реестра платежей терминала -
        # тогда commission_amount будет заполняться по каждой операции).
        cur.execute(f'''
            SELECT
                bst.operation_date::date AS op_date,
                bst.amount,
                COALESCE(bst.commission_amount, 0) AS commission_amount,
                bst.commission_source
            FROM {SCHEMA}.bank_statement_transactions bst
            JOIN {SCHEMA}.user_integrations ui ON ui.id = bst.integration_id
            JOIN {SCHEMA}.integration_providers p ON p.id = ui.provider_id
            JOIN {SCHEMA}.integration_categories c ON c.id = p.category_id
            WHERE bst.company_id = %s AND c.slug = 'banks' AND bst.direction = 'in'
              AND bst.operation_date::date BETWEEN %s AND %s
        ''', (company_id, date_from, date_to))

        bank_rows = cur.fetchall()
        bank_raw_total = 0.0
        bank_commission_total = 0.0
        bank_count = 0
        bank_with_known_commission = 0
        daily_bank: Dict[str, float] = {}

        for op_date, amount, commission_amount, commission_source in bank_rows:
            amount_f = float(amount) if amount else 0.0
            commission_f = float(commission_amount) if commission_amount else 0.0
            bank_raw_total += amount_f
            bank_commission_total += commission_f
            bank_count += 1
            if commission_source == 'registry':
                bank_with_known_commission += 1
            if op_date:
                day_key = op_date.isoformat()
                daily_bank[day_key] = daily_bank.get(day_key, 0.0) + amount_f + commission_f

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

        details = {
            'payments_by_status': payments_by_status,
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
