import json
import os
from typing import Any, Dict

import psycopg2

import tochka_oauth
from auth_guard import guard

# Адрес возврата должен совпадать с указанным при регистрации приложения в Точке.
REDIRECT_URI = os.environ.get('TOCHKA_REDIRECT_URI') or 'https://s-verka.ru/oauth/tochka'


def _resp(status: int, payload: Dict[str, Any]) -> Dict[str, Any]:
    return {
        'statusCode': status,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps(payload, ensure_ascii=False),
        'isBase64Encoded': False
    }


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Подключение расчётного счёта Точки по OAuth 2.0 от имени компании.
    GET  ?action=status&company_id=..        -> подключена ли Точка у компании
    GET  ?action=authorize_url&company_id=.. -> ссылка на подтверждение доступа в Точке
    POST { code, company_id }                -> обмен кода на токены и сохранение доступа
    '''
    denied = guard(event)
    if denied:
        return denied

    method = event.get('httpMethod', 'GET')
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    try:
        if method == 'GET':
            params = event.get('queryStringParameters') or {}
            company_id = params.get('company_id')
            if not company_id:
                return _resp(400, {'error': 'company_id required'})
            action = params.get('action')

            if action == 'status':
                return _resp(200, {
                    'configured': tochka_oauth.is_configured(),
                    'connected': tochka_oauth.is_connected(cur, int(company_id)),
                })

            if action == 'authorize_url':
                if not tochka_oauth.is_configured():
                    return _resp(200, {'success': False, 'error': 'Подключение через Точку ещё не настроено на платформе'})
                url, err = tochka_oauth.build_authorize_url(REDIRECT_URI, state=str(company_id))
                if not url:
                    return _resp(200, {'success': False, 'error': err})
                return _resp(200, {'success': True, 'authorize_url': url})

            return _resp(400, {'error': 'Unknown action'})

        if method == 'POST':
            body = json.loads(event.get('body') or '{}')
            code = str(body.get('code') or '').strip()
            company_id = body.get('company_id')
            if not code or not company_id:
                return _resp(400, {'error': 'code and company_id required'})
            token_data, err = tochka_oauth.exchange_code(code, REDIRECT_URI)
            if not token_data:
                return _resp(200, {'success': False, 'error': f'{err}. Ссылка подтверждения действует 5 минут - попробуйте подключить ещё раз'})
            tochka_oauth.save_grant(cur, int(company_id), token_data)
            conn.commit()
            return _resp(200, {'success': True})

        return _resp(405, {'error': 'Method not allowed'})
    finally:
        cur.close()
        conn.close()
