import json
import urllib.request
import urllib.error
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


def _extract_uid(webhook_data: Dict[str, Any]) -> Optional[str]:
    for key in UID_KEYS:
        value = webhook_data.get(key)
        if value:
            return str(value)
    return None


def _find_receipt_by_legacy_no(token: str, legacy_no: str, store_id: str,
                                protocol_version: str = 'v4') -> Optional[Dict[str, Any]]:
    '''Поиск чека кассы Екомкасса по внешнему номеру (legacy_no = наш UUID платежа).'''
    mobile_version = 'v2' if protocol_version == 'v5' else 'v1'
    url = f'{ECOMKASSA_BASE_URL}/api/mobile/{mobile_version}/courier/find/{legacy_no}?storeId={store_id}'
    req = urllib.request.Request(url, headers={'Token': token})
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            return json.loads(response.read().decode('utf-8'))
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError):
        return None


def _find_cash_register_integration(cur, company_id: int) -> Optional[Tuple[int, Dict[str, Any]]]:
    '''
    Кассовый чек по UUID платежа лежит в интеграции "Екомкасса" (касса, provider
    slug=ecomkassa) - отдельной от "Екомкасса — платёжный шлюз". Компания считается
    имеющей одну активную кассу Екомкассы, поэтому она находится автоматически
    по company_id, без явной настройки в конфиге шлюза.
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


def _save_receipt(cur, integration_id: int, company_id: int, legacy_no: str,
                   data: Dict[str, Any]) -> Optional[int]:
    status = data.get('status')
    total_sum = data.get('total') or data.get('sum') or data.get('totalSum')
    doc_number = data.get('docNumber') or data.get('doc_number')
    doc_datetime = data.get('docDateTime') or data.get('doc_datetime') or data.get('createdAt')
    order_id = data.get('orderId') or data.get('order_id') or legacy_no

    cur.execute('''
        INSERT INTO t_p83864310_fintech_payment_reco.ecomkassa_receipts (
            integration_id, company_id, order_id, legacy_no, status,
            total_sum, doc_number, doc_datetime, raw_data
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (integration_id, order_id) DO UPDATE SET
            status = EXCLUDED.status,
            total_sum = EXCLUDED.total_sum,
            doc_number = EXCLUDED.doc_number,
            doc_datetime = EXCLUDED.doc_datetime,
            raw_data = EXCLUDED.raw_data
        RETURNING id
    ''', (
        integration_id, company_id, str(order_id), str(legacy_no), status,
        total_sum, doc_number, doc_datetime, json.dumps(data)
    ))
    result = cur.fetchone()
    return (result[0], total_sum) if result else (None, total_sum)


def process(cur, integration_id: int, company_id: int, config: Dict[str, Any],
            webhook_settings: Dict[str, Any], webhook_data: Dict[str, Any]) -> Tuple[bool, Optional[int], Optional[str]]:
    '''
    Обрабатывает callback от прокси-шлюза payments.ecomkassa.ru (invoice): наш
    сервис не участвует в создании платежа (это делает внешний CMS/CRM-модуль),
    только принимает уведомления об изменении статуса. Идентификатор платежа
    (uid, он же UUID) совпадает с legacy_no предчека кассы Екомкасса, поэтому им
    же ищем и довязываем фискальный чек, а сумму платежа берём из чека - в самом
    статусном колбэке суммы может не быть, так как корзина уже создана в кассе.
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

    # Деньги фактически проведены только на статусах "оплачен, ожидает
    # подтверждения" и "оплачен, подтверждён" - только тогда есть смысл идти
    # за чеком (на CREATED чека может ещё не быть, на CANCELED/REJECTED он не нужен).
    if status in ('AUTHORIZED', 'CONFIRMED'):
        cash_integration = _find_cash_register_integration(cur, company_id)
        if cash_integration:
            cash_integration_id, cash_config = cash_integration
            token = cash_config.get('token')
            store_id = cash_config.get('store_id')
            protocol_version = cash_config.get('protocol_version', 'v4')
            if token and store_id:
                receipt_data = _find_receipt_by_legacy_no(token, uid, store_id, protocol_version)
                if receipt_data:
                    receipt_id, receipt_sum = _save_receipt(cur, cash_integration_id, company_id, uid, receipt_data)
                    if receipt_sum:
                        amount = float(receipt_sum)

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
            raw_data, receipt_id
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (integration_id, payment_id, status) DO UPDATE SET
            receipt_id = COALESCE(EXCLUDED.receipt_id, t_p83864310_fintech_payment_reco.webhook_payments.receipt_id),
            amount = CASE WHEN t_p83864310_fintech_payment_reco.webhook_payments.amount = 0
                          THEN EXCLUDED.amount
                          ELSE t_p83864310_fintech_payment_reco.webhook_payments.amount END
        RETURNING id
    ''', (
        integration_id, company_id, uid, None,
        amount, uid, status, str(status_code) if status_code is not None else None, None,
        None, None, None, None, None,
        json.dumps(webhook_data), receipt_id
    ))

    result = cur.fetchone()
    webhook_payment_id = result[0] if result else None

    return True, webhook_payment_id, None
