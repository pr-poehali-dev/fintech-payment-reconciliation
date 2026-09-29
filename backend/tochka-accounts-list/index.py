import json
import urllib.request
import urllib.error
from typing import Dict, Any, List, Optional

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
}

# Open Banking API Точки (https://developers.tochka.com/docs/tochka-api/algoritm-raboty-s-jwt-tokenom):
# по JWT-токену сначала узнаём customerCode компании (Get Customers List),
# затем по нему - список расчётных счетов с их accountId и номером (Get Accounts List).
BASE_URL = 'https://enter.tochka.com/uapi/open-banking/v1.0'


def _request(path: str, api_token: str) -> Optional[Dict[str, Any]]:
    req = urllib.request.Request(
        f'{BASE_URL}{path}',
        headers={'Authorization': f'Bearer {api_token}'}
    )
    try:
        with urllib.request.urlopen(req, timeout=15) as response:
            return json.loads(response.read().decode('utf-8'))
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError):
        return None


def fetch_customer_codes(api_token: str) -> Optional[List[str]]:
    data = _request('/customers', api_token)
    if data is None:
        return None
    customers = data.get('Data', {}).get('Customer', [])
    return [c.get('customerCode') for c in customers if c.get('customerCode')]


def fetch_accounts_for_customer(api_token: str, customer_code: str) -> List[Dict[str, Any]]:
    data = _request(f'/accounts?customerCode={customer_code}', api_token)
    if data is None:
        return []
    return data.get('Data', {}).get('Account', [])


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    По JWT-токену Точки получает список расчётных счетов компании (Get Customers
    List -> Get Accounts List), чтобы пользователь мог выбрать нужный счёт при
    настройке интеграции, не переписывая номер счёта вручную из интернет-банка.
    Args: api_token (JWT, полученный в интернет-банке Точки)
    Returns: success, accounts[] с полями account_id, account_number, currency, balance
    '''

    method = event.get('httpMethod', 'POST')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': '', 'isBase64Encoded': False}

    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'}),
            'isBase64Encoded': False
        }

    body = json.loads(event.get('body') or '{}')
    api_token = body.get('api_token', '').strip()

    if not api_token:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'api_token required'}),
            'isBase64Encoded': False
        }

    customer_codes = fetch_customer_codes(api_token)
    if customer_codes is None:
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'success': False, 'error': 'Не удалось авторизоваться — проверьте токен и его срок действия'}),
            'isBase64Encoded': False
        }

    accounts: List[Dict[str, Any]] = []
    for customer_code in customer_codes:
        for acc in fetch_accounts_for_customer(api_token, customer_code):
            accounts.append({
                'account_id': acc.get('accountId'),
                'account_number': acc.get('accountNumber') or acc.get('accId'),
                'currency': acc.get('currency'),
                'balance': acc.get('balance', {}).get('amount') if isinstance(acc.get('balance'), dict) else None
            })

    if not accounts:
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'success': False, 'error': 'Счетов не найдено — проверьте права токена (нужен доступ «Счета»)'}),
            'isBase64Encoded': False
        }

    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'success': True, 'accounts': accounts}),
        'isBase64Encoded': False
    }
