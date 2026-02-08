from __future__ import annotations

from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker

from .models import Base


def get_engine(db_path: str):
    return create_engine(f"sqlite:///{db_path}")


def init_db(engine) -> None:
    Base.metadata.create_all(engine)
    _migrate_sqlite(engine)


def _migrate_sqlite(engine) -> None:
    if engine.dialect.name != "sqlite":
        return
    with engine.begin() as conn:
        _ensure_kb_drafts_columns(conn)


def _ensure_kb_drafts_columns(conn) -> None:
    existing = {
        row[1] for row in conn.execute(text("PRAGMA table_info(kb_drafts)")).fetchall()
    }
    columns = {
        "reviewer": "TEXT",
        "reviewed_at": "DATETIME",
        "review_notes": "TEXT",
        "published_at": "DATETIME",
        "generation_mode": "TEXT DEFAULT 'deterministic'",
        "rlm_trace_json": "TEXT",
    }
    for name, col_type in columns.items():
        if name not in existing:
            conn.execute(text(f"ALTER TABLE kb_drafts ADD COLUMN {name} {col_type}"))


def get_session(engine):
    return sessionmaker(bind=engine)()
