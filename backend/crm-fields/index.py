import json
import os
from typing import Any, Dict

import psycopg2

import bitrix_crm

SCHEMA = 't_p83864310_fintech_payment_reco'
CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
}


def respond(status: int, payload: Dict[str, Any]) -> Dict[str, Any]:
    return {
        'statusCode': status,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps(payload, ensure_ascii=False, default=str),
        'isBase64Encoded': False
    }


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Поля CRM для настройки сценария автоматизации (сейчас Битрикс24).
    GET ?company_id=&integration_id= - поля сделок, лидов, контактов, компаний и стадии воронок
    POST {company_id, integration_id, entity: deal|lead, entity_id, mapping} - проверка сопоставления
         на реальной сделке/лиде: какие значения подставятся и какой получится чек
    '''
    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': '', 'isBase64Encoded': False}

    params = event.get('queryStringParameters') or {}
    body = json.loads(event.get('body') or '{}') if method == 'POST' else {}
    company_id = params.get('company_id') or body.get('company_id')
    integration_id = params.get('integration_id') or body.get('integration_id')
    if not company_id or not integration_id:
        return respond(400, {'error': 'company_id и integration_id обязательны'})

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    try:
        cur.execute(f'''
            SELECT p.slug, ui.config, c.inn FROM {SCHEMA}.user_integrations ui
            JOIN {SCHEMA}.integration_providers p ON p.id = ui.provider_id
            JOIN {SCHEMA}.companies c ON c.id = ui.company_id
            WHERE ui.id = %s AND ui.company_id = %s
        ''', (integration_id, company_id))
        row = cur.fetchone()
    finally:
        cur.close()
        conn.close()
    if not row:
        return respond(404, {'error': 'Интеграция не найдена'})
    slug, config, seller_inn = row
    config = json.loads(config) if isinstance(config, str) else (config or {})
    if slug != 'bitrix24':
        return respond(400, {'error': 'Загрузка полей пока доступна только для Битрикс24'})
    webhook_url = config.get('webhook_url', '')

    if method == 'GET':
        result, err = bitrix_crm.load_fields(webhook_url)
        if err:
            return respond(502, {'error': err})
        return respond(200, {'success': True, **result})

    if method == 'POST':
        entity = body.get('entity') or 'deal'
        mapping = {**bitrix_crm.DEFAULT_MAPPING, **(body.get('mapping') or {}), 'entity': entity}
        record, err = bitrix_crm.load_record(webhook_url, entity, body.get('entity_id'))
        if err:
            return respond(200, {'success': False, 'error': err})
        refs = {k: mapping.get(k) for k in ('order_id', 'payment_ref', 'amount', 'customer_email', 'customer_phone',
                                              'customer_name', 'customer_inn')}
        values = {k: bitrix_crm.resolve(record, entity, ref) for k, ref in refs.items()}
        main = record[entity]
        values['order_id'] = bitrix_crm.make_order_id(record, entity, mapping, seller_inn)
        data, build_error, note = bitrix_crm.build_data(record, entity, mapping, seller_inn)
        return respond(200, {
            'success': True,
            'title': main.get('TITLE'),
            'stage': main.get(bitrix_crm.STAGE_FIELD[entity]),
            'stage_matches': bitrix_crm.stage_matches(mapping, entity, main),
            'has_contact': bool(record.get('contact')),
            'has_company': bool(record.get('company')),
            'products_count': len(record.get('products') or []),
            'values': values,
            'items': (data or {}).get('items') or [],
            'total': round(sum(i['sum'] for i in (data or {}).get('items') or []), 2),
            'error': build_error or None,
            'note': note.lstrip(', ') or None,
        })

    return respond(405, {'error': 'Method not allowed'})
