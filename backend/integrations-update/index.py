import json
import os
import psycopg2
from typing import Dict, Any

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Обновление настроек интеграции пользователя
    '''
    
    method = event.get('httpMethod', 'PUT')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'PUT, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
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
    
    body_str = event.get('body', '{}')
    if body_str:
        body = json.loads(body_str)
    else:
        body = {}
    
    integration_id = body.get('integration_id')
    owner_id = body.get('owner_id')
    integration_name = body.get('integration_name')
    config = body.get('config', {})
    webhook_settings = body.get('webhook_settings', {})
    forward_url = body.get('forward_url')
    
    if not integration_id or not owner_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'integration_id and owner_id required'}),
            'isBase64Encoded': False
        }
    
    dsn = os.environ['DATABASE_URL']
    conn = psycopg2.connect(dsn)
    cur = conn.cursor()
    
    try:
        cur.execute('''
            UPDATE user_integrations
            SET 
                integration_name = COALESCE(%s, integration_name),
                config = COALESCE(%s::jsonb, config),
                webhook_settings = COALESCE(%s::jsonb, webhook_settings),
                forward_url = %s,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = %s AND owner_id = %s
            RETURNING id
        ''', (
            integration_name,
            json.dumps(config) if config else None,
            json.dumps(webhook_settings) if webhook_settings else None,
            forward_url,
            integration_id,
            owner_id
        ))
        
        updated = cur.fetchone()
        
        if not updated:
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Integration not found or access denied'}),
                'isBase64Encoded': False
            }
        
        conn.commit()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'success': True,
                'message': 'Integration updated successfully'
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