import urllib.parse
from typing import Dict, Any


def parse_bracket_form(body: str) -> Dict[str, Any]:
    '''
    Разбирает application/x-www-form-urlencoded тело вида
    data[FIELDS][ID]=123&auth[domain]=x.bitrix24.ru
    в обычный вложенный dict. Такой формат шлют исходящие вебхуки
    Битрикс24 и часть вебхуков AmoCRM.
    '''
    pairs = urllib.parse.parse_qsl(body, keep_blank_values=True)
    result: Dict[str, Any] = {}

    for raw_key, value in pairs:
        # a[b][c] -> ['a', 'b', 'c']; a[] -> ['a', ''] (пустые скобки - элемент списка).
        head, _, rest = raw_key.partition('[')
        parts = [head] + ([p for p in rest.rstrip(']').split('][')] if rest else [])

        node = result
        for i, part in enumerate(parts):
            is_last = i == len(parts) - 1
            key = part if part != '' else str(len(node)) if isinstance(node, dict) else part
            if is_last:
                node[key] = value
            else:
                if key not in node or not isinstance(node[key], dict):
                    node[key] = {}
                node = node[key]

    return result


def parse_webhook_body(body: str, content_type: str) -> Dict[str, Any]:
    '''
    Универсальный разбор тела вебхука: JSON для большинства провайдеров (Т-Банк),
    form-urlencoded с вложенными ключами для Битрикс24/AmoCRM.
    '''
    import json

    body = body or ''
    if 'application/x-www-form-urlencoded' in (content_type or ''):
        return parse_bracket_form(body)

    try:
        return json.loads(body) if body else {}
    except json.JSONDecodeError:
        return parse_bracket_form(body)
