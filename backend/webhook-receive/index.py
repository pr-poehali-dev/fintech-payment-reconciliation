import json
import os
import hashlib
import psycopg2
import urllib.request
import urllib.error
import time
from typing import Dict, Any

def verify_tbank_token(data: Dict[str, Any], terminal_password: str) -> bool:
    '''
    Проверка подписи вебхука от Тбанка
    https://developer.tbank.ru/eacq/intro/developer/notification
    '''
    received_token = data.get('Token', '')
    if not received_token:
        return False
    
    values_to_hash = []
    for key in sorted(data.keys()):
        if key != 'Token':
            values_to_hash.append(str(data[key]))
    
    values_to_hash.append(terminal_password)
    
    concatenated = ''.join(values_to_hash)
    calculated_token = hashlib.sha256(concatenated.encode('utf-8')).hexdigest()
    
    return calculated_token == received_token

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Прием вебхуков от платежных провайдеров по уникальному токену
    Сохраняет данные платежа в БД для дальнейшей обработки
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
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Method not allowed'}),
            'isBase64Encoded': False
        }
    
    url = event.get('url', '')
    webhook_token = url.strip('/') if url else None
    
    if not webhook_token or webhook_token == '':
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Token required'}),
            'isBase64Encoded': False
        }
    
    try:
        webhook_data = json.loads(event.get('body', '{}'))
    except json.JSONDecodeError:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Invalid JSON'}),
            'isBase64Encoded': False
        }
    
    dsn = os.environ['DATABASE_URL']
    conn = psycopg2.connect(dsn)
    cur = conn.cursor()
    
    try:
        cur.execute('''
            SELECT 
                ui.id, 
                ui.owner_id, 
                ui.config,
                ui.webhook_settings,
                p.slug,
                ui.forward_url
            FROM user_integrations ui
            JOIN integration_providers p ON p.id = ui.provider_id
            WHERE ui.webhook_token = %s AND ui.status = 'active'
        ''', (webhook_token,))
        
        integration_row = cur.fetchone()
        if not integration_row:
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'error': 'Integration not found'}),
                'isBase64Encoded': False
            }
        
        integration_id, owner_id, config, webhook_settings, provider_slug, forward_url = integration_row
        
        config = json.loads(config) if isinstance(config, str) else config
        webhook_settings = json.loads(webhook_settings) if isinstance(webhook_settings, str) else webhook_settings
        
        if provider_slug == 'tbank':
            terminal_password = config.get('terminal_password', '')
            if not verify_tbank_token(webhook_data, terminal_password):
                return {
                    'statusCode': 403,
                    'headers': {'Content-Type': 'application/json'},
                    'body': json.dumps({'error': 'Invalid signature'}),
                    'isBase64Encoded': False
                }
            
            status = webhook_data.get('Status', '')
            payment_status_map = {
                'AUTHORIZED': 'notify_on_authorized',
                'CONFIRMED': 'notify_on_confirmed',
                'REJECTED': 'notify_on_rejected',
                'REFUNDED': 'notify_on_refunded'
            }
            
            notify_key = payment_status_map.get(status)
            if notify_key and not webhook_settings.get(notify_key, True):
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'text/plain'},
                    'body': 'OK',
                    'isBase64Encoded': False
                }
            
            webhook_payment_id = None
            cur.execute('''
                INSERT INTO webhook_payments (
                    integration_id, owner_id, payment_id, terminal_key,
                    amount, order_id, status, payment_status, error_code,
                    customer_email, customer_phone, pan, card_type, exp_date,
                    raw_data
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT DO NOTHING
                RETURNING id
            ''', (
                integration_id,
                owner_id,
                webhook_data.get('PaymentId'),
                webhook_data.get('TerminalKey'),
                float(webhook_data.get('Amount', 0)) / 100,
                webhook_data.get('OrderId'),
                webhook_data.get('Status'),
                webhook_data.get('PaymentStatus'),
                webhook_data.get('ErrorCode'),
                webhook_data.get('CardData', {}).get('Email') if isinstance(webhook_data.get('CardData'), dict) else None,
                webhook_data.get('Phone'),
                webhook_data.get('Pan'),
                webhook_data.get('CardType'),
                webhook_data.get('ExpDate'),
                json.dumps(webhook_data)
            ))
            
            result = cur.fetchone()
            if result:
                webhook_payment_id = result[0]
        
        cur.execute('''
            UPDATE user_integrations 
            SET last_webhook_at = NOW(), 
                webhook_count = webhook_count + 1,
                updated_at = NOW()
            WHERE id = %s
        ''', (integration_id,))
        
        conn.commit()
        
        if forward_url:
            start_time = int(time.time() * 1000)
            status_code = None
            error_message = None
            
            try:
                req = urllib.request.Request(
                    forward_url,
                    data=json.dumps(webhook_data).encode('utf-8'),
                    headers={'Content-Type': 'application/json'},
                    method='POST'
                )
                with urllib.request.urlopen(req, timeout=5) as response:
                    status_code = response.status
            except urllib.error.HTTPError as e:
                status_code = e.code
                error_message = f"HTTP {e.code}: {e.reason}"
            except urllib.error.URLError as e:
                status_code = 0
                error_message = f"URL Error: {str(e.reason)}"
            except Exception as e:
                status_code = 0
                error_message = f"Error: {str(e)}"
            
            response_time = int(time.time() * 1000) - start_time
            
            cur.execute('''
                INSERT INTO t_p83864310_fintech_payment_reco.webhook_forward_logs 
                (webhook_payment_id, forward_url, status_code, error_message, response_time_ms)
                VALUES (%s, %s, %s, %s, %s)
            ''', (webhook_payment_id, forward_url, status_code, error_message, response_time))
            conn.commit()
        
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'text/plain'},
            'body': 'OK',
            'isBase64Encoded': False
        }
        
    except Exception as e:
        conn.rollback()
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }
    finally:
        cur.close()
        conn.close()