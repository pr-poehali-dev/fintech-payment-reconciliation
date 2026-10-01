import json
import os
import secrets
import psycopg2
from typing import Dict, Any

def copy_integration(body: Dict[str, Any]):
    '''
    Копия интеграции в другую (или эту же) компанию пользователя: те же настройки и ключи,
    новый адрес вебхука. Лимит интеграций по тарифу целевой компании соблюдается.
    POST {action: copy, company_id, integration_id, target_company_id, user_id, integration_name?}
    '''
    company_id = int(body.get('company_id') or 0)
    target_id = int(body.get('target_company_id') or 0)
    user_id = body.get('user_id')
    if not company_id or not target_id or not user_id or not body.get('integration_id'):
        return 400, {'error': 'Укажите интеграцию, компанию и пользователя'}
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    try:
        cur.execute('''
            SELECT COUNT(DISTINCT company_id) FROM company_users
            WHERE user_id = %s AND status = 'active' AND company_id IN (%s, %s)
        ''', (user_id, company_id, target_id))
        if cur.fetchone()[0] < (1 if company_id == target_id else 2):
            return 403, {'error': 'Нет доступа к одной из компаний'}
        cur.execute('''
            SELECT integration_name FROM user_integrations
            WHERE id = %s AND company_id = %s AND status != 'deleted'
        ''', (body['integration_id'], company_id))
        row = cur.fetchone()
        if not row:
            return 404, {'error': 'Интеграция не найдена'}
        name = (body.get('integration_name') or '').strip() or row[0] or ''
        cur.execute('''
            SELECT t.max_integrations,
                   (SELECT COUNT(*) FROM user_integrations ui WHERE ui.company_id = %s AND ui.status != 'deleted')
            FROM subscriptions s JOIN tariffs t ON t.id = s.tariff_id
            WHERE s.company_id = %s
        ''', (target_id, target_id))
        limit_row = cur.fetchone()
        if limit_row and limit_row[0] is not None and limit_row[1] >= limit_row[0]:
            return 403, {'error': f'В выбранной компании исчерпан лимит интеграций по тарифу ({limit_row[0]})',
                         'error_code': 'limit_reached'}
        cur.execute('''
            INSERT INTO user_integrations
                (legacy_owner_id_unused, provider_id, integration_name, webhook_token, config, status,
                 webhook_settings, forward_url, company_id, sync_interval_hours)
            SELECT legacy_owner_id_unused, provider_id, %s, %s, config, status,
                   webhook_settings, forward_url, %s, sync_interval_hours
            FROM user_integrations WHERE id = %s
            RETURNING id, webhook_token
        ''', (name[:100], secrets.token_urlsafe(32), target_id, body['integration_id']))
        new_id, token = cur.fetchone()
        conn.commit()
        return 200, {
            'success': True, 'integration_id': new_id, 'company_id': target_id, 'integration_name': name,
            'webhook_url': f"https://functions.poehali.dev/a923b457-57a6-4eb2-b566-9a9d65cb04e8?token={token}",
        }
    finally:
        cur.close()
        conn.close()


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Создание новой интеграции для компании
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
    if body.get('action') == 'copy':
        status, payload = copy_integration(body)
        return {
            'statusCode': status,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps(payload, ensure_ascii=False),
            'isBase64Encoded': False
        }
    company_id = body.get('company_id')
    provider_slug = body.get('provider_slug')
    integration_name = body.get('integration_name', '')
    config = body.get('config', {})
    forward_url = body.get('forward_url', '')
    sync_interval_hours = body.get('sync_interval_hours')
    webhook_settings = body.get('webhook_settings', {
        'notify_on_authorized': True,
        'notify_on_confirmed': True,
        'notify_on_rejected': True,
        'notify_on_refunded': True
    })
    
    if not company_id or not provider_slug:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'company_id and provider_slug required'}),
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

        # Лимит интеграций по тарифу (пусто - без ограничения).
        cur.execute('''
            SELECT t.max_integrations,
                   (SELECT COUNT(*) FROM user_integrations ui WHERE ui.company_id = %s AND ui.status != 'deleted')
            FROM subscriptions s JOIN tariffs t ON t.id = s.tariff_id
            WHERE s.company_id = %s
        ''', (company_id, company_id))
        limit_row = cur.fetchone()
        if limit_row and limit_row[0] is not None and limit_row[1] >= limit_row[0]:
            return {
                'statusCode': 403,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'error': f'Лимит интеграций по тарифу исчерпан ({limit_row[0]}). Смените тариф или удалите неиспользуемую интеграцию.',
                    'error_code': 'limit_reached'
                }, ensure_ascii=False),
                'isBase64Encoded': False
            }

        cur.execute('''
            INSERT INTO user_integrations 
            (company_id, provider_id, integration_name, webhook_token, config, webhook_settings, forward_url, sync_interval_hours, status)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'active')
            RETURNING id, webhook_token
        ''', (
            company_id,
            provider_id, 
            integration_name, 
            webhook_token,
            json.dumps(config),
            json.dumps(webhook_settings),
            forward_url if forward_url else None,
            sync_interval_hours
        ))
        
        integration_id, token = cur.fetchone()
        conn.commit()
        
        webhook_url = f"https://functions.poehali.dev/a923b457-57a6-4eb2-b566-9a9d65cb04e8?token={token}"
        
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