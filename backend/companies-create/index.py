import json
import os
import psycopg2
from typing import Dict, Any


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Создание новой компании: создаёт запись компании, назначает создателя
    владельцем (роль owner) и выдаёт пробную подписку
    Args: user_id, name (short_name для отображения), inn (обязателен),
          kpp, ogrn, full_name, legal_address (опционально, из company-lookup-by-inn)
    Returns: company_id, name, role
    '''

    method = event.get('httpMethod', 'POST')

    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }

    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'}),
            'isBase64Encoded': False
        }

    body = json.loads(event.get('body', '{}'))
    user_id = body.get('user_id')
    name = (body.get('name') or '').strip()
    inn = (body.get('inn') or '').strip()
    kpp = body.get('kpp')
    ogrn = body.get('ogrn')
    full_name = body.get('full_name')
    legal_address = body.get('legal_address')

    if not user_id or not name:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'user_id and name required'}),
            'isBase64Encoded': False
        }

    if not inn or not inn.isdigit() or len(inn) not in (10, 12):
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'ИНН обязателен и должен содержать 10 или 12 цифр'}),
            'isBase64Encoded': False
        }

    dsn = os.environ['DATABASE_URL']
    conn = psycopg2.connect(dsn)
    cur = conn.cursor()

    try:
        cur.execute('SELECT id FROM app_users WHERE id = %s', (user_id,))
        if not cur.fetchone():
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'User not found'}),
                'isBase64Encoded': False
            }

        cur.execute(
            '''INSERT INTO companies (name, inn, kpp, ogrn, full_name, legal_address, status, created_by)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s) RETURNING id, name''',
            (name, inn, kpp, ogrn, full_name, legal_address, 'active', user_id)
        )
        company_id, company_name = cur.fetchone()

        cur.execute("SELECT id, name, color FROM roles WHERE slug = 'owner'")
        role_row = cur.fetchone()
        role_id, role_name, role_color = role_row

        cur.execute(
            '''INSERT INTO company_users (company_id, user_id, role_id, status, joined_at)
               VALUES (%s, %s, %s, %s, now())''',
            (company_id, user_id, role_id, 'active')
        )

        cur.execute("SELECT id FROM tariffs WHERE slug = 'trial'")
        tariff_row = cur.fetchone()

        if tariff_row:
            cur.execute(
                '''INSERT INTO subscriptions (company_id, tariff_id, status, trial_ends_at, current_period_start, current_period_end)
                   VALUES (%s, %s, 'trial', now() + interval '14 days', now(), now() + interval '14 days')''',
                (company_id, tariff_row[0])
            )

        conn.commit()

        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'success': True,
                'company_id': company_id,
                'name': company_name,
                'role_slug': 'owner',
                'role_name': role_name,
                'role_color': role_color
            }),
            'isBase64Encoded': False
        }

    except Exception as e:
        conn.rollback()
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }
    finally:
        cur.close()
        conn.close()