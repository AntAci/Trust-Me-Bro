from __future__ import annotations

import hashlib
import random
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional, Tuple

from sqlalchemy import func, text

from db.models import KBArticleVersion, KBDraft, PublishedKBArticle

try:
    import numpy as np
    from sklearn.decomposition import TruncatedSVD
    from sklearn.feature_extraction.text import TfidfVectorizer

    _SKLEARN_AVAILABLE = True
except Exception:
    _SKLEARN_AVAILABLE = False

_CACHE: Dict[Tuple[str, int, int, Optional[str]], Dict[str, Any]] = {}


def build_galaxy_layout(session, limit: int = 800, seed: int = 42):
    db_key = str(session.get_bind().url)
    latest_updated_at = _get_latest_updated_at(session)
    cache_key = (db_key, limit, seed, latest_updated_at)
    cached = _CACHE.get(cache_key)
    if cached:
        return cached["nodes"], cached["edges"], cached["highlights"]

    articles = (
        session.query(PublishedKBArticle)
        .order_by(PublishedKBArticle.updated_at.desc())
        .all()
    )
    article_ids = [article.kb_article_id for article in articles]
    versions = _fetch_versions(session, article_ids)

    ticket_ids = {article.source_ticket_id for article in articles if article.source_ticket_id}
    drafts = _fetch_latest_drafts(session, ticket_ids)

    tickets = _fetch_tickets(session, ticket_ids)

    nodes: List[Dict[str, Any]] = []
    edges: List[Dict[str, Any]] = []

    for article in articles:
        nodes.append(_article_node(article))
    for version in versions:
        nodes.append(_version_node(version))
    for draft in drafts.values():
        nodes.append(_draft_node(draft))
    for ticket in tickets:
        nodes.append(_ticket_node(ticket))

    if not nodes:
        return [], [], {"latest_published_version_node_id": None}

    nodes = _downsample_nodes(nodes, limit=limit, seed=seed)
    node_ids = {node["id"] for node in nodes}

    edges.extend(_build_ticket_to_draft_edges(tickets, drafts, node_ids))
    edges.extend(_build_draft_to_article_edges(articles, drafts, node_ids))
    edges.extend(_build_version_chain_edges(versions, node_ids))

    _assign_coordinates(nodes, seed)

    highlights = {"latest_published_version_node_id": _latest_version_node_id(versions)}

    _CACHE.clear()
    _CACHE[cache_key] = {"nodes": nodes, "edges": edges, "highlights": highlights}
    return nodes, edges, highlights


def _get_latest_updated_at(session) -> Optional[str]:
    article_updated = session.query(func.max(PublishedKBArticle.updated_at)).scalar()
    version_created = session.query(func.max(KBArticleVersion.created_at)).scalar()
    latest = max([value for value in [article_updated, version_created] if value], default=None)
    return latest.isoformat() if latest else None


def _fetch_versions(session, article_ids: Iterable[str]) -> List[KBArticleVersion]:
    if not article_ids:
        return []
    return (
        session.query(KBArticleVersion)
        .filter(KBArticleVersion.kb_article_id.in_(list(article_ids)))
        .order_by(KBArticleVersion.kb_article_id, KBArticleVersion.version)
        .all()
    )


def _fetch_latest_drafts(session, ticket_ids: Iterable[str]) -> Dict[str, KBDraft]:
    if not ticket_ids:
        return {}
    drafts = (
        session.query(KBDraft)
        .filter(KBDraft.ticket_id.in_(list(ticket_ids)))
        .order_by(KBDraft.ticket_id, KBDraft.created_at.desc())
        .all()
    )
    latest: Dict[str, KBDraft] = {}
    for draft in drafts:
        if draft.ticket_id not in latest:
            latest[draft.ticket_id] = draft
    return latest


def _fetch_tickets(session, ticket_ids: Iterable[str]) -> List[Dict[str, Any]]:
    ticket_ids = [ticket_id for ticket_id in ticket_ids if ticket_id]
    if not ticket_ids:
        return []
    placeholders = ", ".join([f":t{i}" for i in range(len(ticket_ids))])
    params = {f"t{i}": ticket_id for i, ticket_id in enumerate(ticket_ids)}
    query = text(
        "SELECT Ticket_Number, Subject, Description, Status, Module, Category, Product "
        f"FROM raw_tickets WHERE Ticket_Number IN ({placeholders})"
    )
    rows = session.execute(query, params).mappings().all()
    return [dict(row) for row in rows]


def _article_node(article: PublishedKBArticle) -> Dict[str, Any]:
    return {
        "id": f"article:{article.kb_article_id}",
        "type": "article",
        "label": article.title or "Untitled",
        "x": 0.0,
        "y": 0.0,
        "created_at": _iso(article.created_at),
        "status": None,
        "version": article.current_version,
        "meta": {
            "module": article.module,
            "category": article.category,
            "source_ticket_id": article.source_ticket_id,
        },
        "_text": f"{article.title or ''} {article.body_markdown or ''}",
    }


def _version_node(version: KBArticleVersion) -> Dict[str, Any]:
    return {
        "id": f"version:{version.version_id}",
        "type": "version",
        "label": version.title or f"Version {version.version}",
        "x": 0.0,
        "y": 0.0,
        "created_at": _iso(version.created_at),
        "status": None,
        "version": version.version,
        "meta": {
            "kb_article_id": version.kb_article_id,
            "source_draft_id": version.source_draft_id,
        },
        "_text": f"{version.title or ''} {version.body_markdown or ''}",
    }


def _draft_node(draft: KBDraft) -> Dict[str, Any]:
    return {
        "id": f"draft:{draft.draft_id}",
        "type": "draft",
        "label": draft.title or "Draft",
        "x": 0.0,
        "y": 0.0,
        "created_at": _iso(draft.created_at),
        "status": draft.status,
        "version": None,
        "meta": {"ticket_id": draft.ticket_id},
        "_text": f"{draft.title or ''} {draft.body_markdown or ''}",
    }


def _ticket_node(ticket: Dict[str, Any]) -> Dict[str, Any]:
    ticket_id = ticket.get("Ticket_Number") or "UNKNOWN"
    subject = ticket.get("Subject") or ""
    description = ticket.get("Description") or ""
    label = subject.strip() or ticket_id
    return {
        "id": f"ticket:{ticket_id}",
        "type": "ticket",
        "label": label,
        "x": 0.0,
        "y": 0.0,
        "created_at": None,
        "status": ticket.get("Status"),
        "version": None,
        "meta": {
            "ticket_id": ticket_id,
            "module": ticket.get("Module"),
            "category": ticket.get("Category"),
            "product": ticket.get("Product"),
        },
        "_text": f"{subject} {description}",
    }


def _downsample_nodes(nodes: List[Dict[str, Any]], limit: int, seed: int) -> List[Dict[str, Any]]:
    if limit <= 0 or len(nodes) <= limit:
        return nodes
    rng = random.Random(seed)
    nodes = nodes[:]
    rng.shuffle(nodes)
    return nodes[:limit]


def _build_ticket_to_draft_edges(
    tickets: Iterable[Dict[str, Any]],
    drafts: Dict[str, KBDraft],
    node_ids: set,
) -> List[Dict[str, Any]]:
    edges = []
    for ticket in tickets:
        ticket_id = ticket.get("Ticket_Number")
        if not ticket_id or ticket_id not in drafts:
            continue
        from_id = f"ticket:{ticket_id}"
        to_id = f"draft:{drafts[ticket_id].draft_id}"
        if from_id in node_ids and to_id in node_ids:
            edges.append({"from": from_id, "to": to_id, "type": "ticket_to_draft"})
    return edges


def _build_draft_to_article_edges(
    articles: Iterable[PublishedKBArticle],
    drafts: Dict[str, KBDraft],
    node_ids: set,
) -> List[Dict[str, Any]]:
    edges = []
    drafts_by_id = {draft.draft_id: draft for draft in drafts.values()}
    for article in articles:
        article_id = f"article:{article.kb_article_id}"
        draft_id = article.latest_draft_id
        draft_node_id = f"draft:{draft_id}"
        if draft_id and draft_node_id in node_ids and article_id in node_ids:
            edges.append({"from": draft_node_id, "to": article_id, "type": "draft_to_article"})
            continue
        ticket_id = article.source_ticket_id
        if ticket_id and ticket_id in drafts:
            draft = drafts[ticket_id]
            draft_node_id = f"draft:{draft.draft_id}"
            if draft_node_id in node_ids and article_id in node_ids:
                edges.append({"from": draft_node_id, "to": article_id, "type": "draft_to_article"})
    return edges


def _build_version_chain_edges(
    versions: Iterable[KBArticleVersion], node_ids: set
) -> List[Dict[str, Any]]:
    edges = []
    by_article: Dict[str, List[KBArticleVersion]] = {}
    for version in versions:
        by_article.setdefault(version.kb_article_id, []).append(version)
    for version_list in by_article.values():
        version_list = sorted(version_list, key=lambda v: v.version)
        for prev, curr in zip(version_list, version_list[1:]):
            from_id = f"version:{prev.version_id}"
            to_id = f"version:{curr.version_id}"
            if from_id in node_ids and to_id in node_ids:
                edges.append({"from": from_id, "to": to_id, "type": "version_chain"})
    return edges


def _assign_coordinates(nodes: List[Dict[str, Any]], seed: int) -> None:
    texts = [node.get("_text", "") for node in nodes]
    if len(nodes) <= 1:
        for node in nodes:
            node["x"] = 0.0
            node["y"] = 0.0
            node.pop("_text", None)
        return
    if _SKLEARN_AVAILABLE:
        coords = _tfidf_svd_coords(texts, seed)
    else:
        coords = _hashed_coords(texts, seed)
    for node, (x, y) in zip(nodes, coords):
        node["x"] = float(x)
        node["y"] = float(y)
        node.pop("_text", None)


def _tfidf_svd_coords(texts: List[str], seed: int) -> List[Tuple[float, float]]:
    vectorizer = TfidfVectorizer(max_features=500, stop_words="english")
    tfidf_matrix = vectorizer.fit_transform(texts)
    if tfidf_matrix.shape[0] < 2:
        return [(0.0, 0.0) for _ in texts]
    svd = TruncatedSVD(n_components=2, random_state=seed)
    coords = svd.fit_transform(tfidf_matrix)
    max_val = float(np.max(np.abs(coords))) if coords.size else 0.0
    if max_val <= 0:
        return [(0.0, 0.0) for _ in texts]
    coords = coords / max_val
    return [(float(x), float(y)) for x, y in coords]


def _hashed_coords(texts: List[str], seed: int) -> List[Tuple[float, float]]:
    coords = []
    for text_value in texts:
        digest = hashlib.md5(text_value.encode("utf-8")).hexdigest()
        numeric = int(digest[:8], 16)
        rng = random.Random(seed + numeric)
        coords.append((rng.uniform(-1, 1), rng.uniform(-1, 1)))
    return coords


def _latest_version_node_id(versions: Iterable[KBArticleVersion]) -> Optional[str]:
    latest: Optional[KBArticleVersion] = None
    for version in versions:
        if latest is None or (version.created_at and version.created_at > latest.created_at):
            latest = version
    return f"version:{latest.version_id}" if latest else None


def _iso(value: Optional[datetime]) -> Optional[str]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)
