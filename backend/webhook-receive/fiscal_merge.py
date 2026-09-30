from typing import List, Tuple

SCHEMA = 't_p83864310_fintech_payment_reco'

# Один физический чек может прийти двумя событиями: от Т-Банка (уведомление
# RECEIPT) и от Екомкассы (колбэк/отчёт кассы). Это один документ, узнаём его
# по фискальной тройке ФН + ФД + ФП. Основным остаётся чек Екомкассы (в нём
# тип документа и провайдер оплаты), чек Т-Банка помечается как слитый.
TRIPLET_EQ = '''
    (t.raw_data->'payload'->>'fn_number') = (e.raw_data->'payload'->>'fn_number')
    AND (t.raw_data->'payload'->>'fiscal_document_number') = (e.raw_data->'payload'->>'fiscal_document_number')
    AND (t.raw_data->'payload'->>'fiscal_document_attribute') = (e.raw_data->'payload'->>'fiscal_document_attribute')
    AND (e.raw_data->'payload'->>'fn_number') IS NOT NULL
    AND (e.raw_data->'payload'->>'fiscal_document_number') IS NOT NULL
    AND (e.raw_data->'payload'->>'fiscal_document_attribute') IS NOT NULL
'''


def _relink(cur, pairs: List[Tuple[int, int]]):
    for dup_id, keep_id in pairs:
        cur.execute(f'UPDATE {SCHEMA}.webhook_payments SET receipt_id = %s, updated_at = NOW() WHERE receipt_id = %s',
                    (keep_id, dup_id))
        cur.execute(f'UPDATE {SCHEMA}.payment_carts SET receipt_id = %s, updated_at = NOW() WHERE receipt_id = %s',
                    (keep_id, dup_id))


def merge_after_ecomkassa(cur, ecomkassa_receipt_id) -> int:
    '''Сохранили чек Екомкассы - сливаем с ним чек Т-Банка с той же фискальной тройкой.'''
    if not ecomkassa_receipt_id:
        return 0
    cur.execute(f'''
        UPDATE {SCHEMA}.ecomkassa_receipts t SET removed_at = NOW(), merged_into_id = e.id
        FROM {SCHEMA}.ecomkassa_receipts e
        WHERE e.id = %s AND e.source <> 'tbank' AND e.removed_at IS NULL
          AND t.source = 'tbank' AND t.company_id = e.company_id AND t.removed_at IS NULL AND t.id <> e.id
          AND {TRIPLET_EQ}
        RETURNING t.id, e.id
    ''', (ecomkassa_receipt_id,))
    pairs = cur.fetchall()
    _relink(cur, pairs)
    return len(pairs)


def merge_after_tbank(cur, tbank_receipt_id) -> int:
    '''Сохранили чек Т-Банка - если такой чек уже есть от Екомкассы, чек Т-Банка сливается в него.'''
    if not tbank_receipt_id:
        return 0
    cur.execute(f'''
        UPDATE {SCHEMA}.ecomkassa_receipts t SET removed_at = NOW(), merged_into_id = e.id
        FROM {SCHEMA}.ecomkassa_receipts e
        WHERE t.id = %s AND t.source = 'tbank' AND t.removed_at IS NULL
          AND e.source <> 'tbank' AND e.company_id = t.company_id AND e.removed_at IS NULL
          AND {TRIPLET_EQ}
        RETURNING t.id, e.id
    ''', (tbank_receipt_id,))
    pairs = cur.fetchall()[:1]
    _relink(cur, pairs)
    return pairs[0][1] if pairs else 0
