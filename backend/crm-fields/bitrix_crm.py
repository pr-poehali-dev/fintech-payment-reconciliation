'''
Битрикс24 для автоматизации: справочник полей (сделки, лиды, контакты, компании),
стадии воронок, загрузка сделки/лида со связанными контактом, компанией и товарами
и сбор данных для чека по сопоставлению полей сценария.
Все запросы идут через входящий вебхук клиента одним вызовом batch.
'''
import ast
import json
import re
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional, Tuple

MSK = timezone(timedelta(hours=3))
ENTITIES = ('deal', 'lead')
RELATED = ('contact', 'company')
ITEMS_MODES = ('products', 'fixed', 'single')
VAT_CODES = ('auto', 'none', 'vat0', 'vat5', 'vat7', 'vat10', 'vat20', 'vat22')

# Поле стадии: у сделки STAGE_ID, у лида STATUS_ID.
STAGE_FIELD = {'deal': 'STAGE_ID', 'lead': 'STATUS_ID'}

DEFAULT_MAPPING = {
    'entity': 'deal',
    'pipeline': '',
    'stage': '',
    'order_id': 'deal.ID',
    'amount': 'deal.OPPORTUNITY',
    'customer_email': 'contact.EMAIL',
    'customer_phone': 'contact.PHONE',
    'customer_name': '',
    'customer_inn': '',
    'items_mode': 'products',
    'fixed_items': [],
    'single_item_name': 'Оплата по сделке №{ID}',
    'vat': 'auto',
}


def call(webhook_url: str, method: str, params: Optional[Dict[str, Any]] = None,
         timeout: float = 8.0) -> Tuple[Any, str]:
    '''Вызов REST Битрикс24 через входящий вебхук. Returns: (result, error).'''
    if not webhook_url:
        return None, 'В интеграции Битрикс24 не указан входящий вебхук'
    if 'functions.poehali.dev' in webhook_url or '/rest/' not in webhook_url:
        return None, ('В интеграции Битрикс24 вместо входящего вебхука портала указан неверный адрес. '
                      'Откройте интеграцию и вставьте адрес вида https://ваш-портал.bitrix24.ru/rest/1/код/')
    req = urllib.request.Request(
        webhook_url.rstrip('/') + f'/{method}.json',
        data=json.dumps(params or {}).encode('utf-8'),
        headers={'Content-Type': 'application/json'},
        method='POST'
    )
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            payload = json.loads(resp.read().decode('utf-8'))
    except urllib.error.HTTPError as e:
        try:
            payload = json.loads(e.read().decode('utf-8'))
        except Exception:
            return None, f'Битрикс24 ответил HTTP {e.code}'
    except Exception as e:
        return None, f'Битрикс24 недоступен: {e}'
    if isinstance(payload, dict) and payload.get('error'):
        return None, f"Битрикс24: {payload.get('error_description') or payload['error']}"
    return payload.get('result'), ''


def batch(webhook_url: str, cmd: Dict[str, str]) -> Tuple[Dict[str, Any], Dict[str, Any], str]:
    '''batch до 50 команд за один запрос. Returns: (результаты, ошибки команд, ошибка запроса).'''
    result, err = call(webhook_url, 'batch', {'halt': 0, 'cmd': cmd})
    if err:
        return {}, {}, err
    result = result or {}
    res = result.get('result') or {}
    errors = result.get('result_error') or {}
    return (res if isinstance(res, dict) else {}), (errors if isinstance(errors, dict) else {}), ''


def _field_list(entity: str, raw: Dict[str, Any]) -> List[Dict[str, Any]]:
    fields = []
    for code, f in (raw or {}).items():
        if not isinstance(f, dict):
            continue
        title = f.get('formLabel') or f.get('listLabel') or f.get('title') or code
        fields.append({
            'ref': f'{entity}.{code}', 'code': code, 'title': title, 'type': f.get('type'),
            'multiple': bool(f.get('isMultiple')), 'custom': code.startswith('UF_'),
        })
    fields.sort(key=lambda x: (x['custom'], x['title'].lower()))
    return fields


def load_fields(webhook_url: str) -> Tuple[Optional[Dict[str, Any]], str]:
    '''
    Справочник для настройки: поля сделок, лидов, контактов, компаний (включая
    пользовательские UF_*), стадии сделок по воронкам и статусы лидов.
    '''
    cmd = {e: f'crm.{e}.fields' for e in ENTITIES + RELATED}
    cmd['categories'] = 'crm.category.list?entityTypeId=2'
    for page in range(6):
        cmd[f'statuses{page}'] = f'crm.status.list?start={page * 50}'
    res, errors, err = batch(webhook_url, cmd)
    if err:
        return None, err
    if not res.get('deal'):
        detail = errors.get('deal') or {}
        return None, f"Битрикс24 не отдал поля сделок: {detail.get('error_description') or 'нет прав crm у вебхука'}"

    categories = {'0': 'Общая воронка'}
    cat_raw = res.get('categories') or {}
    for c in (cat_raw.get('categories') if isinstance(cat_raw, dict) else cat_raw) or []:
        categories[str(c.get('id'))] = c.get('name') or f"Воронка {c.get('id')}"

    seen = set()
    deal_stages, lead_stages = [], []
    for page in range(6):
        for s in res.get(f'statuses{page}') or []:
            entity_id = s.get('ENTITY_ID') or ''
            key = (entity_id, s.get('STATUS_ID'))
            if key in seen:
                continue
            seen.add(key)
            item = {'value': s.get('STATUS_ID'), 'label': s.get('NAME'), 'sort': int(s.get('SORT') or 0)}
            if entity_id == 'STATUS':
                lead_stages.append(item)
            elif entity_id.startswith('DEAL_STAGE'):
                cat = entity_id[len('DEAL_STAGE_'):] if entity_id != 'DEAL_STAGE' else '0'
                item['group'] = categories.get(cat, f'Воронка {cat}')
                item['group_id'] = cat
                deal_stages.append(item)
    deal_stages.sort(key=lambda s: (int(s['group_id']) if s['group_id'].isdigit() else 0, s['sort']))
    lead_stages.sort(key=lambda s: s['sort'])

    return {
        'fields': {e: _field_list(e, res.get(e)) for e in ENTITIES + RELATED},
        'stages': {'deal': deal_stages, 'lead': lead_stages},
    }, ''


def load_record(webhook_url: str, entity: str, entity_id: str) -> Tuple[Optional[Dict[str, Any]], str]:
    '''Сделка или лид + привязанные контакт и компания + товарные строки - одним batch.'''
    if entity not in ENTITIES:
        return None, 'Неизвестный объект CRM'
    entity_id = re.sub(r'\D', '', str(entity_id or ''))
    if not entity_id:
        return None, 'Не указан номер сделки или лида'
    cmd = {
        'main': f'crm.{entity}.get?id={entity_id}',
        'products': f'crm.{entity}.productrows.get?id={entity_id}',
        'contact': 'crm.contact.get?id=$result[main][CONTACT_ID]',
        'company': 'crm.company.get?id=$result[main][COMPANY_ID]',
    }
    res, errors, err = batch(webhook_url, cmd)
    if err:
        return None, err
    if not res.get('main'):
        noun = 'Сделка' if entity == 'deal' else 'Лид'
        detail = (errors.get('main') or {}).get('error_description') or 'не найдена'
        return None, f'{noun} #{entity_id} в Битрикс24: {detail}'
    main = res['main']
    return {
        entity: main,
        'contact': res.get('contact') if main.get('CONTACT_ID') not in (None, '', '0', 0) else None,
        'company': res.get('company') if main.get('COMPANY_ID') not in (None, '', '0', 0) else None,
        'products': res.get('products') or [],
    }, ''


def resolve(record: Dict[str, Any], entity: str, ref: Optional[str]) -> Optional[str]:
    '''
    Значение поля по ссылке «объект.КОД» (deal.OPPORTUNITY, contact.EMAIL, company.UF_CRM_INN).
    Ссылка без объекта - поле самой сделки/лида. Мультиполя (EMAIL, PHONE) - первое значение.
    '''
    if not ref:
        return None
    source, _, code = ref.partition('.') if '.' in ref else (entity, '', ref)
    data = record.get(source)
    if not isinstance(data, dict):
        return None
    value = data.get(code)
    if isinstance(value, list):
        values = [v.get('VALUE') if isinstance(v, dict) else v for v in value]
        values = [str(v) for v in values if v not in (None, '')]
        return values[0] if values else None
    if isinstance(value, dict):
        value = value.get('VALUE')
    if value in (None, '', False):
        return None
    return str(value).strip()


def resolve_all(record: Dict[str, Any], entity: str, ref: Optional[str]) -> List[str]:
    '''Все значения поля (для телефонов: мультиполе PHONE или строка через запятую) в формате +7...'''
    if not ref:
        return []
    source, _, code = ref.partition('.') if '.' in ref else (entity, '', ref)
    data = record.get(source)
    value = data.get(code) if isinstance(data, dict) else None
    raw = [v.get('VALUE') if isinstance(v, dict) else v for v in value] if isinstance(value, list) else [value]
    phones = []
    for part in ','.join(str(v) for v in raw if v not in (None, '', False)).split(','):
        phone = ffd_phone(part)
        if phone and phone not in phones:
            phones.append(phone)
    return phones


def ffd_phone(value: Any) -> Optional[str]:
    '''Телефон по ФФД: +7 и 10 цифр (+79999999999). 8XXXXXXXXXX и XXXXXXXXXX приводим, остальное - None.'''
    digits = re.sub(r'\D', '', str(value or ''))
    if len(digits) == 10:
        digits = '7' + digits
    elif len(digits) == 11 and digits[0] == '8':
        digits = '7' + digits[1:]
    return f'+{digits}' if len(digits) == 11 and digits[0] == '7' else None


def _number(value: Any) -> Optional[float]:
    if value in (None, ''):
        return None
    text = str(value).split('|')[0].replace(' ', '').replace(',', '.')
    try:
        return round(float(text), 2)
    except ValueError:
        return None


_CALC_OPS = {
    ast.Add: lambda a, b: a + b, ast.Sub: lambda a, b: a - b,
    ast.Mult: lambda a, b: a * b, ast.Div: lambda a, b: a / b,
}


def calc_amount(record: Dict[str, Any], entity: str, template: str) -> Tuple[Optional[float], str, Optional[str]]:
    '''
    Сумма по шаблону: «{OPPORTUNITY}» или формула «{OPPORTUNITY} - {UF_CRM_X} * 2» (знак = в начале не обязателен).
    Разрешены только числа, + - * / и скобки. Пустое поле считается нулём (нет предоплаты - вычитаем 0),
    но если итог вышел не больше нуля - ошибка с перечнем пустых полей. Возвращает (сумма, текст, ошибка).
    '''
    missing: List[str] = []

    def sub(m: 're.Match[str]') -> str:
        num = _number(resolve(record, entity, m.group(1)))
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
        if isinstance(node, ast.BinOp) and type(node.op) in _CALC_OPS:
            return _CALC_OPS[type(node.op)](ev(node.left), ev(node.right))
        raise ValueError

    try:
        value = round(ev(ast.parse(expr, mode='eval')), 2)
    except (ValueError, SyntaxError, ZeroDivisionError, TypeError):
        return None, expr, 'формулу не удалось посчитать - разрешены числа, поля, + - * / и скобки'
    if value <= 0:
        empty = f'; пустые поля посчитаны как 0: {", ".join(missing)}' if missing else ''
        return None, expr, f'получилось {value} - сумма должна быть больше нуля{empty}'
    return value, expr, None


def _vat_from_rate(rate: Any) -> str:
    if rate in (None, ''):
        return 'none'
    try:
        value = int(round(float(rate)))
    except (TypeError, ValueError):
        return 'none'
    return f'vat{value}' if f'vat{value}' in VAT_CODES else 'none'


NAME_LIMIT = 128  # ФФД, тег 1030 - наименование предмета расчёта


def _item(name: str, price: float, quantity: float, vat: str) -> Dict[str, Any]:
    return {
        'name': (name or 'Товар')[:NAME_LIMIT], 'price': round(price, 2), 'quantity': quantity,
        'sum': round(price * quantity, 2), 'measurement_unit': 'шт',
        'payment_method': 'full_payment', 'payment_object': 'commodity', 'vat': {'type': vat},
    }


def human_date(value: str) -> str:
    '''Дата из Битрикс24 (2026-10-05 или 2026-10-05T03:00:00+03:00) -> 05.10.2026. Остальное - как есть.'''
    m = re.fullmatch(r'(\d{4})-(\d{2})-(\d{2})(?:T[\d:.]+(?:[+-]\d{2}:?\d{2}|Z)?)?', str(value).strip())
    return f'{m.group(3)}.{m.group(2)}.{m.group(1)}' if m else value


def single_name(record: Dict[str, Any], entity: str, mapping: Dict[str, Any]) -> str:
    '''Название позиции «одной суммой»: {КОД} - поле сделки/лида, {contact.КОД} / {company.КОД} - контакта/компании.'''
    name = re.sub(r'\{([\w.]+)\}', lambda m: human_date(resolve(record, entity, m.group(1)) or ''),
                  mapping.get('single_item_name') or 'Оплата')
    return re.sub(r'\s{2,}', ' ', name).strip() or 'Оплата'


def full_item_names(record: Dict[str, Any], entity: str, mapping: Dict[str, Any]) -> List[str]:
    '''Полные (до обрезки по ФФД) названия позиций - в том же порядке, что позиции чека.'''
    mode = mapping.get('items_mode') or 'products'
    if mode == 'single':
        return [single_name(record, entity, mapping)]
    if mode == 'fixed':
        return [r['name'].strip() for r in mapping.get('fixed_items') or []
                if (r.get('name') or '').strip() and _number(r.get('price')) is not None]
    return [str(r.get('PRODUCT_NAME') or r.get('ORIGINAL_PRODUCT_NAME') or 'Товар')
            for r in record.get('products') or [] if _number(r.get('PRICE'))]


def build_items(record: Dict[str, Any], entity: str, mapping: Dict[str, Any],
                amount: Optional[float]) -> Tuple[List[Dict[str, Any]], str]:
    '''
    Позиции чека в формате АТОЛ по режиму сценария:
    products - товары из сделки/лида; fixed - фиксированный список из настройки;
    single - одна позиция на сумму из сопоставленного поля.
    '''
    mode = mapping.get('items_mode') or 'products'
    vat_setting = mapping.get('vat') or 'auto'
    fixed_vat = 'none' if vat_setting == 'auto' else vat_setting
    noun = 'сделке' if entity == 'deal' else 'лиде'

    if mode == 'fixed':
        items = []
        for row in mapping.get('fixed_items') or []:
            price = _number(row.get('price'))
            quantity = _number(row.get('quantity')) or 1
            if not (row.get('name') or '').strip() or price is None:
                continue
            items.append(_item(row['name'].strip(), price, quantity, row.get('vat') or fixed_vat))
        return items, '' if items else 'В сценарии не заполнен фиксированный состав чека'

    if mode == 'single':
        # Сумма позиции: своё поле/шаблон ({OPPORTUNITY}, {UF_CRM_...}), пусто - поле «Сумма» сопоставления.
        template = str(mapping.get('single_item_amount') or '').strip()
        if template:
            amount, expr, calc_err = calc_amount(record, entity, template)
            if calc_err:
                return [], f'Сумма позиции «{template}» ({expr}): {calc_err}'
        if not amount:
            return [], f'В {noun} не заполнена сумма (поле «{mapping.get("amount")}»)'
        return [_item(single_name(record, entity, mapping), amount, 1, fixed_vat)], ''

    items = []
    for row in record.get('products') or []:
        price = _number(row.get('PRICE'))
        quantity = _number(row.get('QUANTITY')) or 1
        # Бесплатные позиции (0 ₽) в чек не берём - касса может отклонить чек.
        if not price:
            continue
        vat = _vat_from_rate(row.get('TAX_RATE')) if vat_setting == 'auto' else vat_setting
        item = _item(row.get('PRODUCT_NAME') or row.get('ORIGINAL_PRODUCT_NAME') or 'Товар', price, quantity, vat)
        if row.get('MEASURE_NAME'):
            item['measurement_unit'] = str(row['MEASURE_NAME'])[:16]
        items.append(item)
    return items, '' if items else f'В {noun} нет платных товаров - добавьте товары или выберите другой состав чека'


def build_data(record: Dict[str, Any], entity: str, mapping: Dict[str, Any]) -> Tuple[Optional[Dict[str, Any]], str, str]:
    '''
    Данные для действия сценария из сделки/лида по сопоставлению полей.
    Returns: (data, ошибка, примечание для журнала).
    '''
    main = record.get(entity) or {}
    amount = _number(resolve(record, entity, mapping.get('amount')))
    items, err = build_items(record, entity, mapping, amount)
    if err:
        return None, err, ''
    total = round(sum(i['sum'] for i in items), 2)
    note = ''
    if amount is not None and abs(amount - total) >= 0.01:
        note = f', сумма в CRM {amount:.2f} ₽ - расхождение {total - amount:+.2f} ₽'

    changed = main.get('CLOSEDATE') if entity == 'deal' and main.get('CLOSED') == 'Y' else main.get('DATE_MODIFY')
    try:
        paid_at = datetime.fromisoformat(changed).isoformat() if changed else None
    except ValueError:
        paid_at = None
    customer = {
        'email': resolve(record, entity, mapping.get('customer_email')),
        'phone': resolve(record, entity, mapping.get('customer_phone')),
        'name': resolve(record, entity, mapping.get('customer_name')),
        'inn': re.sub(r'\D', '', resolve(record, entity, mapping.get('customer_inn')) or '') or None,
    }
    if customer['phone']:
        digits = re.sub(r'\D', '', customer['phone'])
        if len(digits) == 11 and digits[0] == '8':
            digits = '7' + digits[1:]
        customer['phone'] = f'+{digits}' if digits else None

    # Поставщик агентского чека из полей CRM (если поля сопоставлены в сценарии).
    agent = {
        'supplier_name': resolve(record, entity, mapping.get('agent_supplier_name')),
        'supplier_inn': re.sub(r'\D', '', resolve(record, entity, mapping.get('agent_supplier_inn')) or '') or None,
        'supplier_phones': resolve_all(record, entity, mapping.get('agent_supplier_phones')),
    }

    order_id = resolve(record, entity, mapping.get('order_id')) or str(main.get('ID'))
    data = {
        'items': items,
        'items_format': 'atol',
        'items_source': 'Битрикс24',
        'customer': {k: v for k, v in customer.items() if v},
        'agent': {k: v for k, v in agent.items() if v},
        'payment': {'created_at': paid_at or datetime.now(MSK).isoformat(), 'amount': total},
        'crm': {
            'entity': entity, 'id': str(main.get('ID')), 'title': main.get('TITLE'),
            'order_id': order_id, 'stage': main.get(STAGE_FIELD[entity]), 'amount': amount,
        },
    }
    return data, '', note


def stage_matches(mapping: Dict[str, Any], entity: str, record_main: Dict[str, Any]) -> bool:
    '''
    Сделка в воронке сценария (CATEGORY_ID, пусто - любая воронка). Стадия не проверяется:
    документ создаётся по самому хуку, когда его прислал Битрикс24. У лидов воронок нет.
    '''
    pipeline = str(mapping.get('pipeline') or '').strip()
    return not (entity == 'deal' and pipeline and str(record_main.get('CATEGORY_ID') or '0') != pipeline)
