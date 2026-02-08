from __future__ import annotations

import os
import sys

import argparse

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from db import get_engine, get_session, init_db
from db.models import PublishedKBArticle
from generation.lineage import get_provenance_report


def main() -> None:
    parser = argparse.ArgumentParser(description="Show provenance for a draft or article")
    parser.add_argument("--draft-id", default=None, help="Draft ID")
    parser.add_argument("--kb-article-id", default=None, help="Published KB article ID")
    parser.add_argument("--db", default="trust_me_bro.db", help="SQLite DB path")
    args = parser.parse_args()

    if not args.draft_id and not args.kb_article_id:
        raise ValueError("Provide --draft-id or --kb-article-id")
    if args.draft_id and args.kb_article_id:
        raise ValueError("Provide only one of --draft-id or --kb-article-id")

    engine = get_engine(args.db)
    init_db(engine)
    session = get_session(engine)
    try:
        if args.kb_article_id:
            article = (
                session.query(PublishedKBArticle)
                .filter(PublishedKBArticle.kb_article_id == args.kb_article_id)
                .one_or_none()
            )
            if not article:
                raise ValueError(f"Published article not found: {args.kb_article_id}")
            draft_id = article.latest_draft_id
        else:
            draft_id = args.draft_id

        report = get_provenance_report(draft_id, session)
    finally:
        session.close()

    print("section\tevidence_unit_id\tsource_type\tsnippet_preview")
    for edge in report.get("edges", []):
        snippet = (edge.get("snippet_preview") or "").replace("\n", " ").strip()
        print(
            f"{edge.get('section','')}\t{edge.get('evidence_unit_id','')}\t"
            f"{edge.get('source_type','')}\t{snippet}"
        )


if __name__ == "__main__":
    main()
