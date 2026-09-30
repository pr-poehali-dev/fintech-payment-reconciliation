import json
import os
import re
import psycopg2
from typing import Dict, Any, Optional

from dictionaries import (PROTOCOLS, RECEIPT_TYPES, OPERATIONS, PAYMENT_METHODS,
                          PAYMENT_OBJECTS_V5, MEASURES, PAYMENT_TYPES)

SCHEMA = 't_p83864310_fintech_payment_reco'

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
}

ACTION_TYPES = {'create_receipt', 'create_order'}
EMAIL_RE = re.compile(r'^[^@\s]+@[^@\s]+\.[^@\s]+$')

COLUMNS = ['id', 'code', 'action_type', 'name', 'description', 'operation', 'paid', 'is_active', 'sort_order',
           'provider_id', 'protocol_version', 'receipt_type', 'payment_method', 'payment_object', 'measure',
           'payment_type', 'default_email']
EDITABLE = COLUMNS[2:]


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


def select_templates(cur, only_active: bool):
    cols = ', '.join(f't.{c}' for c in COLUMNS)
    cur.execute(f'''
        SELECT {cols}, p.name,
               (SELECT COUNT(*) FROM {SCHEMA}.automation_scenarios s
                WHERE s.action_template = t.code AND s.removed_at IS NULL)
        FROM {SCHEMA}.automation_action_templates t
        LEFT JOIN {SCHEMA}.integration_providers p ON p.id = t.provider_id
        {'WHERE t.is_active' if only_active else ''}
        ORDER BY t.sort_order, t.id
    ''')
    result = []
    for r in cur.fetchall():
        row = dict(zip(COLUMNS, r))
        row['provider_name'] = r[len(COLUMNS)]
        row['scenarios_count'] = r[len(COLUMNS) + 1]
        result.append(row)
    return result


def normalize(cur, body: Dict[str, Any], creating: bool):
    '''Проверка и приведение полей шаблона. Returns: (values, error).'''
    if not (body.get('name') or '').strip():
        return None, 'Укажите название шаблона'
    if creating and not re.fullmatch(r'[a-z][a-z0-9_]{1,49}', body.get('code') or ''):
        return None, 'Код: латиница в нижнем регистре, цифры и _, от 2 до 50 символов'
    checks = [
        ('action_type', ACTION_TYPES, 'Неизвестный тип действия'),
        ('protocol_version', PROTOCOLS, 'Версия протокола: v4 или v5'),
        ('receipt_type', RECEIPT_TYPES, 'Тип чека: обычный или коррекция'),
        ('operation', OPERATIONS, 'Операция: приход или возврат прихода'),
        ('payment_method', PAYMENT_METHODS, 'Неизвестный признак расчёта'),
        ('payment_object', PAYMENT_OBJECTS_V5, 'Неизвестный предмет расчёта'),
        ('measure', MEASURES, 'Неизвестная единица измерения'),
    ]
    for field, allowed, error in checks:
        if body.get(field) not in allowed:
            return None, error

    if body['receipt_type'] == 'correction' and body['operation'] == 'sell_refund' and body['protocol_version'] == 'v4':
        return None, 'Коррекция возврата прихода есть только в протоколе v5'

    payment_type = body.get('payment_type')
    if payment_type in ('', None):
        payment_type = None
    elif int(payment_type) not in PAYMENT_TYPES:
        return None, 'Неизвестный тип оплаты'
    else:
        payment_type = int(payment_type)

    email = (body.get('default_email') or '').strip() or None
    if email and not EMAIL_RE.match(email):
        return None, 'Почта по умолчанию указана неверно'

    provider_id = body.get('provider_id')
    if not provider_id:
        return None, 'Выберите кассу'
    cur.execute(f'''
        SELECT 1 FROM {SCHEMA}.integration_providers p
        JOIN {SCHEMA}.integration_categories c ON c.id = p.category_id
        WHERE p.id = %s AND c.slug = 'cash_registers'
    ''', (provider_id,))
    if not cur.fetchone():
        return None, 'Касса не найдена'

    return {
        'action_type': body['action_type'],
        'name': body['name'].strip(),
        'description': (body.get('description') or '').strip() or None,
        'operation': body['operation'],
        'paid': payment_type is not None,
        'is_active': bool(body.get('is_active', True)),
        'sort_order': int(body.get('sort_order') or 100),
        'provider_id': int(provider_id),
        'protocol_version': body['protocol_version'],
        'receipt_type': body['receipt_type'],
        'payment_method': body['payment_method'],
        'payment_object': body['payment_object'],
        'measure': body['measure'],
        'payment_type': payment_type,
        'default_email': email,
    }, None


def usage(cur, template_id) -> Optional[tuple]:
    cur.execute(f'''
        SELECT t.action_type, t.name, (SELECT COUNT(*) FROM {SCHEMA}.automation_scenarios s
                                       WHERE s.action_template = t.code AND s.removed_at IS NULL)
        FROM {SCHEMA}.automation_action_templates t WHERE t.id = %s
    ''', (template_id,))
    return cur.fetchone()


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Шаблоны действий автоматизации (каталог платформы) с параметрами чека по АТОЛ Онлайн v4/v5:
    касса, версия протокола, тип чека, операция, признак и предмет расчёта, единица измерения,
    тип оплаты, почта по умолчанию.
    GET ?active=1 - активные шаблоны для сценариев компаний
    GET ?requester_user_id= - все шаблоны + список касс (админ платформы)
    POST / PUT / DELETE {requester_user_id, ...} - создать / изменить / удалить
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
            return respond(200, {'success': True, 'templates': select_templates(cur, True)})

        requester = params.get('requester_user_id') or body.get('requester_user_id')
        if not requester:
            return respond(400, {'error': 'requester_user_id required'})
        if not is_admin(cur, requester):
            return respond(403, {'error': 'Доступ запрещён'})

        if method == 'GET':
            cur.execute(f'''
                SELECT p.id, p.name FROM {SCHEMA}.integration_providers p
                JOIN {SCHEMA}.integration_categories c ON c.id = p.category_id
                WHERE c.slug = 'cash_registers' ORDER BY p.id
            ''')
            providers = [{'id': r[0], 'name': r[1]} for r in cur.fetchall()]
            return respond(200, {'success': True, 'templates': select_templates(cur, False), 'providers': providers})

        if method == 'POST':
            values, error = normalize(cur, body, True)
            if error:
                return respond(400, {'error': error})
            cur.execute(f'SELECT 1 FROM {SCHEMA}.automation_action_templates WHERE code = %s', (body['code'],))
            if cur.fetchone():
                return respond(400, {'error': 'Шаблон с таким кодом уже есть'})
            fields = ['code'] + EDITABLE
            cur.execute(f'''
                INSERT INTO {SCHEMA}.automation_action_templates ({', '.join(fields)})
                VALUES ({', '.join(['%s'] * len(fields))}) RETURNING id
            ''', [body['code']] + [values[f] for f in EDITABLE])
            new_id = cur.fetchone()[0]
            conn.commit()
            return respond(200, {'success': True, 'id': new_id})

        if method == 'PUT':
            if not body.get('id'):
                return respond(400, {'error': 'id required'})
            values, error = normalize(cur, body, False)
            if error:
                return respond(400, {'error': error})
            current = usage(cur, body['id'])
            if not current:
                return respond(404, {'error': 'Шаблон не найден'})
            if current[2] and current[0] != values['action_type']:
                return respond(400, {'error': f'Шаблон используется в сценариях ({current[2]}) - тип действия менять нельзя'})
            cur.execute(f'''
                UPDATE {SCHEMA}.automation_action_templates
                SET {', '.join(f'{f} = %s' for f in EDITABLE)}, updated_at = NOW()
                WHERE id = %s
            ''', [values[f] for f in EDITABLE] + [body['id']])
            conn.commit()
            return respond(200, {'success': True})

        if method == 'DELETE':
            if not body.get('id'):
                return respond(400, {'error': 'id required'})
            current = usage(cur, body['id'])
            if not current:
                return respond(404, {'error': 'Шаблон не найден'})
            if current[2]:
                return respond(400, {'error': f'Шаблон используется в сценариях ({current[2]}) - удалить нельзя, можно выключить'})
            cur.execute(f'DELETE FROM {SCHEMA}.automation_action_templates WHERE id = %s', (body['id'],))
            conn.commit()
            return respond(200, {'success': True})

        return respond(405, {'error': 'Method not allowed'})
    finally:
        cur.close()
        conn.close()
