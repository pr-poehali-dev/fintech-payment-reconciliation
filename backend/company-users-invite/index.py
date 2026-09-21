import json
import os
import re
import psycopg2
from typing import Dict, Any


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Приглашение пользователя в компанию по номеру телефона с назначением роли
    Если пользователя с таким телефоном ещё нет — он будет создан
    Args: company_id, phone, full_name, role_slug, invited_by (user_id)
    Returns: user_id, status приглашения
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
    company_id = body.get('company_id')
    phone_raw = body.get('phone', '')
    full_name = body.get('full_name')
    role_slug = body.get('role_slug')
    invited_by = body.get('invited_by')

    phone = re.sub(r'\D', '', phone_raw)

    if not company_id or len(phone) < 10 or not role_slug:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'company_id, phone and role_slug required'}),
            'isBase64Encoded': False
        }

    dsn = os.environ['DATABASE_URL']
    conn = psycopg2.connect(dsn)
    cur = conn.cursor()

    try:
        cur.execute("SELECT id FROM roles WHERE slug = %s AND scope = 'company'", (role_slug,))
        role_row = cur.fetchone()
        if not role_row:
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Role not found'}),
                'isBase64Encoded': False
            }
        role_id = role_row[0]

        cur.execute('SELECT id FROM app_users WHERE phone = %s', (phone,))
        user_row = cur.fetchone()

        if user_row:
            user_id = user_row[0]
        else:
            cur.execute(
                'INSERT INTO app_users (phone, full_name, status) VALUES (%s, %s, %s) RETURNING id',
                (phone, full_name, 'active')
            )
            user_id = cur.fetchone()[0]

        cur.execute(
            'SELECT id FROM company_users WHERE company_id = %s AND user_id = %s',
            (company_id, user_id)
        )
        if cur.fetchone():
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Пользователь уже добавлен в эту компанию'}),
                'isBase64Encoded': False
            }

        cur.execute(
            '''INSERT INTO company_users (company_id, user_id, role_id, status, invited_by, invited_at)
               VALUES (%s, %s, %s, %s, %s, now())''',
            (company_id, user_id, role_id, 'pending', invited_by)
        )

        conn.commit()

        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'success': True,
                'user_id': user_id,
                'status': 'pending'
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
