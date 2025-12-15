import json
import os
import psycopg2
import urllib.request
import urllib.error
from typing import Dict, Any
from datetime import datetime, timedelta

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Загрузка чеков из OFD.RU за указанный период
    Args: integration_id, date_from (ISO), date_to (ISO)
    Returns: список чеков и статистика загрузки
    '''
    
    method = event.get('httpMethod', 'POST')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    if method != 'POST':
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json; charset=utf-8'},
            'body': json.dumps({'error': True, 'message': 'Запрос с заданными параметрами не поддерживается'}, ensure_ascii=False),
            'isBase64Encoded': False
        }
    
    body_data = json.loads(event.get('body', '{}'))
    integration_id = body_data.get('integration_id')
    date_from = body_data.get('date_from')
    date_to = body_data.get('date_to')
    
    if not integration_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'integration_id required'}),
            'isBase64Encoded': False
        }
    
    dsn = os.environ['DATABASE_URL']
    conn = psycopg2.connect(dsn)
    cur = conn.cursor()
    
    cur.execute('''
        SELECT config, owner_id, provider_id
        FROM t_p83864310_fintech_payment_reco.user_integrations
        WHERE id = %s AND status = 'active'
    ''', (integration_id,))
    
    integration_row = cur.fetchone()
    if not integration_row:
        conn.close()
        return {
            'statusCode': 404,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Integration not found'}),
            'isBase64Encoded': False
        }
    
    config, owner_id, provider_id = integration_row
    config = json.loads(config) if isinstance(config, str) else config
    
    inn = config.get('inn')
    kkt = config.get('kkt')
    auth_token = config.get('auth_token')
    api_url = config.get('api_url', 'https://ofd.ru')
    
    if not all([inn, kkt, auth_token]):
        conn.close()
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Missing INN, KKT or auth_token in config'}),
            'isBase64Encoded': False
        }
    
    if not date_from:
        date_from = (datetime.now() - timedelta(days=1)).strftime('%d.%m.%Y')
    else:
        try:
            dt = datetime.fromisoformat(date_from.replace('Z', '+00:00'))
            date_from = dt.strftime('%d.%m.%Y')
        except:
            date_from = (datetime.now() - timedelta(days=1)).strftime('%d.%m.%Y')
    
    if not date_to:
        date_to = datetime.now().strftime('%d.%m.%Y')
    else:
        try:
            dt = datetime.fromisoformat(date_to.replace('Z', '+00:00'))
            date_to = dt.strftime('%d.%m.%Y')
        except:
            date_to = datetime.now().strftime('%d.%m.%Y')
    
    ofd_url = f'{api_url}/api/integration/v2/inn/{inn}/kkt/{kkt}/receipts'
    
    print(f"[DEBUG] OFD Request: {ofd_url}?DateFrom={date_from}&DateTo={date_to}")
    
    try:
        req = urllib.request.Request(
            f'{ofd_url}?DateFrom={date_from}&DateTo={date_to}',
            headers={'AuthToken': auth_token},
            method='GET'
        )
        
        with urllib.request.urlopen(req, timeout=30) as response:
            response_body = response.read().decode('utf-8')
            receipts_data = json.loads(response_body)
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8') if e.fp else str(e)
        conn.close()
        return {
            'statusCode': e.code,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({
                'error': f'OFD API error: {error_body}',
                'debug': {
                    'url': ofd_url,
                    'DateFrom': date_from,
                    'DateTo': date_to,
                    'has_token': bool(auth_token)
                }
            }),
            'isBase64Encoded': False
        }
    except Exception as e:
        conn.close()
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }
    
    receipts = receipts_data if isinstance(receipts_data, list) else []
    
    inserted_count = 0
    for receipt in receipts:
        try:
            cur.execute('''
                INSERT INTO t_p83864310_fintech_payment_reco.ofd_receipts (
                    integration_id, owner_id, receipt_id, operation_type,
                    total_sum, cash_sum, ecash_sum, doc_number, doc_datetime,
                    fn_number, raw_data
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (integration_id, receipt_id) DO NOTHING
                RETURNING id
            ''', (
                integration_id,
                owner_id,
                receipt.get('Id'),
                receipt.get('OperationType'),
                float(receipt.get('TotalSumm', 0)) / 100,
                float(receipt.get('CashSumm', 0)) / 100,
                float(receipt.get('ECashSumm', 0)) / 100,
                receipt.get('DocNumber'),
                receipt.get('DocDateTime'),
                receipt.get('FnNumber'),
                json.dumps(receipt)
            ))
            
            if cur.fetchone():
                inserted_count += 1
        except Exception as e:
            continue
    
    conn.commit()
    conn.close()
    
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({
            'success': True,
            'total_receipts': len(receipts),
            'inserted': inserted_count,
            'date_from': date_from,
            'date_to': date_to
        }),
        'isBase64Encoded': False
    }