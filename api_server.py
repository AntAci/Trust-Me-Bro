from __future__ import annotations

import json
import logging
import os
from datetime import datetime
from typing import Any, Dict, Optional

# Load environment variables from .env file FIRST
from dotenv import load_dotenv
load_dotenv()

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
from generation.synthetic import generate_synthetic_scenario

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


@app.on_event("startup")
def startup_event():
    openai_key = os.getenv("OPENAI_API_KEY")
    if openai_key:
        masked_key = openai_key[:8] + "..." + openai_key[-4:] if len(openai_key) > 12 else "***"
        logger.info(f"✅ OpenAI API key loaded: {masked_key}")
        print(f"✅ OpenAI API key loaded: {masked_key}")
    else:
        logger.warning("⚠️ OPENAI_API_KEY not set - drafts will use deterministic mode (no LLM)")
        print("⚠️ OPENAI_API_KEY not set - drafts will use deterministic mode (no LLM)")


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
    is_sqlite = engine.dialect.name == "sqlite"
    use_raw = True
    if is_sqlite:
        use_raw = _sqlite_object_exists(session, "raw_tickets")
    query = """
        SELECT Ticket_Number, Subject, Status, Category, Module
        FROM raw_tickets
    """
    if is_sqlite and not use_raw:
        query = """
            SELECT ticket_number AS Ticket_Number,
                   subject AS Subject,
                   status AS Status,
                   category AS Category,
                   module AS Module
            FROM tickets
        """
    params: Dict[str, Any] = {}
    if search:
        column_ticket = "Ticket_Number" if use_raw else "ticket_number"
        column_subject = "Subject" if use_raw else "subject"
        query += f" WHERE lower({column_ticket}) LIKE :pattern OR lower({column_subject}) LIKE :pattern"
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


@app.get("/api/tickets/{ticket_id}/transcript")
def get_ticket_transcript(ticket_id: str, session=Depends(get_db)):
    is_sqlite = engine.dialect.name == "sqlite"
    use_raw = True
    if is_sqlite:
        use_raw = _sqlite_object_exists(session, "raw_conversations")
    rows = session.execute(
        text(
            """
            SELECT Conversation_ID, Issue_Summary, Transcript
            FROM raw_conversations
            WHERE Ticket_Number = :ticket_id
            ORDER BY Conversation_ID ASC
            """
        ),
        {"ticket_id": ticket_id},
    ).mappings().all()
    if is_sqlite and not use_raw:
        rows = session.execute(
            text(
                """
                SELECT conversation_id AS Conversation_ID,
                       issue_summary AS Issue_Summary,
                       transcript AS Transcript
                FROM conversations
                WHERE ticket_number = :ticket_id
                ORDER BY conversation_id ASC
                """
            ),
            {"ticket_id": ticket_id},
        ).mappings().all()

    messages = []
    if rows:
        transcript_text = "\n".join(
            [str(row.get("Transcript") or "").strip() for row in rows if row.get("Transcript")]
        ).strip()
        if transcript_text:
            messages = _parse_transcript_lines(transcript_text)

        if not messages:
            issue_summary = str(rows[0].get("Issue_Summary") or "").strip()
            if issue_summary:
                messages = [
                    {
                        "id": "summary-1",
                        "role": "system",
                        "text": issue_summary,
                        "timestamp": "09:00",
                    }
                ]

    return {"ticket_id": ticket_id, "transcript": messages}


def _parse_transcript_lines(transcript_text: str):
    transcript_text = transcript_text.strip()
    if transcript_text.startswith("[") or transcript_text.startswith("{"):
        try:
            parsed = json.loads(transcript_text)
            if isinstance(parsed, dict):
                parsed = parsed.get("messages") or parsed.get("transcript") or []
            if isinstance(parsed, list):
                speaker_roles = {}
                messages = []
                for idx, item in enumerate(parsed):
                    if not isinstance(item, dict):
                        continue
                    speaker = str(item.get("speaker") or item.get("author") or "").strip()
                    role = str(item.get("role") or "").lower()
                    text = str(item.get("text") or item.get("message") or "").strip()
                    if not text:
                        continue
                    if not role or role not in {"agent", "customer", "system"}:
                        role = _assign_role_for_speaker(speaker, speaker_roles)
                    messages.append(
                        {
                            "id": item.get("id") or f"msg-{idx + 1}",
                            "role": role,
                            "speaker": speaker or None,
                            "text": text,
                            "timestamp": item.get("timestamp") or f"09:{10 + idx:02d}",
                        }
                    )
                if messages:
                    return messages
        except Exception:
            pass

    lines = [line.strip() for line in transcript_text.splitlines() if line.strip()]
    messages = []
    speaker_roles = {}
    for idx, line in enumerate(lines):
        role = "agent"
        speaker = None
        lowered = line.lower()
        if ":" in line:
            possible_speaker, content = line.split(":", 1)
            speaker = possible_speaker.strip()
            line = content.strip()

        if speaker:
            role = _assign_role_for_speaker(speaker, speaker_roles)
        else:
            role = "agent"

        if not line:
            continue

        messages.append(
            {
                "id": f"msg-{idx + 1}",
                "role": role,
                "speaker": speaker or None,
                "text": line,
                "timestamp": f"09:{10 + idx:02d}",
            }
        )
    return messages


def _role_from_speaker(speaker: str) -> Optional[str]:
    if not speaker:
        return None
    lowered = speaker.lower()
    if lowered in {"customer", "resident", "caller", "tenant", "user"}:
        return "customer"
    if lowered in {"agent", "support", "rep", "csr", "associate"}:
        return "agent"
    if lowered == "system":
        return "system"
    return None


def _assign_role_for_speaker(speaker: str, speaker_roles: Dict[str, str]) -> str:
    if not speaker:
        return "agent"
    explicit = _role_from_speaker(speaker)
    if explicit:
        return explicit
    if speaker in speaker_roles:
        return speaker_roles[speaker]
    if not speaker_roles:
        speaker_roles[speaker] = "agent"
    elif "customer" not in speaker_roles.values():
        speaker_roles[speaker] = "customer"
    else:
        speaker_roles[speaker] = "agent"
    return speaker_roles[speaker]


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


@app.get("/api/articles")
def list_articles(
    limit: int = Query(50, ge=1, le=500),
    session=Depends(get_db),
):
    """List all published KB articles, ordered by most recent first."""
    articles = (
        session.query(PublishedKBArticle)
        .order_by(PublishedKBArticle.created_at.desc())
        .limit(limit)
        .all()
    )
    return [_serialize_article(a) for a in articles]


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
        "source_ticket_id": article.source_ticket_id,
        "title": article.title,
        "current_version": article.current_version,
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


@app.post("/api/demo/generate-scenario")
def generate_scenario_endpoint(payload: Dict[str, Any] = Body(...), session=Depends(get_db)):
    mode = payload.get("mode", "new")
    existing_kb_context = payload.get("existing_kb_context")
    category_hint = payload.get("category_hint")

    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        raise HTTPException(status_code=400, detail="OPENAI_API_KEY not configured")

    try:
        scenario = generate_synthetic_scenario(
            api_key=api_key,
            mode=mode,
            existing_kb_context=existing_kb_context,
            category_hint=category_hint,
        )
        _persist_synthetic_scenario(scenario, session)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc

    return scenario


def _persist_synthetic_scenario(scenario: Dict[str, Any], session):
    ticket = scenario.get("ticket") or {}
    ticket_number = str(ticket.get("ticket_number") or "").strip()
    if not ticket_number:
        return

    _ensure_ticket_tables(session)

    conversation_id = f"conv-{ticket_number}"
    transcript = scenario.get("transcript") or []
    transcript_text = _build_transcript_text(transcript)
    issue_summary = str(ticket.get("subject") or "").strip()
    agent_name = "Agent"
    for message in transcript:
        if (message.get("role") or "").lower() == "agent":
            agent_name = str(message.get("speaker") or "Agent")
            break

    session.execute(
        text(
            """
            INSERT INTO tickets (
                ticket_number, conversation_id, status, product, module, category,
                subject, description, resolution, root_cause, script_id
            )
            VALUES (
                :ticket_number, :conversation_id, :status, :product, :module, :category,
                :subject, :description, :resolution, :root_cause, :script_id
            )
            ON CONFLICT(ticket_number) DO UPDATE SET
                conversation_id = excluded.conversation_id,
                status = excluded.status,
                product = excluded.product,
                module = excluded.module,
                category = excluded.category,
                subject = excluded.subject,
                description = excluded.description,
                resolution = excluded.resolution,
                root_cause = excluded.root_cause,
                script_id = excluded.script_id
            """
        ),
        {
            "ticket_number": ticket_number,
            "conversation_id": conversation_id,
            "status": ticket.get("status") or "Resolved",
            "product": ticket.get("product") or "PropertySuite",
            "module": ticket.get("module") or "General",
            "category": ticket.get("category") or "General",
            "subject": ticket.get("subject") or "Support request",
            "description": ticket.get("description") or "",
            "resolution": ticket.get("resolution") or "",
            "root_cause": ticket.get("root_cause") or "",
            "script_id": ticket.get("script_id"),
        },
    )

    session.execute(
        text(
            """
            INSERT INTO conversations (
                conversation_id, ticket_number, channel, conversation_start, conversation_end,
                customer_role, agent_name, product, category, issue_summary, transcript
            )
            VALUES (
                :conversation_id, :ticket_number, :channel, :conversation_start, :conversation_end,
                :customer_role, :agent_name, :product, :category, :issue_summary, :transcript
            )
            ON CONFLICT(conversation_id, ticket_number) DO UPDATE SET
                transcript = excluded.transcript,
                issue_summary = excluded.issue_summary,
                agent_name = excluded.agent_name
            """
        ),
        {
            "conversation_id": conversation_id,
            "ticket_number": ticket_number,
            "channel": "support",
            "conversation_start": datetime.utcnow().isoformat(),
            "conversation_end": datetime.utcnow().isoformat(),
            "customer_role": "Caller",
            "agent_name": agent_name,
            "product": ticket.get("product") or "PropertySuite",
            "category": ticket.get("category") or "General",
            "issue_summary": issue_summary,
            "transcript": transcript_text,
        },
    )

    evidence_units = scenario.get("evidenceUnits") or []
    for unit in evidence_units:
        evidence = EvidenceUnit(
            evidence_unit_id=unit.get("evidence_unit_id"),
            source_type=unit.get("source_type") or "TICKET",
            source_id=unit.get("source_id") or ticket_number,
            field_name=unit.get("field_name") or "description",
            char_offset_start=0,
            char_offset_end=len(unit.get("snippet_text") or ""),
            chunk_index=0,
            snippet_text=unit.get("snippet_text") or "",
        )
        session.merge(evidence)

    session.commit()


def _build_transcript_text(messages: list[dict[str, Any]]) -> str:
    lines = []
    for message in messages:
        speaker = str(message.get("speaker") or message.get("role") or "Agent")
        text = str(message.get("text") or "").strip()
        if not text:
            continue
        lines.append(f"{speaker}: {text}")
    return "\n".join(lines).strip()


def _sqlite_object_exists(session, name: str) -> bool:
    if engine.dialect.name != "sqlite":
        return False
    row = session.execute(
        text(
            """
            SELECT name FROM sqlite_master
            WHERE (type = 'table' OR type = 'view') AND name = :name
            """
        ),
        {"name": name},
    ).fetchone()
    return row is not None


def _ensure_ticket_tables(session):
    session.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS tickets (
                ticket_number TEXT PRIMARY KEY,
                conversation_id TEXT,
                created_at TEXT,
                closed_at TEXT,
                status TEXT,
                priority TEXT,
                tier TEXT,
                product TEXT,
                module TEXT,
                category TEXT,
                case_type TEXT,
                account_name TEXT,
                property_name TEXT,
                property_city TEXT,
                property_state TEXT,
                contact_name TEXT,
                contact_role TEXT,
                contact_email TEXT,
                contact_phone TEXT,
                subject TEXT,
                description TEXT,
                resolution TEXT,
                root_cause TEXT,
                tags TEXT,
                kb_article_id TEXT,
                generation_source_record TEXT,
                script_id TEXT,
                generated_kb_article_id TEXT
            )
            """
        )
    )
    session.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS conversations (
                conversation_id TEXT,
                ticket_number TEXT,
                channel TEXT,
                conversation_start TEXT,
                conversation_end TEXT,
                customer_role TEXT,
                agent_name TEXT,
                product TEXT,
                category TEXT,
                issue_summary TEXT,
                transcript TEXT,
                sentiment TEXT,
                generation_source_record TEXT,
                PRIMARY KEY (conversation_id, ticket_number)
            )
            """
        )
    )


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
        "generation_mode": draft.generation_mode,
        "has_rlm_trace": draft.rlm_trace_json is not None,
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


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
