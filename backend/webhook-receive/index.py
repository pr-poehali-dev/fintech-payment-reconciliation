import json
import os
import psycopg2
import urllib.request
import urllib.error
import time
from typing import Dict, Any

from form_parser import parse_webhook_body
from inbox import save_event, mark_processed
import tbank_handler
import bitrix24_handler
import amocrm_handler

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
}

# Каждый провайдер имеет свой изолированный обработчик и свой event_type -
# события разных провайдеров никогда не смешиваются, даже если прилетят
# в одну и ту же секунду.
EVENT_TYPE_BY_PROVIDER = {
    'tbank': 'payment_status_changed',
    'bitrix24': 'deal_updated',
    'amocrm': 'lead_updated'
}


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Роутер входящих вебхуков от всех провайдеров (эквайринг, CRM).
    Определяет провайдера по уникальному webhook_token, сохраняет сырое событие
    в inbox-таблицу webhook_events (чтобы событие не потерялось и не перепуталось
    с событием другого провайдера), затем передаёт его в изолированный обработчик
    конкретного провайдера.
    '''

    method = event.get('httpMethod', 'POST')

    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': CORS_HEADERS,
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

    params = event.get('queryStringParameters', {}) or {}
    webhook_token = params.get('token', '')

    if not webhook_token:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Token required'}),
            'isBase64Encoded': False
        }

    headers = event.get('headers', {}) or {}
    content_type = headers.get('Content-Type') or headers.get('content-type') or ''

    raw_body = event.get('body', '{}') or ''
    if event.get('isBase64Encoded'):
        import base64
        raw_body = base64.b64decode(raw_body).decode('utf-8', errors='replace')

    try:
        webhook_data = parse_webhook_body(raw_body, content_type)
    except Exception:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Invalid body'}),
            'isBase64Encoded': False
        }

    dsn = os.environ['DATABASE_URL']
    conn = psycopg2.connect(dsn)
    cur = conn.cursor()

    try:
        cur.execute('''
            SELECT 
                ui.id, 
                ui.company_id,
                ui.config,
                ui.webhook_settings,
                p.slug,
                ui.forward_url
            FROM t_p83864310_fintech_payment_reco.user_integrations ui
            JOIN t_p83864310_fintech_payment_reco.integration_providers p ON p.id = ui.provider_id
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

        integration_id, company_id, config, webhook_settings, provider_slug, forward_url = integration_row

        config = json.loads(config) if isinstance(config, str) else (config or {})
        webhook_settings = json.loads(webhook_settings) if isinstance(webhook_settings, str) else (webhook_settings or {})

        # Шаг 1: событие сразу попадает в inbox как есть, до какой-либо обработки -
        # это гарантирует, что даже при сбое обработчика сырые данные не потеряются.
        event_type = EVENT_TYPE_BY_PROVIDER.get(provider_slug, 'unknown')
        event_id = save_event(cur, integration_id, company_id, provider_slug, event_type, webhook_data)
        conn.commit()

        # Шаг 2: событие передаётся в обработчик именно своего провайдера.
        webhook_payment_id = None
        external_deal_id = None
        handler_error = None

        if provider_slug == 'tbank':
            signature_valid, webhook_payment_id, handler_error = tbank_handler.process(
                cur, integration_id, company_id, config, webhook_settings, webhook_data
            )
            if not signature_valid:
                mark_processed(cur, event_id, 'rejected', handler_error)
                conn.commit()
                return {
                    'statusCode': 403,
                    'headers': {'Content-Type': 'application/json'},
                    'body': json.dumps({'error': handler_error}),
                    'isBase64Encoded': False
                }
        elif provider_slug == 'bitrix24':
            _, external_deal_id, handler_error = bitrix24_handler.process(cur, integration_id, company_id, config, webhook_data)
        elif provider_slug == 'amocrm':
            _, external_deal_id, handler_error = amocrm_handler.process(cur, integration_id, company_id, config, webhook_data)

        if external_deal_id:
            cur.execute('''
                UPDATE t_p83864310_fintech_payment_reco.webhook_events
                SET external_deal_id = %s
                WHERE id = %s
            ''', (external_deal_id, event_id))

        mark_processed(cur, event_id, 'failed' if handler_error else 'processed', handler_error)

        cur.execute('''
            UPDATE t_p83864310_fintech_payment_reco.user_integrations 
            SET last_webhook_at = NOW(), 
                webhook_count = webhook_count + 1,
                updated_at = NOW()
            WHERE id = %s
        ''', (integration_id,))

        conn.commit()

        if forward_url and webhook_payment_id:
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