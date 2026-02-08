from __future__ import annotations

import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, Optional

from fastapi import Body, Depends, FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import func, text

from analytics.galaxy import build_galaxy_layout
from analytics.grounding import compute_grounding
from db import get_engine, get_session, init_db
from db.models import EvidenceUnit, KBDraft, KBLineageEdge, PublishedKBArticle, KBArticleVersion
from generation.generator import generate_kb_draft
from generation.governance import approve_draft, reject_draft
from generation.lineage import write_lineage_edges
from generation.publish import publish_draft

logger = logging.getLogger("trust_me_bro.api")

DB_PATH = os.getenv("DB_PATH", "trust_me_bro.db")
engine = get_engine(DB_PATH)
init_db(engine)

app = FastAPI(title="Trust-Me-Bro Trust Signals API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://127.0.0.1:8080",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_origin_regex=r"https?://(localhost|127\\.0\\.0\\.1)(:\\d+)?",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_db():
    session = get_session(engine)
    try:
        yield session
    finally:
        session.close()


@app.exception_handler(HTTPException)
async def http_exception_handler(request: Request, exc: HTTPException):
    return JSONResponse(status_code=exc.status_code, content={"error": exc.detail})


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled exception: %s", exc)
    return JSONResponse(status_code=500, content={"error": "Internal server error"})


@app.get("/api/metrics")
def get_metrics(session=Depends(get_db)):
    drafts_by_status = _drafts_by_status(session)
    return {
        "tickets_count": _safe_count(session, "raw_tickets"),
        "evidence_units_count": session.query(func.count(EvidenceUnit.evidence_unit_id)).scalar()
        or 0,
        "drafts_pending": drafts_by_status.get("draft", 0),
        "drafts_approved": drafts_by_status.get("approved", 0),
        "drafts_rejected": drafts_by_status.get("rejected", 0),
        "published_articles_count": session.query(
            func.count(PublishedKBArticle.kb_article_id)
        ).scalar()
        or 0,
        "provenance_edges_count": session.query(func.count(KBLineageEdge.edge_id)).scalar()
        or 0,
    }


@app.get("/api/tickets")
def list_tickets(
    limit: int = Query(50, ge=1, le=500),
    search: Optional[str] = Query(None),
    session=Depends(get_db),
):
    query = """
        SELECT Ticket_Number, Subject, Status, Category, Module
        FROM raw_tickets
    """
    params: Dict[str, Any] = {}
    if search:
        query += " WHERE lower(Ticket_Number) LIKE :pattern OR lower(Subject) LIKE :pattern"
        params["pattern"] = f"%{search.lower()}%"
    query += " ORDER BY Ticket_Number DESC LIMIT :limit"
    params["limit"] = limit
    rows = session.execute(text(query), params).mappings().all()
    return [
        {
            "ticket_id": str(row.get("Ticket_Number")),
            "ticket_number": str(row.get("Ticket_Number")),
            "subject": str(row.get("Subject") or ""),
            "status": str(row.get("Status") or ""),
            "category": str(row.get("Category") or "") or None,
            "module": str(row.get("Module") or "") or None,
        }
        for row in rows
    ]


@app.post("/api/drafts/generate")
def generate_draft_endpoint(
    payload: Dict[str, Any] = Body(...),
    session=Depends(get_db),
):
    ticket_id = payload.get("ticket_id")
    generation_mode = payload.get("generation_mode") or "rlm"
    if not ticket_id:
        raise HTTPException(status_code=400, detail="ticket_id is required")
    api_key = os.getenv("OPENAI_API_KEY")
    try:
        draft, case_json = generate_kb_draft(
            ticket_id=str(ticket_id),
            session=session,
            api_key=api_key,
            generation_mode=generation_mode,
        )
        write_lineage_edges(draft, case_json, session)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "draft_id": draft.draft_id,
        "draft": _serialize_draft(session, draft),
    }


@app.get("/api/drafts/{draft_id}")
def get_draft(draft_id: str, session=Depends(get_db)):
    draft = session.query(KBDraft).filter(KBDraft.draft_id == draft_id).one_or_none()
    if not draft:
        raise HTTPException(status_code=404, detail="Draft not found")
    return _serialize_draft(session, draft)


@app.post("/api/drafts/{draft_id}/approve")
def approve_draft_endpoint(
    draft_id: str,
    payload: Dict[str, Any] = Body(...),
    session=Depends(get_db),
):
    reviewer = payload.get("reviewer") or "Reviewer"
    notes = payload.get("notes")
    try:
        draft = approve_draft(session, draft_id, reviewer=reviewer, notes=notes)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _serialize_draft(session, draft)


@app.post("/api/drafts/{draft_id}/reject")
def reject_draft_endpoint(
    draft_id: str,
    payload: Dict[str, Any] = Body(...),
    session=Depends(get_db),
):
    reviewer = payload.get("reviewer") or "Reviewer"
    notes = payload.get("notes")
    try:
        draft = reject_draft(session, draft_id, reviewer=reviewer, notes=notes)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return _serialize_draft(session, draft)


@app.post("/api/drafts/{draft_id}/publish")
def publish_draft_endpoint(
    draft_id: str,
    payload: Dict[str, Any] = Body(...),
    session=Depends(get_db),
):
    reviewer = payload.get("reviewer") or "Reviewer"
    note = payload.get("note")
    kb_article_id = payload.get("kb_article_id")
    try:
        article = publish_draft(
            session,
            draft_id=draft_id,
            reviewer=reviewer,
            change_note=note,
            kb_article_id=kb_article_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    return {
        "kb_article_id": article.kb_article_id,
        "version": article.current_version,
    }


@app.get("/api/articles/{kb_article_id}")
def get_article(kb_article_id: str, session=Depends(get_db)):
    article = (
        session.query(PublishedKBArticle)
        .filter(PublishedKBArticle.kb_article_id == kb_article_id)
        .one_or_none()
    )
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    return _serialize_article(article)


@app.get("/api/articles/{kb_article_id}/versions")
def get_article_versions(kb_article_id: str, session=Depends(get_db)):
    versions = (
        session.query(KBArticleVersion)
        .filter(KBArticleVersion.kb_article_id == kb_article_id)
        .order_by(KBArticleVersion.version.asc())
        .all()
    )
    return [_serialize_version(version) for version in versions]


@app.get("/api/provenance")
def get_provenance(kb_article_id: str = Query(...), session=Depends(get_db)):
    article = (
        session.query(PublishedKBArticle)
        .filter(PublishedKBArticle.kb_article_id == kb_article_id)
        .one_or_none()
    )
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    grouped = session.execute(
        text(
            """
            SELECT le.section_label AS section_label,
                   eu.source_type AS source_type,
                   COUNT(*) AS count
            FROM kb_lineage_edges le
            JOIN evidence_units eu
                ON eu.evidence_unit_id = le.evidence_unit_id
            WHERE le.draft_id = :draft_id
            GROUP BY le.section_label, eu.source_type
            ORDER BY le.section_label, eu.source_type
            """
        ),
        {"draft_id": article.latest_draft_id},
    ).mappings().all()

    total_edges = session.execute(
        text("SELECT COUNT(*) AS count FROM kb_lineage_edges WHERE draft_id = :draft_id"),
        {"draft_id": article.latest_draft_id},
    ).scalar()
    return {
        "kb_article_id": article.kb_article_id,
        "latest_draft_id": article.latest_draft_id,
        "grouped": [dict(row) for row in grouped],
        "total_edges": int(total_edges or 0),
    }


@app.get("/api/provenance/evidence")
def get_evidence_units(
    kb_article_id: str = Query(...),
    section_label: str = Query(...),
    source_type: str = Query(...),
    limit: int = Query(20, ge=1, le=200),
    offset: int = Query(0, ge=0),
    session=Depends(get_db),
):
    article = (
        session.query(PublishedKBArticle)
        .filter(PublishedKBArticle.kb_article_id == kb_article_id)
        .one_or_none()
    )
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    rows = session.execute(
        text(
            """
            SELECT eu.evidence_unit_id,
                   eu.source_type,
                   eu.source_id,
                   eu.field_name,
                   eu.snippet_text
            FROM kb_lineage_edges le
            JOIN evidence_units eu
                ON eu.evidence_unit_id = le.evidence_unit_id
            WHERE le.draft_id = :draft_id
              AND le.section_label = :section_label
              AND eu.source_type = :source_type
            ORDER BY eu.evidence_unit_id
            LIMIT :limit OFFSET :offset
            """
        ),
        {
            "draft_id": article.latest_draft_id,
            "section_label": section_label,
            "source_type": source_type,
            "limit": limit,
            "offset": offset,
        },
    ).mappings().all()

    total = session.execute(
        text(
            """
            SELECT COUNT(*) AS count
            FROM kb_lineage_edges le
            JOIN evidence_units eu
                ON eu.evidence_unit_id = le.evidence_unit_id
            WHERE le.draft_id = :draft_id
              AND le.section_label = :section_label
              AND eu.source_type = :source_type
            """
        ),
        {
            "draft_id": article.latest_draft_id,
            "section_label": section_label,
            "source_type": source_type,
        },
    ).scalar()

    return {
        "evidence_units": [dict(row) for row in rows],
        "total": int(total or 0),
        "limit": limit,
        "offset": offset,
    }


@app.get("/api/galaxy")
def get_galaxy(
    limit: int = Query(800, ge=1, le=5000),
    seed: int = Query(42, ge=0, le=2**31 - 1),
    session=Depends(get_db),
):
    nodes, edges, highlights = build_galaxy_layout(session, limit=limit, seed=seed)
    return {
        "computed_at": datetime.utcnow().isoformat(),
        "layout": {"method": "tfidf+svd2", "seed": seed, "limit": limit},
        "nodes": nodes,
        "edges": edges,
        "highlights": highlights,
    }


@app.get("/api/drafts/{draft_id}/grounding")
def grounding_for_draft(
    draft_id: str,
    threshold: float = Query(0.28, ge=0.0, le=1.0),
    max_claims: int = Query(80, ge=1, le=500),
    session=Depends(get_db),
):
    try:
        return compute_grounding(
            session,
            draft_id=draft_id,
            threshold=threshold,
            max_claims=max_claims,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.get("/api/articles/{kb_article_id}/grounding")
def grounding_for_article(
    kb_article_id: str,
    threshold: float = Query(0.28, ge=0.0, le=1.0),
    max_claims: int = Query(80, ge=1, le=500),
    session=Depends(get_db),
):
    try:
        return compute_grounding(
            session,
            kb_article_id=kb_article_id,
            threshold=threshold,
            max_claims=max_claims,
        )
    except ValueError as exc:
        raise HTTPException(status_code=404, detail=str(exc)) from exc


@app.post("/api/demo/publish_v2")
def demo_publish_v2(
    payload: Dict[str, Any] = Body(...),
    session=Depends(get_db),
):
    kb_article_id = payload.get("kb_article_id")
    ticket_id = payload.get("ticket_id")
    reviewer = payload.get("reviewer") or "Demo"
    note = payload.get("note") or "v2 update"
    if not kb_article_id or not ticket_id:
        raise HTTPException(
            status_code=400, detail="kb_article_id and ticket_id are required"
        )
    try:
        draft, _ = generate_kb_draft(ticket_id=ticket_id, session=session, api_key=None)
        approve_draft(session, draft.draft_id, reviewer=reviewer, notes=note)
        article = publish_draft(
            session,
            draft_id=draft.draft_id,
            reviewer=reviewer,
            change_note=note,
            kb_article_id=kb_article_id,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return {
        "kb_article_id": article.kb_article_id,
        "version": article.current_version,
        "latest_draft_id": article.latest_draft_id,
    }


def _safe_count(session, table_name: str) -> int:
    try:
        result = session.execute(text(f"SELECT COUNT(*) AS count FROM {table_name}"))
        return int(result.scalar() or 0)
    except Exception:
        return 0


def _drafts_by_status(session) -> Dict[str, int]:
    rows = session.query(KBDraft.status, func.count(KBDraft.draft_id)).group_by(
        KBDraft.status
    )
    return {status: int(count) for status, count in rows}


def _serialize_draft(session, draft: KBDraft) -> Dict[str, Any]:
    return {
        "draft_id": draft.draft_id,
        "ticket_id": draft.ticket_id,
        "title": draft.title,
        "body_markdown": draft.body_markdown,
        "case_json": _inject_case_counts(session, draft),
        "status": _map_draft_status(draft.status),
        "reviewer": draft.reviewer,
        "reviewed_at": _iso(draft.reviewed_at),
        "review_notes": draft.review_notes,
        "published_at": _iso(draft.published_at),
        "created_at": _iso(draft.created_at),
    }


def _serialize_article(article: PublishedKBArticle) -> Dict[str, Any]:
    return {
        "kb_article_id": article.kb_article_id,
        "latest_draft_id": article.latest_draft_id,
        "title": article.title,
        "body_markdown": article.body_markdown,
        "module": article.module,
        "category": article.category,
        "tags_json": article.tags_json,
        "source_type": article.source_type,
        "source_ticket_id": article.source_ticket_id,
        "current_version": article.current_version,
        "created_at": _iso(article.created_at),
        "updated_at": _iso(article.updated_at),
    }


def _serialize_version(version: KBArticleVersion) -> Dict[str, Any]:
    return {
        "version_id": version.version_id,
        "kb_article_id": version.kb_article_id,
        "version": version.version,
        "source_draft_id": version.source_draft_id,
        "body_markdown": version.body_markdown,
        "title": version.title,
        "reviewer": version.reviewer,
        "change_note": version.change_note,
        "is_rollback": bool(version.is_rollback),
        "created_at": _iso(version.created_at),
    }


def _inject_case_counts(session, draft: KBDraft) -> Optional[str]:
    if not draft.case_json:
        return None
    try:
        data = json.loads(draft.case_json)
    except json.JSONDecodeError:
        return draft.case_json
    evidence_counts = session.execute(
        text(
            """
            SELECT eu.source_type AS source_type, COUNT(*) AS count
            FROM kb_lineage_edges le
            JOIN evidence_units eu
                ON eu.evidence_unit_id = le.evidence_unit_id
            WHERE le.draft_id = :draft_id
            GROUP BY eu.source_type
            """
        ),
        {"draft_id": draft.draft_id},
    ).mappings().all()
    section_counts = session.execute(
        text(
            """
            SELECT le.section_label AS section_label, COUNT(*) AS count
            FROM kb_lineage_edges le
            WHERE le.draft_id = :draft_id
            GROUP BY le.section_label
            """
        ),
        {"draft_id": draft.draft_id},
    ).mappings().all()
    data["evidence_counts"] = {row["source_type"]: int(row["count"]) for row in evidence_counts}
    data["section_counts"] = {row["section_label"]: int(row["count"]) for row in section_counts}
    return json.dumps(data)


def _map_draft_status(status: str) -> str:
    if status == "draft":
        return "pending"
    if status == "published":
        return "approved"
    if status == "superseded":
        return "rejected"
    return status


def _iso(value: Optional[datetime]) -> Optional[str]:
    if not value:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)
