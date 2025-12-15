import json
import os
import psycopg2
import urllib.request
import urllib.error
import urllib.parse
from typing import Dict, Any

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Получение детальной информации о чеке из OFD.RU
    Args: integration_id, raw_id (ID чека из OFD)
    Returns: подробные данные чека с товарами
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
    integration_id = params.get('integration_id')
    raw_id = params.get('raw_id')
    
    if not integration_id or not raw_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'integration_id and raw_id required'}),
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
    api_url = config.get('api_url', 'https://demo.ofd.ru')
    
    if not all([inn, kkt, auth_token]):
        conn.close()
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Missing INN, KKT or auth_token in config'}),
            'isBase64Encoded': False
        }
    
    ofd_url = f'{api_url}/api/integration/v2/inn/{inn}/kkt/{kkt}/receipt/{raw_id}'
    
    url_params = urllib.parse.urlencode({'AuthToken': auth_token})
    full_url = f'{ofd_url}?{url_params}'
    
    print(f"[DEBUG] Fetching receipt details: {full_url[:100]}...")
    
    try:
        req = urllib.request.Request(full_url, method='GET')
        
        with urllib.request.urlopen(req, timeout=30) as response:
            response_body = response.read().decode('utf-8')
            print(f"[DEBUG] Response status: {response.status}")
            print(f"[DEBUG] Response body: {response_body[:500]}")
            
            receipt_data = json.loads(response_body)
            
            if isinstance(receipt_data, dict) and receipt_data.get('Status') == 'Failed':
                conn.close()
                return {
                    'statusCode': 200,
                    'headers': {
                        'Content-Type': 'application/json',
                        'Access-Control-Allow-Origin': '*'
                    },
                    'body': json.dumps({
                        'success': False,
                        'error': f'OFD API returned error: {receipt_data.get("Errors", [])}',
                        'error_details': receipt_data
                    }),
                    'isBase64Encoded': False
                }
            
            conn.close()
            
            return {
                'statusCode': 200,
                'headers': {
                    'Content-Type': 'application/json',
                    'Access-Control-Allow-Origin': '*'
                },
                'body': json.dumps({
                    'success': True,
                    'receipt': receipt_data
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
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }
