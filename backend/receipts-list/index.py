import json
import os
import psycopg2
from typing import Dict, Any
from decimal import Decimal

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Получение списка чеков из всех источников (касса + ОФД)
    Args: owner_id, limit (опционально), offset (опционально)
    Returns: список чеков с меткой источника
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
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json; charset=utf-8'},
            'body': json.dumps({'error': True, 'message': 'Запрос с заданными параметрами не поддерживается'}, ensure_ascii=False),
            'isBase64Encoded': False
        }
    
    params = event.get('queryStringParameters', {}) or {}
    owner_id = params.get('owner_id')
    limit = int(params.get('limit', 100))
    offset = int(params.get('offset', 0))
    source_filter = params.get('source')
    
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
    
    query_parts = []
    
    if not source_filter or source_filter == 'ofd':
        query_parts.append('''
            SELECT 
                'ofd' as source,
                ofd.id,
                ofd.integration_id,
                ui.integration_name,
                ofd.receipt_id as document_id,
                ofd.operation_type,
                ofd.total_sum,
                ofd.cash_sum,
                ofd.ecash_sum,
                ofd.doc_number,
                ofd.doc_datetime as document_datetime,
                ofd.fn_number,
                ofd.created_at,
                ofd.raw_data
            FROM t_p83864310_fintech_payment_reco.ofd_receipts ofd
            JOIN t_p83864310_fintech_payment_reco.user_integrations ui ON ui.id = ofd.integration_id
            WHERE ofd.owner_id = %s
        ''')
    
    if query_parts:
        union_query = ' UNION ALL '.join(query_parts)
        full_query = f'''
            WITH all_receipts AS ({union_query})
            SELECT * FROM all_receipts
            ORDER BY document_datetime DESC NULLS LAST
            LIMIT %s OFFSET %s
        '''
        
        cur.execute(full_query, (owner_id, limit, offset))
    else:
        cur.execute('SELECT NULL LIMIT 0')
    
    rows = cur.fetchall()
    columns = [desc[0] for desc in cur.description] if cur.description else []
    
    receipts = []
    for row in rows:
        receipt = {}
        for col, val in zip(columns, row):
            if isinstance(val, Decimal):
                receipt[col] = float(val)
            elif hasattr(val, 'isoformat'):
                receipt[col] = val.isoformat()
            else:
                receipt[col] = val
        receipts.append(receipt)
    
    cur.execute('''
        SELECT COUNT(*) FROM t_p83864310_fintech_payment_reco.ofd_receipts WHERE owner_id = %s
    ''', (owner_id,))
    
    total_count = cur.fetchone()[0]
    
    conn.close()
    
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({
            'success': True,
            'receipts': receipts,
            'total': total_count,
            'limit': limit,
            'offset': offset
        }),
        'isBase64Encoded': False
    }