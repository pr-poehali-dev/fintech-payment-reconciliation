import json
import os
import psycopg2
from typing import Dict, Any


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Админ-раздел платформы: каталог ролей компаний (scope=company)
    с количеством пользователей на каждой роли.
    Доступ только для пользователей компании с флагом is_platform_admin.
    Args: requester_user_id (query параметр)
    Returns: список ролей
    '''

    method = event.get('httpMethod', 'GET')

    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }

    if method != 'GET':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'}),
            'isBase64Encoded': False
        }

    params = event.get('queryStringParameters') or {}
    requester_user_id = params.get('requester_user_id')

    if not requester_user_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'requester_user_id required'}),
            'isBase64Encoded': False
        }

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

        cur.execute('''
            SELECT
                r.id, r.slug, r.name, r.description, r.color, r.modules, r.permissions,
                r.is_system, r.sort_order,
                (SELECT COUNT(*) FROM company_users WHERE role_id = r.id AND status = 'active')
            FROM roles r
            WHERE r.scope = 'company'
            ORDER BY r.sort_order
        ''')

        roles = []
        for row in cur.fetchall():
            roles.append({
                'id': row[0],
                'slug': row[1],
                'name': row[2],
                'description': row[3],
                'color': row[4],
                'modules': row[5],
                'permissions': row[6],
                'is_system': row[7],
                'sort_order': row[8],
                'users_count': row[9]
            })

        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'success': True,
                'roles': roles
            }),
            'isBase64Encoded': False
        }

    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }
    finally:
        cur.close()
        conn.close()
