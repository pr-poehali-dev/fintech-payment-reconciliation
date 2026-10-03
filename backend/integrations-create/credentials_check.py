'''
Проверка логина/пароля платёжки при сохранении интеграции.

Правило для всех банков: перед сохранением делаем безвредный запрос к API банка
с введёнными данными (статус несуществующего заказа/платежа). Банк отвечает
по-разному на «неверные данные» и «заказ не найден» - по этому и понимаем, верны ли данные.
  - неверные данные -> (False, понятная ошибка), интеграцию не сохраняем;
  - данные верные -> (True, None);
  - банк недоступен -> (True, предупреждение): сбой банка не мешает настройке.
Новый банк = функция check_<slug> + строка в CHECKERS.
'''
import hashlib
import json
import ssl
import urllib.error
import urllib.parse
import urllib.request
from typing import Any, Callable, Dict, Optional, Tuple

from russian_ca import RUSSIAN_TRUSTED_CA

Result = Tuple[bool, Optional[str]]
_ctx: Dict[str, ssl.SSLContext] = {}


def ssl_context() -> ssl.SSLContext:
    '''Серверы российских банков подписаны сертификатами Минцифры - добавляем их к системным.'''
    if 'ctx' not in _ctx:
        ctx = ssl.create_default_context()
        ctx.load_verify_locations(cadata=RUSSIAN_TRUSTED_CA)
        _ctx['ctx'] = ctx
    return _ctx['ctx']


def _post(url: str, data: bytes, content_type: str) -> Tuple[Optional[Dict[str, Any]], Optional[str]]:
    req = urllib.request.Request(url, data=data, headers={'Content-Type': content_type}, method='POST')
    try:
        with urllib.request.urlopen(req, timeout=8, context=ssl_context()) as resp:
            return json.loads(resp.read().decode('utf-8')), None
    except urllib.error.HTTPError as e:
        return None, f'банк ответил ошибкой {e.code}'
    except Exception as e:
        return None, str(e)[:120]


def _unavailable(bank: str, err: Optional[str]) -> Result:
    return True, f'Не удалось проверить данные: {bank} не ответил ({err}). Интеграция сохранена - проверьте её по первому платежу.'


TBANK_API = 'https://securepay.tinkoff.ru/v2'


def check_tbank(config: Dict[str, Any]) -> Result:
    '''
    Т-Банк эквайринг: GetState по несуществующему платежу.
    501 «Терминал не найден» - неверный Terminal ID; 204 «Неверный токен» - неверный пароль;
    любой другой ответ (например 7/325 «платёж не найден») - пара Terminal ID + пароль верна.
    '''
    terminal = str(config.get('terminal_id') or '').strip()
    password = str(config.get('terminal_password') or '').strip()
    if not terminal or not password:
        return False, 'Укажите Terminal ID и пароль терминала'
    # Номер платежа - правдоподобной длины: на короткий банк отвечает «транзакция не найдена», не проверив пароль.
    payload = {'TerminalKey': terminal, 'PaymentId': '7000000000'}
    values = {**payload, 'Password': password}
    payload['Token'] = hashlib.sha256(''.join(str(values[k]) for k in sorted(values)).encode('utf-8')).hexdigest()
    data, err = _post(f'{TBANK_API}/GetState', json.dumps(payload).encode('utf-8'), 'application/json')
    if data is None:
        return _unavailable('Т-Банк', err)
    code = str(data.get('ErrorCode') or '0')
    if code == '501':
        return False, 'Т-Банк не нашёл терминал с таким Terminal ID - проверьте его в личном кабинете'
    if code == '204':
        return False, 'Неверный пароль терминала - Т-Банк не принял пару Terminal ID + пароль'
    return True, None


ALFA_API = {
    'test': 'https://alfa.rbsuat.com/payment/rest',
    'prod': 'https://payment.alfabank.ru/payment/rest',
    'prod_pay': 'https://pay.alfabank.ru/payment/rest',
}


def check_alfabank(config: Dict[str, Any]) -> Result:
    '''
    Альфа-Банк: getOrderStatusExtended по несуществующему заказу.
    errorCode 5 «Доступ запрещён» - неверный логин/пароль или не тот сервер;
    6 «Заказ не найден» (или любой другой) - данные верны.
    '''
    user = str(config.get('user_name') or '').strip()
    password = str(config.get('password') or '').strip()
    if not user or not password:
        return False, 'Укажите логин и пароль API-пользователя'
    base = ALFA_API.get(config.get('environment') or 'prod', ALFA_API['prod'])
    form = urllib.parse.urlencode({'userName': user, 'password': password,
                                   'orderId': '00000000-0000-0000-0000-000000000000', 'language': 'ru'})
    data, err = _post(f'{base}/getOrderStatusExtended.do', form.encode('utf-8'), 'application/x-www-form-urlencoded')
    if data is None:
        return _unavailable('Альфа-Банк', err)
    if str(data.get('errorCode') or '0') == '5':
        return False, ('Альфа-Банк отказал в доступе: неверный логин или пароль, либо выбран не тот сервер банка '
                       '(логин с префиксом r- - payment.alfabank.ru, без префикса - pay.alfabank.ru)')
    return True, None


CHECKERS: Dict[str, Callable[[Dict[str, Any]], Result]] = {
    'tbank': check_tbank,
    'alfabank': check_alfabank,
}


def check(provider_slug: str, config: Dict[str, Any]) -> Result:
    checker = CHECKERS.get(provider_slug)
    return checker(config or {}) if checker else (True, None)
