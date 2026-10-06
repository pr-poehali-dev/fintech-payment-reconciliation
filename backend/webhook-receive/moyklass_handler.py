'''
Вебхуки CRM «Мой Класс».

Одна интеграция = один этап (config.stage):
  payment_new - «Принят платёж»: ученик оплатил абонемент -> чек предоплаты (аванс);
  debit_new   - «Новое списание»: занятие проведено, с баланса/абонемента списана его
                стоимость -> чек полного расчёта с зачётом аванса (услуга оказана, 54-ФЗ).
События другого типа, пришедшие на адрес этой интеграции, не обрабатываются -
так вебхуки разных этапов не смешиваются.

Списание хранится со статусом OFFSET: это не новые деньги, а зачёт уже полученной
предоплаты, поэтому в сверке выручки оно не учитывается (там считаются только
AUTHORIZED/CONFIRMED), но автоматизация по нему пробивает чек зачёта.

Вебхук приходит без подписи, защита - уникальный адрес с токеном интеграции.
В обработчике только сохраняем платёж (быстро, без запросов в API): ученика,
абонемент и способ оплаты дозапрашивает автоматизация при сборке чека.
'''
import json
from typing import Any, Dict, Optional, Tuple

SCHEMA = 't_p83864310_fintech_payment_reco'

STAGES = {
    'payment_new': 'Принят платёж',
    'debit_new': 'Новое списание (зачёт аванса)',
}

# Этап -> статус платежа в нашей базе.
STAGE_STATUS = {'payment_new': 'CONFIRMED', 'debit_new': 'OFFSET'}


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
    # Фильтр способов оплаты - только для оплат: у списания способа оплаты нет.
    skip_receipt = stage == 'payment_new' and bool(allowed) and str(type_id) not in allowed
    status = STAGE_STATUS.get(stage, 'CONFIRMED')
    if stage == 'debit_new':
        label = 'Мой Класс · зачёт аванса'
    else:
        label = f'Мой Класс · способ #{type_id}' if type_id else 'Мой Класс'

    cur.execute(f'''
        INSERT INTO {SCHEMA}.webhook_payments (
            integration_id, company_id, payment_id, amount, order_id, status, payment_status,
            raw_data, payment_provider, origin
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, 'webhook')
        ON CONFLICT (integration_id, payment_id, status) DO NOTHING
        RETURNING id
    ''', (
        integration_id, company_id, str(payment_id), amount, None, status, event,
        json.dumps(webhook_data, ensure_ascii=False), label
    ))
    row = cur.fetchone()
    if not row:
        noun = 'Списание' if stage == 'debit_new' else 'Платёж'
        return None, None, f'{noun} #{payment_id} уже получено ранее - повтор вебхука'
    if skip_receipt:
        return None, None, (
            f'Платёж #{payment_id} сохранён для сверки, чек не создаётся: способ оплаты #{type_id} '
            f'не выбран в настройках интеграции'
        )
    return row[0], None, None
