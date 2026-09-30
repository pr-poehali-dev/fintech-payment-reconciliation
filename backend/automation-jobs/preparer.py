import json
from typing import Any, Dict, Optional, Tuple

SCHEMA = 't_p83864310_fintech_payment_reco'

# Задержка следующей попытки (минуты) по номеру попытки; после последней - статус failed.
RETRY_DELAYS = [1, 5, 15, 60]


def _payment(cur, payment_id: str) -> Optional[Dict[str, Any]]:
    cur.execute(f'''
        SELECT id, payment_id, order_id, amount, status, customer_email, customer_phone,
               payment_provider, receipt_id, created_at
        FROM {SCHEMA}.webhook_payments WHERE id = %s
    ''', (payment_id,))
    r = cur.fetchone()
    if not r:
        return None
    return {
        'id': r[0], 'payment_id': r[1], 'order_id': r[2], 'amount': float(r[3] or 0),
        'status': r[4], 'customer_email': r[5], 'customer_phone': r[6],
        'payment_provider': r[7], 'receipt_id': r[8], 'created_at': r[9].isoformat() if r[9] else None
    }


def prepare(cur, job: Dict[str, Any], scenario: Dict[str, Any]) -> Tuple[str, Dict[str, Any], str]:
    '''
    Сбор данных для действия сценария. Возвращает (статус, данные, сообщение в журнал):
    ready - всё собрано; skipped - действие не нужно; error - повторить позже.
    Корзина пока не подключена: источник выбирается в сценарии отдельным шагом.
    '''
    if job['source_type'] == 'payment':
        payment = _payment(cur, job['source_id'])
        if not payment:
            return 'error', {}, 'Платёж не найден в базе'
        if payment['status'] not in ('CONFIRMED', 'AUTHORIZED', 'done'):
            return 'skipped', {'payment': payment}, f"Платёж в статусе {payment['status']} - чек не нужен"
        if payment['receipt_id'] and scenario['action_template'] == 'regular':
            return 'skipped', {'payment': payment}, 'По платежу уже есть чек в кассе'
        data = {
            'payment': payment,
            'customer': {'email': payment['customer_email'], 'phone': payment['customer_phone']},
            'items': None,
            'items_source': 'не подключён'
        }
        return 'ready', data, f"Собраны данные платежа #{payment['payment_id']} на {payment['amount']:.2f} ₽"

    return 'error', {}, f"Источник «{job['source_type']}» пока не поддерживается"


def retry_delay(attempts: int) -> Optional[int]:
    return RETRY_DELAYS[attempts - 1] if attempts - 1 < len(RETRY_DELAYS) else None


def log(cur, job_id: int, level: str, message: str, details: Optional[Dict[str, Any]] = None):
    cur.execute(
        f'INSERT INTO {SCHEMA}.automation_job_log (job_id, level, message, details) VALUES (%s, %s, %s, %s)',
        (job_id, level, message, json.dumps(details, ensure_ascii=False, default=str) if details else None)
    )
