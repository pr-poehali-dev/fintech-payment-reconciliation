import json
import urllib.request
import urllib.error
from datetime import datetime
from typing import Any, Dict, Optional, Tuple

ECOMKASSA_BASE_URL = 'https://app.ecomkassa.ru'

# "done" - чек фискализирован и payload с фискальными данными заполнен.
# Любой другой статус (wait/pending и т.п.) - чек ещё не готов, пробуем позже.
RECEIPT_DONE_STATUS = 'done'


def fetch_report(token: str, store_id: str, uid: str, protocol_version: str = 'v4',
                  timeout: float = 10.0) -> Optional[Dict[str, Any]]:
    '''
    GET /fiscalorder/{version}/{storeId}/report/{uuid} - проверка статуса пробития
    чека Екомкассы по UUID платежа (= внешнему номеру предчека в кассе).
    Ответ: {"status": "done"/..., "payload": {"total": ..., "fiscal_receipt_number": ...}}.
    '''
    url = f'{ECOMKASSA_BASE_URL}/fiscalorder/{protocol_version}/{store_id}/report/{uid}'
    req = urllib.request.Request(url, headers={'Token': token})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as response:
            return json.loads(response.read().decode('utf-8'))
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError, TimeoutError):
        return None


def parse_receipt_datetime(value: Any) -> Optional[str]:
    '''Екомкасса отдаёт дату чека как "14.07.2019 15:08:25" - переводим в ISO для timestamp-колонки.'''
    if not value:
        return None
    try:
        return datetime.strptime(str(value), '%d.%m.%Y %H:%M:%S').isoformat()
    except ValueError:
        return None


def save_receipt_from_report(cur, integration_id: int, company_id: int, uid: str,
                              report_data: Dict[str, Any]) -> Tuple[Optional[int], float, Optional[str]]:
    '''
    Сохраняет фискальный чек по ответу report(status="done") в ecomkassa_receipts.
    Для счетов на оплату (kind="INVOICE") report() дополнительно отдаёт invoice_payload
    с полем "provider" - дискриминатором конкретной платёжной системы внутри шлюза
    (у одной кассы Екомкассы их может быть подключено больше 10). Сохраняем его
    отдельной колонкой для фильтрации событий и детализации сверки.
    Returns: (receipt_id, total_sum, payment_provider)
    '''
    payload = report_data.get('payload') or {}
    total_sum = payload.get('total')
    doc_number = payload.get('fiscal_receipt_number') or payload.get('fiscal_document_number')
    doc_datetime = parse_receipt_datetime(payload.get('receipt_datetime'))

    invoice_payload = report_data.get('invoice_payload') or {}
    payment_provider = invoice_payload.get('provider') if isinstance(invoice_payload, dict) else None

    cur.execute('''
        INSERT INTO t_p83864310_fintech_payment_reco.ecomkassa_receipts (
            integration_id, company_id, order_id, legacy_no, status,
            total_sum, doc_number, doc_datetime, raw_data, payment_provider
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (integration_id, order_id) DO UPDATE SET
            status = EXCLUDED.status,
            total_sum = EXCLUDED.total_sum,
            doc_number = EXCLUDED.doc_number,
            doc_datetime = EXCLUDED.doc_datetime,
            raw_data = EXCLUDED.raw_data,
            payment_provider = COALESCE(EXCLUDED.payment_provider, t_p83864310_fintech_payment_reco.ecomkassa_receipts.payment_provider)
        RETURNING id
    ''', (
        integration_id, company_id, str(uid), str(uid), RECEIPT_DONE_STATUS,
        total_sum, str(doc_number) if doc_number else None, doc_datetime, json.dumps(report_data), payment_provider
    ))
    result = cur.fetchone()
    receipt_id = result[0] if result else None
    return receipt_id, float(total_sum) if total_sum else 0.0, payment_provider