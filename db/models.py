from __future__ import annotations

from datetime import datetime
from typing import Optional

from sqlalchemy import Boolean, DateTime, Integer, String, Text, Index
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class EvidenceUnit(Base):
    __tablename__ = "evidence_units"

    evidence_unit_id: Mapped[str] = mapped_column(String, primary_key=True)
    source_type: Mapped[str] = mapped_column(String, nullable=False)
    source_id: Mapped[str] = mapped_column(String, nullable=False)
    field_name: Mapped[str] = mapped_column(String, nullable=False)
    char_offset_start: Mapped[int] = mapped_column(Integer, nullable=False)
    char_offset_end: Mapped[int] = mapped_column(Integer, nullable=False)
    chunk_index: Mapped[int] = mapped_column(Integer, nullable=False)
    snippet_text: Mapped[str] = mapped_column(Text, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


Index("ix_evidence_units_source", EvidenceUnit.source_type, EvidenceUnit.source_id)
Index("ix_evidence_units_field", EvidenceUnit.field_name)


class KBDraft(Base):
    __tablename__ = "kb_drafts"

    draft_id: Mapped[str] = mapped_column(String, primary_key=True)
    ticket_id: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    body_markdown: Mapped[str] = mapped_column(Text, nullable=False)
    case_json: Mapped[str] = mapped_column(Text, nullable=False)
    status: Mapped[str] = mapped_column(String, nullable=False)
    reviewer: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    reviewed_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    review_notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    published_at: Mapped[Optional[datetime]] = mapped_column(DateTime, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


Index("ix_kb_drafts_ticket_status", KBDraft.ticket_id, KBDraft.status)


class KBLineageEdge(Base):
    __tablename__ = "kb_lineage_edges"

    edge_id: Mapped[str] = mapped_column(String, primary_key=True)
    draft_id: Mapped[str] = mapped_column(String, nullable=False)
    evidence_unit_id: Mapped[str] = mapped_column(String, nullable=False)
    relationship: Mapped[str] = mapped_column(String, nullable=False)
    section_label: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


Index("ix_kb_lineage_draft", KBLineageEdge.draft_id)
Index("ix_kb_lineage_eu", KBLineageEdge.evidence_unit_id)


class LearningEvent(Base):
    __tablename__ = "learning_events"

    event_id: Mapped[str] = mapped_column(String, primary_key=True)
    event_type: Mapped[str] = mapped_column(String, nullable=False)
    draft_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    ticket_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    metadata_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class PublishedKBArticle(Base):
    __tablename__ = "published_kb_articles"

    kb_article_id: Mapped[str] = mapped_column(String, primary_key=True)
    latest_draft_id: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    body_markdown: Mapped[str] = mapped_column(Text, nullable=False)
    module: Mapped[str] = mapped_column(String, nullable=False)
    category: Mapped[str] = mapped_column(String, nullable=False)
    tags_json: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    source_type: Mapped[str] = mapped_column(String, nullable=False)
    source_ticket_id: Mapped[str] = mapped_column(String, nullable=False)
    current_version: Mapped[int] = mapped_column(Integer, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    updated_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


Index("ix_published_kb_module", PublishedKBArticle.module)
Index("ix_published_kb_category", PublishedKBArticle.category)


class KBArticleVersion(Base):
    __tablename__ = "kb_article_versions"

    version_id: Mapped[str] = mapped_column(String, primary_key=True)
    kb_article_id: Mapped[str] = mapped_column(String, nullable=False)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    source_draft_id: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    body_markdown: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str] = mapped_column(Text, nullable=False)
    reviewer: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    change_note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    is_rollback: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


Index("ix_versions_article", KBArticleVersion.kb_article_id)

