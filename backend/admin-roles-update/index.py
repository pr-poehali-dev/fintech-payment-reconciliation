import json
import os
import psycopg2
from typing import Dict, Any


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Админ-раздел платформы: редактирование роли компании
    Системные роли (is_system=true) можно редактировать (модули/права/название),
    но нельзя удалить.
    Args: requester_user_id, role_id, name, description, color, modules[], permissions[]
    Returns: обновлённая роль
    '''

    method = event.get('httpMethod', 'PUT')

    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'PUT, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }

    if method != 'PUT':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'}),
            'isBase64Encoded': False
        }

    body = json.loads(event.get('body') or '{}')
    requester_user_id = body.get('requester_user_id')
    role_id = body.get('role_id')
    name = (body.get('name') or '').strip()
    description = body.get('description', '')
    color = body.get('color') or 'bg-info'
    modules = body.get('modules') or []
    permissions = body.get('permissions') or []

    if not requester_user_id or not role_id or not name:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'requester_user_id, role_id and name required'}),
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

        cur.execute("SELECT id FROM roles WHERE id = %s AND scope = 'company'", (role_id,))
        if not cur.fetchone():
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Роль не найдена'}),
                'isBase64Encoded': False
            }

        cur.execute('''
            UPDATE roles
            SET name = %s, description = %s, color = %s, modules = %s, permissions = %s, updated_at = now()
            WHERE id = %s
            RETURNING id, slug, name, description, color, modules, permissions, is_system, sort_order
        ''', (name, description, color, json.dumps(modules), json.dumps(permissions), role_id))

        row = cur.fetchone()
        conn.commit()

        cur.execute('SELECT COUNT(*) FROM company_users WHERE role_id = %s AND status = %s', (role_id, 'active'))
        users_count = cur.fetchone()[0]

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
                    'users_count': users_count
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
