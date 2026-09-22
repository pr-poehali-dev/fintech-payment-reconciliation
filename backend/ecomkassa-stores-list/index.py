import json
from typing import Dict, Any

from ecomkassa_api import get_token, fetch_firm_profile

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
}


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    По логину/паролю Екомкассы получает токен авторизации и список магазинов (stores)
    из профиля организации - чтобы пользователь мог выбрать нужный storeId
    при настройке интеграции, не открывая личный кабинет Екомкассы.
    Args: login, password, protocol_version ('v4' или 'v5')
    Returns: token, stores[] (id, name/title и другие поля как есть от API)
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
    login = body.get('login', '').strip()
    password = body.get('password', '')
    protocol_version = body.get('protocol_version', 'v4')

    if protocol_version not in ('v4', 'v5'):
        protocol_version = 'v4'

    if not login or not password:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'login and password required'}),
            'isBase64Encoded': False
        }

    token = get_token(login, password, protocol_version)
    if not token:
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'success': False, 'error': 'Неверный логин или пароль Екомкассы'}),
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

    stores = firm_profile.get('stores', []) if isinstance(firm_profile, dict) else []

    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({
            'success': True,
            'token': token,
            'stores': stores
        }),
        'isBase64Encoded': False
    }
