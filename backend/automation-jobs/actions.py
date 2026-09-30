from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from ecomkassa_client import cash_register, create_courier_order
from receipt_dictionaries import MEASURES, PAYMENT_OBJECTS_V5

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
    source_company = data.get('source_company') or {}
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
    result, err = create_courier_order(kassa, operation, body)
    if not result:
        return 'error', {'request': body}, err
    return 'done', {'request': body, 'response': result, 'external_id': external_id}, (
        f"Заказ создан в Екомкассе: #{result.get('uuid')} на {total:.2f} ₽, "
        f"шаблон «{template.get('name')}», {'оплаченный' if paid else 'неоплаченный'} ({result.get('permalink', '')})"
    )


ACTIONS = {'create_order': create_order}
