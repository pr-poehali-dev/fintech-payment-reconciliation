import json
import os
from typing import Any, Dict

import psycopg2

SCHEMA = 't_p83864310_fintech_payment_reco'

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
    'Access-Control-Max-Age': '86400'
}


def respond(status: int, payload: Dict[str, Any]) -> Dict[str, Any]:
    return {
        'statusCode': status,
        'headers': {**CORS_HEADERS, 'Content-Type': 'application/json'},
        'body': json.dumps(payload, ensure_ascii=False, default=str),
        'isBase64Encoded': False
    }


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Уведомления в кабинете компании. Прочтение и скрытие - у каждого сотрудника своё.
    GET ?company_id=&user_id=[&unread=1][&limit=] - список и счётчик непрочитанных
    POST {action: "read", company_id, user_id, ids?} - отметить прочитанными (без ids - все)
    POST {action: "hide", company_id, user_id, id} - убрать уведомление из своего списка
    '''
    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': '', 'isBase64Encoded': False}

    params = event.get('queryStringParameters') or {}
    body = json.loads(event.get('body') or '{}') if method == 'POST' else {}
    company_id = body.get('company_id') or params.get('company_id')
    user_id = body.get('user_id') or params.get('user_id')
    if not company_id or not user_id:
        return respond(400, {'error': 'company_id and user_id required'})

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    try:
        if method == 'POST':
            action = body.get('action')
            if action == 'read':
                ids = [int(i) for i in body.get('ids') or []]
                id_filter = 'AND n.id = ANY(%s)' if ids else ''
                args = [user_id, company_id] + ([ids] if ids else [])
                cur.execute(f'''
                    INSERT INTO {SCHEMA}.notification_reads (notification_id, user_id)
                    SELECT n.id, %s FROM {SCHEMA}.notifications n
                    WHERE n.company_id = %s {id_filter}
                    ON CONFLICT (notification_id, user_id) DO NOTHING
                ''', args)
                conn.commit()
                return respond(200, {'success': True})
            if action == 'hide':
                cur.execute(f'''
                    INSERT INTO {SCHEMA}.notification_reads (notification_id, user_id, hidden)
                    SELECT n.id, %s, TRUE FROM {SCHEMA}.notifications n WHERE n.id = %s AND n.company_id = %s
                    ON CONFLICT (notification_id, user_id) DO UPDATE SET hidden = TRUE
                ''', (user_id, body.get('id'), company_id))
                conn.commit()
                return respond(200, {'success': True})
            return respond(400, {'error': 'Unknown action'})

        if method != 'GET':
            return respond(405, {'error': 'Method not allowed'})

        limit = min(int(params.get('limit', 100)), 300)
        unread_filter = 'AND r.read_at IS NULL' if params.get('unread') == '1' else ''
        cur.execute(f'''
            SELECT n.id, n.kind, n.level, n.title, n.message, n.link_module, n.entity_type, n.entity_id,
                   n.payload, n.created_at, r.read_at IS NOT NULL
            FROM {SCHEMA}.notifications n
            LEFT JOIN {SCHEMA}.notification_reads r ON r.notification_id = n.id AND r.user_id = %s
            WHERE n.company_id = %s AND COALESCE(r.hidden, FALSE) = FALSE {unread_filter}
            ORDER BY n.created_at DESC, n.id DESC LIMIT {limit}
        ''', (user_id, company_id))
        items = [{
            'id': r[0], 'kind': r[1], 'level': r[2], 'title': r[3], 'message': r[4],
            'link_module': r[5], 'entity_type': r[6], 'entity_id': r[7], 'payload': r[8],
            'created_at': r[9], 'read': r[10]
        } for r in cur.fetchall()]
        cur.execute(f'''
            SELECT COUNT(*) FROM {SCHEMA}.notifications n
            LEFT JOIN {SCHEMA}.notification_reads r ON r.notification_id = n.id AND r.user_id = %s
            WHERE n.company_id = %s AND r.notification_id IS NULL
        ''', (user_id, company_id))
        unread = cur.fetchone()[0]
        return respond(200, {'success': True, 'notifications': items, 'unread': unread})
    finally:
        cur.close()
        conn.close()
