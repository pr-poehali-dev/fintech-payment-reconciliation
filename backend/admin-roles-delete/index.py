import json
import os
import psycopg2
from typing import Dict, Any


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Админ-раздел платформы: удаление роли компании.
    Системные роли (is_system=true) удалить нельзя.
    Роль с активными пользователями удалить нельзя.
    Args: requester_user_id, role_id
    Returns: success
    '''

    method = event.get('httpMethod', 'DELETE')

    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'DELETE, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }

    if method != 'DELETE':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'}),
            'isBase64Encoded': False
        }

    raw_body = event.get('body') or '{}'
    body = json.loads(raw_body)
    requester_user_id = body.get('requester_user_id')
    role_id = body.get('role_id')

    if not requester_user_id or not role_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'requester_user_id and role_id required'}),
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

        cur.execute("SELECT is_system FROM roles WHERE id = %s AND scope = 'company'", (role_id,))
        role_row = cur.fetchone()

        if not role_row:
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Роль не найдена'}),
                'isBase64Encoded': False
            }

        if role_row[0]:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Системную роль нельзя удалить'}),
                'isBase64Encoded': False
            }

        cur.execute("SELECT COUNT(*) FROM company_users WHERE role_id = %s AND status = 'active'", (role_id,))
        if cur.fetchone()[0] > 0:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Роль назначена пользователям, сначала снимите её'}),
                'isBase64Encoded': False
            }

        cur.execute('DELETE FROM roles WHERE id = %s', (role_id,))
        conn.commit()

        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'success': True}),
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