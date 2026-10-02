import json
import os
import psycopg2
import urllib.request
import urllib.error
import urllib.parse
from typing import Dict, Any, Optional, Tuple
from datetime import datetime, timedelta
from cron_report import record_cron_run

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
}

# Автозагрузка (без явных дат, режим company_id) не тянет чеки глубже этого окна -
# страница "Чеки" дёргает загрузку при каждом открытии, поэтому большого окна не
# требуется, а маленькое держит запрос к ОФД быстрым.
AUTO_SYNC_LOOKBACK_DAYS = 3


def fetch_and_save_receipts(cur, integration_id: int, company_id: int, config: Dict[str, Any],
                             dt_from: datetime, dt_to: datetime) -> Tuple[bool, int, int, Optional[str]]:
    '''
    Запрашивает чеки OFD.RU за период [dt_from, dt_to] по одной интеграции и
    сохраняет новые в ofd_receipts (повторные приходы игнорируются по
    UNIQUE(integration_id, receipt_id)).
    Returns: (success, total_receipts, inserted_count, error)
    '''
    inn = config.get('inn')
    kkt = config.get('kkt')
    auth_token = config.get('auth_token')
    api_url = config.get('api_url', 'https://ofd.ru')

    if not all([inn, kkt, auth_token]):
        return False, 0, 0, 'Missing INN, KKT or auth_token in config'

    iso_from = dt_from.strftime('%Y-%m-%dT00:00:00')
    iso_to = dt_to.strftime('%Y-%m-%dT23:59:59')

    ofd_url = f'{api_url}/api/integration/v2/inn/{inn}/kkt/{kkt}/receipts-with-fpd-short'
    params = urllib.parse.urlencode({
        'dateFrom': iso_from,
        'dateTo': iso_to,
        'AuthToken': auth_token
    })
    full_url = f'{ofd_url}?{params}'

    try:
        req = urllib.request.Request(full_url, method='GET')
        with urllib.request.urlopen(req, timeout=30) as response:
            response_body = response.read().decode('utf-8')
            receipts_data = json.loads(response_body)
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8') if e.fp else str(e)
        return False, 0, 0, f'OFD API error: {error_body}'
    except (urllib.error.URLError, json.JSONDecodeError, TimeoutError) as e:
        return False, 0, 0, f'OFD API request failed: {str(e)}'

    if isinstance(receipts_data, dict) and receipts_data.get('Status') == 'Failed':
        return False, 0, 0, f'OFD API returned error: {receipts_data.get("Errors", [])}'

    if isinstance(receipts_data, dict) and 'Data' in receipts_data:
        receipts = receipts_data.get('Data', [])
    elif isinstance(receipts_data, list):
        receipts = receipts_data
    else:
        receipts = []

    inserted_count = 0
    skipped: list = []
    for receipt in receipts:
        info = {
            'id': receipt.get('Id'),
            'doc_datetime': receipt.get('DocDateTime'),
            'doc_number': receipt.get('DocNumber'),
            'total': float(receipt.get('TotalSumm', 0) or 0) / 100,
            'operation_type': receipt.get('OperationType')
        }
        try:
            cur.execute('''
                INSERT INTO t_p83864310_fintech_payment_reco.ofd_receipts (
                    integration_id, company_id, receipt_id, operation_type,
                    total_sum, cash_sum, ecash_sum, doc_number, doc_datetime,
                    fn_number, raw_data
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (integration_id, receipt_id) DO NOTHING
                RETURNING id
            ''', (
                integration_id,
                company_id,
                receipt.get('Id'),
                receipt.get('OperationType'),
                float(receipt.get('TotalSumm', 0)) / 100,
                float(receipt.get('CashSumm', 0)) / 100,
                float(receipt.get('ECashSumm', 0)) / 100,
                receipt.get('DocNumber'),
                receipt.get('DocDateTime'),
                receipt.get('FnNumber'),
                json.dumps(receipt)
            ))
            if cur.fetchone():
                inserted_count += 1
            else:
                skipped.append({**info, 'reason': 'уже есть в базе (тот же Id)'})
        except Exception as e:
            skipped.append({**info, 'reason': str(e)[:200]})

    cur.execute('''
        UPDATE t_p83864310_fintech_payment_reco.user_integrations
        SET last_synced_at = NOW(), updated_at = NOW()
        WHERE id = %s
    ''', (integration_id,))

    fetch_and_save_receipts.last_skipped = skipped
    return True, len(receipts), inserted_count, None


def parse_iso_date(value: Optional[str], fallback: datetime) -> datetime:
    if not value:
        return fallback
    try:
        return datetime.fromisoformat(value.replace('Z', '+00:00')).replace(tzinfo=None)
    except ValueError:
        return fallback


def _handle(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Загрузка фискальных чеков из OFD.RU.
    Два режима:
    1) integration_id + date_from/date_to (опционально) - ручная загрузка за явный
       период для одной интеграции (по умолчанию последние 30 дней).
    2) company_id - автозагрузка для ВСЕХ активных касс ОФД компании сразу, за
       период от последней успешной синхронизации (last_synced_at) до сейчас,
       но не глубже 3 дней назад. В платформе нет cron-планировщика, поэтому
       этот режим дёргается с фронта автоматически при каждом открытии
       страницы "Чеки" - без участия пользователя.
    Args: integration_id (режим 1) или company_id (режим 2), date_from/date_to (ISO, опционально)
    Returns: режим 1 - total_receipts/inserted; режим 2 - integrations_checked/total_receipts/inserted/results
    '''

    method = event.get('httpMethod', 'POST')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': '', 'isBase64Encoded': False}

    if method != 'POST':
        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json; charset=utf-8'},
            'body': json.dumps({'error': True, 'message': 'Запрос с заданными параметрами не поддерживается'}, ensure_ascii=False),
            'isBase64Encoded': False
        }

    body_data = json.loads(event.get('body', '{}') or '{}')
    integration_id = body_data.get('integration_id')
    company_id_param = body_data.get('company_id')
    date_from_param = body_data.get('date_from')
    date_to_param = body_data.get('date_to')

    if not integration_id and not company_id_param:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'integration_id or company_id required'}),
            'isBase64Encoded': False
        }

    dsn = os.environ['DATABASE_URL']
    conn = psycopg2.connect(dsn)
    cur = conn.cursor()

    try:
        now = datetime.now()

        if integration_id:
            cur.execute('''
                SELECT config, company_id
                FROM t_p83864310_fintech_payment_reco.user_integrations
                WHERE id = %s AND status = 'active'
            ''', (integration_id,))

            integration_row = cur.fetchone()
            if not integration_row:
                return {
                    'statusCode': 404,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'error': 'Integration not found'}),
                    'isBase64Encoded': False
                }

            config, company_id = integration_row
            config = json.loads(config) if isinstance(config, str) else (config or {})

            dt_from = parse_iso_date(date_from_param, now - timedelta(days=30))
            dt_to = parse_iso_date(date_to_param, now)

            success, total_receipts, inserted, error = fetch_and_save_receipts(
                cur, integration_id, company_id, config, dt_from, dt_to
            )

            if not success:
                conn.rollback()
                return {
                    'statusCode': 200,
                    'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                    'body': json.dumps({'success': False, 'error': error}),
                    'isBase64Encoded': False
                }

            conn.commit()
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'success': True,
                    'total_receipts': total_receipts,
                    'inserted': inserted
                }),
                'isBase64Encoded': False
            }

        # Режим 2: автозагрузка по всей компании
        cur.execute('''
            SELECT ui.id, ui.config, ui.last_synced_at
            FROM t_p83864310_fintech_payment_reco.user_integrations ui
            JOIN t_p83864310_fintech_payment_reco.integration_providers p ON p.id = ui.provider_id
            WHERE ui.company_id = %s AND p.slug = 'ofdru' AND ui.status = 'active'
        ''', (company_id_param,))

        integrations = cur.fetchall()

        if not integrations:
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'success': True, 'integrations_checked': 0, 'total_receipts': 0, 'inserted': 0, 'results': []}),
                'isBase64Encoded': False
            }

        lookback = now - timedelta(days=AUTO_SYNC_LOOKBACK_DAYS)
        total_receipts_sum = 0
        inserted_sum = 0
        results = []

        for ui_id, config, last_synced_at in integrations:
            config = json.loads(config) if isinstance(config, str) else (config or {})
            # Явный период (окно "Дозагрузка исторических данных") важнее
            # автоокна "последние 3 дня" - иначе исторические чеки ОФД не
            # запрашивались вовсе, какой бы период ни выбрал пользователь.
            if date_from_param:
                dt_from = parse_iso_date(date_from_param, lookback)
                dt_to = parse_iso_date(date_to_param, now)
            else:
                dt_from = max(last_synced_at, lookback) if last_synced_at else lookback
                dt_to = now

            success, total_receipts, inserted, error = fetch_and_save_receipts(
                cur, ui_id, company_id_param, config, dt_from, dt_to
            )

            results.append({
                'integration_id': ui_id,
                'success': success,
                'total_receipts': total_receipts,
                'inserted': inserted,
                'skipped': getattr(fetch_and_save_receipts, 'last_skipped', []),
                'error': error
            })

            if success:
                total_receipts_sum += total_receipts
                inserted_sum += inserted

        conn.commit()

        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'success': True,
                'integrations_checked': len(integrations),
                'total_receipts': total_receipts_sum,
                'inserted': inserted_sum,
                'results': results
            }),
            'isBase64Encoded': False
        }

    except Exception as e:
        import traceback
        print('[OFD ERROR]', type(e).__name__, repr(e))
        print(traceback.format_exc())
        conn.rollback()
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': str(e)}),
            'isBase64Encoded': False
        }
    finally:
        cur.close()
        conn.close()


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''Точка входа: обработка запроса + итог для админки, если вызвал планировщик.'''
    resp = _handle(event, context)
    if event.get('httpMethod', 'POST') == 'POST':
        record_cron_run(event, resp, 'ofd', 'inserted')
    return resp
