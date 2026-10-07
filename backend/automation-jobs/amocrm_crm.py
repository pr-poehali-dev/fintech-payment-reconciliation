'''
AmoCRM для автоматизации: справочник полей (сделка, контакт, компания, включая
пользовательские), воронки и этапы, загрузка сделки со связанными контактом,
компанией и товарами. Сделка приводится к тому же виду, что и в Битрикс24,
поэтому сбор чека, сопоставление полей и условие запуска общие (bitrix_crm.py).
'''
import json
import re
import urllib.error
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import bitrix_crm

DEFAULT_MAPPING = {**bitrix_crm.DEFAULT_MAPPING}

STD_FIELDS = {
    'deal': [
        ('ID', 'ID сделки', 'integer'), ('TITLE', 'Название сделки', 'string'),
        ('OPPORTUNITY', 'Бюджет', 'money'), ('STAGE_ID', 'Этап', 'string'),
        ('CATEGORY_ID', 'Воронка', 'string'), ('DATE_CREATE', 'Дата создания', 'datetime'),
        ('DATE_MODIFY', 'Дата изменения', 'datetime'), ('CLOSEDATE', 'Дата закрытия', 'datetime'),
    ],
    'contact': [
        ('ID', 'ID контакта', 'integer'), ('NAME', 'Имя (полностью)', 'string'),
        ('FIRST_NAME', 'Имя', 'string'), ('LAST_NAME', 'Фамилия', 'string'),
        ('EMAIL', 'Email', 'multifield'), ('PHONE', 'Телефон', 'multifield'),
    ],
    'company': [
        ('ID', 'ID компании', 'integer'), ('TITLE', 'Название компании', 'string'),
        ('EMAIL', 'Email', 'multifield'), ('PHONE', 'Телефон', 'multifield'),
    ],
}
MULTI_CODES = ('PHONE', 'EMAIL')
API_ENTITY = {'deal': 'leads', 'contact': 'contacts', 'company': 'companies'}


def base_url(subdomain: str) -> str:
    host = re.sub(r'^https?://', '', str(subdomain or '').strip()).split('/')[0]
    if not host:
        return ''
    return f'https://{host if "." in host else host + ".amocrm.ru"}'


def call(config: Dict[str, Any], path: str, timeout: float = 8.0) -> Tuple[Any, str]:
    '''GET к REST API v4 AmoCRM по долгосрочному токену. Returns: (json, ошибка).'''
    url = base_url(config.get('subdomain', ''))
    token = str(config.get('api_key') or '').strip()
    if not url or not token:
        return None, 'В интеграции AmoCRM не указан поддомен или долгосрочный токен'
    req = urllib.request.Request(url + path, headers={'Authorization': f'Bearer {token}'})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode('utf-8')
            return (json.loads(body) if body else {}), ''
    except urllib.error.HTTPError as e:
        if e.code == 204:
            return {}, ''
        if e.code == 401:
            return None, 'AmoCRM отклонил токен - выпустите новый долгосрочный токен и обновите интеграцию'
        if e.code == 404:
            return None, 'не найдено'
        return None, f'AmoCRM ответил HTTP {e.code}'
    except Exception as e:
        return None, f'AmoCRM недоступен: {e}'


def _custom_fields(config: Dict[str, Any], api_entity: str) -> Tuple[List[Dict[str, Any]], str]:
    out: List[Dict[str, Any]] = []
    for page in range(1, 5):
        res, err = call(config, f'/api/v4/{api_entity}/custom_fields?limit=250&page={page}')
        if err:
            return out, err
        chunk = ((res or {}).get('_embedded') or {}).get('custom_fields') or []
        out.extend(chunk)
        if len(chunk) < 250:
            break
    return out, ''


def _field_list(entity: str, custom: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    fields = [{'ref': f'{entity}.{c}', 'code': c, 'title': t, 'type': ty, 'multiple': ty == 'multifield', 'custom': False}
              for c, t, ty in STD_FIELDS[entity]]
    for f in custom:
        if f.get('code') in MULTI_CODES:
            continue
        code = f"CF_{f.get('id')}"
        item = {'ref': f'{entity}.{code}', 'code': code, 'title': f.get('name') or code, 'type': f.get('type'),
                'multiple': f.get('type') == 'multiselect', 'custom': True}
        enums = f.get('enums') or []
        if enums:
            item['items'] = [{'value': str(e.get('value')), 'label': str(e.get('value'))} for e in enums if e.get('value') not in (None, '')]
        fields.append(item)
    return fields


def load_fields(config: Dict[str, Any]) -> Tuple[Optional[Dict[str, Any]], str]:
    '''Справочник для настройки: поля сделки, контакта, компании и этапы по воронкам.'''
    jobs = {e: (lambda a=a: _custom_fields(config, a)) for e, a in API_ENTITY.items()}
    jobs['pipelines'] = lambda: call(config, '/api/v4/leads/pipelines')
    with ThreadPoolExecutor(max_workers=4) as pool:
        futures = {k: pool.submit(fn) for k, fn in jobs.items()}
        results = {k: f.result() for k, f in futures.items()}
    pipes, err = results['pipelines']
    if err:
        return None, f'AmoCRM: {err}'
    stages = []
    for p in ((pipes or {}).get('_embedded') or {}).get('pipelines') or []:
        for s in (p.get('_embedded') or {}).get('statuses') or []:
            stages.append({'value': str(s.get('id')), 'label': s.get('name'), 'sort': int(s.get('sort') or 0),
                           'group': p.get('name') or f"Воронка {p.get('id')}", 'group_id': str(p.get('id'))})
    fields = {e: _field_list(e, results[e][0]) for e in API_ENTITY}
    fields['lead'] = []
    return {'fields': fields, 'stages': {'deal': stages, 'lead': []}}, ''


def _iso(ts: Any) -> Optional[str]:
    try:
        return datetime.fromtimestamp(int(ts), tz=timezone.utc).isoformat() if ts else None
    except (TypeError, ValueError):
        return None


def _cf_value(v: Dict[str, Any]) -> Optional[str]:
    value = v.get('value')
    if isinstance(value, dict):
        value = value.get('name') or value.get('value') or json.dumps(value, ensure_ascii=False)
    if value in (None, '', False):
        return None
    return str(value)


def _flatten(raw: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    '''Поля AmoCRM (custom_fields_values) -> плоский словарь: CF_<id>, PHONE/EMAIL - списком.'''
    out: Dict[str, Any] = {}
    for f in (raw or {}).get('custom_fields_values') or []:
        values = [x for x in (_cf_value(v) for v in f.get('values') or []) if x]
        if not values:
            continue
        code = f.get('field_code')
        if code in MULTI_CODES:
            out[code] = (out.get(code) or []) + values
            continue
        if f.get('field_type') in ('date', 'date_time', 'birthday'):
            values = [_iso(v) or v for v in values]
        out[f"CF_{f.get('field_id')}"] = values if len(values) > 1 else values[0]
    return out


def _deal(lead: Dict[str, Any]) -> Dict[str, Any]:
    closed = lead.get('closed_at')
    return {
        **_flatten(lead),
        'ID': str(lead.get('id')), 'TITLE': lead.get('name') or '', 'OPPORTUNITY': lead.get('price'),
        'STAGE_ID': str(lead.get('status_id') or ''), 'CATEGORY_ID': str(lead.get('pipeline_id') or ''),
        'DATE_CREATE': _iso(lead.get('created_at')), 'DATE_MODIFY': _iso(lead.get('updated_at')),
        'CLOSEDATE': _iso(closed), 'CLOSED': 'Y' if closed else 'N',
    }


def _contact(c: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not c:
        return None
    return {**_flatten(c), 'ID': str(c.get('id')), 'NAME': c.get('name') or '',
            'FIRST_NAME': c.get('first_name') or '', 'LAST_NAME': c.get('last_name') or ''}


def _company(c: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not c:
        return None
    return {**_flatten(c), 'ID': str(c.get('id')), 'TITLE': c.get('name') or ''}


def _products(config: Dict[str, Any], elements: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
    '''Товары сделки (элементы каталога): название, цена из поля цены каталога, количество из привязки.'''
    by_catalog: Dict[str, List[Dict[str, Any]]] = {}
    for el in elements:
        meta = el.get('metadata') or {}
        if meta.get('catalog_id'):
            by_catalog.setdefault(str(meta['catalog_id']), []).append(el)
    rows = []
    for catalog_id, links in by_catalog.items():
        query = '&'.join(f'filter[id][]={l.get("id")}' for l in links)
        res, err = call(config, f'/api/v4/catalogs/{catalog_id}/elements?limit=250&{query}')
        if err:
            continue
        found = {str(e.get('id')): e for e in ((res or {}).get('_embedded') or {}).get('elements') or []}
        for link in links:
            el = found.get(str(link.get('id')))
            if not el:
                continue
            meta = link.get('metadata') or {}
            price = None
            for f in el.get('custom_fields_values') or []:
                if (meta.get('price_id') and f.get('field_id') == meta.get('price_id')) or (price is None and f.get('field_code') == 'PRICE'):
                    vals = f.get('values') or []
                    price = vals[0].get('value') if vals else None
            rows.append({'PRODUCT_NAME': el.get('name') or 'Товар', 'PRICE': price, 'QUANTITY': meta.get('quantity') or 1})
    return rows


def load_record(config: Dict[str, Any], entity_id: Any) -> Tuple[Optional[Dict[str, Any]], str]:
    '''Сделка + основной контакт + компания + товары - в том же виде, что запись Битрикс24.'''
    lead_id = re.sub(r'\D', '', str(entity_id or ''))
    if not lead_id:
        return None, 'Не указан номер сделки'
    lead, err = call(config, f'/api/v4/leads/{lead_id}?with=contacts,catalog_elements')
    if err:
        return None, f'Сделка #{lead_id} в AmoCRM: {err}'
    emb = lead.get('_embedded') or {}
    contacts = emb.get('contacts') or []
    main_contact = next((c for c in contacts if c.get('is_main')), contacts[0] if contacts else None)
    companies = emb.get('companies') or []
    tasks = {}
    if main_contact:
        tasks['contact'] = lambda: call(config, f"/api/v4/contacts/{main_contact['id']}")
    if companies:
        tasks['company'] = lambda: call(config, f"/api/v4/companies/{companies[0]['id']}")
    if emb.get('catalog_elements'):
        tasks['products'] = lambda: (_products(config, emb['catalog_elements']), '')
    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = {k: pool.submit(fn) for k, fn in tasks.items()}
        res = {k: f.result()[0] for k, f in futures.items()}
    return {
        'deal': _deal(lead),
        'contact': _contact(res.get('contact')),
        'company': _company(res.get('company')),
        'products': res.get('products') or [],
    }, ''


def build_data(record: Dict[str, Any], mapping: Dict[str, Any]) -> Tuple[Optional[Dict[str, Any]], str, str]:
    data, err, note = bitrix_crm.build_data(record, 'deal', mapping)
    if data:
        data['items_source'] = 'AmoCRM'
    return data, err, note


def extract_lead_id(webhook_data: Dict[str, Any]) -> Optional[str]:
    '''ID сделки из вебхука AmoCRM: leads[status|add|update][0][id].'''
    leads = webhook_data.get('leads') if isinstance(webhook_data, dict) else None
    if not isinstance(leads, dict):
        return None
    for event_type in ('status', 'add', 'update'):
        entries = leads.get(event_type)
        first = next(iter(entries.values()), None) if isinstance(entries, dict) else (entries[0] if isinstance(entries, list) and entries else None)
        if isinstance(first, dict) and first.get('id'):
            return str(first['id'])
    return None
