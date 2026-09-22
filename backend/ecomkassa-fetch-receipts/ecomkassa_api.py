import json
import time
import urllib.request
import urllib.error
from typing import Any, Dict, Optional

# https://ecomkassa.ru/podrazdel_api_dokumentacija
BASE_URL = 'https://app.ecomkassa.ru'


def find_receipt_by_legacy_no(token: str, legacy_no: str, store_id: str,
                               protocol_version: str = 'v4') -> Optional[Dict[str, Any]]:
    '''
    Поиск чека по внешнему номеру заказа (legacyNo) - номеру, под которым заказ
    известен во внешней системе продавца (не в Екомкассе).
    v4 -> GET /api/mobile/v1/courier/find/:legacyNo?storeId=:storeId
    v5 -> GET /api/mobile/v2/courier/find/:legacyNo?storeId=:storeId
    '''
    mobile_version = 'v2' if protocol_version == 'v5' else 'v1'
    url = f'{BASE_URL}/api/mobile/{mobile_version}/courier/find/{legacy_no}?storeId={store_id}'
    req = urllib.request.Request(url, headers={'Token': token})

    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            return json.loads(response.read().decode('utf-8'))
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError):
        return None


def find_order_by_id(token: str, order_id: str) -> Optional[Dict[str, Any]]:
    '''GET /api/mobile/v1/orders/:orderId - статус и данные транзакции/чека по внутреннему orderId.'''
    url = f'{BASE_URL}/api/mobile/v1/orders/{order_id}'
    req = urllib.request.Request(url, headers={'Token': token})

    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            return json.loads(response.read().decode('utf-8'))
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError):
        return None


# Статусы, при которых чек считается готовым и опрос можно останавливать.
# Точный набор статусов Екомкассы не задокументирован публично - перечислены
# все правдоподобные финальные значения, чтобы не зависать в бесконечном пуллинге.
FINAL_STATUSES = {'done', 'success', 'fiscalized', 'paid', 'completed', 'closed'}


def poll_order_until_ready(token: str, order_id: str, max_attempts: int = 5,
                            delay_seconds: float = 2.0) -> Optional[Dict[str, Any]]:
    '''
    Опрашивает GET /api/mobile/v1/orders/:orderId несколько раз с паузой, пока
    статус заказа не станет финальным (чек фискализирован) или не кончатся попытки.
    '''
    last_result = None
    for attempt in range(max_attempts):
        result = find_order_by_id(token, order_id)
        if result is None:
            return last_result
        last_result = result

        status = str(result.get('status', '')).lower() if isinstance(result, dict) else ''
        if status in FINAL_STATUSES:
            return result

        if attempt < max_attempts - 1:
            time.sleep(delay_seconds)

    return last_result
