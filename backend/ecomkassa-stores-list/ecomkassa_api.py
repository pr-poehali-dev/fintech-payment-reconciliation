import json
import urllib.request
import urllib.error
from typing import Any, Dict, List, Optional

# https://ecomkassa.ru/podrazdel_api_dokumentacija
BASE_URL = 'https://app.ecomkassa.ru'


def get_token(login: str, password: str, protocol_version: str = 'v4') -> Optional[str]:
    '''
    Получение токена авторизации Екомкассы.
    POST https://app.ecomkassa.ru/fiscalorder/v4/getToken (или v5)
    Body: {"login": "...", "pass": "..."}
    Ответ: {"code": 0, "text": "", "token": "..."}
    '''
    url = f'{BASE_URL}/fiscalorder/{protocol_version}/getToken'
    data = json.dumps({'login': login, 'pass': password}).encode('utf-8')

    req = urllib.request.Request(
        url,
        data=data,
        method='POST',
        headers={'Content-Type': 'application/json; charset=utf-8'}
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            result = json.loads(response.read().decode('utf-8'))
            if result.get('code') == 0:
                return result.get('token')
            return None
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError):
        return None


def fetch_firm_profile(token: str) -> Optional[Dict[str, Any]]:
    '''
    GET /api/mobile/v1/profile/firm - профиль организации со списком магазинов (stores),
    из которого пользователь выбирает storeId для интеграции.
    '''
    url = f'{BASE_URL}/api/mobile/v1/profile/firm'
    req = urllib.request.Request(url, headers={'Token': token})

    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            raw_body = response.read().decode('utf-8')
            print(f'[DEBUG] profile/firm raw response: {raw_body[:2000]}')
            return json.loads(raw_body)
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8') if e.fp else str(e)
        print(f'[DEBUG] profile/firm HTTP error {e.code}: {error_body[:1000]}')
        return None
    except (urllib.error.URLError, json.JSONDecodeError) as e:
        print(f'[DEBUG] profile/firm error: {str(e)}')
        return None


def extract_stores(firm_profile: Dict[str, Any]) -> List[Dict[str, Any]]:
    '''
    Ищет список магазинов в ответе profile/firm. Реальный формат ответа:
    {"errorCode": 0, "payload": {"firmId": ..., "stores": [{"storeId": 2, "storeName": "...", ...}]}}
    Дополнительно проверяем ещё пару вероятных мест на случай отличий между
    протоколами v4/v5, т.к. структура не задокументирована публично.
    '''
    if not isinstance(firm_profile, dict):
        return []

    payload = firm_profile.get('payload')
    if isinstance(payload, dict):
        stores = payload.get('stores')
        if isinstance(stores, list) and stores:
            return stores

    for key in ('stores', 'shops', 'Stores', 'Shops'):
        value = firm_profile.get(key)
        if isinstance(value, list) and value:
            return value

    for wrapper_key in ('data', 'firm', 'result', 'Data', 'Firm', 'Result'):
        wrapper = firm_profile.get(wrapper_key)
        if isinstance(wrapper, dict):
            for key in ('stores', 'shops', 'Stores', 'Shops'):
                value = wrapper.get(key)
                if isinstance(value, list) and value:
                    return value

    return []


def find_receipt_by_legacy_no(token: str, legacy_no: str, store_id: str,
                               protocol_version: str = 'v4') -> Optional[Dict[str, Any]]:
    '''
    Поиск чека по внешнему номеру заказа (legacyNo).
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
    '''
    GET /api/mobile/v1/orders/:orderId - используется для поллинга статуса
    транзакции/чека по внутреннему orderId Екомкассы.
    '''
    url = f'{BASE_URL}/api/mobile/v1/orders/{order_id}'
    req = urllib.request.Request(url, headers={'Token': token})

    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            return json.loads(response.read().decode('utf-8'))
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError):
        return None