import hashlib
import json
from typing import Any, Dict, Optional, Tuple


def verify_tbank_token(data: Dict[str, Any], terminal_password: str) -> bool:
    '''
    Проверка подписи вебхука от Тбанка
    Алгоритм согласно https://developer.tbank.ru/eacq/intro/developer/token:
    1. Собрать параметры (исключить Token и вложенные объекты)
    2. Добавить Password
    3. Отсортировать по ключу
    4. Сконкатенировать значения
    5. SHA-256
    '''
    received_token = data.get('Token', '')
    if not received_token:
        return False

    params_to_hash = {}

    for key, value in data.items():
        if key == 'Token':
            continue

        if isinstance(value, (dict, list)):
            continue

        if isinstance(value, bool):
            params_to_hash[key] = 'true' if value else 'false'
        else:
            params_to_hash[key] = str(value)

    params_to_hash['Password'] = terminal_password

    sorted_keys = sorted(params_to_hash.keys())
    values_list = [params_to_hash[key] for key in sorted_keys]
    concatenated = ''.join(values_list)

    calculated_token = hashlib.sha256(concatenated.encode('utf-8')).hexdigest()

    return calculated_token == received_token


def process(cur, integration_id: int, company_id: int, config: Dict[str, Any],
            webhook_settings: Dict[str, Any], webhook_data: Dict[str, Any]) -> Tuple[bool, Optional[int], Optional[str]]:
    '''
    Обрабатывает вебхук платёжного эквайринга Т-Банка: проверяет подпись,
    фильтрует по настройкам уведомлений, сохраняет платёж.
    Returns: (signature_valid, webhook_payment_id, error)
    '''
    terminal_password = config.get('terminal_password', '')
    if not verify_tbank_token(webhook_data, terminal_password):
        return False, None, 'Invalid signature'

    status = webhook_data.get('Status', '')

    payment_status_map = {
        'AUTHORIZED': 'notify_on_authorized',
        'CONFIRMED': 'notify_on_confirmed',
        'REJECTED': 'notify_on_rejected',
        'REFUNDED': 'notify_on_refunded',
        'CANCELED': 'notify_on_canceled'
    }

    notify_key = payment_status_map.get(status)
    if notify_key and not webhook_settings.get(notify_key, True):
        return True, None, None

    cur.execute('''
        INSERT INTO t_p83864310_fintech_payment_reco.webhook_payments (
            integration_id, company_id, payment_id, terminal_key,
            amount, order_id, status, payment_status, error_code,
            customer_email, customer_phone, pan, card_type, exp_date,
            raw_data
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
        ON CONFLICT (integration_id, payment_id, status) DO NOTHING
        RETURNING id
    ''', (
        integration_id,
        company_id,
        webhook_data.get('PaymentId'),
        webhook_data.get('TerminalKey'),
        float(webhook_data.get('Amount', 0)) / 100,
        webhook_data.get('OrderId'),
        webhook_data.get('Status'),
        webhook_data.get('PaymentStatus'),
        webhook_data.get('ErrorCode'),
        webhook_data.get('CardData', {}).get('Email') if isinstance(webhook_data.get('CardData'), dict) else None,
        webhook_data.get('Phone'),
        webhook_data.get('Pan'),
        webhook_data.get('CardType'),
        webhook_data.get('ExpDate'),
        json.dumps(webhook_data)
    ))

    result = cur.fetchone()
    webhook_payment_id = result[0] if result else None

    return True, webhook_payment_id, None
