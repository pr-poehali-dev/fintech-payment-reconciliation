import json
from typing import Any, Dict, Optional, Tuple

from ecomkassa_client import company_cash_register, get_receipt_atol
import bitrix_crm
import alfabank_api
import tochka_acquiring_api

SCHEMA = 't_p83864310_fintech_payment_reco'

# Задержка следующей попытки (минуты) по номеру попытки; после последней - статус failed.
# Пауза перед повтором (мин): 1, 5, 15 - после 4-й неудачной попытки задание уходит в «Не удалось».
RETRY_DELAYS = [1, 5, 15]


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


def _fetch_alfabank_cart(cur, company_id: int, payment: Dict[str, Any]) -> Optional[str]:
    '''Запрос заказа с корзиной у Альфа-Банка (getOrderStatusExtended) и сохранение корзины.'''
    cur.execute(f'SELECT config FROM {SCHEMA}.user_integrations WHERE id = %s', (payment['integration_id'],))
    row = cur.fetchone()
    config = row[0] if row and isinstance(row[0], dict) else json.loads((row or [None])[0] or '{}')
    order, err = alfabank_api.get_order_status(config, str(payment['payment_id']), payment.get('order_id'), timeout=8)
    if not order:
        return err
    alfabank_api.save_cart(cur, payment['integration_id'], company_id, str(payment['payment_id']), order)
    return None


def _fetch_tochka_cart(cur, company_id: int, payment: Dict[str, Any]) -> Optional[str]:
    '''Операция с корзиной у Точки (Get Payment Operation Info) и сохранение корзины.'''
    cur.execute(f'SELECT config FROM {SCHEMA}.user_integrations WHERE id = %s', (payment['integration_id'],))
    row = cur.fetchone()
    config = row[0] if row and isinstance(row[0], dict) else json.loads((row or [None])[0] or '{}')
    op, err = tochka_acquiring_api.get_operation(str(config.get('api_token') or ''), str(payment['payment_id']), timeout=8)
    if not op:
        return err
    tochka_acquiring_api.save_cart(cur, payment['integration_id'], company_id, str(payment['payment_id']), op)
    return None


# Провайдеры, у которых корзина приходит в уведомлении и без неё чек не собрать.
CART_FROM_PROVIDER = {'tbank': 'Т-Банк', 'alfabank': 'Альфа-Банк', 'tochka_acquiring': 'Точка'}


def prepare(cur, job: Dict[str, Any], scenario: Dict[str, Any]) -> Tuple[str, Dict[str, Any], str]:
    '''
    Сбор данных для действия сценария. Возвращает (статус, данные, сообщение в журнал):
    ready - всё собрано; skipped - действие не нужно; error - повторить позже.
    Корзина берётся у того же провайдера, откуда пришёл платёж.
    '''
    if job['source_type'] in ('crm_deal', 'crm_lead'):
        return prepare_crm(cur, job, scenario)
    if job['source_type'] != 'payment':
        return 'error', {}, f"Источник «{job['source_type']}» пока не поддерживается"

    payment = _payment(cur, job['source_id'])
    if not payment:
        return 'error', {}, 'Платёж не найден в базе'
    if payment['status'] not in ('CONFIRMED', 'AUTHORIZED', 'done'):
        return 'skipped', {'payment': payment}, f"Платёж в статусе {payment['status']} - документ не нужен"
    if payment['receipt_id'] and scenario['action_template'] == 'regular':
        return 'skipped', {'payment': payment}, 'По платежу уже есть чек в кассе'
    if (job.get('payload') or {}).get('reason') == 'discrepancy':
        # Расхождение: пока задание ждало, чек мог прийти - перепроверяем, чтобы не задвоить.
        has_receipt = payment['receipt_id'] is not None
        if not has_receipt:
            cur.execute(f'''
                SELECT EXISTS (SELECT 1 FROM {SCHEMA}.automation_documents d
                               WHERE d.payment_row_id = %s AND d.doc_kind = 'receipt' AND d.job_id <> %s)
            ''', (payment['id'], job['id']))
            has_receipt = bool(cur.fetchone()[0])
        if has_receipt:
            return 'skipped', {'payment': payment}, 'Чек по платежу уже есть или его пробивает другое задание - второй не нужен'

    data: Dict[str, Any] = {
        'payment': payment,
        'customer': {'email': payment['customer_email'], 'phone': payment['customer_phone']},
        'items': None,
        'items_source': None
    }

    provider_name = CART_FROM_PROVIDER.get(payment['provider_slug'])
    if provider_name:
        cart = _cart(cur, payment['integration_id'], str(payment['payment_id']))
        if (not cart or not cart['items']) and payment['provider_slug'] in ('alfabank', 'tochka_acquiring'):
            # У Альфа-Банка и Точки состав заказа не приходит в уведомлении - дозапрашиваем у банка.
            fetch = _fetch_alfabank_cart if payment['provider_slug'] == 'alfabank' else _fetch_tochka_cart
            cart_error = fetch(cur, job['company_id'], payment)
            cart = _cart(cur, payment['integration_id'], str(payment['payment_id']))
            if not cart:
                return 'error', data, f'Не удалось получить корзину заказа у {provider_name}: {cart_error}'
        if not cart:
            return 'error', data, f'Ждём корзину от {provider_name} (уведомление с составом чека ещё не пришло)'
        if not cart['items']:
            if payment['provider_slug'] == 'tochka_acquiring':
                return 'error', data, ('В платёжной ссылке Точки нет товаров - для чека передавайте Items '
                                       'при создании ссылки (метод с чеком payments_with_receipt)')
            if payment['provider_slug'] == 'alfabank':
                if payment.get('payment_provider') == 'СБП' and not payment.get('order_id'):
                    return 'error', data, ('Оплата по статическому QR-коду СБП - у такого платежа нет корзины. '
                                           'Для чека нужен заказ с корзиной (динамический QR или платёжная страница)')
                return 'error', data, ('В заказе Альфа-Банка нет корзины товаров (orderBundle) - '
                                       'магазин должен передавать её при регистрации заказа')
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


def _crm_webhook_url(cur, scenario_id: int) -> str:
    cur.execute(f'''
        SELECT ui.config FROM {SCHEMA}.automation_scenarios s
        JOIN {SCHEMA}.user_integrations ui ON ui.id = s.source_integration_id
        WHERE s.id = %s
    ''', (scenario_id,))
    row = cur.fetchone()
    config = row[0] if row else {}
    config = json.loads(config) if isinstance(config, str) else (config or {})
    return config.get('webhook_url', '')


def prepare_crm(cur, job: Dict[str, Any], scenario: Dict[str, Any]) -> Tuple[str, Dict[str, Any], str]:
    '''
    Сделка/лид Битрикс24: свежие данные из CRM (сделка + контакт + компания + товары),
    проверка стадии запуска, сбор позиций и покупателя по сопоставлению полей сценария.
    '''
    entity = 'lead' if job['source_type'] == 'crm_lead' else 'deal'
    noun = 'Сделка' if entity == 'deal' else 'Лид'
    mapping = {**bitrix_crm.DEFAULT_MAPPING, **(scenario.get('field_mapping') or {})}
    record, err = bitrix_crm.load_record(_crm_webhook_url(cur, scenario['id']), entity, job['source_id'])
    if err:
        return 'error', {}, err
    main = record[entity]
    if not bitrix_crm.stage_matches(mapping, entity, main):
        return 'skipped', {'crm': {'entity': entity, 'id': job['source_id']}}, (
            f"{noun} #{job['source_id']} в воронке {main.get('CATEGORY_ID', '-')}, а сценарий настроен на воронку "
            f"{mapping.get('pipeline')} - документ не создаётся"
        )
    data, err, note = bitrix_crm.build_data(record, entity, mapping)
    if err:
        return 'error', {}, err
    total = sum(i['sum'] for i in data['items'])
    return 'ready', data, (
        f"{noun} #{job['source_id']} «{main.get('TITLE') or ''}»: {len(data['items'])} поз. на {total:.2f} ₽{note}"
    )


def retry_delay(attempts: int) -> Optional[int]:
    return RETRY_DELAYS[attempts - 1] if attempts - 1 < len(RETRY_DELAYS) else None


def log(cur, job_id: int, level: str, message: str, details: Optional[Dict[str, Any]] = None):
    cur.execute(
        f'INSERT INTO {SCHEMA}.automation_job_log (job_id, level, message, details) VALUES (%s, %s, %s, %s)',
        (job_id, level, message, json.dumps(details, ensure_ascii=False, default=str) if details else None)
    )
