import json
import urllib.error
import urllib.request
from typing import Any, Dict, Optional, Tuple

from ecomkassa_token import ensure_valid_token

SCHEMA = 't_p83864310_fintech_payment_reco'
BASE_URL = 'https://app.ecomkassa.ru'


def _request(method: str, path: str, token: str, body: Optional[Dict[str, Any]] = None,
             timeout: float = 15.0) -> Tuple[int, Any]:
    data = json.dumps(body, ensure_ascii=False).encode('utf-8') if body is not None else None
    req = urllib.request.Request(f'{BASE_URL}{path}', data=data, method=method,
                                 headers={'Token': token, 'Content-Type': 'application/json; charset=utf-8'})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            text = r.read().decode('utf-8')
            status = r.status
    except urllib.error.HTTPError as e:
        text = e.read().decode('utf-8') if e.fp else ''
        status = e.code
    except (urllib.error.URLError, TimeoutError) as e:
        return 0, str(e)
    try:
        return status, json.loads(text) if text else None
    except json.JSONDecodeError:
        return status, text


def cash_register(cur, integration_id: int) -> Optional[Dict[str, Any]]:
    '''Касса Екомкассы: рабочий токен (обновляется сам), номер магазина, версия протокола.'''
    cur.execute(f'''
        SELECT ui.config, p.slug FROM {SCHEMA}.user_integrations ui
        JOIN {SCHEMA}.integration_providers p ON p.id = ui.provider_id
        WHERE ui.id = %s AND ui.status = 'active'
    ''', (integration_id,))
    row = cur.fetchone()
    if not row or row[1] != 'ecomkassa':
        return None
    config = json.loads(row[0]) if isinstance(row[0], str) else (row[0] or {})
    token = ensure_valid_token(cur, integration_id, config)
    if not token or not config.get('store_id'):
        return None
    return {'id': integration_id, 'token': token, 'store_id': str(config['store_id']),
            'protocol_version': config.get('protocol_version', 'v4')}


def company_cash_register(cur, company_id: int) -> Optional[Dict[str, Any]]:
    cur.execute(f'''
        SELECT ui.id FROM {SCHEMA}.user_integrations ui
        JOIN {SCHEMA}.integration_providers p ON p.id = ui.provider_id
        WHERE ui.company_id = %s AND p.slug = 'ecomkassa' AND ui.status = 'active'
        ORDER BY ui.id LIMIT 1
    ''', (company_id,))
    row = cur.fetchone()
    return cash_register(cur, row[0]) if row else None


def get_receipt_atol(kassa: Dict[str, Any], order_id: str) -> Tuple[Optional[Dict[str, Any]], str]:
    '''
    GET /api/mobile/v1/orders/:orderId/atol-4 (или atol-5 по протоколу кассы) -
    чек по идентификатору в формате АТОЛ Онлайн: корзина, оплаты, организация, клиент.
    '''
    fmt = 'atol-5' if kassa['protocol_version'] == 'v5' else 'atol-4'
    status, data = _request('GET', f'/api/mobile/v1/orders/{order_id}/{fmt}', kassa['token'])
    if status == 200 and isinstance(data, dict) and isinstance(data.get('receipt'), dict):
        return data, ''
    return None, f'Екомкасса не отдала чек #{order_id} ({status}: {str(data)[:200]})'


def create_courier_order(kassa: Dict[str, Any], operation: str, body: Dict[str, Any]) -> Tuple[Optional[Dict[str, Any]], str]:
    '''
    POST /api/mobile/v1/courier/:storeId/create/:operation (sell / sell_refund) -
    создание заказа, тело как у чека продажи АТОЛ Онлайн. Повтор с тем же
    external_id возвращает уже созданный заказ, дубль не появляется.
    '''
    status, data = _request('POST', f"/api/mobile/v1/courier/{kassa['store_id']}/create/{operation}",
                            kassa['token'], body, timeout=20.0)
    if status == 200 and isinstance(data, dict) and data.get('uuid') and not data.get('error'):
        return data, ''
    return None, f'Екомкасса не создала заказ ({status}: {str(data)[:300]})'


def deliver_courier_order(kassa: Dict[str, Any], order_id: str, body: Dict[str, Any]) -> Tuple[Optional[Dict[str, Any]], str]:
    '''
    POST /api/mobile/v1/courier/:orderId/deliver - подтверждение доставки (оплата) заказа.
    Тело: cashierName, paymentAddress, customerEmail, customerPhone (необязательные) и
    payments в формате АТОЛ 4 - если заказ не был предоплачен; предоплаченный - пустой массив.
    После подтверждения касса пробивает чек и шлёт callback_url заказа.
    '''
    status, data = _request('POST', f'/api/mobile/v1/courier/{order_id}/deliver', kassa['token'], body, timeout=20.0)
    if status == 200 and isinstance(data, dict) and data.get('errorCode') == 0:
        return data.get('payload') or {}, ''
    return None, f'Екомкасса не подтвердила доставку заказа #{order_id} ({status}: {str(data)[:300]})'


def order_status(kassa: Dict[str, Any], order_id: str) -> Optional[str]:
    '''GET /api/mobile/v1/orders/:orderId - статус заказа (WAITING, PAID ...).'''
    status, data = _request('GET', f'/api/mobile/v1/orders/{order_id}', kassa['token'])
    return data.get('status') if status == 200 and isinstance(data, dict) else None
