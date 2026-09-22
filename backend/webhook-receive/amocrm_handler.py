import json
import urllib.request
import urllib.error
from typing import Any, Dict, Optional, Tuple


def fetch_lead_details(subdomain: str, api_key: str, lead_id: str) -> Optional[Dict[str, Any]]:
    '''
    Вебхук AmoCRM присылает только событие и ID сделки (leads[status][0][id]),
    полные данные доопрашиваются через REST API /api/v4/leads/{id}.
    '''
    url = f'https://{subdomain}.amocrm.ru/api/v4/leads/{lead_id}'
    req = urllib.request.Request(url, headers={'Authorization': f'Bearer {api_key}'})
    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            return json.loads(response.read().decode('utf-8'))
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError):
        return None


def extract_lead_id(webhook_data: Dict[str, Any]) -> Optional[str]:
    leads = webhook_data.get('leads', {})
    if not isinstance(leads, dict):
        return None

    for event_type in ('update', 'add', 'status'):
        entries = leads.get(event_type)
        if isinstance(entries, dict) and entries:
            first_entry = next(iter(entries.values()))
            if isinstance(first_entry, dict) and first_entry.get('id'):
                return first_entry['id']
        if isinstance(entries, list) and entries:
            first_entry = entries[0]
            if isinstance(first_entry, dict) and first_entry.get('id'):
                return first_entry['id']

    return None


def process(cur, integration_id: int, company_id: int, config: Dict[str, Any],
            webhook_data: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    '''
    Обрабатывает событие AmoCRM: достаёт ID сделки из вебхука, ходит в REST API
    за полными данными, сохраняет/обновляет сделку в crm_deals.
    '''
    subdomain = config.get('subdomain', '')
    api_key = config.get('api_key', '')
    if not subdomain or not api_key:
        return False, 'subdomain or api_key not configured'

    lead_id = extract_lead_id(webhook_data)
    if not lead_id:
        return False, 'Lead ID not found in webhook payload'

    lead = fetch_lead_details(subdomain, api_key, lead_id)
    if not lead:
        return False, f'Failed to fetch lead {lead_id} from AmoCRM API'

    cur.execute('''
        INSERT INTO t_p83864310_fintech_payment_reco.crm_deals (
            integration_id, company_id, provider_slug, external_deal_id,
            title, stage, amount, currency, raw_data, updated_at
        ) VALUES (%s, %s, 'amocrm', %s, %s, %s, %s, 'RUB', %s, NOW())
        ON CONFLICT (integration_id, external_deal_id) DO UPDATE SET
            title = EXCLUDED.title,
            stage = EXCLUDED.stage,
            amount = EXCLUDED.amount,
            raw_data = EXCLUDED.raw_data,
            updated_at = NOW()
    ''', (
        integration_id,
        company_id,
        str(lead_id),
        lead.get('name'),
        str(lead.get('status_id', '')),
        lead.get('price'),
        json.dumps(lead)
    ))

    return True, None
