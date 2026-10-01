import json
import os
import urllib.request
from typing import Any, Dict, List

import psycopg2

SCHEMA = 't_p83864310_fintech_payment_reco'

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-User-Id',
    'Access-Control-Max-Age': '86400'
}


# Виды уведомлений, на которые сотрудник может подписаться (дубль в мессенджер/почту).
KINDS = {
    'automation_failed': 'Сценарий автоматизации не выполнен',
}
CHANNELS = {'max': 'ek_max', 'whatsapp': 'ek_wa', 'telegram': 'ek_tg', 'email': 'ek_email'}
SEND_URL = 'https://functions.poehali.dev/ace36e55-b169-41f2-9d2b-546f92221bb7'


def send(channel: str, recipient: str, text: str) -> str:
    '''Отправка через сервис сообщений. Returns: текст ошибки или "".'''
    api_key = os.environ.get('MESSENGER_API_KEY', '')
    if not api_key:
        return 'MESSENGER_API_KEY не настроен'
    req = urllib.request.Request(
        SEND_URL,
        data=json.dumps({'provider': CHANNELS[channel], 'recipient': recipient, 'message': text}).encode('utf-8'),
        headers={'Content-Type': 'application/json', 'X-Api-Key': api_key},
        method='POST'
    )
    try:
        urllib.request.urlopen(req, timeout=8).close()
        return ''
    except Exception as e:
        return str(e)[:500]


def recipient_of(channel: str, phone: str, email: str) -> str:
    '''Мессенджеры - на номер входа в кабинет, почта - на email из профиля.'''
    if channel == 'email':
        return email or ''
    return ''.join(ch for ch in (phone or '') if ch.isdigit())


def dispatch(cur, conn, company_id=None, limit: int = 5) -> Dict[str, int]:
    '''Отправляет ожидающие доставки (по 5 за вызов - укладываемся в таймаут функции).'''
    where = "d.status = 'pending'"
    args: List[Any] = []
    if company_id:
        where += ' AND n.company_id = %s'
        args.append(company_id)
    cur.execute(f'''
        UPDATE {SCHEMA}.notification_deliveries u SET status = 'sending', updated_at = NOW()
        FROM (
            SELECT d.id FROM {SCHEMA}.notification_deliveries d
            JOIN {SCHEMA}.notifications n ON n.id = d.notification_id
            WHERE {where} ORDER BY d.id LIMIT {limit} FOR UPDATE SKIP LOCKED
        ) c WHERE u.id = c.id
        RETURNING u.id
    ''', args)
    ids = [r[0] for r in cur.fetchall()]
    conn.commit()
    result = {'sent': 0, 'failed': 0}
    for delivery_id in ids:
        cur.execute(f'''
            SELECT d.channel, u.phone, u.email, n.title, n.message, c.name
            FROM {SCHEMA}.notification_deliveries d
            JOIN {SCHEMA}.notifications n ON n.id = d.notification_id
            JOIN {SCHEMA}.app_users u ON u.id = d.user_id
            LEFT JOIN {SCHEMA}.companies c ON c.id = n.company_id
            WHERE d.id = %s
        ''', (delivery_id,))
        channel, phone, email, title, message, company_name = cur.fetchone()
        to = recipient_of(channel, phone, email)
        error = 'Не указан адрес получателя' if not to else send(
            channel, to, f'{title} · {company_name or "Сверка"}\n\n{message}')
        cur.execute(f'''
            UPDATE {SCHEMA}.notification_deliveries SET status = %s, error = %s, updated_at = NOW() WHERE id = %s
        ''', ('failed' if error else 'sent', error or None, delivery_id))
        conn.commit()
        result['failed' if error else 'sent'] += 1
    return result


def respond(status: int, payload: Dict[str, Any]) -> Dict[str, Any]:
    return {
        'statusCode': status,
        'headers': {**CORS_HEADERS, 'Content-Type': 'application/json'},
        'body': json.dumps(payload, ensure_ascii=False, default=str),
        'isBase64Encoded': False
    }


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Уведомления в кабинете компании. Прочтение и скрытие - у каждого сотрудника своё.
    GET ?company_id=&user_id=[&unread=1][&limit=] - список и счётчик непрочитанных
    POST {action: "read", company_id, user_id, ids?} - отметить прочитанными (без ids - все)
    POST {action: "hide", company_id, user_id, id} - убрать уведомление из своего списка
    GET ?company_id=&user_id=&prefs=1 - мои настройки дублирования (канал, виды)
    POST {action: "save_prefs", company_id, user_id, channel, kinds} - сохранить настройки
    POST {action: "test", company_id, user_id, channel} - тестовое сообщение себе
    POST {action: "dispatch", company_id?} - отправить ожидающие дубли уведомлений
    '''
    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': '', 'isBase64Encoded': False}

    params = event.get('queryStringParameters') or {}
    body = json.loads(event.get('body') or '{}') if method == 'POST' else {}

    if method == 'POST' and body.get('action') == 'dispatch':
        conn = psycopg2.connect(os.environ['DATABASE_URL'])
        cur = conn.cursor()
        try:
            return respond(200, {'success': True, **dispatch(cur, conn, body.get('company_id'))})
        finally:
            cur.close()
            conn.close()

    company_id = body.get('company_id') or params.get('company_id')
    user_id = body.get('user_id') or params.get('user_id')
    if not company_id or not user_id:
        return respond(400, {'error': 'company_id and user_id required'})

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    try:
        if method == 'POST':
            action = body.get('action')
            if action == 'read':
                ids = [int(i) for i in body.get('ids') or []]
                id_filter = 'AND n.id = ANY(%s)' if ids else ''
                args = [user_id, company_id] + ([ids] if ids else [])
                cur.execute(f'''
                    INSERT INTO {SCHEMA}.notification_reads (notification_id, user_id)
                    SELECT n.id, %s FROM {SCHEMA}.notifications n
                    WHERE n.company_id = %s {id_filter}
                    ON CONFLICT (notification_id, user_id) DO NOTHING
                ''', args)
                conn.commit()
                return respond(200, {'success': True})
            if action == 'hide':
                cur.execute(f'''
                    INSERT INTO {SCHEMA}.notification_reads (notification_id, user_id, hidden)
                    SELECT n.id, %s, TRUE FROM {SCHEMA}.notifications n WHERE n.id = %s AND n.company_id = %s
                    ON CONFLICT (notification_id, user_id) DO UPDATE SET hidden = TRUE
                ''', (user_id, body.get('id'), company_id))
                conn.commit()
                return respond(200, {'success': True})
            if action == 'save_prefs':
                channel = body.get('channel') or None
                if channel and channel not in CHANNELS:
                    return respond(400, {'error': 'Неизвестный канал'})
                kinds = [k for k in body.get('kinds') or [] if k in KINDS]
                cur.execute(f'''
                    INSERT INTO {SCHEMA}.notification_preferences (company_id, user_id, channel, kinds)
                    VALUES (%s, %s, %s, %s)
                    ON CONFLICT (company_id, user_id) DO UPDATE SET
                        channel = EXCLUDED.channel, kinds = EXCLUDED.kinds, updated_at = NOW()
                ''', (company_id, user_id, channel, json.dumps(kinds)))
                conn.commit()
                return respond(200, {'success': True})
            if action == 'test':
                channel = body.get('channel')
                if channel not in CHANNELS:
                    return respond(400, {'error': 'Выберите канал'})
                cur.execute(f'SELECT phone, email FROM {SCHEMA}.app_users WHERE id = %s', (user_id,))
                row = cur.fetchone()
                to = recipient_of(channel, row[0] if row else '', row[1] if row else '')
                if not to:
                    return respond(400, {'error': 'В профиле не указан email' if channel == 'email' else 'В профиле нет номера'})
                error = send(channel, to, 'Проверка уведомлений Сверки: сообщения будут приходить сюда.')
                if error:
                    return respond(502, {'error': f'Не удалось отправить: {error}'})
                return respond(200, {'success': True})
            return respond(400, {'error': 'Unknown action'})

        if method != 'GET':
            return respond(405, {'error': 'Method not allowed'})

        if params.get('prefs') == '1':
            cur.execute(f'''
                SELECT p.channel, p.kinds, u.phone, u.email
                FROM {SCHEMA}.app_users u
                LEFT JOIN {SCHEMA}.notification_preferences p ON p.user_id = u.id AND p.company_id = %s
                WHERE u.id = %s
            ''', (company_id, user_id))
            r = cur.fetchone()
            return respond(200, {
                'success': True,
                'channel': r[0] if r else None,
                'kinds': (r[1] if r else None) or [],
                'phone': r[2] if r else None,
                'email': r[3] if r else None,
                'catalog': [{'kind': k, 'label': v} for k, v in KINDS.items()]
            })

        limit = min(int(params.get('limit', 100)), 300)
        unread_filter = 'AND r.read_at IS NULL' if params.get('unread') == '1' else ''
        cur.execute(f'''
            SELECT n.id, n.kind, n.level, n.title, n.message, n.link_module, n.entity_type, n.entity_id,
                   n.payload, n.created_at, r.read_at IS NOT NULL
            FROM {SCHEMA}.notifications n
            LEFT JOIN {SCHEMA}.notification_reads r ON r.notification_id = n.id AND r.user_id = %s
            WHERE n.company_id = %s AND COALESCE(r.hidden, FALSE) = FALSE {unread_filter}
            ORDER BY n.created_at DESC, n.id DESC LIMIT {limit}
        ''', (user_id, company_id))
        items = [{
            'id': r[0], 'kind': r[1], 'level': r[2], 'title': r[3], 'message': r[4],
            'link_module': r[5], 'entity_type': r[6], 'entity_id': r[7], 'payload': r[8],
            'created_at': r[9], 'read': r[10]
        } for r in cur.fetchall()]
        cur.execute(f'''
            SELECT COUNT(*) FROM {SCHEMA}.notifications n
            LEFT JOIN {SCHEMA}.notification_reads r ON r.notification_id = n.id AND r.user_id = %s
            WHERE n.company_id = %s AND r.notification_id IS NULL
        ''', (user_id, company_id))
        unread = cur.fetchone()[0]
        return respond(200, {'success': True, 'notifications': items, 'unread': unread})
    finally:
        cur.close()
        conn.close()
