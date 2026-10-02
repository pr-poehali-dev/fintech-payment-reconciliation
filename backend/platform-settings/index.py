import json
import re
import os
import socket
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

import psycopg2

SCHEMA = 't_p83864310_fintech_payment_reco'

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Cron-Token',
    'Access-Control-Max-Age': '86400'
}

# Фоновые задачи по каждой компании - то, что сейчас запускается входом в
# кабинет и открытием страниц. При включённом cron их вызывает планировщик.
JOBS_URL = 'https://functions.poehali.dev/22902813-812b-495a-9ea0-8497b880c461'
RESYNC_URL = 'https://functions.poehali.dev/0b50cd7c-94bc-4be9-824a-0bb119c6adef'
TICK_BATCH = 15
FETCH_ORDERS_URL = 'https://functions.poehali.dev/dc01171b-cd60-4a98-b96c-5d167bc1add8'
# Окно авто-дозагрузки Екомкассы: документы, обновлённые за последние N часов.
ECOMKASSA_AUTO_HOURS = 24

# Интервал (мин) для внешнего планировщика - показывается в админке.
CRON_INTERVAL_MIN = 1


def respond(status: int, payload: Dict[str, Any]) -> Dict[str, Any]:
    return {
        'statusCode': status,
        'headers': {**CORS_HEADERS, 'Content-Type': 'application/json'},
        'body': json.dumps(payload, ensure_ascii=False, default=str),
        'isBase64Encoded': False
    }


def is_admin(cur, user_id) -> bool:
    cur.execute(f'''
        SELECT 1 FROM {SCHEMA}.company_users cu
        JOIN {SCHEMA}.companies c ON c.id = cu.company_id
        WHERE cu.user_id = %s AND cu.status = 'active' AND c.is_platform_admin = true
          AND (cu.platform_admin OR cu.role_id IN (SELECT id FROM {SCHEMA}.roles WHERE slug = 'owner'))
    ''', (user_id,))
    return cur.fetchone() is not None


def load_settings(cur) -> Dict[str, Any]:
    cur.execute(f'''
        SELECT s.managing_company_id, c.name, c.inn, s.cron_enabled, s.cron_token,
               s.cron_last_tick_at, s.cron_last_result, s.updated_at, s.metrika_counter_id
        FROM {SCHEMA}.platform_settings s
        LEFT JOIN {SCHEMA}.companies c ON c.id = s.managing_company_id
        WHERE s.id = 1
    ''')
    r = cur.fetchone()
    return {
        'managing_company_id': r[0], 'managing_company_name': r[1], 'managing_company_inn': r[2],
        'cron_enabled': r[3], 'cron_token': r[4], 'cron_last_tick_at': r[5],
        'cron_last_result': r[6], 'updated_at': r[7], 'metrika_counter_id': r[8]
    }


def call(url: str, body: Dict[str, Any], timeout: float) -> Optional[str]:
    '''
    Запускает задачу функции, не дожидаясь её конца: тайм-аут ожидания ответа -
    это «задача запущена и работает», а не ошибка. Ошибка - только отказ сразу
    (функция недоступна, ответ с ошибкой).
    '''
    try:
        req = urllib.request.Request(url, data=json.dumps(body).encode('utf-8'),
                                     headers={'Content-Type': 'application/json'}, method='POST')
        urllib.request.urlopen(req, timeout=timeout).close()
        return None
    except (socket.timeout, TimeoutError):
        return None
    except urllib.error.URLError as e:
        if isinstance(e.reason, (socket.timeout, TimeoutError)):
            return None
        return str(e)[:200]
    except Exception as e:
        return str(e)[:200]


def tick(cur, conn, settings: Dict[str, Any]) -> Dict[str, Any]:
    '''
    Один шаг планировщика: по каждой компании с активными интеграциями -
    очередь автоматизации (+ дубли уведомлений и проверка «платежи без чека за
    вчера») и дозагрузка непробитых чеков Екомкассы. Все вызовы параллельно,
    не дожидаясь их окончания. Компаний больше TICK_BATCH - берём по кругу,
    следующая порция - на следующем шаге.
    '''
    cur.execute(f'''
        SELECT c.id FROM {SCHEMA}.companies c
        WHERE c.status = 'active'
          AND EXISTS (SELECT 1 FROM {SCHEMA}.user_integrations ui
                      WHERE ui.company_id = c.id AND ui.status = 'active')
        ORDER BY c.id
    ''')
    all_ids = [r[0] for r in cur.fetchall()]
    offset = int((settings.get('cron_last_result') or {}).get('next_offset') or 0)
    if offset >= len(all_ids):
        offset = 0
    company_ids = all_ids[offset:offset + TICK_BATCH]
    next_offset = offset + TICK_BATCH if offset + TICK_BATCH < len(all_ids) else 0

    ecomkassa_ids = set()
    if company_ids:
        cur.execute(f'''
            SELECT DISTINCT ui.company_id FROM {SCHEMA}.user_integrations ui
            JOIN {SCHEMA}.integration_providers p ON p.id = ui.provider_id
            WHERE p.slug = 'ecomkassa' AND ui.status = 'active' AND ui.company_id = ANY(%s)
        ''', (company_ids,))
        ecomkassa_ids = {r[0] for r in cur.fetchall()}

    tasks = []
    for company_id in company_ids:
        if company_id in ecomkassa_ids:
            # Новые счета/заказы/чеки Екомкассы (и платежи шлюза по ним), если живой хук не пришёл.
            tasks.append((company_id, FETCH_ORDERS_URL, {
                'company_id': company_id, 'auto_hours': ECOMKASSA_AUTO_HOURS,
                'order_types': ['INVC', 'CORD', 'VCHR'], 'statuses': ['PAID', 'COMPLETED'], 'batch_size': 30
            }))
        tasks.append((company_id, JOBS_URL, {'action': 'run', 'company_id': company_id, 'heartbeat': True}))
        tasks.append((company_id, RESYNC_URL, {'company_id': company_id}))
    errors: Dict[int, List[str]] = {}
    if tasks:
        with ThreadPoolExecutor(max_workers=len(tasks)) as pool:
            for (company_id, _, _), err in zip(tasks, pool.map(lambda t: call(t[1], t[2], 2.5), tasks)):
                if err:
                    errors.setdefault(company_id, []).append(err)
    summary = {'companies': len(company_ids), 'total_companies': len(all_ids), 'failed': len(errors),
               'errors': [{'company_id': k, 'errors': v} for k, v in list(errors.items())[:5]],
               'next_offset': next_offset}
    cur.execute(f'''
        UPDATE {SCHEMA}.platform_settings SET cron_last_tick_at = NOW(), cron_last_result = %s WHERE id = 1
    ''', (json.dumps(summary, ensure_ascii=False),))
    conn.commit()
    return summary


def check_cron(settings: Dict[str, Any]) -> List[str]:
    '''Почему автоматический режим может не работать - для сообщения в админке.'''
    problems = []
    if not settings['cron_enabled']:
        return problems
    last = settings['cron_last_tick_at']
    fallback = ' Пока это так, задачи запускаются по-старому - из кабинетов клиентов.'
    if not last:
        problems.append('Планировщик ещё ни разу не вызывал запуск: задание на сервере не настроено. '
                        f'Добавьте его (раз в {CRON_INTERVAL_MIN} мин) по команде ниже.' + fallback)
    elif last < datetime.utcnow() - timedelta(minutes=5):
        problems.append(f'Планировщик не запускался с {last:%d.%m.%Y %H:%M} UTC - проверьте задание на сервере.' + fallback)
    result = settings.get('cron_last_result') or {}
    if result.get('failed'):
        problems.append(f"При последнем запуске были ошибки у компаний: {result['failed']} из {result.get('companies')}.")
    return problems


def is_platform_owner(cur, user_id) -> bool:
    cur.execute(f'''
        SELECT 1 FROM {SCHEMA}.company_users cu
        JOIN {SCHEMA}.companies c ON c.id = cu.company_id
        WHERE cu.user_id = %s AND cu.status = 'active' AND c.is_platform_admin = true
          AND cu.role_id IN (SELECT id FROM {SCHEMA}.roles WHERE slug = 'owner')
    ''', (user_id,))
    return cur.fetchone() is not None


def platform_members(cur) -> List[Dict[str, Any]]:
    '''Сотрудники компании платформы и их доступ к админке (владелец - всегда).'''
    cur.execute(f'''
        SELECT u.id, u.full_name, u.phone, u.email, r.slug, r.name, cu.platform_admin
        FROM {SCHEMA}.company_users cu
        JOIN {SCHEMA}.companies c ON c.id = cu.company_id AND c.is_platform_admin = true
        JOIN {SCHEMA}.app_users u ON u.id = cu.user_id
        JOIN {SCHEMA}.roles r ON r.id = cu.role_id
        WHERE cu.status = 'active'
        ORDER BY (r.slug = 'owner') DESC, u.full_name NULLS LAST, u.id
    ''')
    return [{'user_id': r[0], 'full_name': r[1], 'phone': r[2], 'email': r[3], 'role_slug': r[4],
             'role_name': r[5], 'is_owner': r[4] == 'owner', 'admin': r[4] == 'owner' or bool(r[6])}
            for r in cur.fetchall()]


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Настройки платформы (только для администраторов платформы) и точка запуска
    фоновых задач по расписанию.
    GET ?requester_user_id= - настройки + список компаний для выбора управляющей
    GET ?public=1 - номер счётчика Яндекс Метрики (без авторизации)
    POST {action: "save", requester_user_id, managing_company_id, cron_enabled, metrika_counter_id}
    GET ?requester_user_id=&section=admins - сотрудники компании платформы и доступ к админке
    POST {action: "set_admin", requester_user_id, user_id, enabled} - дать/забрать доступ (только владелец)
    POST {action: "tick"} + заголовок X-Cron-Token - шаг планировщика по всем компаниям
         (работает, только если включён режим cron)
    '''
    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': '', 'isBase64Encoded': False}

    params = event.get('queryStringParameters') or {}
    body = json.loads(event.get('body') or '{}') if method == 'POST' else {}
    headers = {k.lower(): v for k, v in (event.get('headers') or {}).items()}

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    try:
        settings = load_settings(cur)

        if method == 'POST' and body.get('action') == 'tick':
            token = headers.get('x-cron-token') or body.get('token')
            if not token or token != settings['cron_token']:
                return respond(403, {'error': 'Неверный ключ планировщика'})
            if not settings['cron_enabled']:
                return respond(409, {'error': 'Автоматический режим (cron) выключен в настройках платформы'})
            return respond(200, {'success': True, **tick(cur, conn, settings)})

        # Публично: номер счётчика Яндекс Метрики - сайт подключает его при загрузке.
        if method == 'GET' and params.get('public') == '1':
            return respond(200, {'success': True, 'metrika_counter_id': settings.get('metrika_counter_id')})

        requester = body.get('requester_user_id') or params.get('requester_user_id')
        if not requester or not is_admin(cur, requester):
            return respond(403, {'error': 'Доступно только администраторам платформы'})

        if method == 'GET' and params.get('section') == 'admins':
            return respond(200, {'success': True, 'members': platform_members(cur),
                                 'can_manage': is_platform_owner(cur, requester)})

        if method == 'POST' and body.get('action') == 'set_admin':
            if not is_platform_owner(cur, requester):
                return respond(403, {'error': 'Назначать администраторов может только владелец компании платформы'})
            cur.execute(f'''
                UPDATE {SCHEMA}.company_users cu SET platform_admin = %s, updated_at = NOW()
                FROM {SCHEMA}.companies c
                WHERE cu.company_id = c.id AND c.is_platform_admin = true
                  AND cu.user_id = %s AND cu.status = 'active'
                  AND cu.role_id NOT IN (SELECT id FROM {SCHEMA}.roles WHERE slug = 'owner')
                RETURNING cu.id
            ''', (bool(body.get('enabled')), body.get('user_id')))
            if not cur.fetchone():
                conn.rollback()
                return respond(404, {'error': 'Сотрудник не найден в компании платформы'})
            conn.commit()
            return respond(200, {'success': True, 'members': platform_members(cur), 'can_manage': True})

        if method == 'POST':
            if body.get('action') != 'save':
                return respond(400, {'error': 'Unknown action'})
            company_id = body.get('managing_company_id')
            if company_id:
                cur.execute(f'SELECT 1 FROM {SCHEMA}.companies WHERE id = %s', (company_id,))
                if not cur.fetchone():
                    return respond(400, {'error': 'Компания не найдена'})
            metrika = re.sub(r'\D', '', str(body.get('metrika_counter_id') or ''))[:20] or None
            cur.execute(f'''
                UPDATE {SCHEMA}.platform_settings
                SET managing_company_id = %s, cron_enabled = %s, metrika_counter_id = %s,
                    updated_by = %s, updated_at = NOW()
                WHERE id = 1
            ''', (company_id or None, bool(body.get('cron_enabled')), metrika, requester))
            conn.commit()
            settings = load_settings(cur)

        cur.execute(f'''
            SELECT id, name, inn FROM {SCHEMA}.companies WHERE status = 'active' ORDER BY name
        ''')
        companies = [{'id': r[0], 'name': r[1], 'inn': r[2]} for r in cur.fetchall()]
        return respond(200, {
            'success': True,
            'settings': settings,
            'companies': companies,
            'cron_interval_min': CRON_INTERVAL_MIN,
            'cron_problems': check_cron(settings)
        })
    finally:
        cur.close()
        conn.close()
