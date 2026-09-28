import json
import urllib.request
import urllib.error
from datetime import datetime
from typing import Any, Dict, Optional, Tuple

# Формат тела callback от payments.ecomkassa.ru официально не задокументирован -
# описан только формат ответа метода проверки статуса по ID (GET /api/v1/payments/{ID}):
# status: 0 - создан, ожидает оплаты; 1 - оплачен, ожидает подтверждения;
# 2 - оплачен, подтверждён; 3 - отменён (возврат); 4 - не оплачен, истекло время.
# Колбэк на смену статуса инвойса устроен так же (подтверждено примером реального
# запроса - {"status": 2}). Идентификатор платежа ищем по нескольким вероятным
# ключам, так как поле может называться по-разному у разных провайдеров под капотом.
STATUS_MAP = {
    0: 'CREATED',
    1: 'AUTHORIZED',
    2: 'CONFIRMED',
    3: 'CANCELED',
    4: 'REJECTED'
}

UID_KEYS = ['uid', 'orderId', 'order_id', 'invoice_id', 'invoiceId', 'paymentId', 'payment_id', 'id']

ECOMKASSA_BASE_URL = 'https://app.ecomkassa.ru'

# Статус пробития чека в ответе метода report - "done" значит чек фискализирован
# и payload с фискальными данными заполнен; любой другой статус (wait/pending и т.п.)
# значит чек ещё не готов - тогда его довяжет дозагрузка при следующем открытии
# "Событий"/"Сверки" (см. ecomkassa-gateway-resync).
RECEIPT_DONE_STATUS = 'done'


def _extract_uid(webhook_data: Dict[str, Any]) -> Optional[str]:
    for key in UID_KEYS:
        value = webhook_data.get(key)
        if value:
            return str(value)
    return None


def fetch_report(token: str, store_id: str, uid: str, protocol_version: str = 'v4',
                  timeout: float = 4.0) -> Optional[Dict[str, Any]]:
    '''
    GET /fiscalorder/{version}/{storeId}/report/{uuid} - проверка статуса пробития
    чека Екомкассы по тому же UUID, что использовался как uid платежа в шлюзе.
    Ответ: {"status": "done"/..., "payload": {"total": ..., "fiscal_receipt_number": ...}}.
    payload заполнен только когда status == "done".
    '''
    url = f'{ECOMKASSA_BASE_URL}/fiscalorder/{protocol_version}/{store_id}/report/{uid}'
    req = urllib.request.Request(url, headers={'Token': token})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return json.loads(response.read().decode('utf-8'))
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError, TimeoutError):
        return None


def _parse_receipt_datetime(value: Any) -> Optional[str]:
    '''Екомкасса отдаёт дату чека как "14.07.2019 15:08:25" - переводим в ISO для timestamp-колонки.'''
    if not value:
        return None
    try:
        return datetime.strptime(str(value), '%d.%m.%Y %H:%M:%S').isoformat()
    except ValueError:
        return None


def find_cash_register_integration(cur, company_id: int) -> Optional[Tuple[int, Dict[str, Any]]]:
    '''
    Фискальный чек по UUID платежа появляется в интеграции "Екомкасса" (касса,
    provider slug=ecomkassa) - отдельной от "Екомкасса — платёжный шлюз". Компания
    считается имеющей одну активную кассу Екомкассы, поэтому она находится
    автоматически по company_id, без явной настройки в конфиге шлюза.
    '''
    cur.execute('''
        SELECT ui.id, ui.config
        FROM t_p83864310_fintech_payment_reco.user_integrations ui
        JOIN t_p83864310_fintech_payment_reco.integration_providers p ON p.id = ui.provider_id
        WHERE ui.company_id = %s AND p.slug = 'ecomkassa' AND ui.status = 'active'
        ORDER BY ui.id
        LIMIT 1
    ''', (company_id,))
    row = cur.fetchone()
    if not row:
        return None
    cash_integration_id, cash_config = row
    cash_config = json.loads(cash_config) if isinstance(cash_config, str) else (cash_config or {})
    return cash_integration_id, cash_config


def save_receipt_from_report(cur, integration_id: int, company_id: int, uid: str,
                              report_data: Dict[str, Any]) -> Tuple[Optional[int], float, Optional[str]]:
    '''
    Сохраняет фискальный чек по ответу report(status="done") в ecomkassa_receipts.
    Для счетов на оплату (kind="INVOICE") report() дополнительно отдаёт invoice_payload
    с полем "provider" - дискриминатором конкретной платёжной системы внутри шлюза
    (у одной кассы Екомкассы их может быть подключено больше 10). Сохраняем его
    отдельной колонкой, чтобы фильтровать события и детализировать сверку по
    конкретному способу оплаты, а не только по шлюзу в целом.
    Returns: (receipt_id, total_sum, payment_provider)
    '''
    payload = report_data.get('payload') or {}
    total_sum = payload.get('total')
    doc_number = payload.get('fiscal_receipt_number') or payload.get('fiscal_document_number')
    doc_datetime = _parse_receipt_datetime(payload.get('receipt_datetime'))

    invoice_payload = report_data.get('invoice_payload') or {}
    payment_provider = invoice_payload.get('provider') if isinstance(invoice_payload, dict) else None

    cur.execute('''
        INSERT INTO t_p83864310_fintech_payment_reco.ecomkassa_receipts (
            integration_id, company_id, order_id, legacy_no, status,
            total_sum, doc_number, doc_datetime, raw_data, payment_provider
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (integration_id, order_id) DO UPDATE SET
            status = EXCLUDED.status,
            total_sum = EXCLUDED.total_sum,
            doc_number = EXCLUDED.doc_number,
            doc_datetime = EXCLUDED.doc_datetime,
            raw_data = EXCLUDED.raw_data,
            payment_provider = COALESCE(EXCLUDED.payment_provider, t_p83864310_fintech_payment_reco.ecomkassa_receipts.payment_provider)
        RETURNING id
    ''', (
        integration_id, company_id, str(uid), str(uid), RECEIPT_DONE_STATUS,
        total_sum, str(doc_number) if doc_number else None, doc_datetime, json.dumps(report_data), payment_provider
    ))
    result = cur.fetchone()
    receipt_id = result[0] if result else None
    return receipt_id, float(total_sum) if total_sum else 0.0, payment_provider


def try_resolve_receipt(cur, company_id: int, uid: str) -> Tuple[Optional[int], float, Optional[str]]:
    '''
    Пробует немедленно получить и сохранить чек по uid через report(). Если чек ещё
    не пробит (status != "done") или касса не настроена - возвращает (None, 0.0, None),
    и довязку позже завершит дозагрузка ecomkassa-gateway-resync.
    '''
    cash_integration = find_cash_register_integration(cur, company_id)
    if not cash_integration:
        return None, 0.0, None

    cash_integration_id, cash_config = cash_integration
    token = cash_config.get('token')
    store_id = cash_config.get('store_id')
    protocol_version = cash_config.get('protocol_version', 'v4')
    if not token or not store_id:
        return None, 0.0, None

    report_data = fetch_report(token, store_id, uid, protocol_version)
    if not report_data or report_data.get('status') != RECEIPT_DONE_STATUS:
        return None, 0.0, None

    return save_receipt_from_report(cur, cash_integration_id, company_id, uid, report_data)


def process(cur, integration_id: int, company_id: int, config: Dict[str, Any],
            webhook_settings: Dict[str, Any], webhook_data: Dict[str, Any]) -> Tuple[bool, Optional[int], Optional[str]]:
    '''
    Обрабатывает callback от прокси-шлюза payments.ecomkassa.ru (invoice): наш
    сервис не участвует в создании платежа (это делает внешний CMS/CRM-модуль),
    только принимает уведомления об изменении статуса. Идентификатор платежа
    (uid, он же UUID) совпадает с внешним номером предчека кассы Екомкасса,
    поэтому им же сразу пробуем получить пробитый чек методом report(). Чек может
    быть ещё не пробит в момент колбэка - тогда сумма/receipt_id останутся
    пустыми, и их довяжет дозагрузка при следующем открытии "Событий"/"Сверки".
    Returns: (accepted, webhook_payment_id, error)
    '''
    uid = _extract_uid(webhook_data)
    if not uid:
        return True, None, 'uid not found in webhook payload'

    raw_status = webhook_data.get('status')
    try:
        status_code = int(raw_status)
    except (TypeError, ValueError):
        status_code = None
    status = STATUS_MAP.get(status_code, str(raw_status) if raw_status is not None else 'UNKNOWN')

    notify_map = {
        'AUTHORIZED': 'notify_on_authorized',
        'CONFIRMED': 'notify_on_confirmed',
        'REJECTED': 'notify_on_rejected',
        'CANCELED': 'notify_on_canceled'
    }
    notify_key = notify_map.get(status)
    if notify_key and not webhook_settings.get(notify_key, True):
        return True, None, None

    amount = 0.0
    receipt_id = None
    payment_provider = None

    # Деньги фактически проведены только на статусах "оплачен, ожидает
    # подтверждения" и "оплачен, подтверждён" - только тогда есть смысл сразу
    # пробовать получить чек (на CREATED чека ещё не может быть, на
    # CANCELED/REJECTED он не нужен).
    if status in ('AUTHORIZED', 'CONFIRMED'):
        receipt_id, amount, payment_provider = try_resolve_receipt(cur, company_id, uid)

    if not amount and webhook_data.get('amount'):
        try:
            amount = float(webhook_data['amount'])
        except (TypeError, ValueError):
            pass

    cur.execute('''
        INSERT INTO t_p83864310_fintech_payment_reco.webhook_payments (
            integration_id, company_id, payment_id, terminal_key,
            amount, order_id, status, payment_status, error_code,
            customer_email, customer_phone, pan, card_type, exp_date,
            raw_data, receipt_id, payment_provider
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (integration_id, payment_id, status) DO UPDATE SET
            receipt_id = COALESCE(EXCLUDED.receipt_id, t_p83864310_fintech_payment_reco.webhook_payments.receipt_id),
            payment_provider = COALESCE(EXCLUDED.payment_provider, t_p83864310_fintech_payment_reco.webhook_payments.payment_provider),
            amount = CASE WHEN t_p83864310_fintech_payment_reco.webhook_payments.amount = 0
                          THEN EXCLUDED.amount
                          ELSE t_p83864310_fintech_payment_reco.webhook_payments.amount END
        RETURNING id
    ''', (
        integration_id, company_id, uid, None,
        amount, uid, status, str(status_code) if status_code is not None else None, None,
        None, None, None, None, None,
        json.dumps(webhook_data), receipt_id, payment_provider
    ))

    result = cur.fetchone()
    webhook_payment_id = result[0] if result else None

    return True, webhook_payment_id, None