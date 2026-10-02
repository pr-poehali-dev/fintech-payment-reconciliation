import json
import re
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from typing import Any, Dict, List, Optional

SCHEMA = 't_p83864310_fintech_payment_reco'
ECOMKASSA_BASE_URL = 'https://app.ecomkassa.ru'
EMAIL_RE = re.compile(r'[\w.+-]+@[\w-]+(?:\.[\w-]+)+')
# Служебные адреса мессенджеров (Wappi ставит их контакту при переписке в Telegram/MAX) - не почта покупателя.
SERVICE_DOMAIN_SUFFIXES = ('.wappi', 'wappi.pro')
# Чек пробит / ссылка оплачена - Битрикс шлёт хук по сделке почти сразу: окно ±5 минут от хука.
HOOK_WINDOW_MIN = 5

# Сколько документов/сделок дорабатываем за один вызов - укладываемся в таймаут функции.
RECEIPTS_PER_RUN = 8
DEALS_PER_RUN = 5
# Насколько далеко назад смотрим: сделки и чеки за последние N дней.
LOOKBACK_DAYS = 14


def _get_json(url: str, headers: Dict[str, str], timeout: float = 4.0) -> Optional[Any]:
    try:
        with urllib.request.urlopen(urllib.request.Request(url, headers=headers), timeout=timeout) as resp:
            return json.loads(resp.read().decode('utf-8'))
    except Exception:
        return None


def _emails(value: Any) -> List[str]:
    found = {m.lower() for m in EMAIL_RE.findall(json.dumps(value, ensure_ascii=False))}
    return sorted(e for e in found if not e.endswith(SERVICE_DOMAIN_SUFFIXES))


def fill_receipt_emails(cur, token: str, protocol_version: str, company_id: int,
                        receipt_ids: Optional[List[int]] = None) -> int:
    '''Почта покупателя из чека Екомкассы (блок client в формате АТОЛ) - в ecomkassa_receipts.customer_email.'''
    if receipt_ids is not None:
        if not receipt_ids:
            return 0
        cur.execute(f'''
            SELECT id, order_id FROM {SCHEMA}.ecomkassa_receipts
            WHERE id = ANY(%s) AND NOT customer_checked
        ''', (receipt_ids,))
    else:
        cur.execute(f'''
            SELECT id, order_id FROM {SCHEMA}.ecomkassa_receipts
            WHERE company_id = %s AND NOT customer_checked AND removed_at IS NULL AND status = 'done'
              AND created_at > NOW() - make_interval(days => %s)
            ORDER BY id DESC LIMIT %s
        ''', (company_id, LOOKBACK_DAYS, RECEIPTS_PER_RUN))
    rows = cur.fetchall()
    if not rows:
        return 0
    fmt = 'atol-5' if protocol_version == 'v5' else 'atol-4'
    with ThreadPoolExecutor(max_workers=len(rows)) as pool:
        docs = list(pool.map(
            lambda r: _get_json(f'{ECOMKASSA_BASE_URL}/api/mobile/v1/orders/{r[1]}/{fmt}', {'Token': token}), rows))
    filled = 0
    for (receipt_id, _), doc in zip(rows, docs):
        if not isinstance(doc, dict):
            continue
        client = (doc.get('receipt') or {}).get('client') or {}
        email = (client.get('email') or '').strip().lower() or None
        if email and email.endswith(SERVICE_DOMAIN_SUFFIXES):
            email = None
        cur.execute(f'''
            UPDATE {SCHEMA}.ecomkassa_receipts SET customer_email = %s, customer_checked = true WHERE id = %s
        ''', (email, receipt_id))
        filled += 1 if email else 0
    return filled


def fill_deal_emails(cur, company_id: int, deal_row_id: Optional[int] = None) -> None:
    '''Почты покупателя по сделке: из полей самой сделки и из контакта (crm.contact.get).'''
    cur.execute(f'''
        SELECT d.id, d.raw_data, ui.config
        FROM {SCHEMA}.crm_deals d
        JOIN {SCHEMA}.user_integrations ui ON ui.id = d.integration_id
        WHERE d.company_id = %s AND d.provider_slug = 'bitrix24' AND d.customer_emails IS NULL
          AND d.updated_at > NOW() - make_interval(days => %s)
          AND (%s::int IS NULL OR d.id = %s::int)
        ORDER BY d.updated_at DESC LIMIT %s
    ''', (company_id, LOOKBACK_DAYS, deal_row_id, deal_row_id, DEALS_PER_RUN))
    for deal_id, raw, config in cur.fetchall():
        raw = raw if isinstance(raw, dict) else json.loads(raw or '{}')
        config = config if isinstance(config, dict) else json.loads(config or '{}')
        emails = set(_emails(raw))
        contact_id = str(raw.get('CONTACT_ID') or '')
        webhook_url = (config.get('webhook_url') or '').rstrip('/')
        if contact_id.isdigit() and webhook_url:
            contact = _get_json(f'{webhook_url}/crm.contact.get.json?id={contact_id}', {})
            if isinstance(contact, dict):
                emails.update(_emails((contact.get('result') or {}).get('EMAIL') or []))
        cur.execute(f'UPDATE {SCHEMA}.crm_deals SET customer_emails = %s WHERE id = %s',
                    (','.join(sorted(emails)), deal_id))


def link_deals(cur, company_id: int, deal_row_id: Optional[int] = None) -> int:
    '''
    Сделка -> чек/счёт Екомкассы, пока приложение ЕкомКассы не пишет ссылку на оплату в сделку:
    та же почта покупателя, та же сумма, и чек пробит в пределах ±5 минут от одного из хуков
    CRM по этой сделке (хук приходит, когда пробит чек или оплачена ссылка). Из подходящих -
    ближайший ко времени хука; чек, уже связанный с другой сделкой, не берём.
    '''
    cur.execute(f'''
        UPDATE {SCHEMA}.crm_deals d SET linked_receipt_id = m.receipt_id, linked_at = NOW()
        FROM (
            SELECT d2.id AS deal_id, (
                SELECT r.id FROM {SCHEMA}.ecomkassa_receipts r
                JOIN {SCHEMA}.webhook_events we ON we.integration_id = d2.integration_id
                     AND we.external_deal_id = d2.external_deal_id
                     AND r.doc_datetime BETWEEN we.created_at - make_interval(mins => %s)
                                            AND we.created_at + make_interval(mins => %s)
                WHERE r.company_id = d2.company_id AND r.removed_at IS NULL AND r.status = 'done'
                  AND r.customer_email IS NOT NULL
                  AND r.customer_email = ANY(string_to_array(d2.customer_emails, ','))
                  AND r.total_sum = d2.amount
                  AND NOT EXISTS (SELECT 1 FROM {SCHEMA}.crm_deals o WHERE o.linked_receipt_id = r.id AND o.id <> d2.id)
                ORDER BY abs(extract(epoch FROM r.doc_datetime - we.created_at))
                LIMIT 1
            ) AS receipt_id
            FROM {SCHEMA}.crm_deals d2
            WHERE d2.company_id = %s AND d2.linked_receipt_id IS NULL
              AND COALESCE(d2.customer_emails, '') <> '' AND d2.amount > 0
              AND d2.updated_at > NOW() - make_interval(days => %s)
              AND (%s::int IS NULL OR d2.id = %s::int)
        ) m
        WHERE d.id = m.deal_id AND m.receipt_id IS NOT NULL
        RETURNING d.id
    ''', (HOOK_WINDOW_MIN, HOOK_WINDOW_MIN, company_id, LOOKBACK_DAYS, deal_row_id, deal_row_id))
    return len(cur.fetchall())


def candidate_receipts(cur, deal_row_id: int) -> List[int]:
    '''Чеки той же суммы, пробитые в окне ±5 минут от хуков сделки, - им нужна почта покупателя.'''
    cur.execute(f'''
        SELECT DISTINCT r.id FROM {SCHEMA}.crm_deals d
        JOIN {SCHEMA}.webhook_events we ON we.integration_id = d.integration_id AND we.external_deal_id = d.external_deal_id
        JOIN {SCHEMA}.ecomkassa_receipts r ON r.company_id = d.company_id AND r.removed_at IS NULL
             AND r.status = 'done' AND NOT r.customer_checked AND r.total_sum = d.amount
             AND r.doc_datetime BETWEEN we.created_at - make_interval(mins => %s) AND we.created_at + make_interval(mins => %s)
        WHERE d.id = %s
    ''', (HOOK_WINDOW_MIN, HOOK_WINDOW_MIN, deal_row_id))
    return [r[0] for r in cur.fetchall()]


def run(cur, token: str, protocol_version: str, company_id: int) -> int:
    '''Один проход связывания сделок CRM с чеками кассы (крон). Returns: сколько сделок связано.'''
    fill_receipt_emails(cur, token, protocol_version, company_id)
    fill_deal_emails(cur, company_id)
    return link_deals(cur, company_id)


def run_for_deal(cur, token: Optional[str], protocol_version: str, company_id: int, deal_row_id: int) -> int:
    '''Связывание сразу по приходу хука CRM: почта сделки, почта чеков-кандидатов, связь.'''
    fill_deal_emails(cur, company_id, deal_row_id)
    if token:
        fill_receipt_emails(cur, token, protocol_version, company_id, candidate_receipts(cur, deal_row_id))
    return link_deals(cur, company_id, deal_row_id)
