from __future__ import annotations

import os
import sys

import argparse

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from db import get_engine, get_session, init_db
from generation.governance import approve_draft, reject_draft


def main() -> None:
    parser = argparse.ArgumentParser(description="Approve or reject a KB draft")
    parser.add_argument("draft_id", help="Draft ID to review")
    parser.add_argument("--action", required=True, choices=["approve", "reject"])
    parser.add_argument("--reviewer", required=True, help="Reviewer name")
    parser.add_argument("--notes", default=None, help="Optional review notes")
    parser.add_argument("--db", default="trust_me_bro.db", help="SQLite DB path")
    args = parser.parse_args()

    engine = get_engine(args.db)
    init_db(engine)
    session = get_session(engine)
    output = None
    try:
        if args.action == "approve":
            draft = approve_draft(session, args.draft_id, args.reviewer, args.notes)
        else:
            draft = reject_draft(session, args.draft_id, args.reviewer, args.notes)
        # Capture fields before session closes (avoid DetachedInstanceError)
        output = f"{draft.draft_id} status={draft.status} reviewer={draft.reviewer}"
    finally:
        session.close()

    print(output or f"{args.draft_id} reviewed")


if __name__ == "__main__":
    main()
