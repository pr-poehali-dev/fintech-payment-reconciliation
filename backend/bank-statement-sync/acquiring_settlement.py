import re
from datetime import datetime
from decimal import Decimal
from typing import Optional

SCHEMA = 't_p83864310_fintech_payment_reco'

SETTLEMENT_DATE_RE = re.compile(r'за\s+(\d{2}\.\d{2}\.\d{4})')
COMMISSION_RE = re.compile(r'сумма комиссии\s+([\d\s]+(?:[.,]\d{1,2})?)\s*руб', re.IGNORECASE)


def parse_settlement(purpose: str):
    '''Из назначения зачисления эквайринга достаёт дату продаж ("за ДД.ММ.ГГГГ") и комиссию.'''
    if not purpose:
        return None, None
    date_m = SETTLEMENT_DATE_RE.search(purpose)
    comm_m = COMMISSION_RE.search(purpose)
    if not date_m or not comm_m:
        return None, None
    try:
        settlement_date = datetime.strptime(date_m.group(1), '%d.%m.%Y').date()
    except ValueError:
        return None, None
    commission = Decimal(comm_m.group(1).replace(' ', '').replace(',', '.'))
    return settlement_date, commission


def find_card_payments(cur, company_id: int, settlement_date) -> list:
    '''
    Успешные карточные (не СБП) платежи компании за день продаж. Дата платежа -
    дата пробитого чека, если он привязан, иначе дата вебхука (как в сверке).
    '''
    cur.execute(f'''
        WITH latest AS (
            SELECT DISTINCT ON (wp.integration_id, wp.payment_id)
                wp.id, wp.amount, wp.status, wp.payment_provider,
                COALESCE(er.doc_datetime, wp.created_at)::date AS pay_date
            FROM {SCHEMA}.webhook_payments wp
            JOIN {SCHEMA}.user_integrations ui ON ui.id = wp.integration_id
            JOIN {SCHEMA}.integration_providers p ON p.id = ui.provider_id
            JOIN {SCHEMA}.integration_categories c ON c.id = p.category_id
            LEFT JOIN {SCHEMA}.ecomkassa_receipts er ON er.id = wp.receipt_id
            WHERE wp.company_id = %s AND c.slug = 'payments'
              AND wp.removed_at IS NULL AND ui.status = 'active'
            ORDER BY wp.integration_id, wp.payment_id, wp.created_at DESC
        )
        SELECT id, amount FROM latest
        WHERE pay_date = %s
          AND status IN ('AUTHORIZED', 'CONFIRMED')
          AND COALESCE(payment_provider, '') NOT ILIKE '%%SBP%%'
        ORDER BY id
    ''', (company_id, settlement_date))
    return cur.fetchall()


def process_acquiring_settlements(cur, integration_id: int, company_id: int, provider_slug: str) -> int:
    '''
    Зачисление классического эквайринга приходит на следующий день(и) одной
    суммой за весь день продаж, уже за вычетом комиссии, а в назначении банк
    пишет "за ДД.ММ.ГГГГ" и "Справочно: сумма комиссии X руб". Для каждого
    такого зачисления:
    1) проставляем settlement_date - день продаж, к которому относятся деньги
       (сверка считает их за этот день, а не за день поступления);
    2) создаём отдельную строку комиссии (direction='out', parent_transaction_id
       = зачисление) - чтобы в группе транзакций было видно: платёж 2500 =
       зачисление 2420 + комиссия 80. Это расчётная строка, реального списания
       со счёта нет, поэтому сверка её не суммирует (см. reconciliation-stats);
    3) привязываем зачисление к карточным платежам того дня, но только если их
       сумма точно равна зачислению + комиссии - иначе связь не ставим, и
       расхождение остаётся видимым.
    Идемпотентно: повторная синхронизация ничего не задваивает.
    Returns: число новых строк комиссии.
    '''
    cur.execute(f'''
        SELECT id, external_transaction_id, operation_date, amount, purpose, linked_payment_id
        FROM {SCHEMA}.bank_statement_transactions
        WHERE integration_id = %s AND company_id = %s
          AND direction = 'in' AND removed_at IS NULL
          AND parent_transaction_id IS NULL
          AND purpose ILIKE '%%сумма комиссии%%'
    ''', (integration_id, company_id))
    deposits = cur.fetchall()

    created = 0
    for dep_id, ext_id, op_date, amount, purpose, linked_payment_id in deposits:
        settlement_date, commission = parse_settlement(purpose or '')
        if not settlement_date or commission is None:
            continue

        cur.execute(f'''
            UPDATE {SCHEMA}.bank_statement_transactions
            SET settlement_date = %s, commission_amount = %s, commission_source = 'purpose'
            WHERE id = %s
        ''', (settlement_date, commission, dep_id))

        cur.execute(f'''
            INSERT INTO {SCHEMA}.bank_statement_transactions (
                integration_id, company_id, provider_slug, external_transaction_id,
                operation_date, amount, direction, counterparty_name, purpose,
                parent_transaction_id, settlement_date, commission_amount, commission_source, origin
            ) VALUES (%s, %s, %s, %s, %s, %s, 'out', %s, %s, %s, %s, %s, 'purpose', 'sync')
            ON CONFLICT (integration_id, external_transaction_id) DO NOTHING
            RETURNING id
        ''', (
            integration_id, company_id, provider_slug, f'{ext_id}:commission',
            op_date, commission, 'Комиссия эквайринга',
            f'Комиссия эквайринга за {settlement_date.strftime("%d.%m.%Y")} (удержана банком из зачисления {amount} руб.)',
            dep_id, settlement_date, commission
        ))
        if cur.fetchone():
            created += 1

        if linked_payment_id:
            continue

        payments = find_card_payments(cur, company_id, settlement_date)
        if not payments:
            continue
        gross = Decimal(str(amount)) + commission
        payments_sum = sum(Decimal(str(a)) for _, a in payments)
        if abs(payments_sum - gross) >= Decimal('0.01'):
            continue

        cur.execute(f'''
            UPDATE {SCHEMA}.bank_statement_transactions
            SET linked_payment_id = %s
            WHERE id = %s
        ''', (payments[0][0], dep_id))

        # Остальные платежи того же дня (если их несколько) объединяем с
        # зачислением в одну группу через общую таблицу связей.
        if len(payments) > 1:
            group_id = f'00000000-0000-4000-8000-{dep_id:012d}'
            members = [('money', provider_slug, dep_id)]
            for pay_id, _ in payments:
                cur.execute(f'''
                    SELECT p.slug FROM {SCHEMA}.webhook_payments wp
                    JOIN {SCHEMA}.user_integrations ui ON ui.id = wp.integration_id
                    JOIN {SCHEMA}.integration_providers p ON p.id = ui.provider_id
                    WHERE wp.id = %s
                ''', (pay_id,))
                row = cur.fetchone()
                if row:
                    members.append(('payment', row[0], pay_id))
            for tx_type, tx_source, tx_id in members:
                cur.execute(f'''
                    INSERT INTO {SCHEMA}.manual_transaction_links
                        (company_id, link_group_id, tx_type, tx_source, tx_id)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (company_id, tx_type, tx_source, tx_id) DO NOTHING
                ''', (company_id, group_id, tx_type, tx_source, tx_id))

    return created
