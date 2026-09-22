import json
import os
import psycopg2
from typing import Dict, Any
from datetime import datetime

from ecomkassa_api import find_receipt_by_legacy_no, poll_order_until_ready

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
}


def save_receipt(cur, integration_id: int, company_id: int, order_id: Any,
                  legacy_no: Any, data: Dict[str, Any]) -> bool:
    '''Сохраняет чек Екомкассы, извлекая типовые поля из ответа API (формат не публично задокументирован,
    поэтому берём наиболее вероятные ключи с фолбэками, а весь ответ сохраняем в raw_data целиком).'''
    status = data.get('status')
    total_sum = data.get('total') or data.get('sum') or data.get('totalSum')
    doc_number = data.get('docNumber') or data.get('doc_number')
    doc_datetime = data.get('docDateTime') or data.get('doc_datetime') or data.get('createdAt')

    cur.execute('''
        INSERT INTO t_p83864310_fintech_payment_reco.ecomkassa_receipts (
            integration_id, company_id, order_id, legacy_no, status,
            total_sum, doc_number, doc_datetime, raw_data
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (integration_id, order_id) DO UPDATE SET
            status = EXCLUDED.status,
            total_sum = EXCLUDED.total_sum,
            doc_number = EXCLUDED.doc_number,
            doc_datetime = EXCLUDED.doc_datetime,
            raw_data = EXCLUDED.raw_data
        RETURNING id
    ''', (
        integration_id, company_id, str(order_id) if order_id is not None else None,
        str(legacy_no) if legacy_no is not None else None, status,
        total_sum, doc_number, doc_datetime, json.dumps(data)
    ))
    return cur.fetchone() is not None


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Загрузка чека Екомкассы одним из двух способов:
    1) по внешнему номеру заказа (legacy_no) - прямой поиск в системе продавца;
    2) по внутреннему order_id Екомкассы - с опросом (поллингом) статуса заказа,
       пока чек не будет фискализирован или не истекут попытки.
    Args: integration_id, legacy_no (опционально), order_id (опционально) - нужен один из двух
    Returns: success, статус чека, сохранённые данные
    '''

    method = event.get('httpMethod', 'POST')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': '', 'isBase64Encoded': False}

    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'}),
            'isBase64Encoded': False
        }

    body = json.loads(event.get('body') or '{}')
    integration_id = body.get('integration_id')
    legacy_no = body.get('legacy_no')
    order_id = body.get('order_id')

    if not integration_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'integration_id required'}),
            'isBase64Encoded': False
        }

    if not legacy_no and not order_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'legacy_no or order_id required'}),
            'isBase64Encoded': False
        }

    dsn = os.environ['DATABASE_URL']
    conn = psycopg2.connect(dsn)
    cur = conn.cursor()

    try:
        cur.execute('''
            SELECT config, company_id
            FROM t_p83864310_fintech_payment_reco.user_integrations
            WHERE id = %s AND status = 'active'
        ''', (integration_id,))

        row = cur.fetchone()
        if not row:
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Integration not found'}),
                'isBase64Encoded': False
            }

        config, company_id = row
        config = json.loads(config) if isinstance(config, str) else (config or {})

        token = config.get('token')
        store_id = config.get('store_id')
        protocol_version = config.get('protocol_version', 'v4')

        if not token or not store_id:
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'success': False, 'error': 'Интеграция не настроена: нет токена или магазина'}),
                'isBase64Encoded': False
            }

        if legacy_no:
            result = find_receipt_by_legacy_no(token, legacy_no, store_id, protocol_version)
            if result is None:
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'success': False, 'error': 'Чек с таким номером не найден'}),
                    'isBase64Encoded': False
                }
            resolved_order_id = result.get('orderId') or result.get('order_id') or legacy_no
        else:
            result = poll_order_until_ready(token, order_id)
            if result is None:
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'success': False, 'error': 'Не удалось получить статус заказа'}),
                    'isBase64Encoded': False
                }
            resolved_order_id = order_id

        save_receipt(cur, integration_id, company_id, resolved_order_id, legacy_no, result)

        cur.execute('''
            UPDATE t_p83864310_fintech_payment_reco.user_integrations
            SET last_synced_at = NOW(), updated_at = NOW()
            WHERE id = %s
        ''', (integration_id,))

        conn.commit()

        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'success': True,
                'order_id': resolved_order_id,
                'status': result.get('status') if isinstance(result, dict) else None,
                'data': result
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
