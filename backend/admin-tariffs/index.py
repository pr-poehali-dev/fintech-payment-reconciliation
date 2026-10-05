import json
import os
from typing import Any, Dict

import psycopg2
from auth_guard import guard

SCHEMA = 't_p83864310_fintech_payment_reco'

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
}

MODULES = {'reconciliation', 'events', 'transactions', 'automation', 'integrations', 'access', 'settings'}
LIMITS = ('max_companies', 'max_users', 'max_integrations', 'max_automations')


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


def list_tariffs(cur):
    cur.execute(f'''
        SELECT t.id, t.slug, t.name, t.description, t.price, t.billing_period, t.is_active,
               t.modules, t.max_users, t.max_integrations, t.max_automations,
               t.period_days, t.yearly_discount_percent, t.max_companies,
               (SELECT COUNT(*) FROM {SCHEMA}.subscriptions s WHERE s.tariff_id = t.id), t.trial_days
        FROM {SCHEMA}.tariffs t ORDER BY t.sort_order, t.id
    ''')
    return [{
        'id': r[0], 'slug': r[1], 'name': r[2], 'description': r[3], 'price': float(r[4]),
        'billing_period': r[5], 'is_active': r[6], 'modules': r[7] or [],
        'max_users': r[8], 'max_integrations': r[9], 'max_automations': r[10],
        'period_days': r[11], 'yearly_discount_percent': float(r[12]), 'max_companies': r[13],
        'companies_count': r[14], 'trial_days': r[15] or 0
    } for r in cur.fetchall()]


def parse_limit(value):
    '''Пусто - без ограничения (NULL), иначе целое >= 0.'''
    if value in (None, ''):
        return None
    n = int(value)
    if n < 0:
        raise ValueError
    return n


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Тарифы платформы для админки (только администраторы платформы).
    GET ?requester_user_id= - тарифы с модулями и лимитами
    POST {action: "save", requester_user_id, id, name, price, is_active, modules[],
          max_companies, max_users, max_integrations, max_automations, period_days, yearly_discount_percent, trial_days}
          - пустой лимит = без ограничения; period_days - оплачиваемый срок, trial_days - пробный период (0 - нет)
    POST {action: "set_company_tariff", requester_user_id, company_id, tariff_id} - сменить тариф компании
    POST {action: "extend_subscription", requester_user_id, company_id, period: tariff|year} - продлить подписку
    '''
    denied = guard(event, check_company=False)
    if denied:
        return denied

    method = event.get('httpMethod', 'GET')
    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': '', 'isBase64Encoded': False}

    params = event.get('queryStringParameters') or {}
    body = json.loads(event.get('body') or '{}') if method == 'POST' else {}
    requester = body.get('requester_user_id') or params.get('requester_user_id')

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    try:
        if not requester or not is_admin(cur, requester):
            return respond(403, {'error': 'Доступно только администраторам платформы'})

        if method == 'POST' and body.get('action') == 'set_company_tariff':
            # Смена тарифа компании. Пробный -> статус trial, платный -> active.
            company_id, tariff_id = body.get('company_id'), body.get('tariff_id')
            cur.execute(f'SELECT slug, name FROM {SCHEMA}.tariffs WHERE id = %s', (tariff_id,))
            tariff = cur.fetchone()
            if not company_id or not tariff:
                return respond(400, {'error': 'Укажите компанию и тариф'})
            status = 'trial' if tariff[0] == 'trial' else 'active'
            cur.execute(f'''
                UPDATE {SCHEMA}.subscriptions SET tariff_id = %s, status = %s, updated_at = NOW()
                WHERE company_id = %s RETURNING id
            ''', (tariff_id, status, company_id))
            if not cur.fetchone():
                cur.execute(f'''
                    INSERT INTO {SCHEMA}.subscriptions (company_id, tariff_id, status, current_period_end)
                    VALUES (%s, %s, %s, NOW() + INTERVAL '30 days')
                ''', (company_id, tariff_id, status))
            conn.commit()
            return respond(200, {'success': True, 'tariff_name': tariff[1], 'subscription_status': status})

        if method == 'POST' and body.get('action') == 'extend_subscription':
            # Продление: от даты окончания (или от сегодня, если уже просрочена) на срок тарифа
            # или на год. Пробный продлевает пробный период, платный - оплаченный период.
            company_id, period = body.get('company_id'), body.get('period') or 'tariff'
            if period not in ('tariff', 'year'):
                return respond(400, {'error': 'Срок продления: тариф или год'})
            cur.execute(f'''
                SELECT s.id, t.slug, CASE WHEN t.slug = 'trial' AND t.trial_days > 0 THEN t.trial_days ELSE t.period_days END
                FROM {SCHEMA}.subscriptions s
                JOIN {SCHEMA}.tariffs t ON t.id = s.tariff_id
                WHERE s.company_id = %s
            ''', (company_id,))
            row = cur.fetchone()
            if not row:
                return respond(400, {'error': 'У компании нет подписки - сначала выберите тариф'})
            sub_id, slug, period_days = row
            days = 365 if period == 'year' else int(period_days or 30)
            is_trial = slug == 'trial'
            cur.execute(f'''
                UPDATE {SCHEMA}.subscriptions SET
                    current_period_start = CASE WHEN COALESCE(current_period_end, NOW()) < NOW() THEN NOW() ELSE current_period_start END,
                    current_period_end = GREATEST(COALESCE(current_period_end, NOW()), NOW()) + make_interval(days => %s),
                    trial_ends_at = CASE WHEN %s THEN GREATEST(COALESCE(trial_ends_at, NOW()), NOW()) + make_interval(days => %s)
                                         ELSE trial_ends_at END,
                    status = %s, updated_at = NOW()
                WHERE id = %s
                RETURNING current_period_end, trial_ends_at, status
            ''', (days, is_trial, days, 'trial' if is_trial else 'active', sub_id))
            end, trial_end, status = cur.fetchone()
            # Движение в истории оплат компании: начисление платформой, без оплаты.
            cur.execute(f'''
                INSERT INTO {SCHEMA}.subscription_payments
                    (company_id, user_id, tariff_id, period, days, amount, status, period_end, method)
                SELECT %s, %s, tariff_id, %s, %s, 0, 'paid', %s, 'platform'
                FROM {SCHEMA}.subscriptions WHERE id = %s
            ''', (company_id, requester, 'year' if period == 'year' else 'month', days, end, sub_id))
            conn.commit()
            return respond(200, {'success': True, 'days': days, 'subscription_status': status,
                                 'current_period_end': end.isoformat(),
                                 'trial_ends_at': trial_end.isoformat() if trial_end else None})

        if method == 'POST':
            if body.get('action') != 'save' or not body.get('id'):
                return respond(400, {'error': 'Unknown action'})
            name = (body.get('name') or '').strip()
            if not name:
                return respond(400, {'error': 'Укажите название тарифа'})
            try:
                limits = [parse_limit(body.get(k)) for k in LIMITS]
                price = float(body.get('price') or 0)
                period_days = int(body.get('period_days') or 0)
                discount = float(body.get('yearly_discount_percent') or 0)
                trial_days = int(body.get('trial_days') or 0)
            except (TypeError, ValueError):
                return respond(400, {'error': 'Лимиты, цена, срок и скидка - неотрицательные числа'})
            if period_days < 1:
                return respond(400, {'error': 'Срок действия - не меньше 1 дня'})
            if not 0 <= trial_days <= 365:
                return respond(400, {'error': 'Пробный период - от 0 до 365 дней'})
            if not 0 <= discount < 100:
                return respond(400, {'error': 'Скидка за год - от 0 до 99%'})
            modules = [m for m in body.get('modules') or [] if m in MODULES]
            cur.execute(f'''
                UPDATE {SCHEMA}.tariffs SET name = %s, price = %s, is_active = %s, modules = %s,
                       max_companies = %s, max_users = %s, max_integrations = %s, max_automations = %s,
                       period_days = %s, yearly_discount_percent = %s, trial_days = %s, updated_at = NOW()
                WHERE id = %s RETURNING id
            ''', (name, price, bool(body.get('is_active', True)), json.dumps(modules), *limits,
                  period_days, discount, trial_days, body['id']))
            if not cur.fetchone():
                return respond(404, {'error': 'Тариф не найден'})
            conn.commit()

        return respond(200, {'success': True, 'tariffs': list_tariffs(cur)})
    finally:
        cur.close()
        conn.close()
