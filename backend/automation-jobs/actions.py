from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

from ecomkassa_client import cash_register, create_courier_order

MSK = timezone(timedelta(hours=3))
# Тип оплаты АТОЛ: 1 - безналичный.
CASHLESS = 1


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


def create_order(cur, job: Dict[str, Any], scenario: Dict[str, Any], data: Dict[str, Any]) -> Tuple[str, Dict[str, Any], str]:
    '''
    Создаёт заказ в Екомкассе (POST /api/mobile/v1/courier/:storeId/create/sell).
    Номер внешнего заказа - auto-<id задания>: повторная отправка того же задания
    вернёт уже созданный заказ, дубля не будет. Оплаченный заказ - в оплатах
    безнал на сумму корзины, неоплаченный - оплаты пустые.
    Returns: (статус, результат, сообщение в журнал): done / error.
    '''
    kassa = cash_register(cur, scenario['target_integration_id'])
    if not kassa:
        return 'error', {}, 'Касса сценария не найдена, отключена или без номера магазина'
    items = _atol_items(data)
    if not items:
        return 'error', {}, 'В собранных данных нет товаров'

    total = round(sum(float(i.get('sum') or 0) for i in items), 2)
    source_company = data.get('source_company') or {}
    customer = data.get('customer') or {}
    client = {k: v for k, v in {'email': customer.get('email'), 'phone': customer.get('phone'),
                                'name': customer.get('name'), 'inn': customer.get('inn')}.items() if v}
    company = {k: v for k, v in {'inn': source_company.get('inn'), 'sno': data.get('taxation') or source_company.get('sno'),
                                 'payment_address': source_company.get('payment_address'),
                                 'email': source_company.get('email')}.items() if v}
    paid = scenario['action_template'] == 'paid_order'
    external_id = f"auto-{job['id']}"
    body = {
        'external_id': external_id,
        'timestamp': datetime.now(MSK).strftime('%d.%m.%Y %H:%M:%S'),
        'receipt': {
            'client': client,
            'company': company,
            'items': items,
            'payments': (data.get('payments') or [{'type': CASHLESS, 'sum': total}]) if paid else [],
            'total': total
        }
    }
    result, err = create_courier_order(kassa, 'sell', body)
    if not result:
        return 'error', {'request': body}, err
    return 'done', {'request': body, 'response': result, 'external_id': external_id}, (
        f"Заказ создан в Екомкассе: #{result.get('uuid')} на {total:.2f} ₽, "
        f"{'оплаченный' if paid else 'неоплаченный'} ({result.get('permalink', '')})"
    )


ACTIONS = {'create_order': create_order}
