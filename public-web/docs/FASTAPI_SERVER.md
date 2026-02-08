# Self-Updating Knowledge Engine - FastAPI Server

Drop this file into your Python repo and run it alongside the React frontend.

## Quick Start

```bash
# Install dependencies
pip install fastapi uvicorn

# Run the server
python api_server.py
# Or with custom DB path:
DB_PATH=./my_database.db python api_server.py
```

Server runs on `http://localhost:8000`

## api_server.py

```python
"""
FastAPI server for Self-Updating Knowledge Engine demo.
Wraps SQLite database operations for the React frontend.

Usage:
    DB_PATH=./trust_me_bro.db python api_server.py
"""

import os
import sqlite3
import uuid
from datetime import datetime
from typing import Optional, List
from contextlib import contextmanager

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

# Configuration
DB_PATH = os.getenv("DB_PATH", "trust_me_bro.db")

app = FastAPI(title="Knowledge Engine API", version="1.0.0")

# CORS for React frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Database connection
@contextmanager
def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


# ============= Models =============

class GenerateDraftRequest(BaseModel):
    ticket_id: str


class ReviewRequest(BaseModel):
    reviewer: str
    notes: Optional[str] = None


class PublishRequest(BaseModel):
    reviewer: str
    note: Optional[str] = None
    kb_article_id: Optional[str] = None


# ============= Endpoints =============

@app.get("/api/metrics")
def get_metrics():
    """Dashboard metrics."""
    with get_db() as conn:
        cur = conn.cursor()
        
        # Tickets count
        cur.execute("SELECT COUNT(*) FROM raw_tickets")
        tickets_count = cur.fetchone()[0]
        
        # Evidence units count
        cur.execute("SELECT COUNT(*) FROM evidence_units")
        evidence_count = cur.fetchone()[0]
        
        # Drafts by status
        cur.execute("SELECT status, COUNT(*) FROM kb_drafts GROUP BY status")
        draft_counts = {row[0]: row[1] for row in cur.fetchall()}
        
        # Published articles count
        cur.execute("SELECT COUNT(*) FROM published_kb_articles")
        published_count = cur.fetchone()[0]
        
        # Provenance edges count
        cur.execute("SELECT COUNT(*) FROM kb_lineage_edges")
        edges_count = cur.fetchone()[0]
        
        return {
            "tickets_count": tickets_count,
            "evidence_units_count": evidence_count,
            "drafts_pending": draft_counts.get("pending", 0),
            "drafts_approved": draft_counts.get("approved", 0),
            "drafts_rejected": draft_counts.get("rejected", 0),
            "published_articles_count": published_count,
            "provenance_edges_count": edges_count,
        }


@app.get("/api/tickets")
def get_tickets(
    limit: int = Query(50, ge=1, le=200),
    search: Optional[str] = None
):
    """List tickets for selector."""
    with get_db() as conn:
        cur = conn.cursor()
        
        query = """
            SELECT 
                rowid as ticket_id,
                Ticket_Number as ticket_number,
                Subject as subject,
                Status as status,
                Category as category
            FROM raw_tickets
        """
        params = []
        
        if search:
            query += " WHERE Ticket_Number LIKE ? OR Subject LIKE ?"
            params = [f"%{search}%", f"%{search}%"]
        
        query += " LIMIT ?"
        params.append(limit)
        
        cur.execute(query, params)
        rows = cur.fetchall()
        
        return [dict(row) for row in rows]


@app.post("/api/drafts/generate")
def generate_draft(request: GenerateDraftRequest):
    """
    Generate a new draft from a ticket.
    
    In production, this would call your AI pipeline.
    For demo, we check for existing drafts or create a mock one.
    """
    with get_db() as conn:
        cur = conn.cursor()
        
        # Check if draft already exists for this ticket
        cur.execute(
            "SELECT * FROM kb_drafts WHERE ticket_id = ? ORDER BY created_at DESC LIMIT 1",
            [request.ticket_id]
        )
        existing = cur.fetchone()
        
        if existing:
            return {
                "draft_id": existing["draft_id"],
                "draft": dict(existing)
            }
        
        # Create new draft (in production, call your AI pipeline here)
        draft_id = f"draft-{uuid.uuid4().hex[:8]}"
        now = datetime.utcnow().isoformat()
        
        # Get ticket info for the draft
        cur.execute(
            "SELECT Subject FROM raw_tickets WHERE rowid = ? OR Ticket_Number = ?",
            [request.ticket_id, request.ticket_id]
        )
        ticket = cur.fetchone()
        title = ticket["Subject"] if ticket else "Generated KB Article"
        
        # Mock KB content
        body_markdown = f"""# {title}

## Problem
[Auto-generated from ticket evidence]

## Symptoms
- Evidence extracted from ticket fields
- Evidence from conversation transcript

## Root Cause
[Analysis based on resolution data]

## Resolution Steps
1. Step extracted from agent actions
2. Step extracted from resolution field

## Placeholders Needed
- `{{PLACEHOLDER_1}}` - Description
"""
        
        case_json = '{"evidence_counts": {"TICKET": 4, "CONVERSATION": 7}, "section_counts": {"problem": 2, "symptoms": 3, "root_cause": 2, "resolution_steps": 4}}'
        
        cur.execute(
            """INSERT INTO kb_drafts 
               (draft_id, ticket_id, title, body_markdown, case_json, status, created_at)
               VALUES (?, ?, ?, ?, ?, 'pending', ?)""",
            [draft_id, request.ticket_id, title, body_markdown, case_json, now]
        )
        conn.commit()
        
        return {
            "draft_id": draft_id,
            "draft": {
                "draft_id": draft_id,
                "ticket_id": request.ticket_id,
                "title": title,
                "body_markdown": body_markdown,
                "case_json": case_json,
                "status": "pending",
                "created_at": now
            }
        }


@app.post("/api/drafts/{draft_id}/approve")
def approve_draft(draft_id: str, request: ReviewRequest):
    """Approve a draft."""
    with get_db() as conn:
        cur = conn.cursor()
        now = datetime.utcnow().isoformat()
        
        cur.execute(
            """UPDATE kb_drafts 
               SET status = 'approved', reviewer = ?, reviewed_at = ?, review_notes = ?
               WHERE draft_id = ?""",
            [request.reviewer, now, request.notes, draft_id]
        )
        conn.commit()
        
        cur.execute("SELECT * FROM kb_drafts WHERE draft_id = ?", [draft_id])
        draft = cur.fetchone()
        
        if not draft:
            raise HTTPException(status_code=404, detail="Draft not found")
        
        return dict(draft)


@app.post("/api/drafts/{draft_id}/reject")
def reject_draft(draft_id: str, request: ReviewRequest):
    """Reject a draft."""
    with get_db() as conn:
        cur = conn.cursor()
        now = datetime.utcnow().isoformat()
        
        cur.execute(
            """UPDATE kb_drafts 
               SET status = 'rejected', reviewer = ?, reviewed_at = ?, review_notes = ?
               WHERE draft_id = ?""",
            [request.reviewer, now, request.notes, draft_id]
        )
        conn.commit()
        
        cur.execute("SELECT * FROM kb_drafts WHERE draft_id = ?", [draft_id])
        draft = cur.fetchone()
        
        if not draft:
            raise HTTPException(status_code=404, detail="Draft not found")
        
        return dict(draft)


@app.post("/api/drafts/{draft_id}/publish")
def publish_draft(draft_id: str, request: PublishRequest):
    """
    Publish a draft as a KB article.
    
    If kb_article_id is provided, publish as new version.
    Otherwise, create new article (v1).
    """
    with get_db() as conn:
        cur = conn.cursor()
        now = datetime.utcnow().isoformat()
        
        # Get draft
        cur.execute("SELECT * FROM kb_drafts WHERE draft_id = ?", [draft_id])
        draft = cur.fetchone()
        
        if not draft:
            raise HTTPException(status_code=404, detail="Draft not found")
        
        if request.kb_article_id:
            # Publish as new version
            cur.execute(
                "SELECT current_version FROM published_kb_articles WHERE kb_article_id = ?",
                [request.kb_article_id]
            )
            article = cur.fetchone()
            
            if not article:
                raise HTTPException(status_code=404, detail="Article not found")
            
            new_version = article["current_version"] + 1
            
            # Update article
            cur.execute(
                """UPDATE published_kb_articles 
                   SET latest_draft_id = ?, title = ?, body_markdown = ?, 
                       current_version = ?, updated_at = ?
                   WHERE kb_article_id = ?""",
                [draft_id, draft["title"], draft["body_markdown"], 
                 new_version, now, request.kb_article_id]
            )
            
            # Add version record
            version_id = f"ver-{uuid.uuid4().hex[:8]}"
            cur.execute(
                """INSERT INTO kb_article_versions
                   (version_id, kb_article_id, version, source_draft_id, 
                    body_markdown, title, reviewer, change_note, is_rollback, created_at)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)""",
                [version_id, request.kb_article_id, new_version, draft_id,
                 draft["body_markdown"], draft["title"], request.reviewer, 
                 request.note, now]
            )
            
            kb_article_id = request.kb_article_id
            version = new_version
            
        else:
            # Create new article (v1)
            kb_article_id = f"kb-{uuid.uuid4().hex[:8]}"
            version = 1
            
            cur.execute(
                """INSERT INTO published_kb_articles
                   (kb_article_id, latest_draft_id, title, body_markdown,
                    source_type, source_ticket_id, current_version, created_at, updated_at)
                   VALUES (?, ?, ?, ?, 'TICKET', ?, 1, ?, ?)""",
                [kb_article_id, draft_id, draft["title"], draft["body_markdown"],
                 draft["ticket_id"], now, now]
            )
            
            # Add v1 version record
            version_id = f"ver-{uuid.uuid4().hex[:8]}"
            cur.execute(
                """INSERT INTO kb_article_versions
                   (version_id, kb_article_id, version, source_draft_id,
                    body_markdown, title, reviewer, change_note, is_rollback, created_at)
                   VALUES (?, ?, 1, ?, ?, ?, ?, ?, 0, ?)""",
                [version_id, kb_article_id, draft_id, draft["body_markdown"],
                 draft["title"], request.reviewer, request.note or "Initial publication", now]
            )
        
        # Mark draft as published
        cur.execute(
            "UPDATE kb_drafts SET published_at = ? WHERE draft_id = ?",
            [now, draft_id]
        )
        
        conn.commit()
        
        return {
            "kb_article_id": kb_article_id,
            "version": version
        }


@app.get("/api/articles/{kb_article_id}")
def get_article(kb_article_id: str):
    """Get published article."""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            "SELECT * FROM published_kb_articles WHERE kb_article_id = ?",
            [kb_article_id]
        )
        article = cur.fetchone()
        
        if not article:
            raise HTTPException(status_code=404, detail="Article not found")
        
        return dict(article)


@app.get("/api/articles/{kb_article_id}/versions")
def get_article_versions(kb_article_id: str):
    """Get version history for an article."""
    with get_db() as conn:
        cur = conn.cursor()
        cur.execute(
            """SELECT * FROM kb_article_versions 
               WHERE kb_article_id = ? 
               ORDER BY version ASC""",
            [kb_article_id]
        )
        rows = cur.fetchall()
        return [dict(row) for row in rows]


@app.get("/api/provenance")
def get_provenance(
    kb_article_id: str = Query(...),
    section_label: Optional[str] = None,
    source_type: Optional[str] = None,
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """
    Get provenance data for an article.
    
    Default: Returns grouped counts by section_label × source_type.
    With filters: Returns paginated evidence units.
    """
    with get_db() as conn:
        cur = conn.cursor()
        
        # Get latest draft ID
        cur.execute(
            "SELECT latest_draft_id FROM published_kb_articles WHERE kb_article_id = ?",
            [kb_article_id]
        )
        article = cur.fetchone()
        
        if not article:
            raise HTTPException(status_code=404, detail="Article not found")
        
        latest_draft_id = article["latest_draft_id"]
        
        if section_label and source_type:
            # Return paginated evidence units
            cur.execute(
                """SELECT eu.* FROM evidence_units eu
                   JOIN kb_lineage_edges le ON eu.evidence_unit_id = le.evidence_unit_id
                   WHERE le.draft_id = ? AND le.section_label = ? AND eu.source_type = ?
                   LIMIT ? OFFSET ?""",
                [latest_draft_id, section_label, source_type, limit, offset]
            )
            units = [dict(row) for row in cur.fetchall()]
            
            cur.execute(
                """SELECT COUNT(*) FROM evidence_units eu
                   JOIN kb_lineage_edges le ON eu.evidence_unit_id = le.evidence_unit_id
                   WHERE le.draft_id = ? AND le.section_label = ? AND eu.source_type = ?""",
                [latest_draft_id, section_label, source_type]
            )
            total = cur.fetchone()[0]
            
            return {
                "evidence_units": units,
                "total": total,
                "limit": limit,
                "offset": offset
            }
        
        else:
            # Return grouped counts
            cur.execute(
                """SELECT le.section_label, eu.source_type, COUNT(*) as count
                   FROM kb_lineage_edges le
                   JOIN evidence_units eu ON le.evidence_unit_id = eu.evidence_unit_id
                   WHERE le.draft_id = ?
                   GROUP BY le.section_label, eu.source_type""",
                [latest_draft_id]
            )
            grouped = [
                {"section_label": row[0], "source_type": row[1], "count": row[2]}
                for row in cur.fetchall()
            ]
            
            cur.execute(
                "SELECT COUNT(*) FROM kb_lineage_edges WHERE draft_id = ?",
                [latest_draft_id]
            )
            total_edges = cur.fetchone()[0]
            
            return {
                "kb_article_id": kb_article_id,
                "latest_draft_id": latest_draft_id,
                "grouped": grouped,
                "total_edges": total_edges
            }


@app.get("/api/provenance/evidence")
def get_evidence_units(
    kb_article_id: str = Query(...),
    section_label: str = Query(...),
    source_type: str = Query(...),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0)
):
    """Get paginated evidence units for a specific section/source combination."""
    with get_db() as conn:
        cur = conn.cursor()
        
        # Get latest draft ID
        cur.execute(
            "SELECT latest_draft_id FROM published_kb_articles WHERE kb_article_id = ?",
            [kb_article_id]
        )
        article = cur.fetchone()
        
        if not article:
            raise HTTPException(status_code=404, detail="Article not found")
        
        latest_draft_id = article["latest_draft_id"]
        
        cur.execute(
            """SELECT eu.* FROM evidence_units eu
               JOIN kb_lineage_edges le ON eu.evidence_unit_id = le.evidence_unit_id
               WHERE le.draft_id = ? AND le.section_label = ? AND eu.source_type = ?
               LIMIT ? OFFSET ?""",
            [latest_draft_id, section_label, source_type, limit, offset]
        )
        units = [dict(row) for row in cur.fetchall()]
        
        cur.execute(
            """SELECT COUNT(*) FROM evidence_units eu
               JOIN kb_lineage_edges le ON eu.evidence_unit_id = le.evidence_unit_id
               WHERE le.draft_id = ? AND le.section_label = ? AND eu.source_type = ?""",
            [latest_draft_id, section_label, source_type]
        )
        total = cur.fetchone()[0]
        
        return {
            "evidence_units": units,
            "total": total,
            "limit": limit,
            "offset": offset
        }


# ============= Run Server =============

if __name__ == "__main__":
    import uvicorn
    
    print(f"Starting Knowledge Engine API...")
    print(f"Database: {DB_PATH}")
    print(f"Server: http://localhost:8000")
    print(f"Docs: http://localhost:8000/docs")
    
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_PATH` | `trust_me_bro.db` | Path to SQLite database |

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/metrics` | GET | Dashboard counts |
| `/api/tickets` | GET | List tickets |
| `/api/drafts/generate` | POST | Generate draft from ticket |
| `/api/drafts/{id}/approve` | POST | Approve draft |
| `/api/drafts/{id}/reject` | POST | Reject draft |
| `/api/drafts/{id}/publish` | POST | Publish as v1 or v2+ |
| `/api/articles/{id}` | GET | Get published article |
| `/api/articles/{id}/versions` | GET | Version history |
| `/api/provenance` | GET | Grouped provenance data |
| `/api/provenance/evidence` | GET | Paginated evidence units |

## Interactive Docs

Once running, visit `http://localhost:8000/docs` for Swagger UI.
