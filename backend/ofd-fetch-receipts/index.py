import json
import os
import psycopg2
import urllib.request
import urllib.error
import urllib.parse
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
        dt_from = datetime.now() - timedelta(days=30)
        date_from = dt_from.strftime('%d.%m.%Y')
    else:
        try:
            dt = datetime.fromisoformat(date_from.replace('Z', '+00:00'))
            date_from = dt.strftime('%d.%m.%Y')
        except:
            dt_from = datetime.now() - timedelta(days=30)
            date_from = dt_from.strftime('%d.%m.%Y')
    
    if not date_to:
        date_to = datetime.now().strftime('%d.%m.%Y')
    else:
        try:
            dt = datetime.fromisoformat(date_to.replace('Z', '+00:00'))
            date_to = dt.strftime('%d.%m.%Y')
        except:
            date_to = datetime.now().strftime('%d.%m.%Y')
    
    test_url = f'{api_url}/api/integration/v2/inn/{inn}/kkts'
    test_params = urllib.parse.urlencode({'AuthToken': auth_token})
    test_full_url = f'{test_url}?{test_params}'
    
    print(f"[DEBUG] Testing token with kkts endpoint: {test_full_url[:100]}...")
    
    try:
        test_req = urllib.request.Request(test_full_url, method='GET')
        with urllib.request.urlopen(test_req, timeout=10) as test_response:
            test_body = test_response.read().decode('utf-8')
            print(f"[DEBUG] Token test successful! Response: {test_body[:200]}")
    except Exception as test_error:
        print(f"[DEBUG] Token test failed: {str(test_error)}")
    
    dt_from_obj = datetime.strptime(date_from, '%d.%m.%Y')
    dt_to_obj = datetime.strptime(date_to, '%d.%m.%Y')
    
    iso_from = dt_from_obj.strftime('%Y-%m-%dT00:00:00')
    iso_to = dt_to_obj.strftime('%Y-%m-%dT23:59:59')
    
    ofd_url = f'{api_url}/api/integration/v2/inn/{inn}/kkt/{kkt}/receipts-with-fpd-short'
    
    params = urllib.parse.urlencode({
        'dateFrom': iso_from,
        'dateTo': iso_to,
        'AuthToken': auth_token
    })
    
    full_url = f'{ofd_url}?{params}'
    print(f"[DEBUG] OFD Request: {full_url[:100]}...")
    
    try:
        req = urllib.request.Request(
            full_url,
            method='GET'
        )
        
        print(f"[DEBUG] Auth token length: {len(auth_token) if auth_token else 0}")
        
        with urllib.request.urlopen(req, timeout=30) as response:
            response_body = response.read().decode('utf-8')
            print(f"[DEBUG] Response status: {response.status}")
            print(f"[DEBUG] Response body: {response_body[:500]}")
            
            receipts_data = json.loads(response_body)
            
            if isinstance(receipts_data, dict) and receipts_data.get('Status') == 'Failed':
                conn.close()
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({
                        'success': False,
                        'error': f'OFD API returned error: {receipts_data.get("Errors", [])}',
                        'error_details': receipts_data,
                        'raw_response': response_body,
                        'debug': {
                            'full_url': full_url,
                            'iso_from': iso_from,
                            'iso_to': iso_to,
                            'api_url': api_url,
                            'inn': inn,
                            'kkt': kkt,
                            'token_length': len(auth_token) if auth_token else 0
                        }
                    }),
                    'isBase64Encoded': False
                }
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8') if e.fp else str(e)
        conn.close()
        
        error_data = {}
        try:
            error_data = json.loads(error_body)
        except:
            error_data = {'raw_error': error_body}
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'success': False,
                'error': f'OFD API error: {error_body}',
                'error_details': error_data,
                'debug': {
                    'http_code': e.code,
                    'full_url': full_url,
                    'iso_from': iso_from,
                    'iso_to': iso_to,
                    'has_token': bool(auth_token),
                    'api_url': api_url,
                    'inn': inn,
                    'kkt': kkt
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
    
    if isinstance(receipts_data, dict) and 'Data' in receipts_data:
        receipts = receipts_data.get('Data', [])
    elif isinstance(receipts_data, list):
        receipts = receipts_data
    else:
        receipts = []
    
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
            'iso_from': iso_from,
            'iso_to': iso_to
        }),
        'isBase64Encoded': False
    }