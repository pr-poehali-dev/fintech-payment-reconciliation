import json
import os
import psycopg2
from typing import Dict, Any, List

from preparer import prepare, retry_delay, log
from actions import ACTIONS

SCHEMA = 't_p83864310_fintech_payment_reco'
BATCH = 20

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


def claim_jobs(cur, company_id=None, job_id=None) -> List[Dict[str, Any]]:
    '''Занимает задания на 2 минуты (SKIP LOCKED) - параллельный запуск их не возьмёт.'''
    # Задание, зависшее «в работе» (сбой посреди обработки, касса не ответила),
    # после истечения блокировки (2 мин) снова берётся в работу как обычный повтор.
    # Дубля в кассе не будет: заказ уходит с тем же external_id.
    where = ["(j.status IN ('new', 'error') AND j.next_attempt_at <= NOW() "
             "OR j.status = 'processing' AND j.locked_until < NOW())",
             '(j.locked_until IS NULL OR j.locked_until < NOW())']
    args: list = []
    if company_id:
        where.append('j.company_id = %s')
        args.append(company_id)
    if job_id:
        where = ['j.id = %s', "j.status IN ('new', 'error', 'failed', 'processing')",
                 '(j.locked_until IS NULL OR j.locked_until < NOW())']
        args = [job_id]
    cur.execute(f'''
        UPDATE {SCHEMA}.automation_jobs u SET status = 'processing', locked_until = NOW() + INTERVAL '2 minutes',
               attempts = u.attempts + 1, updated_at = NOW()
        FROM (
            SELECT j.id, j.status AS prev_status FROM {SCHEMA}.automation_jobs j
            WHERE {' AND '.join(where)}
            ORDER BY j.next_attempt_at LIMIT {BATCH}
            FOR UPDATE SKIP LOCKED
        ) c
        WHERE u.id = c.id
        RETURNING u.id, u.scenario_id, u.source_type, u.source_id, u.attempts, u.company_id, u.step, u.prepared_data,
                  c.prev_status
    ''', args)
    return [{'id': r[0], 'scenario_id': r[1], 'source_type': r[2], 'source_id': r[3], 'attempts': r[4],
             'company_id': r[5], 'step': r[6], 'prepared_data': r[7], 'was_stuck': r[8] == 'processing'}
            for r in cur.fetchall()]


def process_job(cur, job: Dict[str, Any]) -> str:
    cur.execute(f'''
        SELECT s.id, s.name, s.action_type, s.action_template, s.target_integration_id, s.field_mapping, s.status,
               s.removed_at, t.operation, t.paid, t.name, t.protocol_version, t.receipt_type, t.payment_method,
               t.payment_object, t.measure, t.payment_type, t.default_email,
               t.correction_type, t.correction_date_source, t.correction_base_date, t.correction_base_number,
               t.auto_deliver, t.cashier_name
        FROM {SCHEMA}.automation_scenarios s
        LEFT JOIN {SCHEMA}.automation_action_templates t ON t.code = s.action_template
        WHERE s.id = %s
    ''', (job['scenario_id'],))
    r = cur.fetchone()
    scenario = {'id': r[0], 'name': r[1], 'action_type': r[2], 'action_template': r[3],
                'target_integration_id': r[4], 'field_mapping': r[5] or {},
                'template': {'operation': r[8] or 'sell', 'paid': r[9] if r[9] is not None else True,
                             'name': r[10] or r[3], 'protocol_version': r[11] or 'v4',
                             'receipt_type': r[12] or 'regular', 'payment_method': r[13],
                             'payment_object': r[14], 'measure': r[15], 'payment_type': r[16],
                             'default_email': r[17], 'correction_type': r[18],
                             'correction_date_source': r[19], 'correction_base_date': r[20],
                             'correction_base_number': r[21], 'auto_deliver': bool(r[22]),
                             'cashier_name': r[23]}}

    if r[7] is not None:
        status, data, message = 'skipped', {}, 'Сценарий удалён'
    elif job['step'] == 'action' and job['prepared_data']:
        return run_action(cur, job, scenario, job['prepared_data'])
    else:
        try:
            status, data, message = prepare(cur, job, scenario)
        except Exception as e:
            status, data, message = 'error', {}, f'Сбой подготовки: {e}'

    if status == 'error':
        delay = retry_delay(job['attempts'])
        if delay is None:
            cur.execute(f'''
                UPDATE {SCHEMA}.automation_jobs SET status = 'failed', last_error = %s, locked_until = NULL, updated_at = NOW()
                WHERE id = %s
            ''', (message, job['id']))
            log(cur, job['id'], 'error', f'{message}. Попытки исчерпаны ({job["attempts"]})')
            return 'failed'
        cur.execute(f'''
            UPDATE {SCHEMA}.automation_jobs SET status = 'error', last_error = %s, locked_until = NULL,
                   next_attempt_at = NOW() + (%s || ' minutes')::interval, updated_at = NOW()
            WHERE id = %s
        ''', (message, str(delay), job['id']))
        log(cur, job['id'], 'error', f'{message}. Повтор через {delay} мин (попытка {job["attempts"]})')
        return 'error'

    cur.execute(f'''
        UPDATE {SCHEMA}.automation_jobs SET status = %s, prepared_data = %s, last_error = NULL,
               locked_until = NULL, step = %s, updated_at = NOW()
        WHERE id = %s
    ''', (status, json.dumps(data, ensure_ascii=False, default=str),
          'action' if status == 'ready' else 'prepare', job['id']))
    log(cur, job['id'], 'info', message)
    if status == 'ready' and scenario['action_type'] in ACTIONS:
        return run_action(cur, job, scenario, data)
    return status


def fail_or_retry(cur, job: Dict[str, Any], message: str) -> str:
    delay = retry_delay(job['attempts'])
    if delay is None:
        cur.execute(f'''
            UPDATE {SCHEMA}.automation_jobs SET status = 'failed', last_error = %s, locked_until = NULL, updated_at = NOW()
            WHERE id = %s
        ''', (message, job['id']))
        log(cur, job['id'], 'error', f'{message}. Попытки исчерпаны ({job["attempts"]})')
        return 'failed'
    cur.execute(f'''
        UPDATE {SCHEMA}.automation_jobs SET status = 'error', last_error = %s, locked_until = NULL,
               next_attempt_at = NOW() + (%s || ' minutes')::interval, updated_at = NOW()
        WHERE id = %s
    ''', (message, str(delay), job['id']))
    log(cur, job['id'], 'error', f'{message}. Повтор через {delay} мин (попытка {job["attempts"]})')
    return 'error'


def run_action(cur, job: Dict[str, Any], scenario: Dict[str, Any], data: Dict[str, Any]) -> str:
    '''Шаг 2: действие в кассе по собранным данным. Повтор идёт с этого шага, без повторного сбора.'''
    action = ACTIONS.get(scenario['action_type'])
    if not action:
        return 'ready'
    try:
        status, result, message = action(cur, job, scenario, data)
    except Exception as e:
        status, result, message = 'error', {}, f'Сбой действия: {e}'
    if status == 'error':
        cur.execute(f'UPDATE {SCHEMA}.automation_jobs SET step = %s WHERE id = %s', ('action', job['id']))
        log(cur, job['id'], 'error', message, result or None)
        return fail_or_retry(cur, job, message)
    cur.execute(f'''
        UPDATE {SCHEMA}.automation_jobs SET status = %s, step = 'done', last_error = NULL, locked_until = NULL,
               payload = payload || %s::jsonb, updated_at = NOW()
        WHERE id = %s
    ''', (status, json.dumps({'action_result': result}, ensure_ascii=False, default=str), job['id']))
    log(cur, job['id'], 'info', message, result)
    return status


def run(cur, conn, company_id=None, job_id=None) -> Dict[str, int]:
    jobs = claim_jobs(cur, company_id, job_id)
    result: Dict[str, int] = {}
    active = []
    for job in jobs:
        if not job.get('was_stuck'):
            active.append(job)
            continue
        message = 'Обработка прервалась (сбой или касса не ответила)'
        if retry_delay(job['attempts'] - 1) is None and not job_id:
            # Зависало на каждой попытке - лимит исчерпан, дальше только вручную.
            cur.execute(f'''
                UPDATE {SCHEMA}.automation_jobs SET status = 'failed', last_error = %s, locked_until = NULL, updated_at = NOW()
                WHERE id = %s
            ''', (message, job['id']))
            log(cur, job['id'], 'error', f'{message}. Попытки исчерпаны ({job["attempts"] - 1})')
            result['failed'] = result.get('failed', 0) + 1
            continue
        log(cur, job['id'], 'error', f'{message} - задание взято в работу повторно')
        active.append(job)
    conn.commit()
    for job in active:
        status = process_job(cur, job)
        conn.commit()
        result[status] = result.get(status, 0) + 1
    return result


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Журнал автоматизации и обработчик подготовки данных.
    GET ?company_id=[&status=][&scenario_id=][&limit=] - журнал заданий
    GET ?company_id=&job_id= - задание и его история шагов
    POST {action: "run", company_id?} - обработать задания в очереди (сигнал из
         приёма вебхука, внешний "будильник" или открытие раздела)
    POST {action: "retry", company_id, job_id} - повторить задание вручную
    '''
    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': '', 'isBase64Encoded': False}

    params = event.get('queryStringParameters') or {}
    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    try:
        if method == 'POST':
            body = json.loads(event.get('body') or '{}')
            action = body.get('action')
            if action == 'run':
                return respond(200, {'success': True, 'processed': run(cur, conn, body.get('company_id'))})
            if action == 'retry':
                if not body.get('company_id') or not body.get('job_id'):
                    return respond(400, {'error': 'company_id and job_id required'})
                cur.execute(f'''
                    UPDATE {SCHEMA}.automation_jobs SET next_attempt_at = NOW(), attempts = 0, status = 'new', updated_at = NOW()
                    WHERE id = %s AND company_id = %s AND status IN ('error', 'failed') RETURNING id
                ''', (body['job_id'], body['company_id']))
                if not cur.fetchone():
                    conn.rollback()
                    return respond(404, {'error': 'Задание не найдено или не в ошибке'})
                log(cur, body['job_id'], 'info', 'Повтор запущен вручную')
                conn.commit()
                return respond(200, {'success': True, 'processed': run(cur, conn, job_id=body['job_id'])})
            return respond(400, {'error': 'Unknown action'})

        if method != 'GET':
            return respond(405, {'error': 'Method not allowed'})

        company_id = params.get('company_id')
        if not company_id:
            return respond(400, {'error': 'company_id required'})

        if params.get('job_id'):
            cur.execute(f'''
                SELECT level, message, details, created_at FROM {SCHEMA}.automation_job_log
                WHERE job_id = %s AND job_id IN (SELECT id FROM {SCHEMA}.automation_jobs WHERE company_id = %s)
                ORDER BY created_at, id
            ''', (params['job_id'], company_id))
            history = [{'level': r[0], 'message': r[1], 'details': r[2], 'created_at': r[3]} for r in cur.fetchall()]
            cur.execute(f'SELECT prepared_data, payload FROM {SCHEMA}.automation_jobs WHERE id = %s AND company_id = %s',
                        (params['job_id'], company_id))
            row = cur.fetchone()
            return respond(200, {'success': True, 'history': history,
                                 'prepared_data': row[0] if row else None, 'payload': row[1] if row else None})

        where = ['j.company_id = %s']
        args: list = [company_id]
        if params.get('status'):
            where.append('j.status = %s')
            args.append(params['status'])
        if params.get('scenario_id'):
            where.append('j.scenario_id = %s')
            args.append(params['scenario_id'])
        limit = min(int(params.get('limit', 100)), 500)
        cur.execute(f'''
            SELECT j.id, j.scenario_id, s.name, j.source_type, j.source_id, j.status, j.step,
                   j.attempts, j.last_error, j.next_attempt_at, j.created_at, j.updated_at
            FROM {SCHEMA}.automation_jobs j
            JOIN {SCHEMA}.automation_scenarios s ON s.id = j.scenario_id
            WHERE {' AND '.join(where)}
            ORDER BY j.created_at DESC LIMIT {limit}
        ''', args)
        jobs = [{
            'id': r[0], 'scenario_id': r[1], 'scenario_name': r[2], 'source_type': r[3], 'source_id': r[4],
            'status': r[5], 'step': r[6], 'attempts': r[7], 'last_error': r[8],
            'next_attempt_at': r[9], 'created_at': r[10], 'updated_at': r[11]
        } for r in cur.fetchall()]
        cur.execute(f'''
            SELECT COUNT(*) FILTER (WHERE status = 'failed'), COUNT(*) FILTER (WHERE status = 'error')
            FROM {SCHEMA}.automation_jobs WHERE company_id = %s
        ''', (company_id,))
        failed_count, retry_count = cur.fetchone()
        return respond(200, {'success': True, 'jobs': jobs,
                             'counts': {'failed': failed_count, 'retry': retry_count}})
    finally:
        cur.close()
        conn.close()
