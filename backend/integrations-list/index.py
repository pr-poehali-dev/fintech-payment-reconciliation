import json
import os
import psycopg2
from typing import Dict, Any

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Получение списка всех интеграций owner с группировкой по категориям
    '''
    
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
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
    owner_id = params.get('owner_id')
    
    if not owner_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'owner_id required'}),
            'isBase64Encoded': False
        }
    
    dsn = os.environ['DATABASE_URL']
    conn = psycopg2.connect(dsn)
    cur = conn.cursor()
    
    try:
        cur.execute('''
            SELECT 
                c.id as category_id,
                c.name as category_name,
                c.slug as category_slug,
                c.icon as category_icon,
                p.id as provider_id,
                p.name as provider_name,
                p.slug as provider_slug,
                p.logo_url as provider_logo,
                p.description as provider_description
            FROM integration_categories c
            LEFT JOIN integration_providers p ON p.category_id = c.id AND p.status = 'active'
            ORDER BY c.sort_order, p.name
        ''')
        
        rows = cur.fetchall()
        
        categories = {}
        for row in rows:
            cat_id = row[0]
            if cat_id not in categories:
                categories[cat_id] = {
                    'id': cat_id,
                    'name': row[1],
                    'slug': row[2],
                    'icon': row[3],
                    'providers': []
                }
            
            if row[4]:
                categories[cat_id]['providers'].append({
                    'id': row[4],
                    'name': row[5],
                    'slug': row[6],
                    'logo_url': row[7],
                    'description': row[8]
                })
        
        cur.execute('''
            SELECT 
                ui.id,
                ui.integration_name,
                ui.webhook_token,
                ui.status,
                ui.webhook_count,
                ui.last_webhook_at,
                ui.created_at,
                p.name as provider_name,
                p.slug as provider_slug,
                c.slug as category_slug,
                ui.provider_id,
                ui.config,
                ui.webhook_settings,
                ui.forward_url
            FROM user_integrations ui
            JOIN integration_providers p ON p.id = ui.provider_id
            JOIN integration_categories c ON c.id = p.category_id
            WHERE ui.owner_id = %s
            ORDER BY ui.created_at DESC
        ''', (owner_id,))
        
        user_integrations = []
        for row in cur.fetchall():
            user_integrations.append({
                'id': row[0],
                'integration_name': row[1],
                'webhook_token': row[2],
                'status': row[3],
                'webhook_count': row[4],
                'last_webhook_at': row[5].isoformat() if row[5] else None,
                'created_at': row[6].isoformat() if row[6] else None,
                'provider_name': row[7],
                'provider_slug': row[8],
                'category_slug': row[9],
                'provider_id': row[10],
                'config': row[11],
                'webhook_settings': row[12],
                'forward_url': row[13]
            })
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'categories': list(categories.values()),
                'user_integrations': user_integrations
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