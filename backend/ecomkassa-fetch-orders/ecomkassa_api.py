import json
import urllib.request
import urllib.error
from typing import Any, Dict, List, Optional

# https://ecomkassa.ru/podrazdel_api_dokumentacija
BASE_URL = 'https://app.ecomkassa.ru'

# Максимум записей за одну страницу, ограничение самого API Екомкассы.
MAX_PAGE_LIMIT = 500


def search_orders(token: str, since: Optional[str] = None, until: Optional[str] = None,
                   order_types: Optional[List[str]] = None, offset: int = 0,
                   limit: int = MAX_PAGE_LIMIT, timeout: float = 15.0) -> Optional[Dict[str, Any]]:
    '''
    POST /api/mobile/v1/orders/search - поиск чеков/счетов/курьерских заказов
    с фильтрами по дате обновления (since/until, ISO 8601 UTC) и типу документа
    (orderTypes: VCHR - чеки, INVC - счета, CORD - курьерские заказы). Поля можно
    задавать в любой комбинации или не задавать вовсе. Ответ содержит статус
    каждого документа (CREATED/PAID/COMPLETED/CANCELED/WAITING/FAILED) - фильтр
    по статусу применяется уже на нашей стороне, в самом API его нет.
    Returns: {"query": {...}, "result": [{orderId, externalId, updated, orderType,
    status, total, firmId, storeId, storeName, cashierName, isSale, isCorrection}]}
    '''
    body: Dict[str, Any] = {'offset': offset, 'limit': min(limit, MAX_PAGE_LIMIT)}
    if since:
        body['since'] = since
    if until:
        body['until'] = until
    if order_types:
        body['orderTypes'] = order_types

    url = f'{BASE_URL}/api/mobile/v1/orders/search'
    data = json.dumps(body).encode('utf-8')
    req = urllib.request.Request(
        url, data=data, method='POST',
        headers={'Token': token, 'Content-Type': 'application/json; charset=utf-8'}
    )

    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return json.loads(response.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        try:
            error_body = json.loads(e.read().decode('utf-8'))
        except (json.JSONDecodeError, AttributeError):
            error_body = {'errorCode': e.code, 'error': str(e)}
        return {'error': True, **error_body}
    except (urllib.error.URLError, json.JSONDecodeError, TimeoutError) as e:
        return {'error': True, 'errorCode': 0, 'error': str(e)}
