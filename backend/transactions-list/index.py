import json
import os

import psycopg2
from typing import Dict, Any
from decimal import Decimal

SCHEMA = 't_p83864310_fintech_payment_reco'

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
}


def to_json_value(val):
    if isinstance(val, Decimal):
        return float(val)
    if hasattr(val, 'isoformat'):
        return val.isoformat()
    return val


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Единый реестр готовых для сверки транзакций: объединяет уже насыщенные
    данные из платежей (webhook_payments), чеков кассы (ecomkassa_receipts),
    чеков ОФД (ofd_receipts) и операций по расчётному счёту
    (bank_statement_transactions) в один список с меткой type (payment/
    receipt/money). Каждая исходная запись - это одна транзакция, без
    склейки нескольких записей по событию.
    Args: company_id (обязателен), type (payment/receipt/money, опционально),
    limit, offset (опционально)
    Returns: transactions[] с общими полями type, id, occurred_at, amount,
    status, title, subtitle, source, raw
    '''

    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': '', 'isBase64Encoded': False}

    if method != 'GET':
        return {
            'statusCode': 405,
            'headers': {**CORS_HEADERS, 'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Method not allowed'}),
            'isBase64Encoded': False
        }

    params = event.get('queryStringParameters', {}) or {}
    company_id = params.get('company_id')
    type_filter = params.get('type')
    limit = int(params.get('limit', 100))
    offset = int(params.get('offset', 0))

    if not company_id:
        return {
            'statusCode': 400,
            'headers': {**CORS_HEADERS, 'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'company_id required'}),
            'isBase64Encoded': False
        }

    dsn = os.environ['DATABASE_URL']
    conn = psycopg2.connect(dsn)
    cur = conn.cursor()

    try:
        parts = []

        if not type_filter or type_filter == 'payment':
            parts.append(f'''
                SELECT
                    'payment' AS type,
                    wp.id AS id,
                    wp.created_at AS occurred_at,
                    wp.amount AS amount,
                    wp.status AS status,
                    ('Платёж #' || wp.payment_id) AS title,
                    COALESCE(wp.payment_provider, p.name) AS subtitle,
                    ui.integration_name AS integration_name,
                    wp.order_id AS reference,
                    wp.receipt_id AS receipt_id,
                    wp.raw_data AS raw_data
                FROM {SCHEMA}.webhook_payments wp
                JOIN {SCHEMA}.user_integrations ui ON ui.id = wp.integration_id
                JOIN {SCHEMA}.integration_providers p ON p.id = ui.provider_id
                WHERE wp.company_id = %(company_id)s AND ui.status != 'deleted'
            ''')

        if not type_filter or type_filter == 'receipt':
            parts.append(f'''
                SELECT
                    'receipt' AS type,
                    ofd.id AS id,
                    ofd.doc_datetime AS occurred_at,
                    ofd.total_sum AS amount,
                    ofd.operation_type AS status,
                    ('Чек ОФД №' || COALESCE(ofd.doc_number, ofd.receipt_id)) AS title,
                    'ОФД' AS subtitle,
                    ui.integration_name AS integration_name,
                    ofd.receipt_id AS reference,
                    NULL::integer AS receipt_id,
                    ofd.raw_data AS raw_data
                FROM {SCHEMA}.ofd_receipts ofd
                JOIN {SCHEMA}.user_integrations ui ON ui.id = ofd.integration_id
                WHERE ofd.company_id = %(company_id)s
            ''')
            parts.append(f'''
                SELECT
                    'receipt' AS type,
                    ekr.id AS id,
                    ekr.doc_datetime AS occurred_at,
                    ekr.total_sum AS amount,
                    ekr.status AS status,
                    ('Чек кассы №' || COALESCE(ekr.doc_number, ekr.order_id, ekr.id::text)) AS title,
                    COALESCE(ekr.payment_provider, 'Касса') AS subtitle,
                    ui.integration_name AS integration_name,
                    ekr.order_id AS reference,
                    NULL::integer AS receipt_id,
                    ekr.raw_data AS raw_data
                FROM {SCHEMA}.ecomkassa_receipts ekr
                JOIN {SCHEMA}.user_integrations ui ON ui.id = ekr.integration_id
                WHERE ekr.company_id = %(company_id)s
            ''')

        if not type_filter or type_filter == 'money':
            parts.append(f'''
                SELECT
                    'money' AS type,
                    bst.id AS id,
                    bst.operation_date AS occurred_at,
                    bst.amount AS amount,
                    bst.direction AS status,
                    COALESCE(bst.counterparty_name, 'Операция по счёту') AS title,
                    COALESCE(bst.purpose, '') AS subtitle,
                    ui.integration_name AS integration_name,
                    bst.external_transaction_id AS reference,
                    NULL::integer AS receipt_id,
                    bst.raw_data AS raw_data
                FROM {SCHEMA}.bank_statement_transactions bst
                JOIN {SCHEMA}.user_integrations ui ON ui.id = bst.integration_id
                WHERE bst.company_id = %(company_id)s
            ''')

        union_query = ' UNION ALL '.join(parts)
        full_query = f'''
            WITH all_tx AS ({union_query})
            SELECT * FROM all_tx
            ORDER BY occurred_at DESC NULLS LAST
            LIMIT %(limit)s OFFSET %(offset)s
        '''

        cur.execute(full_query, {'company_id': company_id, 'limit': limit, 'offset': offset})
        rows = cur.fetchall()
        columns = [desc[0] for desc in cur.description]

        transactions = []
        for row in rows:
            tx = {}
            for col, val in zip(columns, row):
                tx[col] = to_json_value(val)
            transactions.append(tx)

        count_query = f'''
            WITH all_tx AS ({union_query})
            SELECT type, COUNT(*), COALESCE(SUM(amount), 0) FROM all_tx GROUP BY type
        '''
        cur.execute(count_query, {'company_id': company_id, 'limit': limit, 'offset': offset})
        totals_by_type = {}
        for t_type, cnt, total in cur.fetchall():
            totals_by_type[t_type] = {'count': cnt, 'amount': float(total)}

        return {
            'statusCode': 200,
            'headers': {**CORS_HEADERS, 'Content-Type': 'application/json'},
            'body': json.dumps({
                'success': True,
                'transactions': transactions,
                'totals_by_type': totals_by_type,
                'limit': limit,
                'offset': offset
            }),
            'isBase64Encoded': False
        }

    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {**CORS_HEADERS, 'Content-Type': 'application/json'},
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }
    finally:
        cur.close()
        conn.close()