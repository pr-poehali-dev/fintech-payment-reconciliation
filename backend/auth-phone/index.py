import json
import os
import re
import psycopg2
from typing import Dict, Any


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Авторизация по номеру телефона: находит или создаёт пользователя,
    обновляет last_login_at и возвращает данные пользователя вместе
    со списком компаний, к которым у него есть доступ
    Args: phone (в теле POST запроса)
    Returns: user_id, phone, full_name, is_platform_admin, companies[]
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
    phone_raw = body.get('phone', '')
    full_name = body.get('full_name')

    phone = re.sub(r'\D', '', phone_raw)
    if len(phone) == 11 and phone.startswith('8'):
        phone = '7' + phone[1:]

    if len(phone) != 11 or not phone.startswith('7'):
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Некорректный номер телефона'}),
            'isBase64Encoded': False
        }

    dsn = os.environ['DATABASE_URL']
    conn = psycopg2.connect(dsn)
    cur = conn.cursor()

    try:
        cur.execute('SELECT id, phone, full_name, email FROM app_users WHERE phone = %s', (phone,))
        row = cur.fetchone()

        if row:
            user_id = row[0]
            cur.execute('UPDATE app_users SET last_login_at = now() WHERE id = %s', (user_id,))
        else:
            cur.execute(
                'INSERT INTO app_users (phone, full_name, status) VALUES (%s, %s, %s) RETURNING id, phone, full_name, email',
                (phone, full_name, 'active')
            )
            row = cur.fetchone()
            user_id = row[0]

        conn.commit()

        cur.execute('''
            SELECT c.id, c.name, c.status, r.slug, r.name, r.color, c.is_platform_admin
            FROM company_users cu
            JOIN companies c ON c.id = cu.company_id
            JOIN roles r ON r.id = cu.role_id
            WHERE cu.user_id = %s AND cu.status = 'active'
            ORDER BY c.name
        ''', (user_id,))

        companies = []
        is_platform_admin = False
        for c_row in cur.fetchall():
            companies.append({
                'id': c_row[0],
                'name': c_row[1],
                'status': c_row[2],
                'role_slug': c_row[3],
                'role_name': c_row[4],
                'role_color': c_row[5]
            })
            if c_row[6]:
                is_platform_admin = True

        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'success': True,
                'user_id': row[0],
                'phone': row[1],
                'full_name': row[2],
                'email': row[3],
                'is_platform_admin': is_platform_admin,
                'companies': companies
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