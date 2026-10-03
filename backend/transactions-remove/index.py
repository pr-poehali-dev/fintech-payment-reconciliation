import json
import os

import psycopg2
from typing import Any, Dict, List
from auth_guard import guard

SCHEMA = 't_p83864310_fintech_payment_reco'

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
}

ALLOWED_TYPES = {'payment', 'receipt_ofd', 'receipt_kassa', 'receipt_order', 'money'}

# Каждому типу транзакции соответствует своя исходная таблица - удаление
# всегда "мягкое" (removed_at = NOW()), физически строка не пропадает, т.к.
# это данные из внешних интеграций (при повторном вебхуке/дозагрузке они
# снова "появятся" в источнике, но останутся скрытыми в реестре, раз были
# явно удалены). company_id в WHERE - обязательная защита от удаления чужих
# записей по подобранному id.
TABLE_BY_TYPE = {
    'payment': ('webhook_payments', 'company_id'),
    'receipt_ofd': ('ofd_receipts', 'company_id'),
    'receipt_kassa': ('ecomkassa_receipts', 'company_id'),
    'receipt_order': ('ecomkassa_receipts', 'company_id'),
    'money': ('bank_statement_transactions', 'company_id'),
}


def response(status: int, body: Dict[str, Any]) -> Dict[str, Any]:
    return {
        'statusCode': status,
        'headers': {**CORS_HEADERS, 'Content-Type': 'application/json'},
        'body': json.dumps(body, ensure_ascii=False),
        'isBase64Encoded': False
    }


def validate_items(items: Any) -> List[Dict[str, Any]]:
    if not isinstance(items, list) or len(items) == 0:
        raise ValueError('items must be a non-empty list')
    result = []
    for item in items:
        if not isinstance(item, dict):
            raise ValueError('each item must be an object')
        t = item.get('type')
        i = item.get('id')
        if t not in ALLOWED_TYPES:
            raise ValueError(f'invalid type: {t}')
        try:
            i = int(i)
        except (TypeError, ValueError):
            raise ValueError('id must be an integer')
        result.append({'type': t, 'id': i})
    return result


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Исключение транзакций из реестра "Транзакции" - кнопка "Удалить",
    появляется когда выбрана хотя бы 1 транзакция галочкой. Работает сразу
    с несколькими выбранными записями любых разных типов за один вызов.

    ВАЖНО - это МЯГКОЕ исключение (removed_at = NOW()), НЕ физическое удаление
    строки: исходные данные (платежи, чеки, банковские операции) приходят из
    внешних интеграций (вебхуки, дозагрузка), и их потеря сломала бы историю
    и сверку. Помеченные записи просто перестают попадать в выборку
    transactions-list (WHERE removed_at IS NULL) и не участвуют в matching
    как чужая пара для других транзакций.

    УСТОЙЧИВОСТЬ: каждый элемент пачки обрабатывается своей короткой
    транзакцией БД (commit сразу после успешного UPDATE, rollback если
    строка не найдена/уже помечена/произошла ошибка) - неудача одного
    элемента никак не затрагивает уже зафиксированные изменения по другим
    id из этой же пачки; такой элемент просто попадает в список "skipped"
    в ответе, а не ломает весь запрос. Из-за company_id в WHERE невозможно
    затронуть запись, принадлежащую другой компании, даже подобрав чужой
    id - она тоже попадёт в "skipped".
    Args: company_id (обязателен), items[] ([{type, id}], минимум 1 элемент;
    type - один из payment/receipt_ofd/receipt_kassa/receipt_order/money)
    Returns: {success, removed_count, skipped: [{type, id}]}
    '''
    denied = guard(event)
    if denied:
        return denied


    method = event.get('httpMethod', 'POST')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': '', 'isBase64Encoded': False}

    if method != 'POST':
        return response(405, {'error': 'Method not allowed'})

    body = json.loads(event.get('body', '{}') or '{}')
    company_id = body.get('company_id')

    if not company_id:
        return response(400, {'error': 'company_id required'})

    try:
        items = validate_items(body.get('items'))
    except ValueError as e:
        return response(400, {'error': str(e)})

    dsn = os.environ['DATABASE_URL']
    conn = psycopg2.connect(dsn)
    cur = conn.cursor()

    try:
        removed_count = 0
        skipped: List[Dict[str, Any]] = []

        # Каждый элемент - своя короткая транзакция БД (commit/rollback сразу
        # после), а не общий SAVEPOINT на весь список: так неудача одного
        # элемента гарантированно не затрагивает уже зафиксированные
        # изменения по остальным, и не зависит от поддержки SAVEPOINT в
        # окружении выполнения функции.
        for item in items:
            table, company_col = TABLE_BY_TYPE[item['type']]
            try:
                cur.execute(f'''
                    UPDATE {SCHEMA}.{table}
                    SET removed_at = NOW()
                    WHERE id = %s AND {company_col} = %s AND removed_at IS NULL
                ''', (item['id'], company_id))
                if cur.rowcount > 0:
                    removed_count += 1
                    conn.commit()
                else:
                    skipped.append(item)
                    conn.rollback()
            except Exception:
                conn.rollback()
                skipped.append(item)
                continue

        return response(200, {
            'success': True,
            'removed_count': removed_count,
            'skipped': skipped
        })

    except Exception as e:
        conn.rollback()
        return response(500, {'error': str(e)})
    finally:
        cur.close()
        conn.close()