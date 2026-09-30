import json
import os
import re
import psycopg2
from typing import Dict, Any, Optional

SCHEMA = 't_p83864310_fintech_payment_reco'

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
}

ACTION_TYPES = {'create_receipt', 'create_order'}
OPERATIONS = {'sell', 'sell_refund', 'sell_correction', 'buy', 'buy_refund', 'buy_correction'}
FIELDS = ('id, code, action_type, name, description, operation, paid, is_active, sort_order, created_at, updated_at')


def respond(status: int, payload: Dict[str, Any]) -> Dict[str, Any]:
    return {
        'statusCode': status,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps(payload, ensure_ascii=False, default=str),
        'isBase64Encoded': False
    }


def is_admin(cur, user_id) -> bool:
    cur.execute(f'''
        SELECT 1 FROM {SCHEMA}.company_users cu
        JOIN {SCHEMA}.companies c ON c.id = cu.company_id
        WHERE cu.user_id = %s AND cu.status = 'active' AND c.is_platform_admin = true
    ''', (user_id,))
    return cur.fetchone() is not None


def row_to_dict(r) -> Dict[str, Any]:
    return {'id': r[0], 'code': r[1], 'action_type': r[2], 'name': r[3], 'description': r[4],
            'operation': r[5], 'paid': r[6], 'is_active': r[7], 'sort_order': r[8],
            'created_at': r[9], 'updated_at': r[10], 'scenarios_count': r[11] if len(r) > 11 else 0}


def validate(body: Dict[str, Any], creating: bool) -> Optional[str]:
    if not (body.get('name') or '').strip():
        return 'Укажите название шаблона'
    if body.get('action_type') not in ACTION_TYPES:
        return 'Неизвестный тип действия'
    if body.get('operation') not in OPERATIONS:
        return 'Неизвестная операция'
    if creating and not re.fullmatch(r'[a-z][a-z0-9_]{1,49}', body.get('code') or ''):
        return 'Код: латиница в нижнем регистре, цифры и _, от 2 до 50 символов'
    return None


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Шаблоны действий автоматизации (каталог платформы).
    GET ?active=1 - активные шаблоны для сценариев компаний (без проверки прав)
    GET ?requester_user_id= - все шаблоны со счётчиком сценариев (админ платформы)
    POST {requester_user_id, code, action_type, name, description, operation, paid, is_active, sort_order} - создать
    PUT {requester_user_id, id, ...те же поля, кроме code} - изменить
    DELETE {requester_user_id, id} - удалить (только если не используется в сценариях)
    '''
    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': '', 'isBase64Encoded': False}

    params = event.get('queryStringParameters') or {}
    body = json.loads(event.get('body') or '{}') if method in ('POST', 'PUT', 'DELETE') else {}

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    try:
        if method == 'GET' and params.get('active'):
            cur.execute(f'''SELECT {FIELDS} FROM {SCHEMA}.automation_action_templates
                            WHERE is_active ORDER BY sort_order, id''')
            return respond(200, {'success': True, 'templates': [row_to_dict(r) for r in cur.fetchall()]})

        requester = params.get('requester_user_id') or body.get('requester_user_id')
        if not requester:
            return respond(400, {'error': 'requester_user_id required'})
        if not is_admin(cur, requester):
            return respond(403, {'error': 'Доступ запрещён'})

        if method == 'GET':
            cur.execute(f'''
                SELECT t.id, t.code, t.action_type, t.name, t.description, t.operation, t.paid, t.is_active,
                       t.sort_order, t.created_at, t.updated_at,
                       (SELECT COUNT(*) FROM {SCHEMA}.automation_scenarios s
                        WHERE s.action_template = t.code AND s.removed_at IS NULL)
                FROM {SCHEMA}.automation_action_templates t
                ORDER BY t.sort_order, t.id
            ''')
            return respond(200, {'success': True, 'templates': [row_to_dict(r) for r in cur.fetchall()]})

        if method == 'POST':
            error = validate(body, True)
            if error:
                return respond(400, {'error': error})
            cur.execute(f'SELECT 1 FROM {SCHEMA}.automation_action_templates WHERE code = %s', (body['code'],))
            if cur.fetchone():
                return respond(400, {'error': 'Шаблон с таким кодом уже есть'})
            cur.execute(f'''
                INSERT INTO {SCHEMA}.automation_action_templates
                    (code, action_type, name, description, operation, paid, is_active, sort_order)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id
            ''', (body['code'], body['action_type'], body['name'].strip(), (body.get('description') or '').strip() or None,
                  body['operation'], bool(body.get('paid', True)), bool(body.get('is_active', True)),
                  int(body.get('sort_order') or 100)))
            new_id = cur.fetchone()[0]
            conn.commit()
            return respond(200, {'success': True, 'id': new_id})

        if method == 'PUT':
            if not body.get('id'):
                return respond(400, {'error': 'id required'})
            error = validate(body, False)
            if error:
                return respond(400, {'error': error})
            cur.execute(f'''
                SELECT t.action_type, (SELECT COUNT(*) FROM {SCHEMA}.automation_scenarios s
                                       WHERE s.action_template = t.code AND s.removed_at IS NULL)
                FROM {SCHEMA}.automation_action_templates t WHERE t.id = %s
            ''', (body['id'],))
            current = cur.fetchone()
            if not current:
                return respond(404, {'error': 'Шаблон не найден'})
            if current[1] and current[0] != body['action_type']:
                return respond(400, {'error': f'Шаблон используется в сценариях ({current[1]}) - тип действия менять нельзя'})
            cur.execute(f'''
                UPDATE {SCHEMA}.automation_action_templates SET
                    action_type = %s, name = %s, description = %s, operation = %s, paid = %s,
                    is_active = %s, sort_order = %s, updated_at = NOW()
                WHERE id = %s
            ''', (body['action_type'], body['name'].strip(), (body.get('description') or '').strip() or None,
                  body['operation'], bool(body.get('paid', True)), bool(body.get('is_active', True)),
                  int(body.get('sort_order') or 100), body['id']))
            conn.commit()
            return respond(200, {'success': True})

        if method == 'DELETE':
            if not body.get('id'):
                return respond(400, {'error': 'id required'})
            cur.execute(f'''
                SELECT t.name, (SELECT COUNT(*) FROM {SCHEMA}.automation_scenarios s
                                WHERE s.action_template = t.code AND s.removed_at IS NULL)
                FROM {SCHEMA}.automation_action_templates t WHERE t.id = %s
            ''', (body['id'],))
            current = cur.fetchone()
            if not current:
                return respond(404, {'error': 'Шаблон не найден'})
            if current[1]:
                return respond(400, {'error': f'Шаблон используется в сценариях ({current[1]}) - удалить нельзя, можно выключить'})
            cur.execute(f'DELETE FROM {SCHEMA}.automation_action_templates WHERE id = %s', (body['id'],))
            conn.commit()
            return respond(200, {'success': True})

        return respond(405, {'error': 'Method not allowed'})
    finally:
        cur.close()
        conn.close()
