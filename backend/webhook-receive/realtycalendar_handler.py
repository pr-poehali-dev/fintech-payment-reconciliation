'''
Вебхуки RealtyCalendar (РК) - CRM посуточной аренды.

РК шлёт вебхук на БРОНЬ (создание, изменение, отмена, новый/удалённый платёж) и каждый раз
присылает бронь целиком со всеми платежами (event_calendar_payments / payments_with_deleted).
Поэтому из каждого вебхука отбираем платежи, подходящие под настройки интеграции, и сохраняем
каждый отдельной строкой по его id: повторный вебхук той же брони уже сохранённые платежи
не задвоит (уникальный ключ интеграция + id платежа + статус).

Одна интеграция = один этап (config.stage) со своими фильтрами - так понятно, какой
вебхук какой сценарий запускает:
  income - платежи гостя (payment_type=income) -> чек предоплаты;
  refund - возвраты (payment_type=refund) -> чек возврата предоплаты.
Фильтры: платёжные системы (manual / moneta / moneta_le / yandex_kassa) - чтобы не задвоить
чеки, которые уже пробивает касса платёжной системы; залоги (type=deposit) - по умолчанию нет.
Подписи у вебхуков РК нет - защита уникальным адресом интеграции.
'''
import json
from typing import Any, Dict, List, Optional, Tuple

SCHEMA = 't_p83864310_fintech_payment_reco'

STAGES = {
    'income': 'Платёж гостя',
    'refund': 'Возврат гостю',
}
STAGE_PAYMENT_TYPE = {'income': 'income', 'refund': 'refund'}
STAGE_STATUS = {'income': 'CONFIRMED', 'refund': 'REFUNDED'}

PAYMENT_SYSTEMS = {
    'manual': 'Вручную (наличные, перевод)',
    'moneta': 'Монета',
    'moneta_le': 'Монета (юрлицо)',
    'yandex_kassa': 'ЮKassa',
}


def event_type(webhook_data: Dict[str, Any]) -> str:
    return str((webhook_data or {}).get('action') or 'unknown')[:50]


def _payments(booking: Dict[str, Any]) -> List[Dict[str, Any]]:
    '''Все платежи брони: при создании - event_calendar_payments, при изменении - payments_with_deleted.'''
    seen: Dict[str, Dict[str, Any]] = {}
    for key in ('payments_with_deleted', 'event_calendar_payments'):
        for p in booking.get(key) or []:
            if isinstance(p, dict) and p.get('id') is not None and str(p['id']) not in seen:
                seen[str(p['id'])] = p
    return list(seen.values())


def select_payments(booking: Dict[str, Any], config: Dict[str, Any]) -> Tuple[List[Dict[str, Any]], List[str]]:
    '''Платежи брони, подходящие под этап и фильтры интеграции, + причины, почему остальные пропущены.'''
    stage = str(config.get('stage') or 'income')
    want_type = STAGE_PAYMENT_TYPE.get(stage, 'income')
    systems = [str(s) for s in (config.get('payment_systems') or []) if str(s).strip()]
    with_deposits = bool(config.get('include_deposits'))
    picked, skipped = [], []
    for p in _payments(booking):
        pid = p.get('id')
        if p.get('is_delete'):
            skipped.append(f'#{pid} удалён')
            continue
        if str(p.get('payment_type') or 'income') != want_type:
            continue
        if p.get('type') == 'deposit' and not with_deposits:
            skipped.append(f'#{pid} залог')
            continue
        system = str(p.get('payment_system') or 'manual')
        if systems and system not in systems:
            skipped.append(f'#{pid} {PAYMENT_SYSTEMS.get(system, system)} не выбрана')
            continue
        try:
            amount = round(float(p.get('amount') or 0), 2)
        except (TypeError, ValueError):
            amount = 0
        if amount <= 0:
            continue
        picked.append({**p, 'amount': amount})
    return picked, skipped


def process(cur, integration_id: int, company_id: int, config: Dict[str, Any],
            webhook_data: Dict[str, Any]) -> Tuple[List[int], Optional[str], Optional[str]]:
    '''
    Returns: (id новых сохранённых платежей для автоматизации, ошибка, пометка «пропущено»).
    '''
    data = webhook_data.get('data') if isinstance(webhook_data.get('data'), dict) else {}
    booking = data.get('booking') if isinstance(data.get('booking'), dict) else None
    if not booking:
        if webhook_data.get('action') == 'create_basket':
            return [], None, 'Создание корзины (подборки) - платежей нет, чек не нужен'
        return [], 'В вебхуке нет брони (data.booking)', None

    stage = str(config.get('stage') or 'income')
    status = STAGE_STATUS.get(stage, 'CONFIRMED')
    picked, skipped = select_payments(booking, config)
    client = booking.get('client') if isinstance(booking.get('client'), dict) else {}
    booking_light = {k: v for k, v in booking.items() if k not in ('payments_with_deleted', 'event_calendar_payments')}

    new_ids: List[int] = []
    for p in picked:
        raw = {'action': webhook_data.get('action'), 'status': webhook_data.get('status'),
               'booking': booking_light, 'payment': p}
        cur.execute(f'''
            INSERT INTO {SCHEMA}.webhook_payments (
                integration_id, company_id, payment_id, amount, order_id, status, payment_status,
                customer_email, customer_phone, raw_data, payment_provider, origin
            ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'webhook')
            ON CONFLICT (integration_id, payment_id, status) DO NOTHING
            RETURNING id
        ''', (
            integration_id, company_id, str(p['id']), p['amount'], str(booking.get('id') or '') or None,
            status, str(p.get('payment_type') or ''), (client.get('email') or None), (client.get('phone') or None),
            json.dumps(raw, ensure_ascii=False),
            f"RealtyCalendar · {PAYMENT_SYSTEMS.get(str(p.get('payment_system') or 'manual'), p.get('payment_system'))}"
        ))
        row = cur.fetchone()
        if row:
            new_ids.append(row[0])

    if new_ids:
        return new_ids, None, None
    noun = 'возвратов' if stage == 'refund' else 'платежей'
    reason = f' (пропущены: {", ".join(skipped)})' if skipped else ''
    return [], None, f'Бронь #{booking.get("id")}: новых {noun} для чека нет{reason}'
