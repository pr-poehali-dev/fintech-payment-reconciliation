import json
import os
import psycopg2
from typing import Dict, Any


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Получение списка компаний, доступных пользователю, с его ролью в каждой
    Args: user_id (query параметр)
    Returns: список компаний с ролью пользователя и статусом подписки
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

    params = event.get('queryStringParameters', {}) or {}
    user_id = params.get('user_id')

    if not user_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'user_id required'}),
            'isBase64Encoded': False
        }

    dsn = os.environ['DATABASE_URL']
    conn = psycopg2.connect(dsn)
    cur = conn.cursor()

    try:
        cur.execute('''
            SELECT
                c.id, c.name, c.inn, c.status,
                r.slug, r.name, r.color,
                s.status, s.trial_ends_at, s.current_period_end,
                t.name
            FROM company_users cu
            JOIN companies c ON c.id = cu.company_id
            JOIN roles r ON r.id = cu.role_id
            LEFT JOIN subscriptions s ON s.company_id = c.id
            LEFT JOIN tariffs t ON t.id = s.tariff_id
            WHERE cu.user_id = %s AND cu.status = 'active'
            ORDER BY c.name
        ''', (user_id,))

        companies = []
        for row in cur.fetchall():
            companies.append({
                'id': row[0],
                'name': row[1],
                'inn': row[2],
                'status': row[3],
                'role_slug': row[4],
                'role_name': row[5],
                'role_color': row[6],
                'subscription_status': row[7],
                'trial_ends_at': row[8].isoformat() if row[8] else None,
                'current_period_end': row[9].isoformat() if row[9] else None,
                'tariff_name': row[10]
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
