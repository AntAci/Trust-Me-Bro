from __future__ import annotations

import os
import sys
from datetime import datetime

import argparse
import json

import pandas as pd

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from db import get_engine, get_session, init_db
from generation.generator import generate_kb_draft
from generation.governance import approve_draft
from generation.lineage import get_provenance_report, write_lineage_edges
from generation.publish import export_for_indexer, publish_draft
from ingestion.workbook_loader import extract_evidence_units, load_workbook_to_db


def main() -> None:
    default_workbook = os.path.join(REPO_ROOT, "Data", "SupportMind__Final_Data.xlsx")
    parser = argparse.ArgumentParser(description="Person 2 demo pipeline")
    parser.add_argument("--workbook", default=default_workbook, help="Path to workbook file")
    parser.add_argument("--ticket", required=False, help="Ticket_Number to run")
    parser.add_argument("--db", default="trust_me_bro.db", help="SQLite DB path")
    parser.add_argument("--openai-key", default=None, help="Optional OpenAI API key")
    parser.add_argument("--openai", action="store_true", help="Use OPENAI_API_KEY")
    parser.add_argument(
        "--generation-mode",
        choices=["deterministic", "rlm"],
        default="deterministic",
        help="Draft generation mode",
    )
    args = parser.parse_args()

    engine = get_engine(args.db)
    init_db(engine)

    counts = load_workbook_to_db(args.workbook, engine)
    print("=== Sheet Counts ===")
    for sheet, count in counts.items():
        print(f"{sheet}: {count}")

    evidence_count = extract_evidence_units(engine)
    print(f"\n=== Evidence Units ===\nTotal: {evidence_count}")

    ticket_id = args.ticket or _pick_first_closed_ticket(engine)
    print(f"\n=== Ticket ===\n{ticket_id}")

    session = get_session(engine)
    try:
        api_key = None
        if args.openai_key:
            api_key = args.openai_key
        elif args.generation_mode == "rlm":
            api_key = os.getenv("OPENAI_API_KEY")
        elif args.openai:
            api_key = os.getenv("OPENAI_API_KEY")

        draft, case_json = generate_kb_draft(
            ticket_id,
            session,
            api_key=api_key,
            generation_mode=args.generation_mode,
        )
        write_lineage_edges(draft, case_json, session)
        provenance = get_provenance_report(draft.draft_id, session)

        print("\n=== Governance Demo ===")
        draft = approve_draft(
            session,
            draft.draft_id,
            reviewer="Demo Reviewer",
            notes="LGTM",
        )
        article = publish_draft(
            session,
            draft.draft_id,
            reviewer="Demo Reviewer",
            change_note="Initial publish",
        )
        export_payload = export_for_indexer(session, article.kb_article_id)

        draft_body_markdown = draft.body_markdown
        case_json_dump = case_json.model_dump()
        provenance_dump = provenance
        export_payload_dump = export_payload
        rlm_trace_dump = None
        if args.generation_mode == "rlm" and draft.rlm_trace_json:
            try:
                rlm_trace_dump = json.loads(draft.rlm_trace_json)
            except json.JSONDecodeError:
                rlm_trace_dump = None
    finally:
        session.close()

    print("\n=== KB Draft ===\n")
    print(draft_body_markdown)

    if args.generation_mode == "rlm":
        print("\n=== RLM Trace Summary ===")
        if rlm_trace_dump:
            sections = rlm_trace_dump.get("sections", {})
            candidate_total = sum(
                section.get("candidate_count", 0) for section in sections.values()
            )
            selected_total = sum(
                len(section.get("selected_evidence_unit_ids", []))
                for section in sections.values()
            )
            verifier_ok = rlm_trace_dump.get("verifier", {}).get("ok")
            generation_mode = rlm_trace_dump.get("generation_mode", "rlm")
            started_at = rlm_trace_dump.get("started_at")
            completed_at = rlm_trace_dump.get("completed_at")
            elapsed = None
            if started_at and completed_at:
                try:
                    start_dt = datetime.fromisoformat(started_at)
                    end_dt = datetime.fromisoformat(completed_at)
                    elapsed = (end_dt - start_dt).total_seconds()
                except ValueError:
                    elapsed = None
            print(f"Sections built: {len(sections)}")
            print(f"Total candidates: {candidate_total}")
            print(f"Total selected: {selected_total}")
            print(f"Verifier OK: {verifier_ok}")
            print(f"Generation mode: {generation_mode}")
            if elapsed is not None:
                print(f"Time: {elapsed:.2f}s")
        else:
            print("Trace not available.")

    print("\n=== CaseJSON ===\n")
    print(json.dumps(case_json_dump, indent=2))

    print("\n=== Provenance ===\n")
    print(json.dumps(provenance_dump, indent=2))

    print("\n=== Export Payload for Indexer ===\n")
    print(json.dumps(export_payload_dump, indent=2))


def _pick_first_closed_ticket(engine) -> str:
    df = pd.read_sql_query(
        "SELECT Ticket_Number FROM raw_tickets WHERE Status = 'Closed' LIMIT 1",
        engine,
    )
    if df.empty:
        raise ValueError("No closed tickets found")
    return str(df.iloc[0]["Ticket_Number"])


if __name__ == "__main__":
    main()
