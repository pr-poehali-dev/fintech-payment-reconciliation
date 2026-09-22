import json
from typing import Any, Dict, Optional


def save_event(cur, integration_id: int, company_id: int, provider_slug: str,
                event_type: Optional[str], raw_payload: Dict[str, Any]) -> int:
    '''
    Кладёт сырое входящее событие в inbox-таблицу webhook_events до любой обработки.
    Так события разных провайдеров физически не пересекаются - у каждого своя строка
    с явным provider_slug, и потеря/ошибка в обработчике одного провайдера
    не затрагивает данные другого.
    '''
    cur.execute('''
        INSERT INTO t_p83864310_fintech_payment_reco.webhook_events
            (integration_id, company_id, provider_slug, event_type, raw_payload, status)
        VALUES (%s, %s, %s, %s, %s, 'pending')
        RETURNING id
    ''', (
        integration_id,
        company_id,
        provider_slug,
        event_type,
        json.dumps(raw_payload)
    ))
    return cur.fetchone()[0]


def mark_processed(cur, event_id: int, status: str, error_message: Optional[str] = None) -> None:
    cur.execute('''
        UPDATE t_p83864310_fintech_payment_reco.webhook_events
        SET status = %s, error_message = %s, processed_at = NOW()
        WHERE id = %s
    ''', (status, error_message, event_id))
