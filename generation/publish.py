from __future__ import annotations

import json
import uuid
from datetime import datetime
from typing import Optional

from sqlalchemy.orm import Session

from db.models import KBDraft, KBArticleVersion, LearningEvent, PublishedKBArticle


def publish_draft(
    session: Session,
    draft_id: str,
    reviewer: str,
    change_note: Optional[str] = None,
    kb_article_id: Optional[str] = None,
) -> PublishedKBArticle:
    draft = _get_draft(session, draft_id)
    if draft.status == "published" or draft.published_at is not None:
        raise ValueError(f"Draft {draft_id} has already been published")
    if draft.status != "approved":
        raise ValueError(f"Draft {draft_id} must be approved before publishing")

    module, category, tags_json = _get_taxonomy(draft)
    title = draft.title
    body_markdown = draft.body_markdown

    if kb_article_id is None:
        kb_article_id = str(uuid.uuid4())
        article = PublishedKBArticle(
            kb_article_id=kb_article_id,
            latest_draft_id=draft.draft_id,
            title=title,
            body_markdown=body_markdown,
            module=module,
            category=category,
            tags_json=tags_json,
            source_type="learned",
            source_ticket_id=draft.ticket_id,
            current_version=1,
            created_at=datetime.utcnow(),
            updated_at=datetime.utcnow(),
        )
        session.add(article)
        version_number = 1
    else:
        article = (
            session.query(PublishedKBArticle)
            .filter(PublishedKBArticle.kb_article_id == kb_article_id)
            .one_or_none()
        )
        if not article:
            raise ValueError(f"Published article not found: {kb_article_id}")
        version_number = article.current_version + 1
        article.latest_draft_id = draft.draft_id
        article.title = title
        article.body_markdown = body_markdown
        article.module = module
        article.category = category
        article.tags_json = tags_json
        article.current_version = version_number
        article.updated_at = datetime.utcnow()

    version = KBArticleVersion(
        version_id=str(uuid.uuid4()),
        kb_article_id=kb_article_id,
        version=version_number,
        source_draft_id=draft.draft_id,
        body_markdown=body_markdown,
        title=title,
        reviewer=reviewer,
        change_note=change_note,
        is_rollback=False,
        created_at=datetime.utcnow(),
    )
    session.add(version)

    draft.status = "published"
    draft.published_at = datetime.utcnow()

    _log_event(
        session,
        event_type="published",
        draft_id=draft.draft_id,
        ticket_id=draft.ticket_id,
        metadata={
            "reviewer": reviewer,
            "change_note": change_note,
            "kb_article_id": kb_article_id,
            "version": version_number,
        },
    )
    session.commit()
    return article


def rollback_version(
    session: Session,
    kb_article_id: str,
    target_version: int,
    reviewer: str,
    note: str,
) -> PublishedKBArticle:
    article = (
        session.query(PublishedKBArticle)
        .filter(PublishedKBArticle.kb_article_id == kb_article_id)
        .one_or_none()
    )
    if not article:
        raise ValueError(f"Published article not found: {kb_article_id}")

    target = (
        session.query(KBArticleVersion)
        .filter(
            KBArticleVersion.kb_article_id == kb_article_id,
            KBArticleVersion.version == target_version,
        )
        .one_or_none()
    )
    if not target:
        raise ValueError(
            f"Version {target_version} not found for article {kb_article_id}"
        )

    new_version_number = article.current_version + 1
    rollback_version_record = KBArticleVersion(
        version_id=str(uuid.uuid4()),
        kb_article_id=kb_article_id,
        version=new_version_number,
        source_draft_id=None,
        body_markdown=target.body_markdown,
        title=target.title,
        reviewer=reviewer,
        change_note=note,
        is_rollback=True,
        created_at=datetime.utcnow(),
    )
    session.add(rollback_version_record)

    article.body_markdown = target.body_markdown
    article.title = target.title
    article.current_version = new_version_number
    article.updated_at = datetime.utcnow()

    _log_event(
        session,
        event_type="rollback",
        draft_id=None,
        ticket_id=article.source_ticket_id,
        metadata={
            "reviewer": reviewer,
            "note": note,
            "kb_article_id": kb_article_id,
            "target_version": target_version,
            "new_version": new_version_number,
        },
    )
    session.commit()
    return article


def get_published_article(session: Session, kb_article_id: str) -> PublishedKBArticle:
    article = (
        session.query(PublishedKBArticle)
        .filter(PublishedKBArticle.kb_article_id == kb_article_id)
        .one_or_none()
    )
    if not article:
        raise ValueError(f"Published article not found: {kb_article_id}")
    return article


def export_for_indexer(session: Session, kb_article_id: str) -> dict:
    article = get_published_article(session, kb_article_id)
    tags = []
    if article.tags_json:
        try:
            tags = json.loads(article.tags_json)
        except json.JSONDecodeError:
            tags = []
    return {
        "kb_article_id": article.kb_article_id,
        "title": article.title,
        "body_markdown": article.body_markdown,
        "module": article.module,
        "category": article.category,
        "tags": tags,
        "source_type": article.source_type,
        "source_ticket_id": article.source_ticket_id,
        "version": article.current_version,
        "lineage_draft_id": article.latest_draft_id,
    }


def _get_draft(session: Session, draft_id: str) -> KBDraft:
    draft = session.query(KBDraft).filter(KBDraft.draft_id == draft_id).one_or_none()
    if not draft:
        raise ValueError(f"Draft not found: {draft_id}")
    return draft


def _get_taxonomy(draft: KBDraft) -> tuple[str, str, Optional[str]]:
    module = "N/A"
    category = "N/A"
    tags_json = None
    try:
        case_data = json.loads(draft.case_json or "{}")
    except json.JSONDecodeError:
        case_data = {}
    if isinstance(case_data, dict):
        module = case_data.get("module") or module
        category = case_data.get("category") or category
        tags = case_data.get("tags")
        if isinstance(tags, list):
            tags_json = json.dumps(tags)
    return module, category, tags_json


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
