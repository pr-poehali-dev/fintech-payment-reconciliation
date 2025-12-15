import json
import os
import psycopg2
from typing import Dict, Any
from datetime import datetime, timedelta

def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Получение статистики для дашборда: платежи, чеки, выручка
    Args: owner_id
    Returns: статистика за разные периоды
    '''
    
    method = event.get('httpMethod', 'GET')
    
    if method == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'GET, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400'
            },
            'body': '',
            'isBase64Encoded': False
        }
    
    if method != 'GET':
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json; charset=utf-8'},
            'body': json.dumps({'error': True, 'message': 'Запрос с заданными параметрами не поддерживается'}, ensure_ascii=False),
            'isBase64Encoded': False
        }
    
    params = event.get('queryStringParameters', {}) or {}
    owner_id = params.get('owner_id', '1')
    
    try:
        dsn = os.environ['DATABASE_URL']
        conn = psycopg2.connect(dsn)
        cur = conn.cursor()
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'success': False, 'error': str(e)}),
            'isBase64Encoded': False
        }
    
    now = datetime.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    month_start = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    last_month_start = (month_start - timedelta(days=1)).replace(day=1, hour=0, minute=0, second=0)
    week_ago = now - timedelta(days=7)
    
    today_str = today_start.strftime('%Y-%m-%d %H:%M:%S')
    month_str = month_start.strftime('%Y-%m-%d %H:%M:%S')
    last_month_str = last_month_start.strftime('%Y-%m-%d %H:%M:%S')
    week_str = week_ago.strftime('%Y-%m-%d %H:%M:%S')
    
    # Платежи за сегодня
    cur.execute(f'''
        SELECT COUNT(*), 
               COUNT(DISTINCT CASE WHEN status IN ('AUTHORIZED', 'CONFIRMED') THEN payment_id END),
               COUNT(DISTINCT CASE WHEN status NOT IN ('AUTHORIZED', 'CONFIRMED', 'CANCELED', 'REJECTED') THEN payment_id END)
        FROM t_p83864310_fintech_payment_reco.webhooks 
        WHERE owner_id = {owner_id} AND created_at >= '{today_str}'
    ''')
    
    webhooks_today, payments_success_today, payments_pending_today = cur.fetchone()
    
    # Платежи за месяц
    cur.execute(f'''
        SELECT COUNT(DISTINCT payment_id), SUM(amount) / 100.0
        FROM t_p83864310_fintech_payment_reco.webhooks 
        WHERE owner_id = {owner_id} 
          AND created_at >= '{month_str}'
          AND status IN ('AUTHORIZED', 'CONFIRMED')
    ''')
    
    payments_month, revenue_month = cur.fetchone()
    revenue_month = float(revenue_month) if revenue_month else 0.0
    
    # Платежи за прошлый месяц для сравнения
    cur.execute(f'''
        SELECT SUM(amount) / 100.0
        FROM t_p83864310_fintech_payment_reco.webhooks 
        WHERE owner_id = {owner_id} 
          AND created_at >= '{last_month_str}'
          AND created_at < '{month_str}'
          AND status IN ('AUTHORIZED', 'CONFIRMED')
    ''')
    
    revenue_last_month_row = cur.fetchone()
    revenue_last_month = float(revenue_last_month_row[0]) if revenue_last_month_row[0] else 0.0
    
    # Рост выручки
    revenue_growth = 0.0
    if revenue_last_month > 0:
        revenue_growth = ((revenue_month - revenue_last_month) / revenue_last_month) * 100
    
    # Чеки за месяц
    cur.execute(f'''
        SELECT COUNT(*), SUM(total_sum)
        FROM t_p83864310_fintech_payment_reco.ofd_receipts 
        WHERE owner_id = {owner_id} AND created_at >= '{month_str}'
    ''')
    
    receipts_month_row = cur.fetchone()
    receipts_month = receipts_month_row[0] if receipts_month_row[0] else 0
    receipts_sum = float(receipts_month_row[1]) if receipts_month_row[1] else 0.0
    
    # Статистика по последним 7 дням (для графика)
    cur.execute(f'''
        SELECT 
            DATE(created_at) as day,
            COUNT(DISTINCT payment_id) as count
        FROM t_p83864310_fintech_payment_reco.webhooks
        WHERE owner_id = {owner_id}
          AND created_at >= '{week_str}'
          AND status IN ('AUTHORIZED', 'CONFIRMED')
        GROUP BY DATE(created_at)
        ORDER BY day
    ''')
    
    daily_payments = []
    for row in cur.fetchall():
        daily_payments.append({
            'date': row[0].isoformat(),
            'count': row[1]
        })
    
    # Последние транзакции
    cur.execute(f'''
        SELECT 
            w.payment_id,
            w.amount / 100.0,
            w.status,
            w.created_at,
            w.customer_email
        FROM t_p83864310_fintech_payment_reco.webhooks w
        WHERE w.owner_id = {owner_id}
        ORDER BY w.created_at DESC
        LIMIT 10
    ''')
    
    recent_transactions = []
    for row in cur.fetchall():
        recent_transactions.append({
            'payment_id': row[0],
            'amount': float(row[1]) if row[1] else 0,
            'status': row[2],
            'created_at': row[3].isoformat() if row[3] else None,
            'customer_email': row[4]
        })
    
    # Интеграции
    cur.execute(f'''
        SELECT COUNT(*)
        FROM t_p83864310_fintech_payment_reco.user_integrations
        WHERE owner_id = {owner_id} AND status = 'active'
    ''')
    
    active_integrations = cur.fetchone()[0]
    
    conn.close()
    
    return {
        'statusCode': 200,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        },
        'body': json.dumps({
            'success': True,
            'stats': {
                'payments_today': webhooks_today or 0,
                'payments_success_today': payments_success_today or 0,
                'payments_pending_today': payments_pending_today or 0,
                'revenue_month': revenue_month,
                'revenue_growth': round(revenue_growth, 1),
                'payments_month': payments_month or 0,
                'receipts_month': receipts_month,
                'receipts_sum': receipts_sum,
                'active_integrations': active_integrations,
                'daily_payments': daily_payments,
                'recent_transactions': recent_transactions
            }
        }),
        'isBase64Encoded': False
    }