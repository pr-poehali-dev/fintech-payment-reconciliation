import json
import os
from typing import Any, Dict

import psycopg2
from auth_guard import guard

SCHEMA = 't_p83864310_fintech_payment_reco'
PAY_ROLES = ('owner', 'admin')


def respond(status: int, payload: Dict[str, Any]) -> Dict[str, Any]:
    return {
        'statusCode': status,
        'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
        'body': json.dumps(payload, ensure_ascii=False, default=str),
        'isBase64Encoded': False
    }


def year_price(price: float, discount: float) -> float:
    return round(price * 12 * (1 - discount / 100), 2)


def load_tariffs(cur):
    cur.execute(f'''
        SELECT id, slug, name, description, price, period_days, yearly_discount_percent,
               modules, max_companies, max_users, max_integrations, max_automations
        FROM {SCHEMA}.tariffs
        WHERE is_active = true AND slug <> 'trial'
        ORDER BY sort_order, id
    ''')
    result = []
    for r in cur.fetchall():
        price, discount = float(r[4]), float(r[6] or 0)
        result.append({
            'id': r[0], 'slug': r[1], 'name': r[2], 'description': r[3],
            'price': price, 'period_days': r[5] or 30, 'yearly_discount_percent': discount,
            'year_price': year_price(price, discount), 'modules': r[7] or [],
            'max_companies': r[8], 'max_users': r[9], 'max_integrations': r[10], 'max_automations': r[11]
        })
    return result


def member_role(cur, company_id, user_id):
    cur.execute(f'''
        SELECT r.slug FROM {SCHEMA}.company_users cu JOIN {SCHEMA}.roles r ON r.id = cu.role_id
        WHERE cu.company_id = %s AND cu.user_id = %s AND cu.status = 'active'
    ''', (company_id, user_id))
    row = cur.fetchone()
    return row[0] if row else None


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Подписка компании в личном кабинете: тарифы, история оплат, оплата и продление.
    GET ?company_id= - тарифы для оплаты, текущая подписка, история оплат, можно ли платить
    POST {action: "pay", company_id, tariff_slug, period: month|year} - оплатить (пока без
         реального платежа) и активировать тариф. Тот же тариф - продление от даты окончания,
         другой тариф - новый срок с сегодняшнего дня. Платить могут владелец и админ компании.
    '''
    denied = guard(event)
    if denied:
        return denied

    method = event.get('httpMethod', 'GET')
    user_id = event.get('session_user_id')
    params = event.get('queryStringParameters') or {}
    body = json.loads(event.get('body') or '{}') if method == 'POST' else {}
    company_id = body.get('company_id') or params.get('company_id')
    if not company_id:
        return respond(400, {'error': 'Не указана компания'})

    conn = psycopg2.connect(os.environ['DATABASE_URL'])
    cur = conn.cursor()
    try:
        role = member_role(cur, company_id, user_id)
        can_pay = role in PAY_ROLES

        if method == 'GET':
            cur.execute(f'''
                SELECT p.id, t.name, p.period, p.days, p.amount, p.status, p.period_end, p.created_at
                FROM {SCHEMA}.subscription_payments p JOIN {SCHEMA}.tariffs t ON t.id = p.tariff_id
                WHERE p.company_id = %s ORDER BY p.created_at DESC LIMIT 20
            ''', (company_id,))
            payments = [{
                'id': r[0], 'tariff_name': r[1], 'period': r[2], 'days': r[3], 'amount': float(r[4]),
                'status': r[5], 'period_end': r[6], 'created_at': r[7]
            } for r in cur.fetchall()]
            return respond(200, {'success': True, 'tariffs': load_tariffs(cur),
                                 'payments': payments, 'can_pay': can_pay})

        if method == 'POST' and body.get('action') == 'pay':
            if not can_pay:
                return respond(403, {'error': 'Оплачивать подписку может только владелец или админ компании'})
            period = body.get('period') or 'month'
            if period not in ('month', 'year'):
                return respond(400, {'error': 'Срок оплаты: месяц или год'})
            tariff = next((t for t in load_tariffs(cur) if t['slug'] == body.get('tariff_slug')), None)
            if not tariff:
                return respond(400, {'error': 'Тариф не найден'})

            days = 365 if period == 'year' else int(tariff['period_days'])
            amount = tariff['year_price'] if period == 'year' else tariff['price']

            cur.execute(f'SELECT id, tariff_id FROM {SCHEMA}.subscriptions WHERE company_id = %s',
                        (company_id,))
            sub = cur.fetchone()
            if sub and sub[1] == tariff['id']:
                cur.execute(f'''
                    UPDATE {SCHEMA}.subscriptions SET
                        current_period_start = CASE WHEN COALESCE(current_period_end, NOW()) < NOW()
                                                    THEN NOW() ELSE current_period_start END,
                        current_period_end = GREATEST(COALESCE(current_period_end, NOW()), NOW())
                                             + make_interval(days => %s),
                        status = 'active', updated_at = NOW()
                    WHERE id = %s RETURNING current_period_end
                ''', (days, sub[0]))
            elif sub:
                cur.execute(f'''
                    UPDATE {SCHEMA}.subscriptions SET tariff_id = %s, status = 'active',
                        current_period_start = NOW(), current_period_end = NOW() + make_interval(days => %s),
                        updated_at = NOW()
                    WHERE id = %s RETURNING current_period_end
                ''', (tariff['id'], days, sub[0]))
            else:
                cur.execute(f'''
                    INSERT INTO {SCHEMA}.subscriptions
                        (company_id, tariff_id, status, current_period_start, current_period_end)
                    VALUES (%s, %s, 'active', NOW(), NOW() + make_interval(days => %s))
                    RETURNING current_period_end
                ''', (company_id, tariff['id'], days))
            period_end = cur.fetchone()[0]

            cur.execute(f'''
                INSERT INTO {SCHEMA}.subscription_payments
                    (company_id, user_id, tariff_id, period, days, amount, status, period_end)
                VALUES (%s, %s, %s, %s, %s, %s, 'paid', %s)
            ''', (company_id, user_id, tariff['id'], period, days, amount, period_end))
            conn.commit()
            return respond(200, {'success': True, 'tariff_name': tariff['name'],
                                 'period_end': period_end, 'amount': amount})

        return respond(405, {'error': 'Method not allowed'})
    finally:
        cur.close()
        conn.close()
