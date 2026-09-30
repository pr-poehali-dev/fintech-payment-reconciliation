import json
import threading
import urllib.request
from typing import Any, Dict, Optional

SCHEMA = 't_p83864310_fintech_payment_reco'

# Адрес обработчика журнала автоматизации (backend/automation-jobs).
AUTOMATION_JOBS_URL = 'https://functions.poehali.dev/22902813-812b-495a-9ea0-8497b880c461'


def enqueue_payment_jobs(cur, company_id: int, integration_id: int, webhook_payment_id: Optional[int],
                         event_id: Optional[int]) -> int:
    '''
    Ставит в журнал задание на каждый ЗАПУЩЕННЫЙ сценарий «Новый платёж» этой
    интеграции. Уникальный ключ (сценарий, платёж) - повторный вебхук того же
    платежа второго задания не создаст.
    '''
    if not webhook_payment_id:
        return 0
    cur.execute(f'''
        INSERT INTO {SCHEMA}.automation_jobs (company_id, scenario_id, source_type, source_id, event_id, payload)
        SELECT s.company_id, s.id, 'payment', %s, %s, %s
        FROM {SCHEMA}.automation_scenarios s
        JOIN {SCHEMA}.webhook_payments wp ON wp.id = %s AND wp.status = 'CONFIRMED'
        WHERE s.company_id = %s AND s.source_integration_id = %s AND s.trigger_type = 'new_payment'
          AND s.status = 'active' AND s.removed_at IS NULL
        ON CONFLICT (scenario_id, source_type, source_id) DO NOTHING
        RETURNING id
    ''', (str(webhook_payment_id), event_id, json.dumps({'webhook_payment_id': webhook_payment_id}),
          webhook_payment_id, company_id, integration_id))
    ids = [r[0] for r in cur.fetchall()]
    for job_id in ids:
        cur.execute(
            f'INSERT INTO {SCHEMA}.automation_job_log (job_id, level, message) VALUES (%s, %s, %s)',
            (job_id, 'info', 'Задание создано по вебхуку платежа')
        )
    return len(ids)


def wake_payment_jobs(cur, integration_id: int, provider_payment_id: Any) -> int:
    '''
    Пришла корзина - задания по этому платежу, которые её ждут, обрабатываются
    сразу, не дожидаясь следующей попытки по расписанию.
    '''
    if not provider_payment_id:
        return 0
    cur.execute(f'''
        UPDATE {SCHEMA}.automation_jobs j SET next_attempt_at = NOW(), status = 'new', attempts = 0, updated_at = NOW()
        FROM {SCHEMA}.webhook_payments wp
        WHERE j.source_type = 'payment' AND j.source_id = wp.id::text
          AND wp.integration_id = %s AND wp.payment_id = %s
          AND j.status IN ('new', 'error', 'failed')
        RETURNING j.id
    ''', (integration_id, str(provider_payment_id)))
    ids = [r[0] for r in cur.fetchall()]
    for job_id in ids:
        cur.execute(
            f'INSERT INTO {SCHEMA}.automation_job_log (job_id, level, message) VALUES (%s, %s, %s)',
            (job_id, 'info', 'Пришла корзина от Т-Банка')
        )
    return len(ids)


def _post(company_id: int):
    try:
        req = urllib.request.Request(
            AUTOMATION_JOBS_URL,
            data=json.dumps({'action': 'run', 'company_id': company_id}).encode('utf-8'),
            headers={'Content-Type': 'application/json'},
            method='POST'
        )
        urllib.request.urlopen(req, timeout=1.5).close()
    except Exception:
        pass


def signal_processor(company_id: int):
    '''
    Сигнал обработчику без ожидания результата: ответ платёжной системе не
    задерживается. Если сигнал потеряется, задание заберёт следующий запуск.
    '''
    t = threading.Thread(target=_post, args=(company_id,), daemon=True)
    t.start()
    t.join(timeout=1.6)
