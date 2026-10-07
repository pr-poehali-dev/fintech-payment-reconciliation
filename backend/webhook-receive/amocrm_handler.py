import json
import re
import urllib.request
import urllib.error
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

EMAIL_RE = re.compile(r'[\w.+-]+@[\w-]+(?:\.[\w-]+)+')
# Системные этапы AmoCRM: 142 - «Успешно реализовано», 143 - «Закрыто и не реализовано».
WON_STATUS_ID = 142
LOST_STATUS_ID = 143


def _base_url(subdomain: str) -> str:
    host = re.sub(r'^https?://', '', str(subdomain or '').strip()).split('/')[0]
    if not host:
        return ''
    return f'https://{host if "." in host else host + ".amocrm.ru"}'


def _get(config: Dict[str, Any], path: str, timeout: float = 6.0) -> Optional[Dict[str, Any]]:
    url = _base_url(config.get('subdomain', ''))
    token = str(config.get('api_key') or '').strip()
    if not url or not token:
        return None
    req = urllib.request.Request(url + path, headers={'Authorization': f'Bearer {token}'})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            body = response.read().decode('utf-8')
            return json.loads(body) if body else None
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError, TimeoutError):
        return None


def extract_lead_id(webhook_data: Dict[str, Any]) -> Optional[str]:
    '''ID сделки из вебхука AmoCRM: leads[status|add|update][0][id].'''
    direct = str(webhook_data.get('deal_id') or webhook_data.get('lead_id') or '').strip()
    if direct.isdigit():
        return direct
    leads = webhook_data.get('leads', {})
    if not isinstance(leads, dict):
        return None
    for event_type in ('status', 'add', 'update'):
        entries = leads.get(event_type)
        first = next(iter(entries.values()), None) if isinstance(entries, dict) and entries else (
            entries[0] if isinstance(entries, list) and entries else None)
        if isinstance(first, dict) and first.get('id'):
            return str(first['id'])
    return None


def _iso(ts: Any) -> Optional[str]:
    try:
        return datetime.fromtimestamp(int(ts), tz=timezone.utc).isoformat() if ts else None
    except (TypeError, ValueError):
        return None


def _flat(lead: Dict[str, Any]) -> Dict[str, Any]:
    '''
    Сделка AmoCRM в плоском виде, как сделка Битрикс24 в crm_deals.raw_data: значения полей
    (CF_<id>) - связка по ссылке на оплату ищет ссылку в любом поле; стадия и даты - те же ключи.
    '''
    out: Dict[str, Any] = {}
    for f in lead.get('custom_fields_values') or []:
        values = [str(v.get('value')) for v in f.get('values') or [] if v.get('value') not in (None, '')]
        if values:
            out[f"CF_{f.get('field_id')}"] = values[0] if len(values) == 1 else ', '.join(values)
    status_id = lead.get('status_id')
    out.update({
        'ID': str(lead.get('id')), 'TITLE': lead.get('name') or '', 'OPPORTUNITY': lead.get('price'),
        'STAGE_ID': str(status_id or ''), 'CATEGORY_ID': str(lead.get('pipeline_id') or ''),
        'STAGE_SEMANTIC_ID': 'S' if status_id == WON_STATUS_ID else ('F' if status_id == LOST_STATUS_ID else 'P'),
        'DATE_CREATE': _iso(lead.get('created_at')), 'DATE_MODIFY': _iso(lead.get('updated_at')),
    })
    return out


def _emails(value: Any) -> List[str]:
    return sorted({m.lower() for m in EMAIL_RE.findall(json.dumps(value, ensure_ascii=False))})


def customer_emails(config: Dict[str, Any], lead: Dict[str, Any]) -> str:
    '''Почты покупателя из полей сделки и основного контакта - для связки с чеком по почте и сумме.'''
    emails = set(_emails(lead.get('custom_fields_values') or []))
    contacts = (lead.get('_embedded') or {}).get('contacts') or []
    main = next((c for c in contacts if c.get('is_main')), contacts[0] if contacts else None)
    if main and main.get('id'):
        contact = _get(config, f"/api/v4/contacts/{main['id']}", timeout=4.0)
        if contact:
            emails.update(_emails(contact.get('custom_fields_values') or []))
    return ','.join(sorted(emails))


def process(cur, integration_id: int, company_id: int, config: Dict[str, Any],
            webhook_data: Dict[str, Any]) -> Tuple[bool, Optional[str], Optional[str]]:
    '''
    Обрабатывает событие AmoCRM: достаёт ID сделки из вебхука, ходит в REST API за сделкой
    и её контактом, сохраняет/обновляет сделку в crm_deals в том же виде, что сделки Битрикс24
    (почты покупателя - сразу, для связки с чеком). webhook_count растёт при повторных хуках.
    Returns: (success, lead_id, error)
    '''
    if not config.get('subdomain') or not config.get('api_key'):
        return False, None, 'subdomain or api_key not configured'

    lead_id = extract_lead_id(webhook_data)
    if not lead_id:
        return False, None, 'Lead ID not found in webhook payload'

    lead = _get(config, f'/api/v4/leads/{lead_id}?with=contacts')
    if not lead:
        return False, str(lead_id), f'Failed to fetch lead {lead_id} from AmoCRM API'

    cur.execute('''
        INSERT INTO t_p83864310_fintech_payment_reco.crm_deals (
            integration_id, company_id, provider_slug, external_deal_id,
            title, stage, amount, currency, raw_data, customer_emails, webhook_count, updated_at
        ) VALUES (%s, %s, 'amocrm', %s, %s, %s, %s, 'RUB', %s, %s, 1, NOW())
        ON CONFLICT (integration_id, external_deal_id) DO UPDATE SET
            title = EXCLUDED.title,
            stage = EXCLUDED.stage,
            amount = EXCLUDED.amount,
            raw_data = EXCLUDED.raw_data,
            customer_emails = EXCLUDED.customer_emails,
            webhook_count = t_p83864310_fintech_payment_reco.crm_deals.webhook_count + 1,
            updated_at = NOW()
    ''', (
        integration_id,
        company_id,
        str(lead_id),
        lead.get('name'),
        str(lead.get('status_id', '')),
        lead.get('price'),
        json.dumps(_flat(lead), ensure_ascii=False),
        customer_emails(config, lead),
    ))

    return True, str(lead_id), None
