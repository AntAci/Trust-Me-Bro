from __future__ import annotations

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
from db.models import EvidenceUnit, KBDraft, KBLineageEdge, PublishedKBArticle
from generation.generator import generate_kb_draft
from generation.governance import approve_draft
from generation.publish import publish_draft

logger = logging.getLogger("trust_me_bro.api")

DB_PATH = os.getenv("DB_PATH", "trust_me_bro.db")
engine = get_engine(DB_PATH)
init_db(engine)

app = FastAPI(title="Trust-Me-Bro Trust Signals API")

app.add_middleware(
    CORSMiddleware,
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
    return {
        "tickets_loaded": _safe_count(session, "raw_tickets"),
        "evidence_units": session.query(func.count(EvidenceUnit.evidence_unit_id)).scalar() or 0,
        "drafts_by_status": _drafts_by_status(session),
        "published_articles": session.query(
            func.count(PublishedKBArticle.kb_article_id)
        ).scalar()
        or 0,
        "provenance_edges": session.query(func.count(KBLineageEdge.edge_id)).scalar() or 0,
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
