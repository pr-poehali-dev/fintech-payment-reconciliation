import json
import os
import time
import psycopg2
import urllib.request
import urllib.error
from typing import Dict, Any, Optional
from datetime import datetime, timedelta

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
}


def fetch_tochka_statement(config: Dict[str, Any], date_from: str, date_to: str) -> Optional[list]:
    '''
    Точка Банк отдаёт выписку асинхронно: сначала Init Statement (заказ выписки),
    затем поллинг Get Statement пока статус не станет Ready.
    https://developers.tochka.com/docs/tochka-api/opisanie-metodov/vypiski
    '''
    api_token = config.get('api_token', '')
    account_id = config.get('account_number', '')
    base_url = 'https://enter.tochka.com/uapi/open-banking/v1.0'

    init_req = urllib.request.Request(
        f'{base_url}/statements',
        data=json.dumps({
            'accountId': account_id,
            'startDateTime': date_from,
            'endDateTime': date_to
        }).encode('utf-8'),
        headers={
            'Authorization': f'Bearer {api_token}',
            'Content-Type': 'application/json'
        },
        method='POST'
    )

    try:
        with urllib.request.urlopen(init_req, timeout=15) as response:
            init_data = json.loads(response.read().decode('utf-8'))
    except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError):
        return None

    statement_id = init_data.get('Data', {}).get('statementId')
    if not statement_id:
        return None

    get_url = f'{base_url}/accounts/{account_id}/statements/{statement_id}'
    get_req = urllib.request.Request(get_url, headers={'Authorization': f'Bearer {api_token}'})

    for _ in range(5):
        try:
            with urllib.request.urlopen(get_req, timeout=15) as response:
                statement_data = json.loads(response.read().decode('utf-8'))
        except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError):
            return None

        status = statement_data.get('Data', {}).get('status')
        if status == 'Ready':
            return statement_data.get('Data', {}).get('Transaction', [])
        time.sleep(2)

    return None


# Реестр обработчиков по провайдеру. Т-Банк и Модульбанк требуют отдельного
# согласования формата API и подключены не будут пока нет проверенной интеграции -
# явно возвращаем понятную ошибку вместо того, чтобы притворяться, что данные загружены.
STATEMENT_FETCHERS = {
    'tochka_account': fetch_tochka_statement
}


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Ручная синхронизация банковской выписки по кнопке "Синхронизировать сейчас".
    Args: integration_id, date_from (ISO, опционально), date_to (ISO, опционально)
    Returns: количество загруженных и новых транзакций
    '''

    method = event.get('httpMethod', 'POST')

    if method == 'OPTIONS':
        return {'statusCode': 200, 'headers': CORS_HEADERS, 'body': '', 'isBase64Encoded': False}

    if method != 'POST':
        return {
            'statusCode': 405,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'Method not allowed'}),
            'isBase64Encoded': False
        }

    body_data = json.loads(event.get('body') or '{}')
    integration_id = body_data.get('integration_id')

    if not integration_id:
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'error': 'integration_id required'}),
            'isBase64Encoded': False
        }

    date_from = body_data.get('date_from') or (datetime.now() - timedelta(days=30)).strftime('%Y-%m-%dT00:00:00Z')
    date_to = body_data.get('date_to') or datetime.now().strftime('%Y-%m-%dT23:59:59Z')

    dsn = os.environ['DATABASE_URL']
    conn = psycopg2.connect(dsn)
    cur = conn.cursor()

    try:
        cur.execute('''
            SELECT ui.config, ui.company_id, p.slug
            FROM t_p83864310_fintech_payment_reco.user_integrations ui
            JOIN t_p83864310_fintech_payment_reco.integration_providers p ON p.id = ui.provider_id
            WHERE ui.id = %s AND ui.status = 'active'
        ''', (integration_id,))

        row = cur.fetchone()
        if not row:
            return {
                'statusCode': 404,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'error': 'Integration not found'}),
                'isBase64Encoded': False
            }

        config, company_id, provider_slug = row
        config = json.loads(config) if isinstance(config, str) else (config or {})

        fetcher = STATEMENT_FETCHERS.get(provider_slug)
        if not fetcher:
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({
                    'success': False,
                    'error': f'Синхронизация для {provider_slug} пока не реализована'
                }),
                'isBase64Encoded': False
            }

        transactions = fetcher(config, date_from, date_to)
        if transactions is None:
            return {
                'statusCode': 200,
                'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
                'body': json.dumps({'success': False, 'error': 'Не удалось получить выписку от банка'}),
                'isBase64Encoded': False
            }

        inserted_count = 0
        for tx in transactions:
            try:
                amount = float(tx.get('Amount', {}).get('Amount', 0))
                direction = 'in' if tx.get('creditDebitIndicator') == 'Credit' else 'out'

                cur.execute('''
                    INSERT INTO t_p83864310_fintech_payment_reco.bank_statement_transactions (
                        integration_id, company_id, provider_slug, external_transaction_id,
                        operation_date, amount, direction, counterparty_name, counterparty_inn,
                        purpose, raw_data
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (integration_id, external_transaction_id) DO NOTHING
                    RETURNING id
                ''', (
                    integration_id,
                    company_id,
                    provider_slug,
                    tx.get('transactionId') or tx.get('paymentId'),
                    tx.get('bookingDateTime'),
                    amount,
                    direction,
                    tx.get('creditorAgent', {}).get('name') if direction == 'out' else tx.get('debtorAgent', {}).get('name'),
                    None,
                    tx.get('remittanceInformationUnstructured') or tx.get('additionalInformation'),
                    json.dumps(tx)
                ))

                if cur.fetchone():
                    inserted_count += 1
            except Exception:
                continue

        conn.commit()

        return {
            'statusCode': 200,
            'headers': {'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({
                'success': True,
                'total_transactions': len(transactions),
                'inserted': inserted_count
            }),
            'isBase64Encoded': False
        }

    except Exception as e:
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