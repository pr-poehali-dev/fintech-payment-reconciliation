import json
import os
import psycopg2
from typing import Dict, Any, Optional

SCHEMA = 't_p83864310_fintech_payment_reco'

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
}

# Источник -> категории интеграций, которые можно выбрать как источник
# (None - источник внутренний, без интеграции).
TRIGGERS = {
    'new_payment': ['payments'],
    'crm_order': ['crm'],
    'discrepancy': None,
}

# Шаблоны действий хранятся в automation_action_templates (правятся в админке платформы).
ACTIONS = {'create_receipt', 'create_order'}

TARGET_CATEGORIES = ['cash_registers']
STATUSES = {'active', 'stopped'}


def respond(status: int, payload: Dict[str, Any]) -> Dict[str, Any]:
    return {
        'statusCode': status,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps(payload, ensure_ascii=False, default=str),
        'isBase64Encoded': False
    }


def integration_category(cur, company_id: int, integration_id: Optional[int]) -> Optional[str]:
    if not integration_id:
        return None
    cur.execute(f'''
        SELECT c.slug FROM {SCHEMA}.user_integrations ui
        JOIN {SCHEMA}.integration_providers p ON p.id = ui.provider_id
        JOIN {SCHEMA}.integration_categories c ON c.id = p.category_id
        WHERE ui.id = %s AND ui.company_id = %s
    ''', (integration_id, company_id))
    row = cur.fetchone()
    return row[0] if row else None


def validate(cur, company_id: int, body: Dict[str, Any]) -> Optional[str]:
    name = (body.get('name') or '').strip()
    if not name:
        return 'Укажите название сценария'
    trigger = body.get('trigger_type')
    if trigger not in TRIGGERS:
        return 'Неизвестный источник'
    allowed = TRIGGERS[trigger]
    if allowed:
        if not body.get('source_integration_id'):
            return 'Выберите интеграцию-источник'
        if integration_category(cur, company_id, body.get('source_integration_id')) not in allowed:
            return 'Интеграция не подходит для этого источника'
    action = body.get('action_type')
    if action not in ACTIONS:
        return 'Неизвестное действие'
    cur.execute(f'''
        SELECT action_type, is_active FROM {SCHEMA}.automation_action_templates WHERE code = %s
    ''', (body.get('action_template'),))
    template = cur.fetchone()
    if not template or template[0] != action:
        return 'Неизвестный шаблон действия'
    if not template[1] and not body.get('id'):
        return 'Шаблон действия отключён'
    if not body.get('target_integration_id'):
        return 'Выберите кассу, где выполнить действие'
    if integration_category(cur, company_id, body.get('target_integration_id')) not in TARGET_CATEGORIES:
        return 'Действие можно выполнить только в кассе'
    if not isinstance(body.get('field_mapping') or {}, dict):
        return 'Некорректная настройка сопоставления полей'
    return None


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Сценарии автоматизации компании: источник (новый платёж, заказ в CRM,
    расхождение) + интеграция-источник -> действие в кассе (создать чек/заказ)
    по шаблону, с сопоставлением полей для CRM.
    GET ?company_id= - список (со статистикой заданий журнала)
    POST {company_id, name, trigger_type, source_integration_id, action_type,
          action_template, target_integration_id, field_mapping} - создать (остановлен)
    PUT {id, company_id, ...те же поля} - изменить; {id, company_id, status} - запустить/остановить
    DELETE {id, company_id} - удалить
    '''
    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': '', 'isBase64Encoded': False}

    params = event.get('queryStringParameters') or {}
    body = json.loads(event.get('body') or '{}') if method != 'GET' else {}
    company_id = params.get('company_id') or body.get('company_id')
    if not company_id:
        return respond(400, {'error': 'company_id required'})

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    try:
        if method == 'GET':
            cur.execute(f'''
                SELECT s.id, s.name, s.trigger_type, s.source_integration_id, si.integration_name,
                       s.action_type, s.action_template, s.target_integration_id, ti.integration_name,
                       s.field_mapping, s.status, s.created_at, s.updated_at,
                       COUNT(j.id), COUNT(j.id) FILTER (WHERE j.status = 'error'), MAX(j.created_at),
                       MAX(t.name)
                FROM {SCHEMA}.automation_scenarios s
                LEFT JOIN {SCHEMA}.automation_action_templates t ON t.code = s.action_template
                LEFT JOIN {SCHEMA}.user_integrations si ON si.id = s.source_integration_id
                LEFT JOIN {SCHEMA}.user_integrations ti ON ti.id = s.target_integration_id
                LEFT JOIN {SCHEMA}.automation_jobs j ON j.scenario_id = s.id
                WHERE s.company_id = %s AND s.removed_at IS NULL
                GROUP BY s.id, si.integration_name, ti.integration_name
                ORDER BY s.created_at DESC
            ''', (company_id,))
            scenarios = [{
                'id': r[0], 'name': r[1], 'trigger_type': r[2],
                'source_integration_id': r[3], 'source_integration_name': r[4],
                'action_type': r[5], 'action_template': r[6],
                'target_integration_id': r[7], 'target_integration_name': r[8],
                'field_mapping': r[9] or {}, 'status': r[10],
                'created_at': r[11], 'updated_at': r[12],
                'jobs_total': r[13], 'jobs_errors': r[14], 'last_job_at': r[15],
                'action_template_name': r[16]
            } for r in cur.fetchall()]
            return respond(200, {'success': True, 'scenarios': scenarios})

        if method == 'POST':
            error = validate(cur, company_id, body)
            if error:
                return respond(400, {'error': error})
            cur.execute(f'''
                INSERT INTO {SCHEMA}.automation_scenarios
                    (company_id, name, trigger_type, source_integration_id, action_type,
                     action_template, target_integration_id, field_mapping, status)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, 'stopped')
                RETURNING id
            ''', (
                company_id, body['name'].strip(), body['trigger_type'],
                body.get('source_integration_id') if TRIGGERS[body['trigger_type']] else None,
                body['action_type'], body['action_template'], body['target_integration_id'],
                json.dumps(body.get('field_mapping') or {})
            ))
            new_id = cur.fetchone()[0]
            conn.commit()
            return respond(200, {'success': True, 'id': new_id})

        scenario_id = body.get('id')
        if not scenario_id:
            return respond(400, {'error': 'id required'})

        if method == 'PUT':
            if set(body.keys()) <= {'id', 'company_id', 'status'}:
                if body.get('status') not in STATUSES:
                    return respond(400, {'error': 'Некорректный статус'})
                cur.execute(f'''
                    UPDATE {SCHEMA}.automation_scenarios SET status = %s, updated_at = NOW()
                    WHERE id = %s AND company_id = %s AND removed_at IS NULL RETURNING id
                ''', (body['status'], scenario_id, company_id))
            else:
                error = validate(cur, company_id, body)
                if error:
                    return respond(400, {'error': error})
                cur.execute(f'''
                    UPDATE {SCHEMA}.automation_scenarios SET
                        name = %s, trigger_type = %s, source_integration_id = %s, action_type = %s,
                        action_template = %s, target_integration_id = %s, field_mapping = %s, updated_at = NOW()
                    WHERE id = %s AND company_id = %s AND removed_at IS NULL RETURNING id
                ''', (
                    body['name'].strip(), body['trigger_type'],
                    body.get('source_integration_id') if TRIGGERS[body['trigger_type']] else None,
                    body['action_type'], body['action_template'], body['target_integration_id'],
                    json.dumps(body.get('field_mapping') or {}), scenario_id, company_id
                ))
            if not cur.fetchone():
                conn.rollback()
                return respond(404, {'error': 'Сценарий не найден'})
            conn.commit()
            return respond(200, {'success': True})

        if method == 'DELETE':
            cur.execute(f'''
                UPDATE {SCHEMA}.automation_scenarios SET removed_at = NOW(), status = 'stopped', updated_at = NOW()
                WHERE id = %s AND company_id = %s AND removed_at IS NULL RETURNING id
            ''', (scenario_id, company_id))
            if not cur.fetchone():
                conn.rollback()
                return respond(404, {'error': 'Сценарий не найден'})
            conn.commit()
            return respond(200, {'success': True})

        return respond(405, {'error': 'Method not allowed'})
    finally:
        cur.close()
        conn.close()
