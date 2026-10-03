import json
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

import psycopg2

from ecomkassa_token import ensure_valid_token
from ecomkassa_api import search_orders
from fiscal_merge import merge_after_ecomkassa
from cron_report import record_cron_run
from auth_guard import guard

SCHEMA = 't_p83864310_fintech_payment_reco'
ECOMKASSA_BASE_URL = 'https://app.ecomkassa.ru'

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
}

ALLOWED_ORDER_TYPES = {'VCHR', 'INVC', 'CORD'}
ALLOWED_STATUSES = {'CREATED', 'PAID', 'COMPLETED', 'CANCELED', 'WAITING', 'FAILED'}

# Сколько страниц поиска (по 500 записей) просматриваем за один вызов, пока
# не наберём достаточно кандидатов для текущей пачки - защита от зависания
# функции на аномально большом периоде без реального прогресса.
MAX_SEARCH_PAGES = 20

DEFAULT_BATCH_SIZE = 8
MAX_BATCH_SIZE = 30


def response(status: int, body: Dict[str, Any]) -> Dict[str, Any]:
    return {
        'statusCode': status,
        'headers': {**CORS_HEADERS, 'Content-Type': 'application/json'},
        'body': json.dumps(body, ensure_ascii=False),
        'isBase64Encoded': False
    }


def fetch_report(token: str, store_id: str, order_id: Any, protocol_version: str = 'v4',
                  timeout: float = 10.0) -> Optional[Dict[str, Any]]:
    '''GET /fiscalorder/{version}/{storeId}/report/{orderId} - полные фискальные данные чека.'''
    import urllib.request
    import urllib.error

    url = f'{ECOMKASSA_BASE_URL}/fiscalorder/{protocol_version}/{store_id}/report/{order_id}'
    req = urllib.request.Request(url, headers={'Token': token})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except Exception:
        return None


def parse_receipt_datetime(value: Any) -> Optional[str]:
    if not value:
        return None
    try:
        return datetime.strptime(str(value), '%d.%m.%Y %H:%M:%S').isoformat()
    except ValueError:
        return None


def find_gateway_integration(cur, company_id: int) -> Optional[int]:
    '''
    Находит активную интеграцию "Екомкасса — платёжный шлюз" (provider slug
    ecomkassa_gateway) компании - именно её integration_id использует "живой"
    вебхук колбэка при создании записи в webhook_payments (см.
    webhook-receive/ecomkassa_gateway_handler.py). При дозагрузке синтетический
    платёж должен писаться под тем же integration_id, иначе один и тот же
    реальный платёж от live-вебхука и от дозагрузки превратится в 2 разные
    строки (уникальность в БД - по (integration_id, payment_id, status)).
    Если у компании шлюз не подключён вовсе - live-вебхук в принципе не может
    существовать, тогда безопасно используем integration_id самой кассы.
    '''
    cur.execute(f'''
        SELECT ui.id
        FROM {SCHEMA}.user_integrations ui
        JOIN {SCHEMA}.integration_providers p ON p.id = ui.provider_id
        WHERE ui.company_id = %s AND p.slug = 'ecomkassa_gateway' AND ui.status = 'active'
        ORDER BY ui.id
        LIMIT 1
    ''', (company_id,))
    row = cur.fetchone()
    return row[0] if row else None


def save_receipt(cur, integration_id: int, company_id: int, order_id: Any,
                  legacy_no: Any, order_type: Optional[str], report_data: Dict[str, Any]) -> Tuple[Optional[int], Optional[float]]:
    '''
    Сохраняет фискальный чек/заказ по ответу report() в ecomkassa_receipts - тот
    же формат, что использует обработчик вебхука шлюза (см.
    webhook-receive/ecomkassa_gateway_handler.py:save_receipt_from_report), чтобы
    дозагруженные исторические документы участвовали в сверке наравне с "живыми".
    order_type (VCHR/INVC/CORD) сохраняется отдельной колонкой - от него зависит,
    как документ будет представлен в реестре транзакций (чек кассы или заказ).
    Returns: (receipt_id, total_sum)
    '''
    payload = report_data.get('payload') or {}
    total_sum = payload.get('total')
    doc_number = payload.get('fiscal_receipt_number') or payload.get('fiscal_document_number')
    doc_datetime = parse_receipt_datetime(payload.get('receipt_datetime'))

    invoice_payload = report_data.get('invoice_payload') or {}
    payment_provider = invoice_payload.get('provider') if isinstance(invoice_payload, dict) else None

    status = report_data.get('status') or 'done'

    cur.execute(f'''
        INSERT INTO {SCHEMA}.ecomkassa_receipts (
            integration_id, company_id, order_id, legacy_no, status,
            total_sum, doc_number, doc_datetime, raw_data, payment_provider, order_type
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (integration_id, order_id) DO UPDATE SET
            status = EXCLUDED.status,
            total_sum = COALESCE(EXCLUDED.total_sum, {SCHEMA}.ecomkassa_receipts.total_sum),
            doc_number = COALESCE(EXCLUDED.doc_number, {SCHEMA}.ecomkassa_receipts.doc_number),
            doc_datetime = COALESCE(EXCLUDED.doc_datetime, {SCHEMA}.ecomkassa_receipts.doc_datetime),
            raw_data = EXCLUDED.raw_data,
            payment_provider = COALESCE(EXCLUDED.payment_provider, {SCHEMA}.ecomkassa_receipts.payment_provider),
            order_type = COALESCE(EXCLUDED.order_type, {SCHEMA}.ecomkassa_receipts.order_type)
        RETURNING id
    ''', (
        integration_id, company_id, str(order_id), str(legacy_no) if legacy_no else str(order_id),
        status, total_sum, str(doc_number) if doc_number else None, doc_datetime,
        json.dumps(report_data), payment_provider, order_type
    ))
    result = cur.fetchone()
    receipt_id = result[0] if result else None
    merge_after_ecomkassa(cur, receipt_id)
    return receipt_id, float(total_sum) if total_sum else None


def save_synthetic_payment(cur, gateway_integration_id: int, company_id: int, order_id: Any,
                            receipt_id: Optional[int], total_sum: Optional[float], report_data: Dict[str, Any]) -> None:
    '''
    Счета (INVC) и часть заказов (CORD), оплаченные через прокси-шлюз Екомкассы,
    в report() содержат invoice_payload с полем "provider" (напр. TOCHKA_SBP) -
    это и есть сам факт платежа через конкретную платёжную систему. "Живой"
    вебхук шлюза создаёт для него отдельную строку в webhook_payments сразу в
    момент оплаты - при дозагрузке событие вебхука уже потеряно, поэтому
    синтезируем ту же запись здесь по данным report(), с receipt_id проставленным
    напрямую (та же связь, что использует live-путь), чтобы платёж сразу был
    виден в реестре транзакций и группировался с чеком.
    Вызывающий код уже гарантировал report_data['status'] == 'done' - раз чек
    фискализирован, деньги точно были получены, поэтому статус платежа = CONFIRMED
    безусловно (конкретное значение invoice_payload.status у Екомкассы не
    документировано полностью и ненадёжно для маппинга статусов).
    '''
    invoice_payload = report_data.get('invoice_payload') or {}
    if not isinstance(invoice_payload, dict):
        return
    payment_provider = invoice_payload.get('provider')
    if not payment_provider:
        return

    uid = str(order_id)
    cur.execute(f'''
        INSERT INTO {SCHEMA}.webhook_payments (
            integration_id, company_id, payment_id, terminal_key,
            amount, order_id, status, payment_status, error_code,
            customer_email, customer_phone, pan, card_type, exp_date,
            raw_data, receipt_id, payment_provider
        ) VALUES (%s, %s, %s, NULL, %s, %s, 'CONFIRMED', NULL, NULL, NULL, NULL, NULL, NULL, NULL, %s, %s, %s)
        ON CONFLICT (integration_id, payment_id, status) DO UPDATE SET
            receipt_id = COALESCE(EXCLUDED.receipt_id, {SCHEMA}.webhook_payments.receipt_id),
            payment_provider = COALESCE(EXCLUDED.payment_provider, {SCHEMA}.webhook_payments.payment_provider),
            amount = CASE WHEN {SCHEMA}.webhook_payments.amount = 0
                          THEN EXCLUDED.amount
                          ELSE {SCHEMA}.webhook_payments.amount END
    ''', (
        gateway_integration_id, company_id, uid,
        total_sum or 0, uid,
        json.dumps(report_data), receipt_id, payment_provider
    ))


def collect_candidates(token: str, since: Optional[str], until: Optional[str],
                        order_types: List[str], statuses: List[str],
                        need_count: int) -> tuple:
    '''
    Проходит страницы /orders/search (по 500 записей), фильтрует локально по
    статусу (API фильтрует только по типу документа и дате) и копит подходящих
    кандидатов, пока их не наберётся хотя бы need_count или не кончатся
    страницы/не будет достигнут защитный лимит MAX_SEARCH_PAGES.
    Returns: (candidates: list, matched_total_so_far: int, capped: bool, error: str|None)
    '''
    candidates = []
    offset = 0
    page = 0
    capped = False

    while page < MAX_SEARCH_PAGES:
        page += 1
        result = search_orders(token, since=since, until=until, order_types=order_types, offset=offset)

        if result is None:
            return candidates, len(candidates), capped, 'Екомкасса не ответила на запрос'
        if result.get('error'):
            return candidates, len(candidates), capped, result.get('error', 'Ошибка запроса к Екомкассе')

        page_items = result.get('result', [])
        if not page_items:
            break

        for item in page_items:
            if item.get('status') in statuses:
                candidates.append(item)

        if len(page_items) < 500:
            break

        offset += 500

        if len(candidates) >= need_count and page >= 2:
            # Уже нашли достаточно для текущей пачки и просмотрели больше одной
            # страницы - можно не листать до конца ради точного matched_total,
            # это лишь ускоряет типичный случай (пачка находится на первых страницах).
            break

    if page >= MAX_SEARCH_PAGES:
        capped = True

    return candidates, len(candidates), capped, None


def _handle(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Дозагрузка исторических чеков/счетов/заказов Екомкассы за период вручную
    (для случаев, когда часть данных не попала через вебхук - например,
    интеграцию подключили уже после того, как в кассе накопились платежи).
    Работает в 2 шага:
    1) POST /api/mobile/v1/orders/search - находит документы за период
       [date_from, date_to] с фильтром по типу (VCHR - чеки, INVC - счета,
       CORD - курьерские заказы), листая страницы по 500 записей; статус
       (CREATED/PAID/COMPLETED/CANCELED/WAITING/FAILED) фильтруется локально,
       т.к. API его не поддерживает.
    2) Для найденных кандидатов (пачками, см. offset/batch_size) параллельно
       вызывает GET .../report/{orderId} за полными фискальными данными и
       сохраняет в ecomkassa_receipts вместе с order_type - в том же формате,
       что и обычные вебхуки, поэтому дозагруженные документы сразу участвуют
       в сверке и матчинге с платежами.
    Если report() содержит invoice_payload (счёт/заказ оплачен через
    прокси-шлюз Екомкассы конкретной платёжной системой, напр. TOCHKA_SBP) -
    дополнительно синтезируется запись платежа в webhook_payments с сразу
    проставленным receipt_id, т.к. "живого" вебхука этого события уже не
    было/не будет - см. save_synthetic_payment().
    Пагинация по кандидатам нужна, т.к. report() на каждый документ - это
    отдельный сетевой запрос, и сотни таких запросов не укладываются в таймаут
    одного вызова функции - фронтенд вызывает повторно с новым offset, пока
    done=false.
    Args: company_id (обязателен), date_from, date_to (ISO, обязательны),
    order_types (['VCHR','INVC','CORD'], default ['VCHR']),
    statuses (default ['COMPLETED']), offset (default 0), batch_size (default 8, max 30)
    Returns: matched_total, processed, inserted, skipped, next_offset, done, capped
    '''

    method = event.get('httpMethod', 'POST')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': '', 'isBase64Encoded': False}

    if method != 'POST':
        return response(405, {'error': 'Method not allowed'})

    body = json.loads(event.get('body', '{}') or '{}')
    company_id = body.get('company_id')
    date_from = body.get('date_from')
    date_to = body.get('date_to')
    order_types = body.get('order_types') or ['VCHR']
    statuses = body.get('statuses') or ['COMPLETED']
    offset = max(0, int(body.get('offset', 0)))
    batch_size = min(MAX_BATCH_SIZE, max(1, int(body.get('batch_size', DEFAULT_BATCH_SIZE))))
    # Авто-режим планировщика: окно «последние N часов», только ещё не загруженные документы.
    auto_hours = body.get('auto_hours')
    only_new = bool(body.get('only_new')) or bool(auto_hours)
    if auto_hours:
        now = datetime.utcnow()
        date_from = (now - timedelta(hours=min(72, max(1, int(auto_hours))))).isoformat()
        date_to = (now + timedelta(minutes=5)).isoformat()

    if not company_id:
        return response(400, {'error': 'company_id required'})
    if not date_from or not date_to:
        return response(400, {'error': 'date_from and date_to required'})

    order_types = [t for t in order_types if t in ALLOWED_ORDER_TYPES] or ['VCHR']
    statuses = [s for s in statuses if s in ALLOWED_STATUSES] or ['COMPLETED']

    dsn = os.environ['DATABASE_URL']
    conn = psycopg2.connect(dsn)
    cur = conn.cursor()

    try:
        cur.execute(f'''
            SELECT ui.id, ui.config
            FROM {SCHEMA}.user_integrations ui
            JOIN {SCHEMA}.integration_providers p ON p.id = ui.provider_id
            WHERE ui.company_id = %s AND p.slug = 'ecomkassa' AND ui.status = 'active'
            ORDER BY ui.id
            LIMIT 1
        ''', (company_id,))
        row = cur.fetchone()

        if not row:
            return response(404, {'error': 'Активная касса Екомкасса не найдена у компании'})

        integration_id, config = row
        config = json.loads(config) if isinstance(config, str) else (config or {})

        token = ensure_valid_token(cur, integration_id, config)
        store_id = config.get('store_id')
        protocol_version = config.get('protocol_version', 'v4')

        if not token or not store_id:
            return response(400, {'error': 'Касса Екомкасса не авторизована (нет токена или store_id)'})

        # Ищем один раз на весь вызов, а не на каждый документ - используется
        # только если найдутся счета/заказы с invoice_payload (см. save_synthetic_payment).
        gateway_integration_id = find_gateway_integration(cur, company_id)

        try:
            since = datetime.fromisoformat(date_from.replace('Z', '+00:00')).strftime('%Y-%m-%dT%H:%M:%S.000Z')
            until = datetime.fromisoformat(date_to.replace('Z', '+00:00')).strftime('%Y-%m-%dT%H:%M:%S.999Z')
        except ValueError:
            return response(400, {'error': 'Некорректный формат date_from/date_to'})

        candidates, matched_total, capped, error = collect_candidates(
            token, since, until, order_types, statuses, need_count=offset + batch_size
        )

        if error:
            return response(200, {'success': False, 'error': error})

        if only_new and candidates:
            # Уже загруженные (чек пробит) не перезапрашиваем - иначе каждый тик
            # планировщика заново тянул бы report() по всем документам окна.
            ids = [str(c.get('orderId')) for c in candidates]
            cur.execute(f'''
                SELECT order_id FROM {SCHEMA}.ecomkassa_receipts
                WHERE integration_id = %s AND status = 'done' AND order_id = ANY(%s)
            ''', (integration_id, ids))
            known = {r[0] for r in cur.fetchall()}
            candidates = [c for c in candidates if str(c.get('orderId')) not in known]
            matched_total = len(candidates)

        batch = candidates[offset:offset + batch_size]

        inserted = 0
        skipped = 0

        # report() для счетов (INVC) у Екомкассы заметно медленнее, чем для
        # чеков (VCHR) - при последовательных запросах пачка из batch_size
        # документов легко превышала таймаут функции, и фронтенд получал 504
        # посреди дозагрузки счетов, тогда как чеки (более быстрые) успевали
        # обработаться. Запрашиваем report() параллельно - это сетевой I/O,
        # GIL не мешает, а сама БД-запись (save_receipt) остаётся
        # последовательной, т.к. курсор psycopg2 не потокобезопасен.
        with ThreadPoolExecutor(max_workers=min(8, len(batch)) or 1) as pool:
            reports = list(pool.map(
                lambda item: fetch_report(token, store_id, item.get('orderId'), protocol_version),
                batch
            ))

        for item, report_data in zip(batch, reports):
            order_id = item.get('orderId')
            external_id = item.get('externalId')
            order_type = item.get('orderType')

            # report().status может быть НЕ "done" даже если сам счёт/заказ
            # уже оплачен покупателем (напр. "wait") - Екомкасса ещё не
            # пробила физический фискальный чек по этому платежу на момент
            # запроса. Пропускаем такой документ ЦЕЛИКОМ (ни чек, ни платёж
            # не создаются) - без фискальных реквизитов (payload) нечего
            # сохранять как чек, а без чека нет receipt_id, чтобы связать с
            # ним платёж. Документ подтянется сам при следующей дозагрузке
            # или "живым" вебхуком, когда касса физически пробьёт чек.
            if not report_data or report_data.get('status') != 'done':
                skipped += 1
                continue

            receipt_id, total_sum = save_receipt(
                cur, integration_id, company_id, order_id, external_id, order_type, report_data
            )
            if not receipt_id:
                skipped += 1
                continue

            inserted += 1

            if report_data.get('invoice_payload'):
                gw_id = gateway_integration_id or integration_id
                save_synthetic_payment(cur, gw_id, company_id, order_id, receipt_id, total_sum, report_data)

        # Время синхронизации кассы - для плашки «Синхронизация: N назад».
        cur.execute(f'UPDATE {SCHEMA}.user_integrations SET last_synced_at = NOW() WHERE id = %s', (integration_id,))
        conn.commit()

        next_offset = offset + len(batch)
        done = len(batch) < batch_size or next_offset >= matched_total

        return response(200, {
            'success': True,
            'matched_total': matched_total,
            'processed': len(batch),
            'inserted': inserted,
            'skipped': skipped,
            'next_offset': next_offset if not done else None,
            'done': done,
            'capped': capped
        })

    except Exception as e:
        conn.rollback()
        return response(500, {'error': str(e)})
    finally:
        cur.close()
        conn.close()


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''Точка входа: обработка запроса + итог для админки, если вызвал планировщик.'''
    denied = guard(event)
    if denied:
        return denied

    resp = _handle(event, context)
    if event.get('httpMethod', 'POST') == 'POST':
        record_cron_run(event, resp, 'ecomkassa', 'inserted')
    return resp
