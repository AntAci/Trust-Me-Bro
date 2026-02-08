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
    """Assign coordinates using radial layout by type."""
    if len(nodes) <= 1:
        for node in nodes:
            node["x"] = 0.0
            node["y"] = 0.0
            node.pop("_text", None)
        return
    
    # Use radial layout - much cleaner visualization
    coords = _radial_layout_by_type(nodes, seed)
    
    for node, (x, y) in zip(nodes, coords):
        node["x"] = float(x)
        node["y"] = float(y)
        node.pop("_text", None)


def _radial_layout_by_type(nodes: List[Dict[str, Any]], seed: int) -> List[Tuple[float, float]]:
    """
    Arrange nodes in concentric circles by type.
    Radii are calibrated to match frontend SVG ring circles.
    Frontend rings are at: 90, 180, 260, 330 pixels from center (600,350)
    With canvas half-width ~500 (accounting for padding), these map to ~0.18, 0.36, 0.52, 0.66
    """
    import math
    
    # Group nodes by type - radii matched to frontend ring circles
    type_order = ["ticket", "draft", "article", "version"]
    # Matched to frontend SVG: r=90, 180, 260, 330 relative to ~500px radius
    type_radii = {"ticket": 0.18, "draft": 0.36, "article": 0.52, "version": 0.66}
    
    nodes_by_type: Dict[str, List[int]] = {t: [] for t in type_order}
    for i, node in enumerate(nodes):
        node_type = node.get("type", "ticket")
        if node_type in nodes_by_type:
            nodes_by_type[node_type].append(i)
        else:
            nodes_by_type["ticket"].append(i)  # fallback
    
    coords = [(0.0, 0.0)] * len(nodes)
    rng = random.Random(seed)
    
    for node_type in type_order:
        indices = nodes_by_type[node_type]
        if not indices:
            continue
        
        base_radius = type_radii[node_type]
        n = len(indices)
        
        # Use golden angle for even distribution around the circle
        golden_angle = math.pi * (3 - math.sqrt(5))  # ~137.5 degrees
        base_angle_offset = rng.uniform(0, 2 * math.pi)
        
        for j, idx in enumerate(indices):
            # Golden angle distribution
            angle = base_angle_offset + j * golden_angle
            
            # Slight spiral for rings with many nodes
            spiral_offset = (j / max(n, 1)) * 0.06 if n > 8 else 0
            radius = base_radius + spiral_offset
            
            # Small jitter to prevent exact overlap
            radius += rng.uniform(-0.015, 0.015)
            angle += rng.uniform(-0.05, 0.05)
            
            x = radius * math.cos(angle)
            y = radius * math.sin(angle)
            
            coords[idx] = (x, y)
    
    return coords


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
    
    # Apply force-directed repulsion to spread overlapping nodes
    coords = _apply_repulsion(coords, seed=seed, iterations=50, min_distance=0.15)
    
    return [(float(x), float(y)) for x, y in coords]


def _apply_repulsion(coords: np.ndarray, seed: int = 42, iterations: int = 100, min_distance: float = 0.25) -> np.ndarray:
    """Apply force-directed repulsion to spread overlapping nodes."""
    rng = np.random.default_rng(seed)
    n = len(coords)
    if n < 2:
        return coords
    
    coords = coords.copy()
    
    # First pass: Add strong random jitter based on original position
    for i in range(n):
        angle = rng.uniform(0, 2 * np.pi)
        radius = rng.uniform(0.1, 0.3)
        coords[i, 0] += np.cos(angle) * radius
        coords[i, 1] += np.sin(angle) * radius
    
    # Multiple passes of force-directed repulsion
    for iteration in range(iterations):
        # Reduce force over iterations for stability
        strength = 1.0 - (iteration / iterations) * 0.5
        
        for i in range(n):
            for j in range(i + 1, n):
                dx = coords[j, 0] - coords[i, 0]
                dy = coords[j, 1] - coords[i, 1]
                distance = np.sqrt(dx * dx + dy * dy)
                
                if distance < min_distance and distance > 0.001:
                    # Push nodes apart
                    force = (min_distance - distance) * strength
                    nx = dx / distance
                    ny = dy / distance
                    coords[i, 0] -= nx * force
                    coords[i, 1] -= ny * force
                    coords[j, 0] += nx * force
                    coords[j, 1] += ny * force
                elif distance < 0.001:
                    # Nodes at same position - add random offset
                    angle = rng.uniform(0, 2 * np.pi)
                    offset = min_distance
                    coords[i, 0] -= np.cos(angle) * offset
                    coords[i, 1] -= np.sin(angle) * offset
                    coords[j, 0] += np.cos(angle) * offset
                    coords[j, 1] += np.sin(angle) * offset
    
    # Normalize back to [-1, 1] range with margin
    max_val = float(np.max(np.abs(coords))) if coords.size else 1.0
    if max_val > 0:
        coords = coords / max_val * 0.9  # Leave 10% margin
    
    return coords


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
