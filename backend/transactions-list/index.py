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


def wants(type_filter, t):
    '''type=receipt - алиас "любой чек" (используется дашбордом), остальные значения - точное совпадение.'''
    if not type_filter:
        return True
    if type_filter == t:
        return True
    if type_filter == 'receipt' and t in ('receipt_ofd', 'receipt_kassa'):
        return True
    return False


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Единый реестр готовых для сверки транзакций: объединяет уже насыщенные
    данные из платежей (webhook_payments), чеков кассы (ecomkassa_receipts),
    чеков ОФД (ofd_receipts) и операций по расчётному счёту
    (bank_statement_transactions) в один список.

    Типы транзакций (поле type): payment, receipt_ofd, receipt_kassa, money -
    чеки кассы и ОФД разведены на два разных типа намеренно: это два разных
    физических источника данных об одном и том же чеке (касса пробивает и
    пересылает результат сама, ОФД получает копию от налоговой), и их нужно
    сверять МЕЖДУ СОБОЙ - если касса случайно пробила чек дважды, в чеках
    кассы будет 2 записи, а в ОФД может быть только 1 подтверждённая - без
    разделения типов такую аномалию не увидеть.

    Платёж - особый случай: один и тот же платёж (payment_id/order_id) обычно
    прилетает НЕСКОЛЬКИМИ вебхуками по мере смены статуса (AUTHORIZED ->
    CONFIRMED -> REFUNDED и т.п.), и в БД это разные строки webhook_payments.
    Чтобы не показывать один платёж как N разных "транзакций без пары",
    все вебхуки одного payment_id/order_id схлопываются в ОДНУ транзакцию
    с последним статусом и полем webhook_history (список всех промежуточных
    статусов) - платёж считается связанным, если связь нашлась хотя бы у
    одного из вебхуков в группе.

    Связывание (linked_type/linked_source/linked_id/match_method):
    - платёж -> чек кассы: webhook_payments.receipt_id, а если его нет -
      совпадение order_id/payment_id с order_id/legacy_no/external_id/uuid
      чека кассы.
    - чек кассы <-> чек ОФД: по триплету фискальных реквизитов ФН+ФД+ФПД -
      однозначно идентифицирует физический фискальный документ независимо
      от того, каким API он был получен.
    - деньги на р/с намеренно НЕ связываются автоматически - в банковской
      выписке нет номера заказа, только сумма/дата/назначение платежа,
      слишком велик риск ложных совпадений.
    Args: company_id (обязателен), type (payment/receipt_ofd/receipt_kassa/
    money/receipt-алиас, опционально), limit, offset (опционально)
    Returns: transactions[] с полями type, source, id, occurred_at, amount,
    status, title, subtitle, integration_name, reference, raw_data,
    linked_type, linked_source, linked_id, match_method,
    webhook_history (только для payment с несколькими вебхуками)
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

        if wants(type_filter, 'payment'):
            parts.append(f'''
                SELECT
                    'payment' AS type,
                    p.slug AS source,
                    wp.id AS id,
                    wp.created_at AS occurred_at,
                    wp.amount AS amount,
                    wp.status AS status,
                    ('Платёж #' || wp.payment_id) AS title,
                    COALESCE(wp.payment_provider, p.name) AS subtitle,
                    ui.integration_name AS integration_name,
                    wp.order_id AS reference,
                    wp.raw_data AS raw_data,
                    CASE WHEN COALESCE(wp.receipt_id, km.id) IS NOT NULL THEN 'receipt_kassa' END AS linked_type,
                    CASE WHEN COALESCE(wp.receipt_id, km.id) IS NOT NULL THEN 'ecomkassa' END AS linked_source,
                    COALESCE(wp.receipt_id, km.id) AS linked_id,
                    CASE
                        WHEN wp.receipt_id IS NOT NULL THEN 'receipt_id'
                        WHEN km.id IS NOT NULL THEN 'order_id'
                    END AS match_method,
                    COALESCE(wp.order_id, wp.payment_id) AS group_key
                FROM {SCHEMA}.webhook_payments wp
                JOIN {SCHEMA}.user_integrations ui ON ui.id = wp.integration_id
                JOIN {SCHEMA}.integration_providers p ON p.id = ui.provider_id
                LEFT JOIN LATERAL (
                    SELECT ekr.id
                    FROM {SCHEMA}.ecomkassa_receipts ekr
                    WHERE ekr.company_id = wp.company_id
                      AND wp.receipt_id IS NULL
                      AND (
                        ekr.order_id = wp.order_id OR ekr.order_id = wp.payment_id OR
                        ekr.legacy_no = wp.order_id OR ekr.legacy_no = wp.payment_id OR
                        ekr.raw_data->>'external_id' = wp.order_id OR
                        ekr.raw_data->>'external_id' = wp.payment_id OR
                        ekr.raw_data->>'uuid' = wp.order_id OR
                        ekr.raw_data->>'uuid' = wp.payment_id
                      )
                    LIMIT 1
                ) km ON true
                WHERE wp.company_id = %(company_id)s AND ui.status != 'deleted'
            ''')

        if wants(type_filter, 'receipt_ofd'):
            parts.append(f'''
                SELECT
                    'receipt_ofd' AS type,
                    'ofd' AS source,
                    ofd.id AS id,
                    ofd.doc_datetime AS occurred_at,
                    ofd.total_sum AS amount,
                    ofd.operation_type AS status,
                    ('Чек ОФД №' || COALESCE(ofd.doc_number, ofd.receipt_id)) AS title,
                    'ОФД' AS subtitle,
                    ui.integration_name AS integration_name,
                    ofd.receipt_id AS reference,
                    ofd.raw_data AS raw_data,
                    CASE WHEN km.id IS NOT NULL THEN 'receipt_kassa' END AS linked_type,
                    CASE WHEN km.id IS NOT NULL THEN 'ecomkassa' END AS linked_source,
                    km.id AS linked_id,
                    CASE WHEN km.id IS NOT NULL THEN 'fiscal_triplet' END AS match_method,
                    NULL::text AS group_key
                FROM {SCHEMA}.ofd_receipts ofd
                JOIN {SCHEMA}.user_integrations ui ON ui.id = ofd.integration_id
                LEFT JOIN LATERAL (
                    SELECT ekr.id
                    FROM {SCHEMA}.ecomkassa_receipts ekr
                    WHERE ekr.company_id = ofd.company_id
                      AND ofd.fn_number IS NOT NULL
                      AND ofd.doc_number IS NOT NULL
                      AND (ofd.raw_data->>'DecimalFiscalSign') IS NOT NULL
                      AND (ekr.raw_data->'payload'->>'fn_number') = ofd.fn_number
                      AND (ekr.raw_data->'payload'->>'fiscal_document_number') = ofd.doc_number
                      AND (ekr.raw_data->'payload'->>'fiscal_document_attribute') = (ofd.raw_data->>'DecimalFiscalSign')
                    LIMIT 1
                ) km ON true
                WHERE ofd.company_id = %(company_id)s
            ''')

        if wants(type_filter, 'receipt_kassa'):
            parts.append(f'''
                SELECT
                    'receipt_kassa' AS type,
                    'ecomkassa' AS source,
                    ekr.id AS id,
                    ekr.doc_datetime AS occurred_at,
                    ekr.total_sum AS amount,
                    ekr.status AS status,
                    ('Чек кассы №' || COALESCE(ekr.doc_number, ekr.order_id, ekr.id::text)) AS title,
                    COALESCE(ekr.payment_provider, 'Касса') AS subtitle,
                    ui.integration_name AS integration_name,
                    ekr.order_id AS reference,
                    ekr.raw_data AS raw_data,
                    CASE WHEN om.id IS NOT NULL THEN 'receipt_ofd' END AS linked_type,
                    CASE WHEN om.id IS NOT NULL THEN 'ofd' END AS linked_source,
                    om.id AS linked_id,
                    CASE WHEN om.id IS NOT NULL THEN 'fiscal_triplet' END AS match_method,
                    NULL::text AS group_key
                FROM {SCHEMA}.ecomkassa_receipts ekr
                JOIN {SCHEMA}.user_integrations ui ON ui.id = ekr.integration_id
                LEFT JOIN LATERAL (
                    SELECT ofd.id
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
                WHERE ekr.company_id = %(company_id)s
            ''')

        if wants(type_filter, 'money'):
            parts.append(f'''
                SELECT
                    'money' AS type,
                    bst.provider_slug AS source,
                    bst.id AS id,
                    bst.operation_date AS occurred_at,
                    bst.amount AS amount,
                    bst.direction AS status,
                    COALESCE(bst.counterparty_name, 'Операция по счёту') AS title,
                    COALESCE(bst.purpose, '') AS subtitle,
                    ui.integration_name AS integration_name,
                    bst.external_transaction_id AS reference,
                    bst.raw_data AS raw_data,
                    NULL::text AS linked_type,
                    NULL::text AS linked_source,
                    NULL::integer AS linked_id,
                    NULL::text AS match_method,
                    NULL::text AS group_key
                FROM {SCHEMA}.bank_statement_transactions bst
                JOIN {SCHEMA}.user_integrations ui ON ui.id = bst.integration_id
                WHERE bst.company_id = %(company_id)s
            ''')

        if not parts:
            return {
                'statusCode': 200,
                'headers': {**CORS_HEADERS, 'Content-Type': 'application/json'},
                'body': json.dumps({'success': True, 'transactions': [], 'totals_by_type': {}, 'limit': limit, 'offset': offset}),
                'isBase64Encoded': False
            }

        # LIMIT/OFFSET намеренно не применяется в SQL: платежи с одним и тем же
        # номером схлопываются в одну транзакцию уже в Python (ниже), а обрезать
        # строки до этого схлопывания means could split одну группу пополам
        # между страницами. При типичных объёмах теста/демо это не проблема -
        # компания вряд ли накопит десятки тысяч транзакций.
        union_query = ' UNION ALL '.join(parts)
        full_query = f'''
            WITH all_tx AS ({union_query})
            SELECT * FROM all_tx
            ORDER BY occurred_at DESC NULLS LAST
        '''

        cur.execute(full_query, {'company_id': company_id})
        rows = cur.fetchall()
        columns = [desc[0] for desc in cur.description]

        # Схлопывание вебхуков одного платежа (payment_id/order_id) в одну
        # транзакцию. Строки уже отсортированы occurred_at DESC на уровне SQL,
        # поэтому первая встреченная строка группы - самая свежая (её статус,
        # сумма и raw_data берём как представление всей группы), а остальные
        # уходят в webhook_history. Порядок появления групп в final_rows
        # совпадает с глобальным порядком occurred_at DESC - пересортировка
        # после схлопывания не нужна.
        payment_groups: Dict[Any, Dict[str, Any]] = {}
        final_rows = []

        for row in rows:
            tx = {}
            for col, val in zip(columns, row):
                tx[col] = to_json_value(val)

            group_key = tx.pop('group_key', None)

            if tx['type'] == 'payment':
                gkey = (tx['source'], group_key or f"id:{tx['id']}")
                group = payment_groups.get(gkey)
                if group is None:
                    group = tx
                    group['webhook_history'] = [{'status': tx['status'], 'occurred_at': tx['occurred_at']}]
                    payment_groups[gkey] = group
                    final_rows.append(group)
                else:
                    group['webhook_history'].append({'status': tx['status'], 'occurred_at': tx['occurred_at']})
                    if tx.get('linked_id') and not group.get('linked_id'):
                        group['linked_type'] = tx['linked_type']
                        group['linked_source'] = tx['linked_source']
                        group['linked_id'] = tx['linked_id']
                        group['match_method'] = tx['match_method']
            else:
                final_rows.append(tx)

        for group in payment_groups.values():
            group['webhook_history'].reverse()
            if len(group['webhook_history']) <= 1:
                del group['webhook_history']

        totals_by_type: Dict[str, Dict[str, Any]] = {}
        for row in final_rows:
            t = row['type']
            bucket = totals_by_type.setdefault(t, {'count': 0, 'amount': 0.0, 'matched_count': 0})
            bucket['count'] += 1
            bucket['amount'] += float(row['amount'] or 0)
            if row.get('linked_id'):
                bucket['matched_count'] += 1

        paginated = final_rows[offset:offset + limit]

        return {
            'statusCode': 200,
            'headers': {**CORS_HEADERS, 'Content-Type': 'application/json'},
            'body': json.dumps({
                'success': True,
                'transactions': paginated,
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
