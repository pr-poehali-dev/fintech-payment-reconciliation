import json
import os
import psycopg2
from typing import Dict, Any

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Получение списка платежей из вебхуков с фильтрацией
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
    integration_id = params.get('integration_id')
    limit = int(params.get('limit', 100))
    offset = int(params.get('offset', 0))
    
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
        where_clause = 'WHERE wp.owner_id = %s'
        query_params = [owner_id]
        
        if integration_id:
            where_clause += ' AND wp.integration_id = %s'
            query_params.append(integration_id)
        
        cur.execute(f'''
            SELECT 
                wp.id,
                wp.payment_id,
                wp.amount,
                wp.order_id,
                wp.status,
                wp.payment_status,
                wp.error_code,
                wp.customer_email,
                wp.customer_phone,
                wp.pan,
                wp.card_type,
                wp.exp_date,
                wp.terminal_key,
                wp.raw_data,
                wp.receipt_id,
                wp.created_at,
                ui.integration_name,
                p.name as provider_name
            FROM webhook_payments wp
            JOIN user_integrations ui ON ui.id = wp.integration_id
            JOIN integration_providers p ON p.id = ui.provider_id
            {where_clause}
            ORDER BY wp.created_at DESC
            LIMIT %s OFFSET %s
        ''', query_params + [limit, offset])
        
        payments = []
        for row in cur.fetchall():
            payments.append({
                'id': row[0],
                'payment_id': row[1],
                'amount': float(row[2]) if row[2] else 0,
                'order_id': row[3],
                'status': row[4],
                'payment_status': row[5],
                'error_code': row[6],
                'customer_email': row[7],
                'customer_phone': row[8],
                'pan': row[9],
                'card_type': row[10],
                'exp_date': row[11],
                'terminal_key': row[12],
                'raw_data': row[13],
                'receipt_id': row[14],
                'created_at': row[15].isoformat() if row[15] else None,
                'integration_name': row[16],
                'provider_name': row[17]
            })
        
        cur.execute(f'''
            SELECT COUNT(*) 
            FROM webhook_payments wp
            {where_clause}
        ''', query_params)
        
        total = cur.fetchone()[0]
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'payments': payments,
                'total': total,
                'limit': limit,
                'offset': offset
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
