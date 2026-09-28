import json
import time
import base64
import urllib.request
import urllib.error
from typing import Any, Dict, Optional

ECOMKASSA_BASE_URL = 'https://app.ecomkassa.ru'

# JWT Екомкассы живёт всего 24 часа - обновляем заранее, за 5 минут до
# истечения, чтобы не словить 401 в середине операции.
EXPIRY_BUFFER_SECONDS = 300


def _decode_jwt_exp(token: str) -> Optional[int]:
    '''Достаёт поле exp из payload JWT без проверки подписи - только чтобы понять, не протух ли токен.'''
    try:
        payload_b64 = token.split('.')[1]
        payload_b64 += '=' * (-len(payload_b64) % 4)
        payload = json.loads(base64.urlsafe_b64decode(payload_b64))
        return payload.get('exp')
    except (IndexError, ValueError, TypeError, json.JSONDecodeError):
        return None


def is_token_expired(token: Optional[str]) -> bool:
    if not token:
        return True
    exp = _decode_jwt_exp(token)
    if exp is None:
        # Не смогли разобрать payload - не будем зря дёргать getToken,
        # пробуем использовать токен как есть.
        return False
    return time.time() >= (exp - EXPIRY_BUFFER_SECONDS)


def fetch_token(login: str, password: str, protocol_version: str = 'v4') -> Optional[str]:
    '''POST /fiscalorder/{version}/getToken - получение нового JWT токена по логину/паролю.'''
    url = f'{ECOMKASSA_BASE_URL}/fiscalorder/{protocol_version}/getToken'
    data = json.dumps({'login': login, 'pass': password}).encode('utf-8')
    req = urllib.request.Request(
        url, data=data, method='POST',
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


def ensure_valid_token(cur, integration_id: int, config: Dict[str, Any]) -> Optional[str]:
    '''
    Возвращает рабочий токен Екомкассы: если сохранённый в config токен уже
    истёк или истекает в ближайшие 5 минут, получает новый по сохранённым
    логину/паролю кассы и сразу обновляет config в БД - чтобы касса не
    переставала работать без ручного захода пользователя в личный кабинет.
    Логин/пароль сохраняются в config только при подключении/переавторизации
    кассы через EcomkassaStorePicker - если их там нет (старая интеграция,
    подключённая до появления автообновления), токен не обновляется и функция
    ведёт себя как раньше: полагается на сохранённый токен, пока он не протухнет.
    Returns: токен (новый или тот же, если он ещё живой) или None/старый
    просроченный, если обновить не удалось.
    '''
    token = config.get('token')

    if not is_token_expired(token):
        return token

    login = config.get('login')
    password = config.get('password')
    if not login or not password:
        return token

    protocol_version = config.get('protocol_version', 'v4')
    new_token = fetch_token(login, password, protocol_version)
    if not new_token:
        return token

    config['token'] = new_token
    cur.execute('''
        UPDATE t_p83864310_fintech_payment_reco.user_integrations
        SET config = config || jsonb_build_object('token', %s::text),
            updated_at = NOW()
        WHERE id = %s
    ''', (new_token, integration_id))

    return new_token
