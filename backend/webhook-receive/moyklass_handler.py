'''
Вебхуки CRM «Мой Класс».

Одна интеграция = один этап (config.stage). Сейчас поддерживается этап
«payment_new» - «Принят платёж» (оплата абонемента/обучения -> чек предоплаты).
События другого типа, пришедшие на адрес этой интеграции, не обрабатываются -
так вебхуки разных этапов (оплата, позже - списание/зачёт аванса) не смешиваются.

Вебхук приходит без подписи, защита - уникальный адрес с токеном интеграции.
В обработчике только сохраняем платёж (быстро, без запросов в API): ученика,
абонемент и способ оплаты дозапрашивает автоматизация при сборке чека.
'''
import json
from typing import Any, Dict, Optional, Tuple

SCHEMA = 't_p83864310_fintech_payment_reco'

STAGES = {
    'payment_new': 'Принят платёж',
}


def event_type(webhook_data: Dict[str, Any]) -> str:
    return str((webhook_data or {}).get('event') or 'unknown')[:50]


def process(cur, integration_id: int, company_id: int, config: Dict[str, Any],
            webhook_data: Dict[str, Any]) -> Tuple[Optional[int], Optional[str], Optional[str]]:
    '''
    Returns: (webhook_payment_id для автоматизации, ошибка, пометка «пропущено»).
    Платёж со способом оплаты, который не выбран в интеграции, сохраняется для сверки,
    но чек по нему не создаётся (его пробивает другая касса).
    '''
    stage = str(config.get('stage') or 'payment_new')
    event = event_type(webhook_data)
    if event != stage:
        return None, None, (
            f'Событие «{event}» не относится к этапу интеграции «{STAGES.get(stage, stage)}» - пропущено. '
            f'Для этого события подключите отдельную интеграцию «Мой Класс» с нужным этапом'
        )

    obj = webhook_data.get('object') if isinstance(webhook_data.get('object'), dict) else {}
    payment_id = obj.get('paymentId')
    amount = obj.get('summa')
    if not payment_id or amount in (None, ''):
        return None, 'В вебхуке нет paymentId или суммы платежа', None
    try:
        amount = round(float(amount), 2)
    except (TypeError, ValueError):
        return None, f'Некорректная сумма платежа: {amount}', None
    if amount <= 0:
        return None, None, f'Платёж #{payment_id} на {amount} ₽ - чек не нужен'

    type_id = obj.get('paymentTypeId')
    allowed = [str(v) for v in (config.get('payment_type_ids') or []) if str(v).strip()]
    skip_receipt = bool(allowed) and str(type_id) not in allowed

    cur.execute(f'''
        INSERT INTO {SCHEMA}.webhook_payments (
            integration_id, company_id, payment_id, amount, order_id, status, payment_status,
            raw_data, payment_provider, origin
        ) VALUES (%s, %s, %s, %s, %s, 'CONFIRMED', %s, %s, %s, 'webhook')
        ON CONFLICT (integration_id, payment_id, status) DO NOTHING
        RETURNING id
    ''', (
        integration_id, company_id, str(payment_id), amount, None, event,
        json.dumps(webhook_data, ensure_ascii=False),
        f'Мой Класс · способ #{type_id}' if type_id else 'Мой Класс'
    ))
    row = cur.fetchone()
    if not row:
        return None, None, f'Платёж #{payment_id} уже получен ранее - повтор вебхука'
    if skip_receipt:
        return None, None, (
            f'Платёж #{payment_id} сохранён для сверки, чек не создаётся: способ оплаты #{type_id} '
            f'не выбран в настройках интеграции'
        )
    return row[0], None, None
