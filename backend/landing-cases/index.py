import base64
import json
import os
import uuid
from typing import Any, Dict

import boto3
import psycopg2
from auth_guard import guard

SCHEMA = 't_p83864310_fintech_payment_reco'

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Session-Id',
    'Access-Control-Max-Age': '86400'
}

LOGO_TYPES = {'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp', 'image/svg+xml': 'svg'}
MAX_LOGO = 2 * 1024 * 1024


def respond(status: int, payload: Dict[str, Any]) -> Dict[str, Any]:
    return {
        'statusCode': status,
        'headers': {**CORS_HEADERS, 'Content-Type': 'application/json'},
        'body': json.dumps(payload, ensure_ascii=False, default=str),
        'isBase64Encoded': False
    }


def is_admin(cur, user_id) -> bool:
    cur.execute(f'''
        SELECT 1 FROM {SCHEMA}.company_users cu
        JOIN {SCHEMA}.companies c ON c.id = cu.company_id
        WHERE cu.user_id = %s AND cu.status = 'active' AND c.is_platform_admin = true
          AND (cu.platform_admin OR cu.role_id IN (SELECT id FROM {SCHEMA}.roles WHERE slug = 'owner'))
    ''', (user_id,))
    return cur.fetchone() is not None


def list_cases(cur):
    cur.execute(f'''
        SELECT id, task, company_name, logo_url, niche, solution, created_at
        FROM {SCHEMA}.landing_cases ORDER BY sort_order, created_at DESC, id DESC
    ''')
    return [{'id': r[0], 'task': r[1], 'company_name': r[2], 'logo_url': r[3], 'niche': r[4],
             'solution': r[5], 'created_at': r[6].isoformat()} for r in cur.fetchall()]


def upload_logo(data_url: str) -> str:
    header, _, b64 = data_url.partition(',')
    mime = header.split(':', 1)[-1].split(';', 1)[0]
    ext = LOGO_TYPES.get(mime)
    if not ext:
        raise ValueError('Логотип: только PNG, JPG, WEBP или SVG')
    raw = base64.b64decode(b64)
    if len(raw) > MAX_LOGO:
        raise ValueError('Логотип больше 2 МБ')
    key = f'landing-cases/{uuid.uuid4().hex}.{ext}'
    s3 = boto3.client('s3', endpoint_url='https://bucket.poehali.dev',
                      aws_access_key_id=os.environ['AWS_ACCESS_KEY_ID'],
                      aws_secret_access_key=os.environ['AWS_SECRET_ACCESS_KEY'])
    s3.put_object(Bucket='files', Key=key, Body=raw, ContentType=mime)
    return f"https://cdn.poehali.dev/projects/{os.environ['AWS_ACCESS_KEY_ID']}/bucket/{key}"


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Кейсы клиентов для главной страницы.
    GET ?public=1 - все кейсы (без авторизации, для лендинга)
    GET ?requester_user_id= - кейсы для админки
    POST {action: "create", requester_user_id, task, company_name, niche, solution, logo?: data-url base64}
    POST {action: "update", requester_user_id, id, task, company_name, niche, solution,
          logo?: новый data-url, remove_logo?: true} - без logo и remove_logo логотип не меняется
    POST {action: "reorder", requester_user_id, ids: [...]} - порядок кейсов в слайдере
    POST {action: "delete", requester_user_id, id}
    '''
    denied = guard(event, public_query=('public',), check_company=False)
    if denied:
        return denied

    method = event.get('httpMethod', 'GET')
    params = event.get('queryStringParameters') or {}
    body = json.loads(event.get('body') or '{}') if method == 'POST' else {}

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    try:
        if method == 'GET' and params.get('public') == '1':
            return respond(200, {'success': True, 'cases': list_cases(cur)})

        requester = body.get('requester_user_id') or params.get('requester_user_id')
        if not requester or not is_admin(cur, requester):
            return respond(403, {'error': 'Доступно только администраторам платформы'})

        if method == 'GET':
            return respond(200, {'success': True, 'cases': list_cases(cur)})

        action = body.get('action')
        if action in ('create', 'update'):
            fields = {k: str(body.get(k) or '').strip() for k in ('task', 'company_name', 'niche', 'solution')}
            if not all(fields.values()):
                return respond(400, {'error': 'Заполните задачу, компанию, нишу и решение'})
            logo_url = None
            if body.get('logo'):
                try:
                    logo_url = upload_logo(body['logo'])
                except ValueError as e:
                    return respond(400, {'error': str(e)})
            if action == 'update':
                case_id = int(body.get('id') or 0)
                cur.execute(f'SELECT logo_url FROM {SCHEMA}.landing_cases WHERE id = %s', (case_id,))
                row = cur.fetchone()
                if not row:
                    return respond(404, {'error': 'Кейс не найден'})
                if not logo_url and not body.get('remove_logo'):
                    logo_url = row[0]
                cur.execute(f'''
                    UPDATE {SCHEMA}.landing_cases
                    SET task = %s, company_name = %s, logo_url = %s, niche = %s, solution = %s WHERE id = %s
                ''', (fields['task'][:5000], fields['company_name'][:200], logo_url, fields['niche'][:200], fields['solution'][:5000], case_id))
                conn.commit()
                return respond(200, {'success': True, 'cases': list_cases(cur)})
            cur.execute(f'''
                INSERT INTO {SCHEMA}.landing_cases (task, company_name, logo_url, niche, solution, sort_order)
                VALUES (%s, %s, %s, %s, %s, (SELECT COALESCE(MIN(sort_order), 1) - 1 FROM {SCHEMA}.landing_cases))
            ''', (fields['task'][:5000], fields['company_name'][:200], logo_url, fields['niche'][:200], fields['solution'][:5000]))
            conn.commit()
            return respond(200, {'success': True, 'cases': list_cases(cur)})

        if action == 'reorder':
            ids = [int(i) for i in (body.get('ids') or [])]
            for pos, case_id in enumerate(ids):
                cur.execute(f'UPDATE {SCHEMA}.landing_cases SET sort_order = %s WHERE id = %s', (pos, case_id))
            conn.commit()
            return respond(200, {'success': True, 'cases': list_cases(cur)})

        if action == 'delete':
            cur.execute(f'DELETE FROM {SCHEMA}.landing_cases WHERE id = %s', (int(body.get('id') or 0),))
            conn.commit()
            return respond(200, {'success': True, 'cases': list_cases(cur)})

        return respond(400, {'error': 'Unknown action'})
    finally:
        cur.close()
        conn.close()
