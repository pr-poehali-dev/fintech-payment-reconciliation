import json
import os
import re
import psycopg2
from typing import Dict, Any

from ecomkassa_api import get_token_detailed, fetch_firm_profile, extract_stores, extract_firm_inn
from auth_guard import guard

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
}


def normalize_inn(value: Any) -> str:
    return re.sub(r'\D', '', str(value)) if value else ''


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    По логину/паролю Екомкассы получает токен авторизации и список магазинов (stores)
    из профиля организации - чтобы пользователь мог выбрать нужный storeId
    при настройке интеграции, не открывая личный кабинет Екомкассы.
    Дополнительно сверяет ИНН организации в Екомкассе с ИНН компании в кабинете
    сервиса - защита от ошибки (особенно у бухгалтера), если случайно указаны
    логин/пароль от чужой Екомкассы, привязанной к другому юрлицу.
    Args: login, password, protocol_version ('v4' или 'v5'), company_id (опционально, для сверки ИНН)
    Returns: token, stores[], ecomkassa_inn, company_inn, inn_match
    '''
    denied = guard(event)
    if denied:
        return denied


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
    login = body.get('login', '').strip()
    password = body.get('password', '')
    protocol_version = body.get('protocol_version', 'v4')
    company_id = body.get('company_id')

    if protocol_version not in ('v4', 'v5'):
        protocol_version = 'v4'

    if not login or not password:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'login and password required'}),
            'isBase64Encoded': False
        }

    auth = get_token_detailed(login, password, protocol_version)
    token = auth['token']
    if not token:
        messages = {
            'blocked': 'Ваша учётная запись в Екомкассе заблокирована. Обратитесь в поддержку Екомкассы',
            'wrong_credentials': 'Неверный логин или пароль Екомкассы',
            'unknown_login': 'Пользователь с таким логином в Екомкассе не найден',
            'network': 'Екомкасса не отвечает, попробуйте позже',
        }
        error = messages.get(auth['reason']) or f"Екомкасса отказала во входе: {auth.get('raw')}"
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'success': False, 'error': error, 'reason': auth['reason'],
                                'provider_error': auth.get('raw')}, ensure_ascii=False),
            'isBase64Encoded': False
        }

    firm_profile = fetch_firm_profile(token)
    if firm_profile is None:
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'success': False, 'error': 'Не удалось получить список магазинов'}),
            'isBase64Encoded': False
        }

    raw_stores = extract_stores(firm_profile)

    # Нормализуем поля Екомкассы (storeId/storeName/storeAddress) в единый
    # формат id/name/address, чтобы фронтенду не нужно было знать про их нейминг.
    stores = [
        {
            'id': store.get('storeId'),
            'name': store.get('storeName'),
            'address': store.get('storeAddress'),
            'type': store.get('storeType')
        }
        for store in raw_stores
        if isinstance(store, dict)
    ]

    ecomkassa_inn = extract_firm_inn(firm_profile)
    company_inn = None
    inn_match = None

    if company_id:
        dsn = os.environ['DATABASE_URL']
        conn = psycopg2.connect(dsn)
        cur = conn.cursor()
        try:
            cur.execute('''
                SELECT inn FROM t_p83864310_fintech_payment_reco.companies WHERE id = %s
            ''', (company_id,))
            row = cur.fetchone()
            company_inn = row[0] if row else None
        finally:
            cur.close()
            conn.close()

        if company_inn and ecomkassa_inn:
            inn_match = normalize_inn(company_inn) == normalize_inn(ecomkassa_inn)

    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({
            'success': True,
            'token': token,
            'stores': stores,
            'ecomkassa_inn': ecomkassa_inn,
            'company_inn': company_inn,
            'inn_match': inn_match
        }),
        'isBase64Encoded': False
    }