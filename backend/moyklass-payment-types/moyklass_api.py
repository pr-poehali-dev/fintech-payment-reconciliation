'''
REST API CRM «Мой Класс» (https://api.moyklass.com).

Авторизация: ключ API компании -> POST /v1/company/auth/getToken {apiKey} -> accessToken,
далее заголовок x-access-token. Токен живёт ограниченное время - получаем на каждый запуск
(вызовов мало: вебхук платежа -> 2-4 запроса).

Вебхук «Принят платёж» (payment_new) присылает только: userId, paymentId, summa,
userSubscriptionId, paymentTypeId, date. Ни позиций, ни контактов в нём нет -
дозапрашиваем ученика (телефон, почта, имя) и абонемент (вид абонемента = название позиции).
'''
import json
import re
import urllib.error
import urllib.request
from typing import Any, Dict, List, Optional, Tuple

API = 'https://api.moyklass.com'
TIMEOUT = 8


def _request(method: str, path: str, token: Optional[str] = None,
             body: Optional[Dict[str, Any]] = None) -> Tuple[Optional[Any], Optional[str]]:
    headers = {'Content-Type': 'application/json', 'Accept': 'application/json'}
    if token:
        headers['x-access-token'] = token
    data = json.dumps(body).encode('utf-8') if body is not None else None
    req = urllib.request.Request(API + path, data=data, headers=headers, method=method)
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
            raw = resp.read().decode('utf-8')
            return (json.loads(raw) if raw else {}), None
    except urllib.error.HTTPError as e:
        detail = ''
        try:
            detail = json.loads(e.read().decode('utf-8')).get('message') or ''
        except Exception:
            pass
        if e.code == 401:
            return None, 'Неверный ключ API «Мой Класс»'
        return None, f'«Мой Класс» ответил ошибкой {e.code}{": " + detail if detail else ""}'
    except Exception as e:
        return None, f'«Мой Класс» недоступен: {str(e)[:100]}'


def get_token(api_key: str) -> Tuple[Optional[str], Optional[str]]:
    if not api_key:
        return None, 'Не указан ключ API «Мой Класс»'
    data, err = _request('POST', '/v1/company/auth/getToken', body={'apiKey': api_key})
    if err:
        return None, err
    token = (data or {}).get('accessToken')
    return (token, None) if token else (None, '«Мой Класс» не выдал токен доступа')


def payment_types(token: str) -> Tuple[List[Dict[str, Any]], Optional[str]]:
    data, err = _request('GET', '/v1/company/paymentTypes', token)
    if err:
        return [], err
    return [{'id': int(t['id']), 'name': t.get('name') or f"Способ #{t['id']}"} for t in (data or []) if t.get('id') is not None], None


def get_user(token: str, user_id: Any) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    return _request('GET', f'/v1/company/users/{int(user_id)}', token)


def get_payment(token: str, payment_id: Any) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    return _request('GET', f'/v1/company/payments/{int(payment_id)}', token)


def get_user_subscription(token: str, user_subscription_id: Any) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    return _request('GET', f'/v1/company/userSubscriptions/{int(user_subscription_id)}', token)


def get_subscription(token: str, subscription_id: Any) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    return _request('GET', f'/v1/company/subscriptions/{int(subscription_id)}', token)


def normalize_phone(value: Any) -> Optional[str]:
    '''Телефон по ФФД: +7 и 10 цифр.'''
    digits = re.sub(r'\D', '', str(value or ''))
    if len(digits) == 11 and digits[0] in '78':
        return '+7' + digits[1:]
    if len(digits) == 10:
        return '+7' + digits
    return None
