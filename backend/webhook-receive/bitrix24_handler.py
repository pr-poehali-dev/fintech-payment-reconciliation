import json
import urllib.request
import urllib.error
from typing import Any, Dict, Optional, Tuple


STAGE_MAP = {
    'NEW': 'Новая',
    'PREPARATION': 'Подготовка',
    'PREPAYMENT_INVOICE': 'Выставлен счёт',
    'EXECUTING': 'В работе',
    'FINAL_INVOICE': 'Финальный счёт',
    'WON': 'Успешно',
    'LOSE': 'Провалена'
}


def fetch_deal_details(webhook_url: str, deal_id: str) -> Optional[Dict[str, Any]]:
    '''
    Вебхук Битрикс24 присылает только событие и ID сделки (data[FIELDS][ID]),
    полные данные нужно доопросить через crm.deal.get.
    '''
    url = webhook_url.rstrip('/') + f'/crm.deal.get.json?id={deal_id}'
    try:
        with urllib.request.urlopen(url, timeout=10) as response:
            data = json.loads(response.read().decode('utf-8'))
            return data.get('result')
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError):
        return None


def process(cur, integration_id: int, company_id: int, config: Dict[str, Any],
            webhook_data: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
    '''
    Обрабатывает событие Битрикс24: достаёт ID сделки из вебхука, ходит в crm.deal.get
    за полными данными, сохраняет/обновляет сделку в crm_deals.
    '''
    webhook_url = config.get('webhook_url', '')
    if not webhook_url:
        return False, 'webhook_url not configured'

    fields = webhook_data.get('data', {}).get('FIELDS', {}) if isinstance(webhook_data.get('data'), dict) else {}
    deal_id = fields.get('ID') if isinstance(fields, dict) else None

    if not deal_id:
        return False, 'Deal ID not found in webhook payload'

    deal = fetch_deal_details(webhook_url, deal_id)
    if not deal:
        return False, f'Failed to fetch deal {deal_id} from Bitrix24 API'

    stage_id = deal.get('STAGE_ID', '')
    stage_name = STAGE_MAP.get(stage_id, stage_id)

    cur.execute('''
        INSERT INTO t_p83864310_fintech_payment_reco.crm_deals (
            integration_id, company_id, provider_slug, external_deal_id,
            title, stage, amount, currency, raw_data, updated_at
        ) VALUES (%s, %s, 'bitrix24', %s, %s, %s, %s, %s, %s, NOW())
        ON CONFLICT (integration_id, external_deal_id) DO UPDATE SET
            title = EXCLUDED.title,
            stage = EXCLUDED.stage,
            amount = EXCLUDED.amount,
            currency = EXCLUDED.currency,
            raw_data = EXCLUDED.raw_data,
            updated_at = NOW()
    ''', (
        integration_id,
        company_id,
        str(deal_id),
        deal.get('TITLE'),
        stage_name,
        deal.get('OPPORTUNITY'),
        deal.get('CURRENCY_ID'),
        json.dumps(deal)
    ))

    return True, None
