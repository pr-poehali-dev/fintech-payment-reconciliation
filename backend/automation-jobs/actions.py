from datetime import date, datetime, timedelta, timezone
import json
from typing import Any, Dict, List, Optional, Tuple

from ecomkassa_client import cash_register, create_courier_order, deliver_courier_order, order_status
from receipt_dictionaries import MEASURES, PAYMENT_OBJECTS_V5

SCHEMA = 't_p83864310_fintech_payment_reco'
MSK = timezone(timedelta(hours=3))


def _atol_items(data: Dict[str, Any]) -> Optional[List[Dict[str, Any]]]:
    '''Позиции в формате АТОЛ. Корзина Т-Банка переводится, корзина Екомкассы уже в нужном формате.'''
    items = data.get('items') or []
    if data.get('items_format') == 'atol':
        return items
    result = []
    for i in items:
        item = {
            'name': i.get('name'), 'price': i.get('price'), 'quantity': i.get('quantity'),
            'sum': i.get('amount'), 'measurement_unit': i.get('measurement_unit') or 'шт',
            'payment_method': i.get('payment_method') or 'full_payment',
            'payment_object': i.get('payment_object') or 'commodity',
            'vat': {'type': i.get('tax') or 'none'}
        }
        if isinstance(i.get('agent_data'), dict):
            item['agent_info'] = {'type': i['agent_data'].get('AgentSign')}
        if isinstance(i.get('supplier_info'), dict):
            item['supplier_info'] = {k.lower(): v for k, v in i['supplier_info'].items()}
        result.append(item)
    return result


def apply_template(items: List[Dict[str, Any]], template: Dict[str, Any]) -> List[Dict[str, Any]]:
    '''
    Проставляет в позиции признак расчёта, предмет расчёта и единицу измерения из шаблона.
    v4: payment_object строкой, measurement_unit строкой; v5: payment_object и measure числами.
    '''
    v5 = template.get('protocol_version') == 'v5'
    result = []
    for i in items:
        item = dict(i)
        if template.get('payment_method'):
            item['payment_method'] = template['payment_method']
        obj = template.get('payment_object')
        if obj:
            item['payment_object'] = PAYMENT_OBJECTS_V5[obj] if v5 else ('commodity' if obj == 'commodity_marked' else obj)
        measure = MEASURES.get(template.get('measure') or '')
        if measure:
            if v5:
                item.pop('measurement_unit', None)
                item['measure'] = measure['v5']
            else:
                item.pop('measure', None)
                item['measurement_unit'] = measure['v4']
        result.append(item)
    return result


def document_operation(template: Dict[str, Any]) -> str:
    '''Операция в URL: sell / sell_refund, для чека коррекции - *_correction.'''
    operation = template.get('operation') or 'sell'
    if template.get('receipt_type') == 'correction':
        return f'{operation}_correction'
    return operation


def correction_info(template: Dict[str, Any], data: Dict[str, Any]) -> Tuple[Optional[Dict[str, Any]], str]:
    '''
    correction_info для чека коррекции - только самостоятельная (type = self):
    v4 - base_date (дата документа основания) + base_number (обязателен);
    v5 - base_date (дата корректируемого расчёта), без номера.
    '''
    if template.get('receipt_type') != 'correction':
        return None, ''
    if template.get('correction_date_source') == 'fixed' and template.get('correction_base_date'):
        base = template['correction_base_date']
        base_date = base if isinstance(base, date) else datetime.strptime(str(base)[:10], '%Y-%m-%d').date()
    else:
        paid_at = (data.get('payment') or {}).get('created_at')
        if not paid_at:
            return None, 'Нет даты платежа для основания коррекции'
        base_date = datetime.fromisoformat(paid_at).date()
    info = {'type': 'self', 'base_date': base_date.strftime('%d.%m.%Y')}
    if template.get('protocol_version') == 'v5':
        return info, ''
    number = template.get('correction_base_number')
    if not number:
        return None, 'В шаблоне не указан номер документа основания коррекции (обязателен для v4)'
    info['base_number'] = number
    return info, ''


WEBHOOK_RECEIVE_URL = 'https://functions.poehali.dev/a923b457-57a6-4eb2-b566-9a9d65cb04e8'


def callback_url(cur, company_id: Optional[int]) -> Optional[str]:
    '''
    Адрес, куда Екомкасса пришлёт уведомление о пробитом чеке по заказу (формат АТОЛ:
    status done/fail, uuid, payload с реквизитами). Принимает его интеграция
    «Екомкасса — платёжный шлюз» компании: она сохраняет чек к кассе компании.
    '''
    if cur is None or not company_id:
        return None
    cur.execute(f'''
        SELECT ui.webhook_token FROM {SCHEMA}.user_integrations ui
        JOIN {SCHEMA}.integration_providers p ON p.id = ui.provider_id
        WHERE ui.company_id = %s AND p.slug = 'ecomkassa_gateway' AND ui.status = 'active'
          AND ui.webhook_token IS NOT NULL
        ORDER BY ui.id LIMIT 1
    ''', (company_id,))
    row = cur.fetchone()
    return f'{WEBHOOK_RECEIVE_URL}?token={row[0]}' if row else None


def save_pending_order(cur, integration_id: int, company_id: Optional[int], order_id: str,
                       raw: Dict[str, Any], total: float) -> None:
    '''
    Заказ создан в Екомкассе - сразу сохраняем его со статусом wait ("В работе"),
    не дожидаясь колбэка: так он появляется в реестре в группе с платежом.
    Пробитый заказ (done) не трогаем. Логика та же, что в webhook-receive.
    '''
    if cur is None or not company_id:
        return
    raw = {k: v for k, v in raw.items() if v is not None}
    raw['status'] = 'wait'
    cur.execute(f'''
        INSERT INTO {SCHEMA}.ecomkassa_receipts (
            integration_id, company_id, order_id, legacy_no, status, total_sum, raw_data, order_type
        ) VALUES (%s, %s, %s, %s, 'wait', %s, %s, 'CORD')
        ON CONFLICT (integration_id, order_id) DO UPDATE SET
            total_sum = COALESCE(EXCLUDED.total_sum, {SCHEMA}.ecomkassa_receipts.total_sum),
            raw_data = {SCHEMA}.ecomkassa_receipts.raw_data || EXCLUDED.raw_data
        WHERE {SCHEMA}.ecomkassa_receipts.status = 'wait'
    ''', (integration_id, company_id, order_id, order_id, total, json.dumps(raw, ensure_ascii=False)))


def create_order(cur, job: Dict[str, Any], scenario: Dict[str, Any], data: Dict[str, Any]) -> Tuple[str, Dict[str, Any], str]:
    '''
    Создаёт заказ в Екомкассе (POST /api/mobile/v1/courier/:storeId/create/:operation).
    Параметры берутся из шаблона действия: операция и тип чека, признак/предмет расчёта,
    единица измерения, тип оплаты (пусто - без оплат), почта по умолчанию.
    Номер внешнего заказа - auto-<id задания>: повтор того же задания дубля не создаст.
    Returns: (статус, результат, сообщение в журнал): done / error.
    '''
    kassa = cash_register(cur, scenario['target_integration_id'])
    if not kassa:
        return 'error', {}, 'Касса сценария не найдена, отключена или без номера магазина'
    items = _atol_items(data)
    if not items:
        return 'error', {}, 'В собранных данных нет товаров'

    template = scenario.get('template') or {}
    items = apply_template(items, template)
    total = round(sum(float(i.get('sum') or 0) for i in items), 2)
    source_company = dict(data.get('source_company') or {})
    if not source_company.get('inn') and cur is not None and job.get('company_id'):
        # Корзина не из Екомкассы (Т-Банк и др.) - реквизиты организации из карточки компании.
        cur.execute(f'SELECT inn FROM {SCHEMA}.companies WHERE id = %s', (job['company_id'],))
        row = cur.fetchone()
        if row and row[0]:
            source_company['inn'] = row[0]
    customer = data.get('customer') or {}
    client = {k: v for k, v in {'email': customer.get('email') or template.get('default_email'),
                                'phone': customer.get('phone'),
                                'name': customer.get('name'), 'inn': customer.get('inn')}.items() if v}
    company = {k: v for k, v in {'inn': source_company.get('inn'), 'sno': data.get('taxation') or source_company.get('sno'),
                                 'payment_address': source_company.get('payment_address'),
                                 'email': source_company.get('email')}.items() if v}
    payment_type = template.get('payment_type')
    paid = payment_type is not None
    operation = document_operation(template)
    correction, err = correction_info(template, data)
    if err:
        return 'error', {}, err
    external_id = f"auto-{job['id']}"
    body = {
        'external_id': external_id,
        'timestamp': datetime.now(MSK).strftime('%d.%m.%Y %H:%M:%S'),
        'receipt': {
            'client': client,
            'company': company,
            'items': items,
            'payments': [{'type': int(payment_type), 'sum': total}] if paid else [],
            'total': total
        }
    }
    if correction:
        body['receipt']['correction_info'] = correction
    notify_url = callback_url(cur, job.get('company_id'))
    if notify_url:
        body['service'] = {'callback_url': notify_url}
    result, err = create_courier_order(kassa, operation, body)
    if not result:
        return 'error', {'request': body}, err
    order_id = str(result.get('uuid'))
    save_pending_order(cur, kassa['id'], job.get('company_id'), order_id, {
        'uuid': order_id, 'external_id': external_id, 'kind': 'COURIER_ORDER',
        'permalink': result.get('permalink'), 'timestamp': result.get('timestamp'),
    }, total)
    message = (
        f"Заказ создан в Екомкассе: #{order_id} на {total:.2f} ₽, "
        f"шаблон «{template.get('name')}», {'оплаченный' if paid else 'неоплаченный'} ({result.get('permalink', '')})"
    )
    outcome = {'request': body, 'response': result, 'external_id': external_id}
    if not template.get('auto_deliver'):
        return 'done', outcome, message

    # Повтор задания вернёт тот же заказ (external_id) - если доставка уже
    # подтверждена, второй раз не подтверждаем.
    if order_status(kassa, order_id) == 'PAID':
        return 'done', outcome, f'{message}. Доставка уже подтверждена'
    deliver_body = {k: v for k, v in {
        'cashierName': template.get('cashier_name'),
        'customerEmail': client.get('email'),
        'customerPhone': client.get('phone'),
    }.items() if v}
    # Предоплаченный заказ - пустой список оплат (касса зачтёт аванс сама).
    deliver_body['payments'] = []
    delivered, err = deliver_courier_order(kassa, order_id, deliver_body)
    outcome['deliver_request'] = deliver_body
    if delivered is None:
        return 'error', outcome, f'{message}. {err}'
    outcome['deliver_response'] = delivered
    return 'done', outcome, (
        f"{message}. Доставка подтверждена, заказ {delivered.get('status', 'PAID')} - "
        f"касса пробьёт чек и пришлёт уведомление"
    )


ACTIONS = {'create_order': create_order}
