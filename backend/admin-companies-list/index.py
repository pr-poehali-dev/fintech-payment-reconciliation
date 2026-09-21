import json
import os
import psycopg2
from typing import Dict, Any


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Админ-раздел платформы: список всех компаний с владельцем, тарифом,
    статусом подписки и количеством пользователей.
    Доступ только для пользователей компании с флагом is_platform_admin.
    Args: requester_user_id (query параметр, для проверки прав)
    Returns: список компаний платформы
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
                c.id, c.name, c.inn, c.status, c.created_at, c.is_platform_admin,
                owner.full_name, owner.phone,
                t.name, s.status, s.trial_ends_at, s.current_period_end,
                (SELECT COUNT(*) FROM company_users WHERE company_id = c.id AND status = 'active')
            FROM companies c
            LEFT JOIN LATERAL (
                SELECT u.full_name, u.phone
                FROM company_users cu
                JOIN app_users u ON u.id = cu.user_id
                JOIN roles r ON r.id = cu.role_id
                WHERE cu.company_id = c.id AND r.slug = 'owner' AND cu.status = 'active'
                LIMIT 1
            ) owner ON true
            LEFT JOIN subscriptions s ON s.company_id = c.id
            LEFT JOIN tariffs t ON t.id = s.tariff_id
            ORDER BY c.created_at DESC
        ''')

        companies = []
        for row in cur.fetchall():
            companies.append({
                'id': row[0],
                'name': row[1],
                'inn': row[2],
                'status': row[3],
                'created_at': row[4].isoformat() if row[4] else None,
                'is_platform_admin': row[5],
                'owner_name': row[6],
                'owner_phone': row[7],
                'tariff_name': row[8],
                'subscription_status': row[9],
                'trial_ends_at': row[10].isoformat() if row[10] else None,
                'current_period_end': row[11].isoformat() if row[11] else None,
                'users_count': row[12]
            })

        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'success': True,
                'companies': companies
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
