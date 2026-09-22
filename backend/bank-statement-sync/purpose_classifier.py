import re
from typing import Any, Dict, Optional

# Категории назначения платежа, которые нас интересуют для сверки выручки:
# - acquiring_online: расчёты по интернет-эквайрингу (агрегаторы, оплата на сайте)
# - acquiring_offline: расчёты по торговому (POS) эквайрингу в точке продаж
# - individual_direct: прямая оплата от физического лица на р/с (не через эквайринг)
# Всё остальное (налоги, зарплата, переводы между своими счетами, займы и т.д.)
# попадает в 'other' и по умолчанию не учитывается.

ONLINE_PATTERNS = [
    r'интернет.?эквайр',
    r'e.?commerce',
    r'электронн\w+\s+торгов',
    r'юkassa', r'yookassa', r'ю.?касс',
    r'cloudpayments', r'robokassa', r'paymaster',
    r'т.?касса', r'tinkoff\s?kassa',
    r'оплата\s+заказа', r'оплата\s+на\s+сайте'
]

OFFLINE_PATTERNS = [
    r'торгов\w*\s+эквайр',
    r'эквайринг.*терминал',
    r'по\s+терминалу',
    r'выручка.*эквайр',
    r'инкассация.*терминал',
    r'pos.?терминал'
]

INDIVIDUAL_PATTERNS = [
    r'от\s+физическ\w+\s+лица',
    r'систем\w+\s+быстрых\s+платежей',
    r'\bсбп\b',
    r'пополнение.*счет\w*\s+от\s+физ',
]

LEGAL_ENTITY_MARKERS = ['ооо', 'зао', 'оао', 'пао', 'нко', 'ип ', 'ao ', 'ao«', 'ао ', 'ао«']

# Государственные и бюджетные организации (ФНС, суды, фонды и т.п.) не являются
# оплатой от физлица, даже если в тестовых данных банка у них указан ИНН
# нетипичной длины - явно исключаем такие платежи (обычно это налоги/штрафы/сборы).
GOVERNMENT_MARKERS = [
    'ифнс', 'фнс', 'налогов', 'казначейств', 'пенсионн', 'фсс', 'фомс',
    'суд', 'госпошлин', 'таможен', 'администрация', 'минфин', 'росреестр'
]


def _matches_any(text: str, patterns) -> bool:
    return any(re.search(p, text, re.IGNORECASE) for p in patterns)


def classify_purpose(operation: Dict[str, Any]) -> str:
    '''
    Определяет категорию назначения платежа по тексту назначения и данным контрагента.
    Это эвристика по ключевым словам, а не официальный справочник банка -
    формат payPurpose в реальных выписках сильно варьируется от компании к компании.
    '''
    purpose = (operation.get('payPurpose') or operation.get('description') or '').strip()

    if _matches_any(purpose, ONLINE_PATTERNS):
        return 'acquiring_online'

    if _matches_any(purpose, OFFLINE_PATTERNS):
        return 'acquiring_offline'

    if _matches_any(purpose, INDIVIDUAL_PATTERNS):
        return 'individual_direct'

    counterparty = operation.get('counterParty') or {}
    inn = (counterparty.get('inn') or '').strip()
    name = (counterparty.get('name') or '').lower()
    direction = 'in' if operation.get('typeOfOperation') == 'Credit' else 'out'

    if any(marker in name for marker in GOVERNMENT_MARKERS):
        return 'other'

    # ИНН из 12 цифр — признак физлица или ИП. Если в названии нет маркеров
    # юрлица/ИП/госоргана, считаем прямой оплатой от физического лица на счёт.
    if direction == 'in' and len(inn) == 12 and not any(marker in name for marker in LEGAL_ENTITY_MARKERS):
        return 'individual_direct'

    return 'other'


DEFAULT_INCLUDED_CATEGORIES = ['acquiring_online', 'acquiring_offline', 'individual_direct']

CATEGORY_LABELS = {
    'acquiring_online': 'Интернет-эквайринг',
    'acquiring_offline': 'Торговый эквайринг',
    'individual_direct': 'Оплата от физлица напрямую',
    'other': 'Прочее (не учитывается)'
}


def get_included_categories(config: Optional[Dict[str, Any]]) -> list:
    if not config:
        return DEFAULT_INCLUDED_CATEGORIES
    categories = config.get('purpose_categories')
    if not categories or not isinstance(categories, list):
        return DEFAULT_INCLUDED_CATEGORIES
    return categories