import json
import re
import urllib.request
import urllib.error
from typing import Dict, Any, List, Optional

from ru_trusted_ca import build_ssl_context

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

# enter.tochka.com отдаёт TLS-сертификат, подписанный НУЦ Минцифры РФ (ГОСТ),
# а не международным CA - системное доверенное хранилище Python его не знает
# и запрос падает с CERTIFICATE_VERIFY_FAILED ещё до отправки токена (поэтому
# ошибка выглядела как "не удалось авторизоваться", хотя токен ни при чём).
SSL_CONTEXT = build_ssl_context()


def _request(path: str, api_token: str) -> Optional[Dict[str, Any]]:
    url = f'{BASE_URL}{path}'
    req = urllib.request.Request(url, headers={'Authorization': f'Bearer {api_token}'})
    try:
        with urllib.request.urlopen(req, timeout=15, context=SSL_CONTEXT) as response:
            raw_body = response.read().decode('utf-8')
            print(f'[DEBUG] GET {url} -> {response.status}: {raw_body[:1500]}')
            return json.loads(raw_body)
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8') if e.fp else str(e)
        print(f'[DEBUG] GET {url} -> HTTP {e.code}: {error_body[:1500]}')
        return None
    except (urllib.error.URLError, json.JSONDecodeError) as e:
        print(f'[DEBUG] GET {url} -> error: {str(e)}')
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


def fetch_balance(api_token: str, account_id: str) -> Optional[float]:
    '''
    Get Balances (https://enter.tochka.com/uapi/open-banking/v1.0/accounts/{accountId}/balances)
    отдаёт несколько типов остатка - берём ClosingAvailable (доступный остаток
    на конец операционного дня), это ближе всего к тому, что видно в интернет-банке.
    '''
    data = _request(f'/accounts/{account_id}/balances', api_token)
    if data is None:
        return None
    balances = data.get('Data', {}).get('Balance', [])
    for b in balances:
        if b.get('type') == 'ClosingAvailable':
            return b.get('Amount', {}).get('amount')
    return balances[0].get('Amount', {}).get('amount') if balances else None


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    По JWT-токену Точки получает список расчётных счетов компании (Get Customers
    List -> Get Accounts List -> Get Balances на каждый счёт), чтобы пользователь
    мог выбрать нужный счёт при настройке интеграции, не переписывая его вручную
    из интернет-банка. accountId Точки уже в формате "номер_счёта/БИК" - его же
    используем и для запроса выписки (Get Statement), поэтому account_number
    в ответе равен account_id.
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
    raw_token = body.get('api_token', '')
    # При копировании токена из интернет-банка/буфера обмена иногда попадают
    # невидимые символы (BOM, zero-width space, переносы строк) - latin-1
    # кодировка HTTP-заголовков их не пропускает, и запрос падает с
    # UnicodeEncodeError до того, как Точка вообще увидит токен. Чистим строго
    # до печатаемого ASCII, как и положено для JWT (base64url + точки).
    api_token = re.sub(r'[^\x21-\x7e]', '', raw_token)

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

    # Один и тот же токен может быть выпущен сразу на несколько customerCode
    # (например, ИП и связанное с ним юрлицо в одном личном кабинете Точки) -
    # Get Accounts List по каждому из них возвращает один и тот же набор
    # реальных счетов компании, поэтому убираем дубли по account_id.
    seen_account_ids = set()
    accounts: List[Dict[str, Any]] = []
    for customer_code in customer_codes:
        for acc in fetch_accounts_for_customer(api_token, customer_code):
            # Get Accounts List не отдаёт номер счёта отдельным полем и баланс -
            # accountId уже и есть идентификатор счёта в формате "номер/БИК"
            # (используется как есть и в Get Statement), а баланс подтягивается
            # отдельным запросом Get Balances.
            account_id = acc.get('accountId')
            if not account_id or account_id in seen_account_ids:
                continue
            seen_account_ids.add(account_id)
            accounts.append({
                'account_id': account_id,
                'account_number': account_id,
                'currency': acc.get('currency'),
                'balance': fetch_balance(api_token, account_id)
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