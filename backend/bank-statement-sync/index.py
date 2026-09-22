import json
import os
import time
import psycopg2
import urllib.request
import urllib.error
from typing import Dict, Any, List, Optional
from datetime import datetime, timedelta

from tbank_oauth import fetch_statement as fetch_tbank_statement
from purpose_classifier import classify_purpose, get_included_categories

CORS_HEADERS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400'
}


def normalize_tx(external_id, operation_date, amount, direction, counterparty_name,
                  counterparty_inn, purpose, purpose_category, raw) -> Dict[str, Any]:
    return {
        'external_id': external_id,
        'operation_date': operation_date,
        'amount': amount,
        'direction': direction,
        'counterparty_name': counterparty_name,
        'counterparty_inn': counterparty_inn,
        'purpose': purpose,
        'purpose_category': purpose_category,
        'raw': raw
    }


def get_tbank_access(cur, company_id: int) -> Dict[str, Any]:
    '''
    Достаёт токен доступа T-Business ID для компании, если владелец уже подтвердил
    доступ через Т-Бизнес. Если подтверждения нет - работаем в режиме песочницы
    с демонстрационными данными, чтобы интеграцию можно было проверить уже сейчас.
    '''
    cur.execute('''
        SELECT access_token, is_sandbox
        FROM t_p83864310_fintech_payment_reco.company_bank_oauth_grants
        WHERE company_id = %s AND provider_slug = 'tbank_account'
    ''', (company_id,))
    row = cur.fetchone()

    if row:
        return {'access_token': row[0], 'is_sandbox': row[1]}

    return {'access_token': '', 'is_sandbox': True}


def fetch_tbank_account_statement(cur, integration_id: int, company_id: int, config: Dict[str, Any],
                                   date_from: str, date_to: str) -> Optional[List[Dict[str, Any]]]:
    '''
    Расчётный счёт Т-Банка (T-Business ID + T-API, https://developer.tbank.ru/docs/products/account-info).
    Если компания подтвердила доступ через Т-Бизнес - используем её реальный access_token
    (в бою) или общий тестовый токен (в песочнице). Каждая операция сразу проходит
    классификацию по назначению платежа и фильтруется по настройке интеграции -
    в БД попадают только эквайринг (онлайн/торговый) и прямые оплаты физлиц,
    остальное (налоги, зарплата, внутренние переводы) отсекается на этом же шаге.
    '''
    access = get_tbank_access(cur, company_id)
    account_number = config.get('account_number', '')
    included_categories = get_included_categories(config)

    all_operations: List[Dict[str, Any]] = []
    cursor = None
    previous_cursor = None

    for _ in range(10):
        data = fetch_tbank_statement(
            access_token=access['access_token'],
            account_number=account_number,
            date_from=date_from,
            date_to=date_to,
            is_sandbox=access['is_sandbox'],
            cursor=cursor
        )
        if data is None:
            return None if not all_operations else all_operations

        for op in data.get('operations', []):
            category = classify_purpose(op)
            if category not in included_categories:
                continue

            direction = 'in' if op.get('typeOfOperation') == 'Credit' else 'out'
            counterparty = op.get('counterParty', {}) or {}
            all_operations.append(normalize_tx(
                external_id=op.get('operationId'),
                operation_date=op.get('operationDate'),
                amount=op.get('operationAmount'),
                direction=direction,
                counterparty_name=counterparty.get('name'),
                counterparty_inn=counterparty.get('inn'),
                purpose=op.get('payPurpose') or op.get('description'),
                purpose_category=category,
                raw=op
            ))

        cursor = data.get('nextCursor')
        # Песочница банка иногда отдаёт один и тот же cursor бесконечно -
        # останавливаемся, если пагинация не продвигается, чтобы не зациклиться.
        if not cursor or cursor == previous_cursor:
            break
        previous_cursor = cursor

    return all_operations


def fetch_tochka_account_statement(cur, integration_id: int, company_id: int, config: Dict[str, Any],
                                    date_from: str, date_to: str) -> Optional[List[Dict[str, Any]]]:
    '''
    Точка Банк отдаёт выписку асинхронно: сначала Init Statement (заказ выписки),
    затем поллинг Get Statement пока статус не станет Ready.
    https://developers.tochka.com/docs/tochka-api/opisanie-metodov/vypiski
    '''
    api_token = config.get('api_token', '')
    account_id = config.get('account_number', '')
    included_categories = get_included_categories(config)
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

    raw_transactions = None
    for _ in range(5):
        try:
            with urllib.request.urlopen(get_req, timeout=15) as response:
                statement_data = json.loads(response.read().decode('utf-8'))
        except (urllib.error.URLError, urllib.error.HTTPError, json.JSONDecodeError):
            return None

        status = statement_data.get('Data', {}).get('status')
        if status == 'Ready':
            raw_transactions = statement_data.get('Data', {}).get('Transaction', [])
            break
        time.sleep(2)

    if raw_transactions is None:
        return None

    result = []
    for tx in raw_transactions:
        category = classify_purpose({
            'payPurpose': tx.get('remittanceInformationUnstructured') or tx.get('additionalInformation'),
            'typeOfOperation': 'Credit' if tx.get('creditDebitIndicator') == 'Credit' else 'Debit',
            'counterParty': {}
        })
        if category not in included_categories:
            continue

        direction = 'in' if tx.get('creditDebitIndicator') == 'Credit' else 'out'
        agent = tx.get('creditorAgent', {}) if direction == 'out' else tx.get('debtorAgent', {})
        result.append(normalize_tx(
            external_id=tx.get('transactionId') or tx.get('paymentId'),
            operation_date=tx.get('bookingDateTime'),
            amount=float(tx.get('Amount', {}).get('Amount', 0)),
            direction=direction,
            counterparty_name=(agent or {}).get('name'),
            counterparty_inn=None,
            purpose=tx.get('remittanceInformationUnstructured') or tx.get('additionalInformation'),
            purpose_category=category,
            raw=tx
        ))

    return result


# Реестр обработчиков по провайдеру. Модульбанк требует отдельного согласования
# формата API и пока не подключён - явно возвращаем понятную ошибку вместо того,
# чтобы притворяться, что данные загружены.
STATEMENT_FETCHERS = {
    'tbank_account': fetch_tbank_account_statement,
    'tochka_account': fetch_tochka_account_statement
}


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    '''
    Ручная синхронизация банковской выписки по кнопке "Синхронизировать сейчас".
    Это второй слой обработки: сюда попадают только операции, прошедшие фильтр
    по назначению платежа (эквайринг онлайн/торговый + прямые оплаты физлиц),
    остальное отсекается ещё на этапе получения выписки от банка.
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

        transactions = fetcher(cur, integration_id, company_id, config, date_from, date_to)
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
                cur.execute('''
                    INSERT INTO t_p83864310_fintech_payment_reco.bank_statement_transactions (
                        integration_id, company_id, provider_slug, external_transaction_id,
                        operation_date, amount, direction, counterparty_name, counterparty_inn,
                        purpose, purpose_category, raw_data
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT (integration_id, external_transaction_id) DO NOTHING
                    RETURNING id
                ''', (
                    integration_id,
                    company_id,
                    provider_slug,
                    tx['external_id'],
                    tx['operation_date'],
                    tx['amount'],
                    tx['direction'],
                    tx['counterparty_name'],
                    tx['counterparty_inn'],
                    tx['purpose'],
                    tx['purpose_category'],
                    json.dumps(tx['raw'])
                ))

                if cur.fetchone():
                    inserted_count += 1
            except Exception:
                continue

        cur.execute('''
            UPDATE t_p83864310_fintech_payment_reco.user_integrations
            SET last_synced_at = NOW(), updated_at = NOW()
            WHERE id = %s
        ''', (integration_id,))

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
