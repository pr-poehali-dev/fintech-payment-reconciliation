from typing import Any, Dict, List, Optional


def matches_keywords(purpose: str, keywords: List[str]) -> bool:
    '''
    Проверяет, содержит ли назначение платежа хотя бы одно из ключевых слов
    (регистронезависимо, простое вхождение подстроки).
    '''
    if not keywords:
        return True

    purpose_lower = (purpose or '').lower()
    return any(kw in purpose_lower for kw in keywords if kw)


def parse_keywords(raw_keywords: Optional[str]) -> List[str]:
    '''
    Разбирает строку "слово1, слово2, слово3" из настроек интеграции
    в список нормализованных (lowercase, без пробелов по краям) ключевых слов.
    '''
    if not raw_keywords or not isinstance(raw_keywords, str):
        return []
    return [w.strip().lower() for w in raw_keywords.split(',') if w.strip()]


def get_purpose_keywords(config: Optional[Dict[str, Any]]) -> List[str]:
    '''Достаёт список ключевых слов из конфига интеграции (поле purpose_keywords)'''
    if not config:
        return []
    return parse_keywords(config.get('purpose_keywords'))


def operation_purpose_text(operation: Dict[str, Any]) -> str:
    return (operation.get('payPurpose') or operation.get('description') or '').strip()
