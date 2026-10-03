import json
import os
import uuid

import psycopg2
from typing import Any, Dict, List
from auth_guard import guard

SCHEMA = 't_p83864310_fintech_payment_reco'

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
}

ALLOWED_TYPES = {'payment', 'receipt_ofd', 'receipt_kassa', 'receipt_order', 'money', 'crm_deal'}


def response(status: int, body: Dict[str, Any]) -> Dict[str, Any]:
    return {
        'statusCode': status,
        'headers': {**CORS_HEADERS, 'Content-Type': 'application/json'},
        'body': json.dumps(body, ensure_ascii=False),
        'isBase64Encoded': False
    }


def validate_items(items: Any) -> List[Dict[str, Any]]:
    '''Проверяет и нормализует список {type, source, id} из тела запроса.'''
    if not isinstance(items, list):
        raise ValueError('items must be a list')
    result = []
    for item in items:
        if not isinstance(item, dict):
            raise ValueError('each item must be an object')
        t = item.get('type')
        s = item.get('source')
        i = item.get('id')
        if t not in ALLOWED_TYPES:
            raise ValueError(f'invalid type: {t}')
        if not s or not isinstance(s, str):
            raise ValueError('source is required')
        try:
            i = int(i)
        except (TypeError, ValueError):
            raise ValueError('id must be an integer')
        result.append({'type': t, 'source': s, 'id': i})
    return result


def detach_one(cur, conn, company_id: Any, target: Dict[str, Any]) -> Dict[str, Any]:
    '''Выводит ОДНУ транзакцию из её группы, не трогая остальных участников.'''
    key = (company_id, target['type'], target['source'], target['id'])

    cur.execute(f'''
        DELETE FROM {SCHEMA}.manual_transaction_links
        WHERE company_id = %s AND tx_type = %s AND tx_source = %s AND tx_id = %s
        RETURNING link_group_id
    ''', key)
    row = cur.fetchone()
    if row:
        # В ручной группе остался один участник - группа больше не имеет смысла.
        cur.execute(f'''
            DELETE FROM {SCHEMA}.manual_transaction_links
            WHERE company_id = %s AND link_group_id = %s::uuid
              AND (SELECT COUNT(*) FROM {SCHEMA}.manual_transaction_links
                   WHERE company_id = %s AND link_group_id = %s::uuid) < 2
        ''', (company_id, row[0], company_id, row[0]))

    # Отметка "не связывать автоматически" - иначе автосвязь (по реквизитам
    # чека/платежа) сразу вернула бы запись обратно в группу.
    cur.execute(f'''
        INSERT INTO {SCHEMA}.transaction_link_exclusions (company_id, tx_type, tx_source, tx_id)
        VALUES (%s, %s, %s, %s)
        ON CONFLICT (company_id, tx_type, tx_source, tx_id) DO NOTHING
    ''', key)

    conn.commit()
    return response(200, {'success': True})


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Ручная связка транзакций пользователем в реестре "Транзакции" - кнопка
    "Связать", появляется когда выбрано 2+ транзакций галочками.
    POST: создаёт новую группу связи (manual_transaction_links) - каждая
    переданная транзакция (type/source/id) становится членом одной группы
    с link_group_id. Если кто-то из выбранных уже состоит в ручной группе -
    все такие группы сливаются в одну вместе с новыми записями (связь
    только добавляется, существующие члены групп не теряются).
    DELETE с mode='detach': выводит из группы ОДНУ запись (item) - снимает её
    ручную связь и запрещает автосвязь для неё; остальные участники группы
    остаются связанными. Повторное "Связать" снимает этот запрет.
    DELETE без mode: разрывает ручную связь - удаляет ВСЮ группу (все транзакции с
    тем же link_group_id), которой принадлежит указанная транзакция. Это
    осознанное решение - "разорвать связь" для пользователя означает разбить
    группу целиком, а не выкинуть из неё одну запись (для этого есть кнопка
    "Удалить" самой транзакции).
    Args (POST body): company_id (обязателен), items[] ([{type, source, id}],
    минимум 2 элемента)
    Args (DELETE body): company_id (обязателен), item ({type, source, id}) -
    любая транзакция из группы, которую нужно разорвать
    Returns: POST - {success, link_group_id}; DELETE - {success, removed_count}
    '''
    denied = guard(event)
    if denied:
        return denied


    method = event.get('httpMethod', 'POST')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': '', 'isBase64Encoded': False}

    if method not in ('POST', 'DELETE'):
        return response(405, {'error': 'Method not allowed'})

    body = json.loads(event.get('body', '{}') or '{}')
    company_id = body.get('company_id')

    if not company_id:
        return response(400, {'error': 'company_id required'})

    dsn = os.environ['DATABASE_URL']
    conn = psycopg2.connect(dsn)
    cur = conn.cursor()

    try:
        if method == 'POST':
            try:
                items = validate_items(body.get('items'))
            except ValueError as e:
                return response(400, {'error': str(e)})

            if len(items) < 2:
                return response(400, {'error': 'Нужно выбрать минимум 2 транзакции для связи'})

            # Если кто-то из выбранных уже состоит в ручных группах - НЕ
            # перезаписываем его привязку (иначе он выпадает из старой группы
            # и "отрывает" остальных её членов), а СЛИВАЕМ все эти группы
            # и новые записи в одну.
            existing_groups: List[str] = []
            for item in items:
                cur.execute(f'''
                    SELECT link_group_id::text FROM {SCHEMA}.manual_transaction_links
                    WHERE company_id = %s AND tx_type = %s AND tx_source = %s AND tx_id = %s
                ''', (company_id, item['type'], item['source'], item['id']))
                row = cur.fetchone()
                if row and row[0] not in existing_groups:
                    existing_groups.append(row[0])

            group_id = existing_groups[0] if existing_groups else str(uuid.uuid4())
            # Сливаем по одной группе, с явным приведением к uuid: передача
            # списка через ANY(...) в этом окружении падает с "object not found".
            for old_group in existing_groups[1:]:
                cur.execute(f'''
                    UPDATE {SCHEMA}.manual_transaction_links
                    SET link_group_id = %s::uuid
                    WHERE company_id = %s AND link_group_id = %s::uuid
                ''', (group_id, company_id, old_group))

            for item in items:
                # Явная связка пользователем снимает прежний "вывод из группы".
                cur.execute(f'''
                    DELETE FROM {SCHEMA}.transaction_link_exclusions
                    WHERE company_id = %s AND tx_type = %s AND tx_source = %s AND tx_id = %s
                ''', (company_id, item['type'], item['source'], item['id']))
                cur.execute(f'''
                    INSERT INTO {SCHEMA}.manual_transaction_links
                        (company_id, link_group_id, tx_type, tx_source, tx_id)
                    VALUES (%s, %s::uuid, %s, %s, %s)
                    ON CONFLICT (company_id, tx_type, tx_source, tx_id) DO UPDATE SET
                        link_group_id = EXCLUDED.link_group_id,
                        created_at = NOW()
                ''', (company_id, group_id, item['type'], item['source'], item['id']))

            conn.commit()
            return response(200, {'success': True, 'link_group_id': group_id})

        # DELETE - разорвать группу, которой принадлежит указанная транзакция
        item = body.get('item')
        if not isinstance(item, dict):
            return response(400, {'error': 'item required'})
        try:
            items = validate_items([item])
        except ValueError as e:
            return response(400, {'error': str(e)})
        target = items[0]

        if body.get('mode') == 'detach':
            return detach_one(cur, conn, company_id, target)

        cur.execute(f'''
            SELECT link_group_id::text FROM {SCHEMA}.manual_transaction_links
            WHERE company_id = %s AND tx_type = %s AND tx_source = %s AND tx_id = %s
        ''', (company_id, target['type'], target['source'], target['id']))
        row = cur.fetchone()

        if not row:
            return response(404, {'error': 'Ручная связь для этой транзакции не найдена'})

        group_id = row[0]
        cur.execute(f'''
            DELETE FROM {SCHEMA}.manual_transaction_links
            WHERE company_id = %s AND link_group_id = %s::uuid
        ''', (company_id, group_id))
        removed_count = cur.rowcount

        conn.commit()
        return response(200, {'success': True, 'removed_count': removed_count})

    except Exception as e:
        conn.rollback()
        print(f'transactions-link error: {type(e).__name__}: {e}')
        return response(500, {'error': str(e).strip(), 'error_type': type(e).__name__, 'pgcode': getattr(e, 'pgcode', None)})
    finally:
        cur.close()
        conn.close()