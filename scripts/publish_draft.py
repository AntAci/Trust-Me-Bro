from __future__ import annotations

import os
import sys

import argparse
import json

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from db import get_engine, get_session, init_db
from generation.publish import export_for_indexer, publish_draft


def main() -> None:
    parser = argparse.ArgumentParser(description="Publish a KB draft")
    parser.add_argument("draft_id", help="Draft ID to publish")
    parser.add_argument("--reviewer", required=True, help="Reviewer name")
    parser.add_argument("--note", default=None, help="Change note for this publish")
    parser.add_argument("--kb-article-id", default=None, help="Existing article ID for v2+")
    parser.add_argument("--db", default="trust_me_bro.db", help="SQLite DB path")
    args = parser.parse_args()

    engine = get_engine(args.db)
    init_db(engine)
    session = get_session(engine)
    try:
        article = publish_draft(
            session,
            args.draft_id,
            reviewer=args.reviewer,
            change_note=args.note,
            kb_article_id=args.kb_article_id,
        )
        payload = export_for_indexer(session, article.kb_article_id)
    finally:
        session.close()

    print(f"kb_article_id={article.kb_article_id} version={article.current_version}")
    print(json.dumps(payload, indent=2))


if __name__ == "__main__":
    main()
