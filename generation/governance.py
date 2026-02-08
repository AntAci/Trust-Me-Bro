from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import List, Optional

from sqlalchemy.orm import Session

from db.models import KBDraft, LearningEvent


ALLOWED_TRANSITIONS = {
    "draft": {"approved", "rejected", "superseded"},
    "approved": {"published", "rejected", "superseded"},
    "rejected": set(),
    "published": set(),
    "superseded": set(),
}


def get_drafts_by_status(session: Session, status: str) -> List[KBDraft]:
    return (
        session.query(KBDraft)
        .filter(KBDraft.status == status)
        .order_by(KBDraft.created_at.desc())
        .all()
    )


def approve_draft(
    session: Session,
    draft_id: str,
    reviewer: str,
    notes: Optional[str] = None,
) -> KBDraft:
    draft = _get_draft(session, draft_id)
    _validate_transition(draft.status, "approved")
    draft.status = "approved"
    draft.reviewer = reviewer
    draft.reviewed_at = datetime.utcnow()
    draft.review_notes = notes
    supersede_other_drafts(
        session,
        ticket_id=draft.ticket_id,
        keep_draft_id=draft.draft_id,
        reason="Superseded by approved draft.",
        reviewer=reviewer,
        statuses={"draft", "approved"},
    )
    _log_event(
        session,
        event_type="approved",
        draft_id=draft.draft_id,
        ticket_id=draft.ticket_id,
        metadata={
            "reviewer": reviewer,
            "notes": notes,
        },
    )
    session.commit()
    return draft


def reject_draft(
    session: Session,
    draft_id: str,
    reviewer: str,
    notes: Optional[str] = None,
) -> KBDraft:
    draft = _get_draft(session, draft_id)
    _validate_transition(draft.status, "rejected")
    draft.status = "rejected"
    draft.reviewer = reviewer
    draft.reviewed_at = datetime.utcnow()
    draft.review_notes = notes
    _log_event(
        session,
        event_type="rejected",
        draft_id=draft.draft_id,
        ticket_id=draft.ticket_id,
        metadata={
            "reviewer": reviewer,
            "notes": notes,
        },
    )
    session.commit()
    return draft


def supersede_other_drafts(
    session: Session,
    ticket_id: str,
    keep_draft_id: str,
    reason: str,
    reviewer: Optional[str] = None,
    statuses: Optional[set[str]] = None,
) -> int:
    if statuses is None:
        statuses = {"draft", "approved"}
    drafts = (
        session.query(KBDraft)
        .filter(
            KBDraft.ticket_id == ticket_id,
            KBDraft.draft_id != keep_draft_id,
            KBDraft.status.in_(statuses),
        )
        .all()
    )
    for draft in drafts:
        _validate_transition(draft.status, "superseded")
        draft.status = "superseded"
        draft.reviewer = reviewer
        draft.reviewed_at = datetime.utcnow()
        draft.review_notes = reason
        _log_event(
            session,
            event_type="superseded",
            draft_id=draft.draft_id,
            ticket_id=draft.ticket_id,
            metadata={
                "reviewer": reviewer,
                "reason": reason,
                "kept_draft_id": keep_draft_id,
            },
        )
    return len(drafts)


def _get_draft(session: Session, draft_id: str) -> KBDraft:
    draft = session.query(KBDraft).filter(KBDraft.draft_id == draft_id).one_or_none()
    if not draft:
        raise ValueError(f"Draft not found: {draft_id}")
    return draft


def _validate_transition(current_status: str, target_status: str) -> None:
    allowed = ALLOWED_TRANSITIONS.get(current_status, set())
    if target_status not in allowed:
        raise ValueError(
            f"Invalid status transition: {current_status} -> {target_status}"
        )


def _log_event(
    session: Session,
    event_type: str,
    draft_id: Optional[str],
    ticket_id: Optional[str],
    metadata: Optional[dict],
) -> None:
    event = LearningEvent(
        event_id=str(uuid.uuid4()),
        event_type=event_type,
        draft_id=draft_id,
        ticket_id=ticket_id,
        metadata_json=json.dumps(metadata or {}),
    )
    session.add(event)
