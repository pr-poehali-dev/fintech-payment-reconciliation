import json
import os
import psycopg2
from typing import Dict, Any

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Получение логов переадресации вебхуков
    GET /webhook-logs?owner_id=123&integration_id=456&limit=50
    '''
    method: str = event.get('httpMethod', 'GET')
    
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
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Method not allowed'}),
            'isBase64Encoded': False
        }
    
    params = event.get('queryStringParameters', {}) or {}
    owner_id = params.get('owner_id')
    integration_id = params.get('integration_id')
    limit = int(params.get('limit', '100'))
    
    if not owner_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'owner_id required'}),
            'isBase64Encoded': False
        }
    
    dsn = os.environ['DATABASE_URL']
    conn = psycopg2.connect(dsn)
    cur = conn.cursor()
    
    try:
        query = '''
            SELECT 
                wfl.id,
                wfl.webhook_payment_id,
                wfl.forward_url,
                wfl.status_code,
                wfl.error_message,
                wfl.response_time_ms,
                wfl.created_at,
                wp.payment_id,
                wp.order_id,
                wp.amount,
                wp.status as payment_status
            FROM t_p83864310_fintech_payment_reco.webhook_forward_logs wfl
            LEFT JOIN t_p83864310_fintech_payment_reco.webhook_payments wp ON wp.id = wfl.webhook_payment_id
            LEFT JOIN t_p83864310_fintech_payment_reco.user_integrations ui ON ui.id = wp.integration_id
            WHERE ui.owner_id = %s
        '''
        
        params_list = [owner_id]
        
        if integration_id:
            query += ' AND ui.id = %s'
            params_list.append(integration_id)
        
        query += ' ORDER BY wfl.created_at DESC LIMIT %s'
        params_list.append(limit)
        
        cur.execute(query, params_list)
        
        logs = []
        for row in cur.fetchall():
            logs.append({
                'id': row[0],
                'webhook_payment_id': row[1],
                'forward_url': row[2],
                'status_code': row[3],
                'error_message': row[4],
                'response_time_ms': row[5],
                'created_at': row[6].isoformat() if row[6] else None,
                'payment_id': row[7],
                'order_id': row[8],
                'amount': float(row[9]) if row[9] else None,
                'payment_status': row[10]
            })
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'logs': logs}),
            'isBase64Encoded': False
        }
        
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }
    finally:
        cur.close()
        conn.close()
