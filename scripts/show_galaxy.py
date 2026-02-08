from __future__ import annotations

import argparse
import json
import os
import sys

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from db import get_engine, get_session, init_db
from db.models import KBGalaxyPoint, PublishedKBArticle


def main() -> None:
    parser = argparse.ArgumentParser(description="Show galaxy points for frontend.")
    parser.add_argument("--db", default="trust_me_bro.db")
    args = parser.parse_args()

    engine = get_engine(args.db)
    init_db(engine)
    session = get_session(engine)
    try:
        rows = (
            session.query(
                KBGalaxyPoint.kb_article_id,
                KBGalaxyPoint.x,
                KBGalaxyPoint.y,
                PublishedKBArticle.title,
                PublishedKBArticle.current_version,
                PublishedKBArticle.latest_draft_id,
                PublishedKBArticle.updated_at,
            )
            .join(
                PublishedKBArticle,
                PublishedKBArticle.kb_article_id == KBGalaxyPoint.kb_article_id,
                isouter=True,
            )
            .all()
        )
        payload = []
        for row in rows:
            payload.append(
                {
                    "kb_article_id": row.kb_article_id,
                    "x": float(row.x),
                    "y": float(row.y),
                    "title": row.title,
                    "current_version": row.current_version,
                    "latest_draft_id": row.latest_draft_id,
                    "updated_at": row.updated_at.isoformat() if row.updated_at else None,
                }
            )
    finally:
        session.close()

    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
