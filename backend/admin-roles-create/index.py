import json
import os
import re
import psycopg2
from typing import Dict, Any


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Админ-раздел платформы: создание новой роли компании (scope=company)
    Args: requester_user_id, name, description, color, modules[], permissions[]
    Returns: созданная роль
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

    raw_body = event.get('body') or '{}'
    body = json.loads(raw_body)
    requester_user_id = body.get('requester_user_id')
    name = (body.get('name') or '').strip()
    description = body.get('description', '')
    color = body.get('color') or 'bg-info'
    modules = body.get('modules') or []
    permissions = body.get('permissions') or []

    if not requester_user_id or not name:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'requester_user_id and name required'}),
            'isBase64Encoded': False
        }

    slug = re.sub(r'[^a-z0-9_]', '', name.lower().replace(' ', '_'))
    if not slug:
        slug = 'role'

    dsn = os.environ['DATABASE_URL']
    conn = psycopg2.connect(dsn)
    cur = conn.cursor()

    try:
        cur.execute('''
            SELECT 1 FROM company_users cu
            JOIN companies c ON c.id = cu.company_id
            WHERE cu.user_id = %s AND cu.status = 'active' AND c.is_platform_admin = true
        ''', (requester_user_id,))

        if not cur.fetchone():
            return {
                'statusCode': 403,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Доступ запрещён'}),
                'isBase64Encoded': False
            }

        cur.execute('SELECT id FROM roles WHERE slug = %s', (slug,))
        if cur.fetchone():
            slug = f'{slug}_{os.urandom(2).hex()}'

        cur.execute('SELECT COALESCE(MAX(sort_order), 0) + 1 FROM roles WHERE scope = \'company\'')
        next_sort = cur.fetchone()[0]

        cur.execute('''
            INSERT INTO roles (slug, name, description, color, scope, modules, permissions, is_system, sort_order)
            VALUES (%s, %s, %s, %s, 'company', %s, %s, false, %s)
            RETURNING id, slug, name, description, color, modules, permissions, is_system, sort_order
        ''', (slug, name, description, color, json.dumps(modules), json.dumps(permissions), next_sort))

        row = cur.fetchone()
        conn.commit()

        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'success': True,
                'role': {
                    'id': row[0],
                    'slug': row[1],
                    'name': row[2],
                    'description': row[3],
                    'color': row[4],
                    'modules': row[5],
                    'permissions': row[6],
                    'is_system': row[7],
                    'sort_order': row[8],
                    'users_count': 0
                }
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