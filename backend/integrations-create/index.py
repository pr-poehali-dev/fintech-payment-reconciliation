import json
import os
import secrets
import psycopg2
from typing import Dict, Any

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Создание новой интеграции для owner
    Генерирует уникальный webhook_token и возвращает URL для настройки
    '''
    
    method = event.get('httpMethod', 'POST')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
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
    owner_id = body.get('owner_id')
    provider_slug = body.get('provider_slug')
    integration_name = body.get('integration_name', '')
    config = body.get('config', {})
    forward_url = body.get('forward_url', '')
    webhook_settings = body.get('webhook_settings', {
        'notify_on_authorized': True,
        'notify_on_confirmed': True,
        'notify_on_rejected': True,
        'notify_on_refunded': True
    })
    
    if not owner_id or not provider_slug:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'owner_id and provider_slug required'}),
            'isBase64Encoded': False
        }
    
    webhook_token = secrets.token_urlsafe(32)
    
    dsn = os.environ['DATABASE_URL']
    conn = psycopg2.connect(dsn)
    cur = conn.cursor()
    
    try:
        cur.execute('''
            SELECT id FROM integration_providers 
            WHERE slug = %s AND status = 'active'
        ''', (provider_slug,))
        
        provider_row = cur.fetchone()
        if not provider_row:
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Provider not found'}),
                'isBase64Encoded': False
            }
        
        provider_id = provider_row[0]
        
        cur.execute('''
            INSERT INTO user_integrations 
            (owner_id, provider_id, integration_name, webhook_token, config, webhook_settings, forward_url, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, 'active')
            RETURNING id, webhook_token
        ''', (
            owner_id, 
            provider_id, 
            integration_name, 
            webhook_token,
            json.dumps(config),
            json.dumps(webhook_settings),
            forward_url if forward_url else None
        ))
        
        integration_id, token = cur.fetchone()
        conn.commit()
        
        webhook_url = f"https://functions.poehali.dev/a923b457-57a6-4eb2-b566-9a9d65cb04e8/{token}"
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'success': True,
                'integration_id': integration_id,
                'webhook_url': webhook_url,
                'webhook_token': token
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