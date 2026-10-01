import hashlib
import json
from datetime import datetime, timezone
from typing import Any, Dict, Optional, Tuple

from fiscal_merge import merge_after_tbank

SCHEMA = 't_p83864310_fintech_payment_reco'


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


def _is_fiscalized(webhook_data: Dict[str, Any]) -> bool:
    '''
    Уведомление RECEIPT бывает двух видов:
    1) касса настроена и подключена - чек пробит, есть ФН/ФД/ФП;
    2) касса настроена, но не подключена - пришла только корзина, чек пробивать
       нам (через сценарий автоматизации).
    '''
    return (
        str(webhook_data.get('ErrorCode', '0')) == '0'
        and bool(webhook_data.get('FnNumber'))
        and webhook_data.get('FiscalDocumentNumber') not in (None, '')
        and webhook_data.get('FiscalDocumentAttribute') not in (None, '')
    )


def _parse_datetime(value: Any) -> Optional[str]:
    if not value:
        return None
    text = str(value).strip()
    try:
        parsed = datetime.fromisoformat(text.replace('Z', '+00:00'))
        # В БД время хранится в UTC без смещения - "+03:00" сначала переводим в UTC.
        if parsed.tzinfo is not None:
            parsed = parsed.astimezone(timezone.utc)
        return parsed.replace(tzinfo=None).isoformat()
    except ValueError:
        pass
    try:
        return datetime.strptime(text, '%d.%m.%Y %H:%M:%S').isoformat()
    except ValueError:
        return None


def save_fiscal_receipt(cur, integration_id: int, company_id: int, webhook_data: Dict[str, Any]) -> Optional[int]:
    '''
    Чек, пробитый кассой Т-Банка, сохраняется в общий реестр чеков кассы
    (source='tbank') - в том же формате payload, что у Екомкассы, чтобы
    работало сопоставление с ОФД и с чеком Екомкассы по ФН + ФД + ФП.
    Сразу связывается с платежом (пара платёж + чек). Если тот же чек уже
    пришёл от Екомкассы - чек Т-Банка сливается в него, дубля не будет.
    Returns: id основного чека (Екомкассы, если слит, иначе Т-Банка).
    '''
    payment_id = str(webhook_data.get('PaymentId'))
    total = float(webhook_data.get('Amount') or 0) / 100
    payload = {
        'total': total,
        'fn_number': str(webhook_data.get('FnNumber')),
        'fiscal_document_number': str(webhook_data.get('FiscalDocumentNumber')),
        'fiscal_document_attribute': str(webhook_data.get('FiscalDocumentAttribute')),
        'fiscal_receipt_number': webhook_data.get('FiscalNumber'),
        'shift_number': webhook_data.get('ShiftNumber'),
        'ecr_registration_number': webhook_data.get('EcrRegNumber'),
        'receipt_datetime': webhook_data.get('ReceiptDatetime'),
        'ofd_receipt_url': webhook_data.get('Url'),
        'ofd_name': webhook_data.get('Ofd'),
        'operation_type': webhook_data.get('Type')
    }
    raw = {'status': 'done', 'kind': 'CASH_VOUCHER', 'provider': 'tbank', 'payload': payload,
           'tbank_notification': {k: v for k, v in webhook_data.items() if k != 'Token'}}
    cur.execute(f'''
        INSERT INTO {SCHEMA}.ecomkassa_receipts (
            integration_id, company_id, order_id, legacy_no, status, total_sum,
            doc_number, doc_datetime, raw_data, order_type, source
        ) VALUES (%s, %s, %s, %s, 'done', %s, %s, %s, %s, 'VCHR', 'tbank')
        ON CONFLICT (integration_id, order_id) DO UPDATE SET
            total_sum = EXCLUDED.total_sum, doc_number = EXCLUDED.doc_number,
            doc_datetime = COALESCE(EXCLUDED.doc_datetime, {SCHEMA}.ecomkassa_receipts.doc_datetime),
            raw_data = EXCLUDED.raw_data
        RETURNING id, merged_into_id
    ''', (
        integration_id, company_id, payment_id, webhook_data.get('OrderId'), total,
        str(webhook_data.get('FiscalDocumentNumber')), _parse_datetime(webhook_data.get('ReceiptDatetime')),
        json.dumps(raw, ensure_ascii=False)
    ))
    row = cur.fetchone()
    receipt_id = row[1] or row[0]
    receipt_id = merge_after_tbank(cur, row[0]) or receipt_id

    cur.execute(f'''
        UPDATE {SCHEMA}.webhook_payments SET receipt_id = %s, updated_at = NOW()
        WHERE integration_id = %s AND payment_id = %s AND receipt_id IS NULL
    ''', (receipt_id, integration_id, payment_id))
    return receipt_id


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
    fiscalized = _is_fiscalized(webhook_data)
    receipt_id = save_fiscal_receipt(cur, integration_id, company_id, webhook_data) if fiscalized else None
    cur.execute('''
        INSERT INTO t_p83864310_fintech_payment_reco.payment_carts
            (company_id, integration_id, payment_id, order_id, source, items, receipt, items_total, fiscal_data,
             fiscalized, receipt_id)
        VALUES (%s, %s, %s, %s, 'tbank_receipt', %s, %s, %s, %s, %s, %s)
        ON CONFLICT (integration_id, payment_id) DO UPDATE SET
            items = EXCLUDED.items, receipt = EXCLUDED.receipt, items_total = EXCLUDED.items_total,
            fiscal_data = EXCLUDED.fiscal_data,
            fiscalized = payment_carts.fiscalized OR EXCLUDED.fiscalized,
            receipt_id = COALESCE(EXCLUDED.receipt_id, payment_carts.receipt_id),
            order_id = COALESCE(EXCLUDED.order_id, payment_carts.order_id), updated_at = NOW()
    ''', (
        company_id, integration_id, str(payment_id), webhook_data.get('OrderId'),
        json.dumps(items, ensure_ascii=False), json.dumps(receipt, ensure_ascii=False), total,
        json.dumps(fiscal, ensure_ascii=False), fiscalized, receipt_id
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

    # Чек мог прийти раньше платежа (уведомления не упорядочены) - довязываем пару.
    if webhook_payment_id:
        cur.execute(f'''
            UPDATE {SCHEMA}.webhook_payments wp SET receipt_id = pc.receipt_id, updated_at = NOW()
            FROM {SCHEMA}.payment_carts pc
            WHERE wp.id = %s AND wp.receipt_id IS NULL AND pc.receipt_id IS NOT NULL
              AND pc.integration_id = wp.integration_id AND pc.payment_id = wp.payment_id
        ''', (webhook_payment_id,))

    return True, webhook_payment_id, None
