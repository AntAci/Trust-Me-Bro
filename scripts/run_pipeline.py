#!/usr/bin/env python3
"""
Trust-Me-Bro End-to-End Pipeline Demo

Usage: python scripts/run_pipeline.py --ticket TKT-001 --auto-approve
"""

import os
import sys
import argparse

from dotenv import load_dotenv
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from gap.detect_gap import detect_gap
from generation.generator import generate_kb_draft
from generation.lineage import write_lineage_edges
from generation.governance import approve_draft
from generation.publish import publish_draft
from retrieval.reindex import reindex_on_publish


def run_pipeline(ticket_number: str, auto_approve: bool = False) -> None:
    load_dotenv()
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL not found in environment")

    engine = create_engine(database_url)
    session = sessionmaker(bind=engine)()
    try:
        print(f"\n{'=' * 60}")
        print(f"TRUST-ME-BRO PIPELINE: {ticket_number}")
        print(f"{'=' * 60}")

        print("\n[1/5] Gap Detection...")
        gap_result = detect_gap(ticket_number, log_event=True)
        print(f"  Is Gap: {gap_result.is_gap} (score: {gap_result.top1_score:.2f})")

        if not gap_result.is_gap:
            print("  No gap detected. Pipeline complete.")
            return

        print("\n[2/5] Generating KB Draft...")
        draft, case_json = generate_kb_draft(ticket_number, session)
        print(f"  Draft ID: {draft.draft_id}")
        print(f"  Title: {draft.title}")

        print("\n[3/5] Writing Lineage...")
        edges = write_lineage_edges(draft, case_json, session)
        print(f"  Lineage edges: {len(edges)}")

        if auto_approve:
            print("\n[4/5] Auto-Approving Draft...")
            draft = approve_draft(session, draft.draft_id, reviewer="Demo", notes="Auto-approved")
            print(f"  Status: {draft.status}")

            print("\n[5/5] Publishing...")
            article = publish_draft(
                session,
                draft.draft_id,
                reviewer="Demo",
                change_note="Initial",
            )
            print(f"  Published KB: {article.kb_article_id}")

            print("\n[+] Reindexing...")
            reindex_on_publish(article.kb_article_id)
        else:
            print("\n[4/5] Draft ready for manual review")
            print(f"  Run: python scripts/review_draft.py --approve {draft.draft_id}")
    finally:
        session.close()

    print(f"\n{'=' * 60}")
    print("PIPELINE COMPLETE")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Run end-to-end pipeline for a ticket")
    parser.add_argument("--ticket", required=True, help="Ticket number")
    parser.add_argument("--auto-approve", action="store_true", help="Auto-approve for demo")
    args = parser.parse_args()
    run_pipeline(args.ticket, args.auto_approve)
