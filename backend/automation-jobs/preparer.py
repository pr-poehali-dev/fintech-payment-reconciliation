import json
from typing import Any, Dict, Optional, Tuple

from ecomkassa_client import company_cash_register, get_receipt_atol

SCHEMA = 't_p83864310_fintech_payment_reco'

# Задержка следующей попытки (минуты) по номеру попытки; после последней - статус failed.
RETRY_DELAYS = [1, 5, 15, 60]


def _payment(cur, payment_id: str) -> Optional[Dict[str, Any]]:
    cur.execute(f'''
        SELECT wp.id, wp.payment_id, wp.order_id, wp.amount, wp.status, wp.customer_email, wp.customer_phone,
               wp.payment_provider, wp.receipt_id, wp.created_at, wp.integration_id, p.slug
        FROM {SCHEMA}.webhook_payments wp
        JOIN {SCHEMA}.user_integrations ui ON ui.id = wp.integration_id
        JOIN {SCHEMA}.integration_providers p ON p.id = ui.provider_id
        WHERE wp.id = %s
    ''', (payment_id,))
    r = cur.fetchone()
    if not r:
        return None
    return {
        'id': r[0], 'payment_id': r[1], 'order_id': r[2], 'amount': float(r[3] or 0),
        'status': r[4], 'customer_email': r[5], 'customer_phone': r[6],
        'payment_provider': r[7], 'receipt_id': r[8], 'created_at': r[9].isoformat() if r[9] else None,
        'integration_id': r[10], 'provider_slug': r[11]
    }


def _cart(cur, integration_id: int, provider_payment_id: str) -> Optional[Dict[str, Any]]:
    cur.execute(f'''
        SELECT items, receipt, items_total, source, fiscal_data, fiscalized, receipt_id FROM {SCHEMA}.payment_carts
        WHERE integration_id = %s AND payment_id = %s
    ''', (integration_id, provider_payment_id))
    r = cur.fetchone()
    if not r:
        return None
    return {'items': r[0] or [], 'receipt': r[1] or {}, 'items_total': float(r[2] or 0), 'source': r[3],
            'fiscal': r[4] or {}, 'fiscalized': bool(r[5]), 'receipt_id': r[6]}


# Провайдеры, у которых корзина приходит в уведомлении и без неё чек не собрать.
CART_FROM_PROVIDER = {'tbank': 'Т-Банк'}


def prepare(cur, job: Dict[str, Any], scenario: Dict[str, Any]) -> Tuple[str, Dict[str, Any], str]:
    '''
    Сбор данных для действия сценария. Возвращает (статус, данные, сообщение в журнал):
    ready - всё собрано; skipped - действие не нужно; error - повторить позже.
    Корзина берётся у того же провайдера, откуда пришёл платёж.
    '''
    if job['source_type'] != 'payment':
        return 'error', {}, f"Источник «{job['source_type']}» пока не поддерживается"

    payment = _payment(cur, job['source_id'])
    if not payment:
        return 'error', {}, 'Платёж не найден в базе'
    if payment['status'] not in ('CONFIRMED', 'AUTHORIZED', 'done'):
        return 'skipped', {'payment': payment}, f"Платёж в статусе {payment['status']} - документ не нужен"
    if payment['receipt_id'] and scenario['action_template'] == 'regular':
        return 'skipped', {'payment': payment}, 'По платежу уже есть чек в кассе'

    data: Dict[str, Any] = {
        'payment': payment,
        'customer': {'email': payment['customer_email'], 'phone': payment['customer_phone']},
        'items': None,
        'items_source': None
    }

    provider_name = CART_FROM_PROVIDER.get(payment['provider_slug'])
    if provider_name:
        cart = _cart(cur, payment['integration_id'], str(payment['payment_id']))
        if not cart:
            return 'error', data, f'Ждём корзину от {provider_name} (уведомление с составом чека ещё не пришло)'
        if not cart['items']:
            return 'error', data, f'{provider_name} прислал уведомление без товаров'
        receipt = cart['receipt']
        data['items'] = cart['items']
        data['items_source'] = provider_name
        data['taxation'] = receipt.get('Taxation')
        data['customer'] = {
            'email': receipt.get('Email') or payment['customer_email'],
            'phone': receipt.get('Phone') or payment['customer_phone'],
            'name': receipt.get('Customer'),
            'inn': receipt.get('CustomerInn')
        }
        data['provider_receipt'] = cart['fiscal']
        diff = round(cart['items_total'] - payment['amount'], 2)
        note = f', расхождение с платежом {diff:+.2f} ₽' if abs(diff) >= 0.01 else ''
        if cart['fiscalized']:
            data['existing_receipt_id'] = cart['receipt_id']
            if scenario['action_template'] == 'regular':
                return 'skipped', data, (
                    f"Касса {provider_name} уже пробила чек (ФН {cart['fiscal'].get('FnNumber')}, "
                    f"ФД {cart['fiscal'].get('FiscalDocumentNumber')}) - второй обычный чек не нужен"
                )
            note += f", касса {provider_name} уже пробила чек (ФН {cart['fiscal'].get('FnNumber')})"
        else:
            note += f', касса {provider_name} чек не пробила - пробиваем сами'
        return 'ready', data, (
            f"Корзина от {provider_name}: {len(cart['items'])} поз. на {cart['items_total']:.2f} ₽ "
            f"(платёж #{payment['payment_id']}{note})"
        )

    if payment['provider_slug'] == 'ecomkassa_gateway':
        # Платёж через шлюз Екомкассы (Точка и др.): идентификатор платежа = номер
        # документа в Екомкассе, корзину читаем оттуда же в формате АТОЛ Онлайн.
        kassa = company_cash_register(cur, job['company_id'])
        if not kassa:
            return 'error', data, 'Не найдена активная касса Екомкассы для чтения корзины'
        atol, err = get_receipt_atol(kassa, str(payment['payment_id']))
        if not atol:
            return 'error', data, err
        receipt = atol['receipt']
        items = receipt.get('items') or []
        if not items:
            return 'error', data, f"В документе Екомкассы #{payment['payment_id']} нет товаров"
        client = receipt.get('client') or {}
        data['items'] = items
        data['items_format'] = 'atol'
        data['payments'] = receipt.get('payments') or []
        data['items_source'] = 'Екомкасса'
        data['source_company'] = receipt.get('company') or {}
        data['taxation'] = (receipt.get('company') or {}).get('sno')
        data['customer'] = {
            'email': client.get('email') or payment['customer_email'],
            'phone': client.get('phone') or payment['customer_phone'],
            'name': client.get('name'), 'inn': client.get('inn')
        }
        total = round(sum(float(i.get('sum') or 0) for i in items), 2)
        diff = round(total - payment['amount'], 2)
        note = f', расхождение с платежом {diff:+.2f} ₽' if abs(diff) >= 0.01 else ''
        return 'ready', data, (
            f"Корзина из Екомкассы: {len(items)} поз. на {total:.2f} ₽ (платёж #{payment['payment_id']}{note})"
        )

    return 'ready', data, f"Собраны данные платежа #{payment['payment_id']} на {payment['amount']:.2f} ₽"


def retry_delay(attempts: int) -> Optional[int]:
    return RETRY_DELAYS[attempts - 1] if attempts - 1 < len(RETRY_DELAYS) else None


def log(cur, job_id: int, level: str, message: str, details: Optional[Dict[str, Any]] = None):
    cur.execute(
        f'INSERT INTO {SCHEMA}.automation_job_log (job_id, level, message, details) VALUES (%s, %s, %s, %s)',
        (job_id, level, message, json.dumps(details, ensure_ascii=False, default=str) if details else None)
    )
