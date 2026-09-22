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
            return json.loads(response.read().decode('utf-8'))
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError):
        return None


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
