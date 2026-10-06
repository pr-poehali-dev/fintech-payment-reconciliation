import json
import os
from typing import Any, Dict

import psycopg2
from auth_guard import guard
import moyklass_api

SCHEMA = 't_p83864310_fintech_payment_reco'

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id',
    'Access-Control-Max-Age': '86400'
}


def respond(status: int, payload: Dict[str, Any]) -> Dict[str, Any]:
    return {
        'statusCode': status,
        'headers': {**CORS_HEADERS, 'Content-Type': 'application/json'},
        'body': json.dumps(payload, ensure_ascii=False),
        'isBase64Encoded': False
    }


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Способы оплаты из CRM «Мой Класс» для настройки интеграции: по каким из них создавать чеки.
    POST {company_id, api_key} - по введённому ключу (новая интеграция)
    POST {company_id, integration_id} - по ключу уже сохранённой интеграции
    Returns: payment_types [{id, name}]
    '''
    denied = guard(event)
    if denied:
        return denied
    if event.get('httpMethod') == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': '', 'isBase64Encoded': False}

    body = json.loads(event.get('body') or '{}')
    api_key = str(body.get('api_key') or '').strip()
    integration_id = body.get('integration_id')
    company_id = body.get('company_id')

    if not api_key and integration_id:
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        try:
            cur.execute(f'''
                SELECT ui.config FROM {SCHEMA}.user_integrations ui
                JOIN {SCHEMA}.integration_providers p ON p.id = ui.provider_id
                WHERE ui.id = %s AND ui.company_id = %s AND p.slug = 'moyklass'
            ''', (int(integration_id), int(company_id or 0)))
            row = cur.fetchone()
        finally:
            cur.close()
            conn.close()
        if not row:
            return respond(404, {'error': 'Интеграция не найдена'})
        config = row[0] if isinstance(row[0], dict) else json.loads(row[0] or '{}')
        api_key = str(config.get('api_key') or '').strip()

    if not api_key:
        return respond(400, {'error': 'Укажите ключ API «Мой Класс»'})

    token, err = moyklass_api.get_token(api_key)
    if not token:
        return respond(400, {'error': err})
    types, err = moyklass_api.payment_types(token)
    if err:
        return respond(502, {'error': err})
    return respond(200, {'success': True, 'payment_types': types})
