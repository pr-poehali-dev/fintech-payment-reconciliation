'''
Сопоставление полей «Мой Класс» для сценария чеков (как у Битрикс24 - bitrix_crm.py).

Запись = платёж/списание из вебхука + дозапрошенные объекты:
  payment      - платёж/списание (сумма, дата, тип, комментарий)
  user         - ученик (имя, телефон, почта, доп. признаки attr_<alias|id>)
  subscription - абонемент ученика (цена, оплачено, скидка, даты, занятий)
  sub_type     - вид абонемента (название, цена, кол-во занятий)
  group        - группа (название, цена) - если есть classId
  course       - программа группы (название)
Ссылка на поле - «объект.код»: user.phone, sub_type.name, user.attr_level.
Название и сумма позиции - шаблоны с подстановкой {объект.код}, сумма может быть формулой.
'''
import ast
import re
from typing import Any, Dict, List, Optional, Tuple

import moyklass_api

NAME_LIMIT = 128

ENTITIES = ['payment', 'user', 'subscription', 'sub_type', 'group', 'course']

BASE_FIELDS: Dict[str, List[Tuple[str, str, str]]] = {
    'payment': [
        ('id', 'ID платежа', 'integer'), ('summa', 'Сумма', 'double'), ('date', 'Дата', 'date'),
        ('optype', 'Тип операции', 'string'), ('comment', 'Комментарий', 'string'),
        ('paymentTypeId', 'ID способа оплаты', 'integer'),
    ],
    'user': [
        ('id', 'ID ученика', 'integer'), ('name', 'Имя', 'string'), ('phone', 'Телефон', 'phone'),
        ('email', 'Email', 'email'), ('balans', 'Баланс', 'double'),
    ],
    'subscription': [
        ('id', 'ID абонемента', 'integer'), ('externalId', 'Номер абонемента', 'string'),
        ('price', 'Цена при продаже', 'double'), ('originalPrice', 'Цена без скидки', 'double'),
        ('discount', 'Скидка, %', 'double'), ('payed', 'Оплачено', 'double'),
        ('remindSumm', 'Долг к оплате', 'double'), ('visitCount', 'Занятий в абонементе', 'integer'),
        ('sellDate', 'Дата продажи', 'date'), ('beginDate', 'Начало действия', 'date'),
        ('endDate', 'Окончание действия', 'date'), ('comment', 'Комментарий', 'string'),
        ('lesson_price', 'Цена одного занятия (цена / занятий)', 'double'),
    ],
    'sub_type': [
        ('id', 'ID вида', 'integer'), ('name', 'Название вида абонемента', 'string'),
        ('price', 'Цена вида', 'double'), ('visitCount', 'Занятий', 'integer'), ('period', 'Срок', 'string'),
    ],
    'group': [
        ('id', 'ID группы', 'integer'), ('name', 'Название группы', 'string'), ('price', 'Цена', 'double'),
        ('beginDate', 'Старт занятий', 'date'), ('comment', 'Комментарий', 'string'),
    ],
    'course': [
        ('id', 'ID программы', 'integer'), ('name', 'Название программы', 'string'),
        ('shortDescription', 'Краткое описание', 'string'),
    ],
}

DEFAULT_MAPPING: Dict[str, Any] = {
    'order_id': 'payment.id',
    'amount': 'payment.summa',
    'customer_email': 'user.email',
    'customer_phone': 'user.phone',
    'customer_name': 'user.name',
    'customer_inn': '',
    'items_mode': 'single',
    'fixed_items': [],
    'single_item_name': '',
    'single_item_amount': '',
    'vat': 'none',
}


def default_item_name(offset: bool) -> str:
    return 'Занятие по абонементу «{sub_type.name}»' if offset else 'Абонемент «{sub_type.name}»'


def load_fields(api_key: str) -> Tuple[Optional[Dict[str, Any]], str]:
    '''Список полей для выбора + доп. признаки ученика из справочника «Мой Класс».'''
    token, err = moyklass_api.get_token(api_key)
    if not token:
        return None, err or ''
    fields: Dict[str, List[Dict[str, Any]]] = {}
    for entity, rows in BASE_FIELDS.items():
        fields[entity] = [{'ref': f'{entity}.{c}', 'code': c, 'title': t, 'type': ty, 'multiple': False, 'custom': False}
                          for c, t, ty in rows]
    attrs, _ = moyklass_api.user_attributes(token)
    for a in attrs:
        code = f"attr_{a.get('alias') or a.get('id')}"
        fields['user'].append({'ref': f'user.{code}', 'code': code, 'title': a.get('name') or code,
                               'type': a.get('type') or 'string', 'multiple': False, 'custom': True})
    return {'fields': fields, 'stages': {}}, ''


def load_record(api_key: str, payment_obj: Dict[str, Any], payment_row: Optional[Dict[str, Any]] = None
                ) -> Tuple[Optional[Dict[str, Any]], str]:
    '''
    Собирает запись по объекту из вебхука (userId, paymentId, summa, userSubscriptionId, classId...).
    payment_row - данные платежа из API (для проверки по номеру), иначе берём из вебхука.
    '''
    token, err = moyklass_api.get_token(api_key)
    if not token:
        return None, err or ''
    obj = payment_obj or {}
    payment = {'id': obj.get('paymentId'), 'summa': obj.get('summa'), 'date': obj.get('date'),
               'paymentTypeId': obj.get('paymentTypeId'), 'optype': obj.get('optype'), 'comment': obj.get('comment')}
    if payment_row:
        payment.update({k: v for k, v in payment_row.items() if v not in (None, '')})
    user_id = obj.get('userId') or (payment_row or {}).get('userId')
    if not user_id:
        return None, 'В платеже нет ученика'
    user, err = moyklass_api.get_user(token, user_id)
    if not user:
        return None, f'Не удалось получить ученика #{user_id}: {err}'
    for a in user.get('attributes') or []:
        code = f"attr_{a.get('attributeAlias') or a.get('attributeId')}"
        user[code] = a.get('value')
    record: Dict[str, Any] = {'payment': payment, 'user': user, 'subscription': {}, 'sub_type': {}, 'group': {}, 'course': {}}

    sub_id = obj.get('userSubscriptionId') or (payment_row or {}).get('userSubscriptionId')
    if sub_id:
        sub, _ = moyklass_api.get_user_subscription(token, sub_id)
        if sub:
            price, visits = _number(sub.get('price')), _number(sub.get('visitCount'))
            sub['lesson_price'] = round(price / visits, 2) if price and visits else None
            record['subscription'] = sub
            class_id = obj.get('classId') or sub.get('mainClassId')
            if sub.get('subscriptionId'):
                st, _ = moyklass_api.get_subscription(token, sub['subscriptionId'])
                record['sub_type'] = st or {}
            if class_id and not obj.get('classId'):
                obj = {**obj, 'classId': class_id}
    if obj.get('classId'):
        group, _ = moyklass_api.get_class(token, obj['classId'])
        if group:
            record['group'] = group
            if group.get('courseId'):
                course, _ = moyklass_api.get_course(token, group['courseId'])
                record['course'] = course or {}
    return record, ''


def resolve(record: Dict[str, Any], ref: Optional[str]) -> Optional[str]:
    if not ref:
        return None
    entity, _, code = ref.partition('.')
    data = record.get(entity)
    if not isinstance(data, dict):
        return None
    value = data.get(code)
    if value in (None, '', False) or isinstance(value, (dict, list)):
        return None
    return str(value).strip()


def human_date(value: str) -> str:
    m = re.fullmatch(r'(\d{4})-(\d{2})-(\d{2})(?:T[\d:.]+(?:[+-]\d{2}:?\d{2}|Z)?)?', str(value).strip())
    return f'{m.group(3)}.{m.group(2)}.{m.group(1)}' if m else value


def _number(value: Any) -> Optional[float]:
    if value in (None, ''):
        return None
    try:
        return round(float(str(value).replace(' ', '').replace(',', '.')), 2)
    except ValueError:
        return None


_OPS = {ast.Add: lambda a, b: a + b, ast.Sub: lambda a, b: a - b, ast.Mult: lambda a, b: a * b, ast.Div: lambda a, b: a / b}


def calc_amount(record: Dict[str, Any], template: str) -> Tuple[Optional[float], str, Optional[str]]:
    '''Сумма по шаблону/формуле: {payment.summa}, {subscription.price} / {subscription.visitCount} и т.п.'''
    missing: List[str] = []

    def sub(m: 're.Match[str]') -> str:
        num = _number(resolve(record, m.group(1)))
        if num is None:
            missing.append(m.group(0))
            return '0'
        return repr(num)

    expr = re.sub(r'\{([\w.]+)\}', sub, template.strip().lstrip('=')).replace(',', '.').replace(' ', '')

    def ev(node: ast.AST) -> float:
        if isinstance(node, ast.Expression):
            return ev(node.body)
        if isinstance(node, ast.Constant) and isinstance(node.value, (int, float)):
            return float(node.value)
        if isinstance(node, ast.UnaryOp) and isinstance(node.op, (ast.USub, ast.UAdd)):
            return -ev(node.operand) if isinstance(node.op, ast.USub) else ev(node.operand)
        if isinstance(node, ast.BinOp) and type(node.op) in _OPS:
            return _OPS[type(node.op)](ev(node.left), ev(node.right))
        raise ValueError

    try:
        value = round(ev(ast.parse(expr, mode='eval')), 2)
    except (ValueError, SyntaxError, ZeroDivisionError, TypeError):
        return None, expr, 'формулу не удалось посчитать - разрешены числа, поля, + - * / и скобки'
    if value <= 0:
        empty = f'; пустые поля посчитаны как 0: {", ".join(missing)}' if missing else ''
        return None, expr, f'получилось {value} - сумма должна быть больше нуля{empty}'
    return value, expr, None


def render_name(record: Dict[str, Any], template: str, fallback: str) -> str:
    name = re.sub(r'\{([\w.]+)\}', lambda m: human_date(resolve(record, m.group(1)) or ''), template or '')
    # Пустая подстановка в кавычках («») - убираем пустые кавычки.
    name = re.sub(r'«\s*»|"\s*"', '', name)
    name = re.sub(r'\s{2,}', ' ', name).strip(' -·,')
    return name or fallback


def _fixed_rows(record: Dict[str, Any], mapping: Dict[str, Any]) -> Tuple[List[Tuple[str, float, float]], str]:
    '''Фиксированный состав: название и цена каждой строки - текст/число, поле {объект.код} или формула.'''
    rows = []
    for i, row in enumerate(mapping.get('fixed_items') or [], 1):
        name_tpl = str(row.get('name') or '').strip()
        price_tpl = str(row.get('price') or '').strip()
        if not name_tpl or not price_tpl:
            continue
        price = _number(price_tpl) if '{' not in price_tpl and not re.search(r'[+*/()]|\d-', price_tpl) else None
        if price is None:
            price, expr, err = calc_amount(record, price_tpl)
            if err:
                return [], f'Позиция {i}, цена «{price_tpl}» ({expr}): {err}'
        rows.append((render_name(record, name_tpl, f'Позиция {i}'), price, _number(row.get('quantity')) or 1))
    return rows, '' if rows else 'В сценарии не заполнен фиксированный состав чека'


def full_item_names(record: Dict[str, Any], mapping: Dict[str, Any], offset: bool) -> List[str]:
    mode = mapping.get('items_mode') or 'single'
    if mode == 'fixed':
        rows, _ = _fixed_rows(record, mapping)
        return [r[0] for r in rows]
    fallback = 'Занятие' if offset else 'Оплата обучения'
    return [render_name(record, mapping.get('single_item_name') or default_item_name(offset), fallback)]


def _item(name: str, price: float, quantity: float, vat: str, offset: bool) -> Dict[str, Any]:
    return {
        'name': (name or 'Услуга')[:NAME_LIMIT], 'price': round(price, 2), 'quantity': quantity,
        'sum': round(price * quantity, 2), 'measurement_unit': 'шт',
        'payment_method': 'full_payment' if offset else 'full_prepayment', 'payment_object': 'service',
        'vat': {'type': vat},
    }


def build_items(record: Dict[str, Any], mapping: Dict[str, Any], offset: bool) -> Tuple[List[Dict[str, Any]], str]:
    vat = mapping.get('vat') or 'none'
    if vat == 'auto':
        vat = 'none'
    mode = mapping.get('items_mode') or 'single'
    if mode == 'fixed':
        rows, err = _fixed_rows(record, mapping)
        if err:
            return [], err
        return [_item(name, price, qty, vat, offset) for name, price, qty in rows], ''

    template = str(mapping.get('single_item_amount') or '').strip()
    if template:
        amount, expr, err = calc_amount(record, template)
        if err:
            return [], f'Сумма позиции «{template}» ({expr}): {err}'
    else:
        amount = _number(resolve(record, mapping.get('amount') or 'payment.summa'))
    if not amount:
        return [], 'Не заполнена сумма платежа'
    name = full_item_names(record, mapping, offset)[0]
    return [_item(name, amount, 1, vat, offset)], ''


def build_data(record: Dict[str, Any], mapping: Dict[str, Any], offset: bool) -> Tuple[Optional[Dict[str, Any]], str, str]:
    mapping = {**DEFAULT_MAPPING, **{k: v for k, v in (mapping or {}).items() if v not in (None,)}}
    items, err = build_items(record, mapping, offset)
    if err:
        return None, err, ''
    total = round(sum(i['sum'] for i in items), 2)
    paid = _number(resolve(record, 'payment.summa'))
    note = ''
    if paid and abs(paid - total) >= 0.01:
        note = f', сумма чека {total:.2f} ₽ отличается от суммы {"списания" if offset else "платежа"} {paid:.2f} ₽'
    item_method = None
    sub = record.get('subscription') or {}
    price, payed = _number(sub.get('price')), _number(sub.get('payed'))
    if not offset and price and payed is not None and payed + 0.01 < price:
        item_method = 'prepayment'
        note += f', абонемент оплачен частично ({payed:.2f} из {price:.2f} ₽) - частичная предоплата'
    customer = {
        'email': resolve(record, mapping.get('customer_email')),
        'phone': moyklass_api.normalize_phone(resolve(record, mapping.get('customer_phone'))),
        'name': resolve(record, mapping.get('customer_name')),
        'inn': re.sub(r'\D', '', resolve(record, mapping.get('customer_inn')) or '') or None,
    }
    data = {
        'items': items, 'items_format': 'atol', 'items_source': 'Мой Класс',
        'customer': customer, 'item_payment_method': item_method, 'offset': offset,
        'moyklass': {'order_id': resolve(record, mapping.get('order_id'))},
    }
    return data, '', note
