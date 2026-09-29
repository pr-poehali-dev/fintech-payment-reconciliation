import json
import os

import psycopg2
from typing import Dict, Any, Optional
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
    '''type=receipt - алиас "любой чек/заказ" (используется дашбордом), остальные значения - точное совпадение.'''
    if not type_filter:
        return True
    if type_filter == t:
        return True
    if type_filter == 'receipt' and t in ('receipt_ofd', 'receipt_kassa', 'receipt_order'):
        return True
    return False


def classify_receipt_sign(operation_type: Optional[str]) -> int:
    '''
    Знак вклада фискального документа в выручку по его типу операции (54-ФЗ):
    Income/приход - продажа, +; Refund Income/возврат прихода - деньги отданы
    обратно клиенту, -; Expense/расход - вы платите (напр. приём у физлица), -;
    Refund Expense/возврат расхода - деньги вернулись вам, +. Неизвестный тип,
    который явно начинается с "возврат"/"refund" - считаем отрицательным на
    всякий случай, иначе по умолчанию считаем приходом (+).
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


def compute_signed_amount(row: Dict[str, Any]) -> float:
    '''
    Сумма транзакции с учётом знака - именно она используется в суммах для
    сверки (в отличие от row['amount'], который всегда хранит абсолютную
    величину документа как есть).
    - payment: платёж вносит вклад только пока он реально "жив" деньгами -
      AUTHORIZED/CONFIRMED (последний статус группы вебхуков) = +amount;
      REFUNDED - деньги пришли и ушли обратно, чистый эффект 0; CANCELED/
      REJECTED - деньги вообще не двигались, тоже 0.
    - receipt_ofd: знак по operation_type самого документа (54-ФЗ).
    - receipt_kassa/receipt_order: касса не хранит тип операции - берём знак
      из связанного чека ОФД, если пара найдена по фискальным реквизитам;
      без пары считаем продажей (+), как и есть по умолчанию сейчас.
    - money: банковская выписка уже отфильтрована по ключевым словам
      назначения платежа на этапе синхронизации (это все "наши" операции
      терминала/счёта) - direction='in' значит деньги пришли (+), 'out' -
      ушли, например возврат клиенту (-).
    '''
    amount = float(row.get('amount') or 0)
    t = row['type']

    if t == 'money':
        return amount if row.get('status') == 'in' else -amount

    if t == 'receipt_ofd':
        return amount * classify_receipt_sign(row.get('status'))

    if t in ('receipt_kassa', 'receipt_order'):
        linked_status = row.get('linked_ofd_status')
        return amount * classify_receipt_sign(linked_status)

    if t == 'payment':
        status = row.get('status')
        if status in ('AUTHORIZED', 'CONFIRMED'):
            return amount
        return 0.0

    return amount


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Единый реестр готовых для сверки транзакций: объединяет уже насыщенные
    данные из платежей (webhook_payments), чеков и заказов кассы
    (ecomkassa_receipts), чеков ОФД (ofd_receipts) и операций по расчётному
    счёту (bank_statement_transactions) в один список.

    Типы транзакций (поле type): payment, receipt_ofd, receipt_kassa,
    receipt_order, money.
    - receipt_kassa/receipt_order - обе строки из ecomkassa_receipts,
      разведены по order_type документа Екомкассы: VCHR/INVC (чек/счёт) ->
      receipt_kassa, CORD (курьерский заказ) -> receipt_order - у заказа
      деньги обычно передаются курьеру физически, это стоит явно отличать
      от кассового/интернет-чека в реестре и в сверке.
    - чеки кассы (receipt_kassa/receipt_order) и ОФД разведены на два разных
      типа намеренно: это два разных физических источника данных об одном и
      том же чеке (касса пробивает и пересылает результат сама, ОФД получает
      копию от налоговой), и их нужно сверять МЕЖДУ СОБОЙ - если касса
      случайно пробила чек дважды, в чеках кассы будет 2 записи, а в ОФД
      может быть только 1 подтверждённая - без разделения типов такую
      аномалию не увидеть.

    Платёж - особый случай: один и тот же платёж (payment_id/order_id) обычно
    прилетает НЕСКОЛЬКИМИ вебхуками по мере смены статуса (AUTHORIZED ->
    CONFIRMED -> REFUNDED и т.п.), и в БД это разные строки webhook_payments.
    Чтобы не показывать один платёж как N разных "транзакций без пары",
    все вебхуки одного payment_id/order_id схлопываются в ОДНУ транзакцию
    с последним статусом и полем webhook_history (список всех промежуточных
    статусов) - платёж считается связанным, если связь нашлась хотя бы у
    одного из вебхуков в группе.
    Платежи, оплаченные через прокси-шлюз Екомкассы (invoice_payload с полем
    provider - конкретная платёжная система вроде TOCHKA_SBP), при дозагрузке
    исторических данных синтезируются напрямую из report() чека/заказа (см.
    ecomkassa-fetch-orders/save_synthetic_payment) - "живого" вебхука такого
    события к моменту дозагрузки уже нет.

    УЧЁТ ВОЗВРАТОВ: количество транзакций (count) считается по числу
    документов как есть, без вычетов. А суммы (amount в totals_by_type и
    поле signed_amount у каждой строки) - НЕТТО с учётом знака операции:
    возврат вычитается из суммы, а не увеличивает её. Подробности знака
    смотри в compute_signed_amount().

    Связывание (linked_type/linked_source/linked_id/match_method):
    - платёж -> чек/заказ кассы: webhook_payments.receipt_id, а если его нет -
      совпадение order_id/payment_id с order_id/legacy_no/external_id/uuid
      документа кассы (linked_type зависит от order_type найденного документа -
      receipt_kassa или receipt_order).
    - чек/заказ кассы <-> чек ОФД: по триплету фискальных реквизитов
      ФН+ФД+ФПД - однозначно идентифицирует физический фискальный документ
      независимо от того, каким API он был получен.
    - деньги на р/с -> платёж: в общем случае банковская выписка не содержит
      номер заказа, но в двух конкретных случаях назначение платежа несёт
      достаточно специфичный идентификатор, чтобы связывать безопасно:
      (1) СБП-платежи через шлюз Екомкассы - банк пишет "QR ID <код>" (и в
      самой операции зачисления, и в списанной следом комиссии за перевод),
      тот же код есть в хвосте invoice_payload.link платежа ("https://web.
      qr.nspk.ru/<код>"); (2) эквайринг с явным external_id - банк пишет
      "Платеж <external_id>", тот же external_id Екомкасса передавала при
      создании платежа и он сохранён в raw_data.external_id. Оба кода
      достаточно длинные и специфичные, случайное совпадение практически
      исключено - в отличие от сопоставления по одной лишь сумме/дате.
    УДАЛЁННЫЕ (removed_at) транзакции полностью исключены из всех 5 запросов
    и из LATERAL-подзапросов связывания - "мягко удалённая" запись не
    участвует ни в списке, ни как чужая пара для связывания.

    РУЧНЫЕ СВЯЗИ (manual_transaction_links, кнопка "Связать" в реестре):
    каждой строке проставляется manual_group_id, если она входит в группу,
    связанную пользователем вручную - фронтенд объединяет такие записи в
    одну группу наравне с автоматическими (linked_id), см.
    transactionGrouping.ts.
    Args: company_id (обязателен), type (payment/receipt_ofd/receipt_kassa/
    receipt_order/money/receipt-алиас на все 3 вида чеков, опционально),
    limit, offset (опционально)
    Returns: transactions[] с полями type, source, id, occurred_at, amount,
    signed_amount, status, title, subtitle, integration_name, reference,
    raw_data, linked_type, linked_source, linked_id, match_method,
    manual_group_id, webhook_history (только для payment с несколькими
    вебхуками).
    totals_by_type[].amount - это сумма signed_amount (нетто, с учётом
    возвратов), totals_by_type[].count - число документов без вычетов.
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
                    CASE
                        WHEN wp.receipt_id IS NOT NULL OR km.id IS NOT NULL THEN
                            CASE WHEN COALESCE(km.order_type, rid_ekr.order_type) = 'CORD' THEN 'receipt_order' ELSE 'receipt_kassa' END
                    END AS linked_type,
                    CASE WHEN COALESCE(wp.receipt_id, km.id) IS NOT NULL THEN 'ecomkassa' END AS linked_source,
                    COALESCE(wp.receipt_id, km.id) AS linked_id,
                    CASE
                        WHEN wp.receipt_id IS NOT NULL THEN 'receipt_id'
                        WHEN km.id IS NOT NULL THEN 'order_id'
                    END AS match_method,
                    COALESCE(wp.order_id, wp.payment_id) AS group_key,
                    NULL::text AS linked_ofd_status
                FROM {SCHEMA}.webhook_payments wp
                JOIN {SCHEMA}.user_integrations ui ON ui.id = wp.integration_id
                JOIN {SCHEMA}.integration_providers p ON p.id = ui.provider_id
                LEFT JOIN {SCHEMA}.ecomkassa_receipts rid_ekr ON rid_ekr.id = wp.receipt_id AND rid_ekr.removed_at IS NULL
                LEFT JOIN LATERAL (
                    SELECT ekr.id, ekr.order_type
                    FROM {SCHEMA}.ecomkassa_receipts ekr
                    WHERE ekr.company_id = wp.company_id
                      AND ekr.removed_at IS NULL
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
                WHERE wp.company_id = %(company_id)s AND ui.status != 'deleted' AND wp.removed_at IS NULL
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
                    ('Чек #' || COALESCE(ofd.doc_number, ofd.receipt_id)) AS title,
                    'ОФД' AS subtitle,
                    ui.integration_name AS integration_name,
                    ofd.receipt_id AS reference,
                    ofd.raw_data AS raw_data,
                    CASE WHEN km.id IS NOT NULL THEN 'receipt_kassa' END AS linked_type,
                    CASE WHEN km.id IS NOT NULL THEN 'ecomkassa' END AS linked_source,
                    km.id AS linked_id,
                    CASE WHEN km.id IS NOT NULL THEN 'fiscal_triplet' END AS match_method,
                    NULL::text AS group_key,
                    NULL::text AS linked_ofd_status
                FROM {SCHEMA}.ofd_receipts ofd
                JOIN {SCHEMA}.user_integrations ui ON ui.id = ofd.integration_id
                LEFT JOIN LATERAL (
                    SELECT ekr.id
                    FROM {SCHEMA}.ecomkassa_receipts ekr
                    WHERE ekr.company_id = ofd.company_id
                      AND ekr.removed_at IS NULL
                      AND ofd.fn_number IS NOT NULL
                      AND ofd.doc_number IS NOT NULL
                      AND (ofd.raw_data->>'DecimalFiscalSign') IS NOT NULL
                      AND (ekr.raw_data->'payload'->>'fn_number') = ofd.fn_number
                      AND (ekr.raw_data->'payload'->>'fiscal_document_number') = ofd.doc_number
                      AND (ekr.raw_data->'payload'->>'fiscal_document_attribute') = (ofd.raw_data->>'DecimalFiscalSign')
                    LIMIT 1
                ) km ON true
                WHERE ofd.company_id = %(company_id)s AND ofd.removed_at IS NULL
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
                    ('Чек #' || COALESCE(ekr.doc_number, ekr.order_id, ekr.id::text)) AS title,
                    COALESCE(ekr.payment_provider, 'Касса') AS subtitle,
                    ui.integration_name AS integration_name,
                    ekr.order_id AS reference,
                    ekr.raw_data AS raw_data,
                    CASE WHEN om.id IS NOT NULL THEN 'receipt_ofd' END AS linked_type,
                    CASE WHEN om.id IS NOT NULL THEN 'ofd' END AS linked_source,
                    om.id AS linked_id,
                    CASE WHEN om.id IS NOT NULL THEN 'fiscal_triplet' END AS match_method,
                    NULL::text AS group_key,
                    om.operation_type AS linked_ofd_status
                FROM {SCHEMA}.ecomkassa_receipts ekr
                JOIN {SCHEMA}.user_integrations ui ON ui.id = ekr.integration_id
                LEFT JOIN LATERAL (
                    SELECT ofd.id, ofd.operation_type
                    FROM {SCHEMA}.ofd_receipts ofd
                    WHERE ofd.company_id = ekr.company_id
                      AND ofd.removed_at IS NULL
                      AND (ekr.raw_data->'payload'->>'fn_number') IS NOT NULL
                      AND (ekr.raw_data->'payload'->>'fiscal_document_number') IS NOT NULL
                      AND (ekr.raw_data->'payload'->>'fiscal_document_attribute') IS NOT NULL
                      AND ofd.fn_number = (ekr.raw_data->'payload'->>'fn_number')
                      AND ofd.doc_number = (ekr.raw_data->'payload'->>'fiscal_document_number')
                      AND (ofd.raw_data->>'DecimalFiscalSign') = (ekr.raw_data->'payload'->>'fiscal_document_attribute')
                    LIMIT 1
                ) om ON true
                WHERE ekr.company_id = %(company_id)s AND ekr.removed_at IS NULL
                  AND (ekr.order_type IS NULL OR ekr.order_type IN ('VCHR', 'INVC'))
            ''')

        if wants(type_filter, 'receipt_order'):
            parts.append(f'''
                SELECT
                    'receipt_order' AS type,
                    'ecomkassa' AS source,
                    ekr.id AS id,
                    ekr.doc_datetime AS occurred_at,
                    ekr.total_sum AS amount,
                    ekr.status AS status,
                    ('Заказ #' || COALESCE(ekr.doc_number, ekr.order_id, ekr.id::text)) AS title,
                    COALESCE(ekr.payment_provider, 'Курьерский заказ') AS subtitle,
                    ui.integration_name AS integration_name,
                    ekr.order_id AS reference,
                    ekr.raw_data AS raw_data,
                    CASE WHEN om.id IS NOT NULL THEN 'receipt_ofd' END AS linked_type,
                    CASE WHEN om.id IS NOT NULL THEN 'ofd' END AS linked_source,
                    om.id AS linked_id,
                    CASE WHEN om.id IS NOT NULL THEN 'fiscal_triplet' END AS match_method,
                    NULL::text AS group_key,
                    om.operation_type AS linked_ofd_status
                FROM {SCHEMA}.ecomkassa_receipts ekr
                JOIN {SCHEMA}.user_integrations ui ON ui.id = ekr.integration_id
                LEFT JOIN LATERAL (
                    SELECT ofd.id, ofd.operation_type
                    FROM {SCHEMA}.ofd_receipts ofd
                    WHERE ofd.company_id = ekr.company_id
                      AND ofd.removed_at IS NULL
                      AND (ekr.raw_data->'payload'->>'fn_number') IS NOT NULL
                      AND (ekr.raw_data->'payload'->>'fiscal_document_number') IS NOT NULL
                      AND (ekr.raw_data->'payload'->>'fiscal_document_attribute') IS NOT NULL
                      AND ofd.fn_number = (ekr.raw_data->'payload'->>'fn_number')
                      AND ofd.doc_number = (ekr.raw_data->'payload'->>'fiscal_document_number')
                      AND (ofd.raw_data->>'DecimalFiscalSign') = (ekr.raw_data->'payload'->>'fiscal_document_attribute')
                    LIMIT 1
                ) om ON true
                WHERE ekr.company_id = %(company_id)s AND ekr.removed_at IS NULL
                  AND ekr.order_type = 'CORD'
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
                    CASE WHEN wpm.id IS NOT NULL THEN 'payment' END AS linked_type,
                    CASE WHEN wpm.id IS NOT NULL THEN wpm.provider_slug END AS linked_source,
                    wpm.id AS linked_id,
                    CASE WHEN wpm.id IS NOT NULL THEN wpm.match_method END AS match_method,
                    NULL::text AS group_key,
                    NULL::text AS linked_ofd_status
                FROM {SCHEMA}.bank_statement_transactions bst
                JOIN {SCHEMA}.user_integrations ui ON ui.id = bst.integration_id
                LEFT JOIN LATERAL (
                    -- Банковская выписка сама по себе не содержит номер заказа -
                    -- назначение платежа (purpose) единственная зацепка. У платежей
                    -- через СБП (Точка/QR) банк пишет "QR ID <код>" - тот же код
                    -- есть в invoice_payload.link платежа Екомкассы (хвост ссылки
                    -- вида https://web.qr.nspk.ru/<код>). У эквайринга Т-Банка в
                    -- purpose приходит "Платеж <external_id>" - тот же external_id,
                    -- что Екомкасса передавала банку при создании платежа, и он же
                    -- сохранён в webhook_payments.raw_data->>'external_id'.
                    -- Оба совпадения достаточно специфичны (случайное совпадение
                    -- по 20+ символьному QR-коду или UUID/строке external_id
                    -- практически исключено), поэтому здесь, в отличие от
                    -- сопоставления по сумме/дате, это безопасно делать автоматически.
                    SELECT wp.id, p.slug AS provider_slug,
                           CASE WHEN qr_match.id IS NOT NULL THEN 'qr_id' ELSE 'external_id' END AS match_method
                    FROM {SCHEMA}.webhook_payments wp
                    JOIN {SCHEMA}.user_integrations wp_ui ON wp_ui.id = wp.integration_id
                    JOIN {SCHEMA}.integration_providers p ON p.id = wp_ui.provider_id
                    LEFT JOIN LATERAL (
                        SELECT wp.id
                        WHERE substring(bst.purpose FROM 'QR\\s*(?:коду\\s+)?ID\\s+([A-Za-z0-9]+)') IS NOT NULL
                          AND regexp_replace(regexp_replace(wp.raw_data->'invoice_payload'->>'link', '\\?.*$', ''), '^.*/', '')
                              = substring(bst.purpose FROM 'QR\\s*(?:коду\\s+)?ID\\s+([A-Za-z0-9]+)')
                    ) qr_match ON true
                    WHERE wp.company_id = bst.company_id AND wp.removed_at IS NULL
                      AND (
                        qr_match.id IS NOT NULL
                        OR (
                          substring(bst.purpose FROM 'Платеж\\s+(\\S+)') IS NOT NULL
                          AND wp.raw_data->>'external_id' = substring(bst.purpose FROM 'Платеж\\s+(\\S+)')
                        )
                      )
                    ORDER BY qr_match.id IS NOT NULL DESC
                    LIMIT 1
                ) wpm ON true
                WHERE bst.company_id = %(company_id)s AND bst.removed_at IS NULL
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
        # строки до этого схлопывания могло бы разбить одну группу пополам
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

        # Ручные связи (кнопка "Связать" в реестре) - раскладываем в словарь
        # (type, source, id) -> link_group_id, чтобы приклеить каждой
        # транзакции её manual_group_id ниже. Группировка по этому полю
        # выполняется уже на фронте (transactionGrouping.ts), тем же
        # union-find, что и для автоматических связей.
        cur.execute(f'''
            SELECT tx_type, tx_source, tx_id, link_group_id::text
            FROM {SCHEMA}.manual_transaction_links
            WHERE company_id = %(company_id)s
        ''', {'company_id': company_id})
        manual_links = {(t, s, i): g for t, s, i, g in cur.fetchall()}

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
            signed = compute_signed_amount(row)
            row['signed_amount'] = signed
            row.pop('linked_ofd_status', None)
            row['manual_group_id'] = manual_links.get((row['type'], row['source'], row['id']))

            t = row['type']
            bucket = totals_by_type.setdefault(t, {'count': 0, 'amount': 0.0, 'matched_count': 0})
            bucket['count'] += 1
            bucket['amount'] += signed
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