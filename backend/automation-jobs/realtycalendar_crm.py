'''
Сопоставление полей RealtyCalendar для сценария чеков (как у «Мой Класс» - moyklass_crm.py).

Запись берётся целиком из вебхука (в API РК не ходим):
  booking   - бронь (даты, ночи, сумма, оплачено, остаток, примечание, источник)
  client    - гость (ФИО, телефон, почта)
  apartment - объект (название, адрес)
  payment   - платёж/возврат (сумма, дата оплаты, платёжная система, комментарий)
Ссылка на поле - «объект.код»: client.phone, apartment.title, booking.begin_date.
Название и сумма позиции - шаблоны с подстановкой {объект.код}, сумма может быть формулой.
'''
import re
from typing import Any, Dict, List, Optional, Tuple

from moyklass_crm import calc_amount, human_date, render_name, resolve, _number

NAME_LIMIT = 128

ENTITIES = ['booking', 'client', 'apartment', 'payment']

BASE_FIELDS: Dict[str, List[Tuple[str, str, str]]] = {
    'booking': [
        ('id', 'ID брони', 'integer'), ('begin_date', 'Заезд', 'date'), ('end_date', 'Выезд', 'date'),
        ('arrival_time', 'Время заезда', 'string'), ('departure_time', 'Время выезда', 'string'),
        ('number_of_nights', 'Ночей', 'integer'), ('number_of_days', 'Дней', 'integer'),
        ('amount', 'Сумма брони', 'double'), ('price_per_day', 'Цена за сутки', 'double'),
        ('prepayment', 'Оплачено', 'double'), ('balance_to_be_paid_1', 'Осталось оплатить', 'double'),
        ('deposit', 'Оплачено залога', 'double'), ('notes', 'Примечание', 'string'),
        ('source_title', 'Источник брони (площадка)', 'string'), ('address', 'Адрес', 'string'),
    ],
    'client': [
        ('fio', 'ФИО гостя', 'string'), ('phone', 'Телефон', 'phone'),
        ('additional_phone', 'Доп. телефон', 'phone'), ('email', 'Email', 'email'), ('id', 'ID гостя', 'integer'),
    ],
    'apartment': [
        ('title', 'Название объекта', 'string'), ('address', 'Адрес объекта', 'string'), ('id', 'ID объекта', 'integer'),
    ],
    'payment': [
        ('id', 'ID платежа', 'integer'), ('amount', 'Сумма платежа', 'double'), ('paid_at', 'Дата оплаты', 'date'),
        ('payment_system_title', 'Платёжная система', 'string'), ('note', 'Комментарий к платежу', 'string'),
        ('type_title', 'Тип (платёж / залог)', 'string'),
    ],
}

SYSTEM_TITLES = {'manual': 'Вручную', 'moneta': 'Монета', 'moneta_le': 'Монета', 'yandex_kassa': 'ЮKassa'}

DEFAULT_MAPPING: Dict[str, Any] = {
    'order_id': 'booking.id',
    'amount': 'payment.amount',
    'customer_email': 'client.email',
    'customer_phone': 'client.phone',
    'customer_name': 'client.fio',
    'customer_inn': '',
    'items_mode': 'single',
    'fixed_items': [],
    'single_item_name': 'Проживание «{apartment.title}» с {booking.begin_date} по {booking.end_date}',
    'single_item_amount': '',
    'vat': 'none',
}


def load_fields() -> Dict[str, Any]:
    fields = {e: [{'ref': f'{e}.{c}', 'code': c, 'title': t, 'type': ty, 'multiple': False, 'custom': False}
                  for c, t, ty in rows] for e, rows in BASE_FIELDS.items()}
    return {'fields': fields, 'stages': {}}


def record_from_raw(raw: Dict[str, Any]) -> Dict[str, Any]:
    '''Запись из сохранённого платежа: {booking, payment} из вебхука.'''
    booking = dict(raw.get('booking') or {})
    origin = booking.get('booking_origin') if isinstance(booking.get('booking_origin'), dict) else {}
    booking['source_title'] = origin.get('title') or booking.get('source')
    payment = dict(raw.get('payment') or {})
    payment['payment_system_title'] = SYSTEM_TITLES.get(str(payment.get('payment_system') or ''), payment.get('payment_system'))
    payment['type_title'] = 'Залог' if payment.get('type') == 'deposit' else 'Платёж'
    if payment.get('paid_at'):
        payment['paid_at'] = str(payment['paid_at'])[:10]
    return {
        'booking': booking,
        'client': booking.get('client') if isinstance(booking.get('client'), dict) else {},
        'apartment': booking.get('apartment') if isinstance(booking.get('apartment'), dict) else
                     {'title': booking.get('address'), 'address': booking.get('address')},
        'payment': payment,
    }


def _item(name: str, price: float, quantity: float, vat: str) -> Dict[str, Any]:
    return {
        'name': (name or 'Проживание')[:NAME_LIMIT], 'price': round(price, 2), 'quantity': quantity,
        'sum': round(price * quantity, 2), 'measurement_unit': 'шт',
        'payment_method': 'full_prepayment', 'payment_object': 'service', 'vat': {'type': vat},
    }


def _fixed_rows(record: Dict[str, Any], mapping: Dict[str, Any]) -> Tuple[List[Tuple[str, float, float]], str]:
    rows = []
    for i, row in enumerate(mapping.get('fixed_items') or [], 1):
        name_tpl, price_tpl = str(row.get('name') or '').strip(), str(row.get('price') or '').strip()
        if not name_tpl or not price_tpl:
            continue
        price = _number(price_tpl) if '{' not in price_tpl and not re.search(r'[+*/()]|\d-', price_tpl) else None
        if price is None:
            price, expr, err = calc_amount(record, price_tpl)
            if err:
                return [], f'Позиция {i}, цена «{price_tpl}» ({expr}): {err}'
        rows.append((render_name(record, name_tpl, f'Позиция {i}'), price, _number(row.get('quantity')) or 1))
    return rows, '' if rows else 'В сценарии не заполнен фиксированный состав чека'


def full_item_names(record: Dict[str, Any], mapping: Dict[str, Any]) -> List[str]:
    if (mapping.get('items_mode') or 'single') == 'fixed':
        return [r[0] for r in _fixed_rows(record, mapping)[0]]
    return [render_name(record, mapping.get('single_item_name') or DEFAULT_MAPPING['single_item_name'], 'Проживание')]


def build_data(record: Dict[str, Any], mapping: Dict[str, Any], refund: bool) -> Tuple[Optional[Dict[str, Any]], str, str]:
    mapping = {**DEFAULT_MAPPING, **{k: v for k, v in (mapping or {}).items() if v is not None}}
    vat = mapping.get('vat') if mapping.get('vat') not in (None, '', 'auto') else 'none'
    if (mapping.get('items_mode') or 'single') == 'fixed':
        rows, err = _fixed_rows(record, mapping)
        if err:
            return None, err, ''
        items = [_item(n, p, q, vat) for n, p, q in rows]
    else:
        template = str(mapping.get('single_item_amount') or '').strip()
        if template:
            amount, expr, err = calc_amount(record, template)
            if err:
                return None, f'Сумма позиции «{template}» ({expr}): {err}', ''
        else:
            amount = _number(resolve(record, mapping.get('amount') or 'payment.amount'))
        if not amount:
            return None, 'Не заполнена сумма платежа', ''
        items = [_item(full_item_names(record, mapping)[0], amount, 1, vat)]

    total = round(sum(i['sum'] for i in items), 2)
    paid = _number(resolve(record, 'payment.amount'))
    note = ''
    if paid and abs(paid - total) >= 0.01:
        note = f', сумма чека {total:.2f} ₽ отличается от суммы {"возврата" if refund else "платежа"} {paid:.2f} ₽'
    booking = record.get('booking') or {}
    booking_amount, prepaid = _number(booking.get('amount')), _number(booking.get('prepayment'))
    item_method = None
    if not refund and booking_amount and prepaid is not None and prepaid + 0.01 < booking_amount:
        item_method = 'prepayment'
        note += f', бронь оплачена частично ({prepaid:.2f} из {booking_amount:.2f} ₽) - частичная предоплата'
    phone = re.sub(r'\D', '', resolve(record, mapping.get('customer_phone')) or '')
    if len(phone) == 11 and phone[0] in '78':
        phone = '+7' + phone[1:]
    elif len(phone) == 10:
        phone = '+7' + phone
    else:
        phone = ''
    customer = {
        'email': resolve(record, mapping.get('customer_email')),
        'phone': phone or None,
        'name': resolve(record, mapping.get('customer_name')),
        'inn': re.sub(r'\D', '', resolve(record, mapping.get('customer_inn')) or '') or None,
    }
    order = resolve(record, mapping.get('order_id'))
    pay_id = resolve(record, 'payment.id')
    data = {
        'items': items, 'items_format': 'atol', 'items_source': 'RealtyCalendar',
        'customer': customer, 'item_payment_method': item_method, 'refund': refund,
        # Номер документа: бронь + платёж - у брони может быть несколько платежей.
        'moyklass': {'order_id': f'{order}-{pay_id}' if order and pay_id and order != pay_id else (order or pay_id)},
    }
    return data, '', note


__all__ = ['load_fields', 'record_from_raw', 'build_data', 'full_item_names', 'human_date', 'resolve', 'NAME_LIMIT']
