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


def save_cart(cur, integration_id: int, company_id: int, webhook_data: Dict[str, Any]) -> bool:
    '''
    Сохраняет корзину (объект Receipt) из уведомления Т-Банка. Receipt приходит
    в уведомлении о фискализации (Status=RECEIPT). Суммы в копейках -> рубли.
    Повторное уведомление по тому же платежу обновляет корзину.
    '''
    receipt = webhook_data.get('Receipt')
    payment_id = webhook_data.get('PaymentId')
    if not isinstance(receipt, dict) or not payment_id:
        return False
    items = []
    for item in receipt.get('Items') or []:
        if not isinstance(item, dict):
            continue
        items.append({
            'name': item.get('Name'),
            'price': float(item.get('Price') or 0) / 100,
            'quantity': float(item.get('Quantity') or 0),
            'amount': float(item.get('Amount') or 0) / 100,
            'tax': item.get('Tax'),
            'payment_method': item.get('PaymentMethod'),
            'payment_object': item.get('PaymentObject'),
            'measurement_unit': item.get('MeasurementUnit'),
            'mark_code': item.get('MarkCode'),
            'mark_quantity': item.get('MarkQuantity'),
            'mark_processing_mode': item.get('MarkProcessingMode'),
            'excise': item.get('Excise'),
            'country_code': item.get('CountryCode'),
            'declaration_number': item.get('DeclarationNumber'),
            'user_data': item.get('UserData'),
            'sectoral_item_props': item.get('SectoralItemProps'),
            'agent_data': item.get('AgentData'),
            'supplier_info': item.get('SupplierInfo')
        })
    total = round(sum(i['amount'] for i in items), 2)
    # Реквизиты уже пробитого чека: по ним видно, что чек по платежу есть.
    fiscal_keys = ['FiscalNumber', 'ShiftNumber', 'ReceiptDatetime', 'FnNumber', 'EcrRegNumber',
                   'FiscalDocumentNumber', 'FiscalDocumentAttribute', 'Type', 'Ofd', 'Url', 'QrCodeUrl',
                   'CalculationPlace', 'CashierName', 'SettlePlace', 'ErrorCode', 'ErrorMessage', 'Amount']
    fiscal = {k: webhook_data.get(k) for k in fiscal_keys if webhook_data.get(k) is not None}
    cur.execute('''
        INSERT INTO t_p83864310_fintech_payment_reco.payment_carts
            (company_id, integration_id, payment_id, order_id, source, items, receipt, items_total, fiscal_data)
        VALUES (%s, %s, %s, %s, 'tbank_receipt', %s, %s, %s, %s)
        ON CONFLICT (integration_id, payment_id) DO UPDATE SET
            items = EXCLUDED.items, receipt = EXCLUDED.receipt, items_total = EXCLUDED.items_total,
            fiscal_data = EXCLUDED.fiscal_data,
            order_id = COALESCE(EXCLUDED.order_id, payment_carts.order_id), updated_at = NOW()
    ''', (
        company_id, integration_id, str(payment_id), webhook_data.get('OrderId'),
        json.dumps(items, ensure_ascii=False), json.dumps(receipt, ensure_ascii=False), total,
        json.dumps(fiscal, ensure_ascii=False)
    ))
    return True


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

    # Корзина из уведомления сохраняется отдельно от платежа.
    save_cart(cur, integration_id, company_id, webhook_data)

    # Уведомление о фискализации - не новый статус платежа, в платежи не пишем.
    if status == 'RECEIPT':
        return True, None, None

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
