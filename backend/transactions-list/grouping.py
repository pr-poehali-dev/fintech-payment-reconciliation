import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple
from zoneinfo import ZoneInfo


def node_key(t: Dict[str, Any]) -> str:
    return f"{t['type']}:{t['source']}:{t['id']}"


class UnionFind:
    def __init__(self):
        self.parent: Dict[str, str] = {}

    def find(self, x: str) -> str:
        self.parent.setdefault(x, x)
        root = x
        while self.parent[root] != root:
            root = self.parent[root]
        while self.parent[x] != root:
            self.parent[x], x = root, self.parent[x]
        return root

    def union(self, a: str, b: str):
        ra, rb = self.find(a), self.find(b)
        if ra != rb:
            self.parent[ra] = rb


def auto_link_target(t: Dict[str, Any], by_key: Dict[str, Dict[str, Any]]) -> Optional[str]:
    if t.get('link_excluded') or not t.get('linked_id') or not t.get('linked_type') or not t.get('linked_source'):
        return None
    b = f"{t['linked_type']}:{t['linked_source']}:{t['linked_id']}"
    target = by_key.get(b)
    if not target or target.get('link_excluded'):
        return None
    return b


def group_transactions(rows: List[Dict[str, Any]]) -> List[List[Dict[str, Any]]]:
    '''Та же группировка, что на фронте (transactionGrouping.ts): авто-связи + ручные группы.'''
    by_key = {node_key(t): t for t in rows}
    uf = UnionFind()
    for t in rows:
        a = node_key(t)
        uf.find(a)
        b = auto_link_target(t, by_key)
        if b:
            uf.union(a, b)
    manual: Dict[str, str] = {}
    for t in rows:
        g = t.get('manual_group_id')
        if not g:
            continue
        if g in manual:
            uf.union(manual[g], node_key(t))
        else:
            manual[g] = node_key(t)

    groups: Dict[str, List[Dict[str, Any]]] = {}
    order: List[str] = []
    for t in rows:
        root = uf.find(node_key(t))
        if root not in groups:
            groups[root] = []
            order.append(root)
        groups[root].append(t)
    return [groups[r] for r in order]


def matched_keys(rows: List[Dict[str, Any]]) -> Set[str]:
    keys: Set[str] = set()
    for g in group_transactions(rows):
        if len(g) > 1:
            keys.update(node_key(t) for t in g)
    return keys


def parse_amount_query(query: str) -> Optional[Tuple[float, str]]:
    cleaned = re.sub(r'(₽|руб\.?|р\.?)$', '', query.strip(), flags=re.IGNORECASE)
    cleaned = re.sub(r'[\s\u00a0]', '', cleaned)
    cleaned = re.sub(r'^[+-]', '', cleaned).replace(',', '.', 1)
    if not re.fullmatch(r'\d+(\.\d{1,2})?', cleaned):
        return None
    return float(cleaned), cleaned


def local_date(occurred_at: Optional[str], tz: ZoneInfo) -> Optional[str]:
    if not occurred_at:
        return None
    dt = datetime.fromisoformat(occurred_at)
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(tz).date().isoformat()


def matches_filters(
    t: Dict[str, Any],
    matched: Set[str],
    unmatched_only: bool,
    date_from: Optional[str],
    date_to: Optional[str],
    tz: ZoneInfo,
    search: str,
) -> bool:
    if unmatched_only and node_key(t) in matched:
        return False

    if date_from or date_to:
        # Зачисление эквайринга относится к дню ПРОДАЖ (settlement_date из
        # назначения "за ДД.ММ.ГГГГ"), а не к дню поступления - как в "Сверке".
        # Даты выписки банка календарные, без времени - сравниваем как есть.
        if t.get('type') == 'money':
            day = t.get('settlement_date') or (t.get('occurred_at') or '')[:10] or None
        else:
            day = local_date(t.get('occurred_at'), tz)
        if not day:
            return False
        if date_from and day < date_from:
            return False
        if date_to and day > date_to:
            return False

    if not search.strip():
        return True

    numeric = parse_amount_query(search)
    if numeric is not None:
        value, raw = numeric
        amount_matches = abs(abs(float(t.get('amount') or 0)) - value) < 0.005
        m = re.search(r'#\s*(\S+)', t.get('title') or '')
        doc_number = m.group(1) if m else None
        number_matches = raw == doc_number or raw == str(t.get('reference') or '')
        return amount_matches or number_matches

    q = search.lower()
    haystack = ' '.join(
        str(v) for v in (
            t.get('title'), t.get('subtitle'), t.get('integration_name'),
            t.get('reference'), t.get('status'), t.get('amount'),
        ) if v is not None
    ).lower()
    return q in haystack


def latest_time(group: List[Dict[str, Any]]) -> str:
    return max((t.get('occurred_at') or '') for t in group)
