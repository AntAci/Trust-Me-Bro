from __future__ import annotations

import os
import sys

import argparse

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from db import get_engine, get_session, init_db
from generation.governance import get_drafts_by_status


def main() -> None:
    parser = argparse.ArgumentParser(description="List KB drafts by status")
    parser.add_argument("--status", required=True, help="draft|approved|rejected|published")
    parser.add_argument("--db", default="trust_me_bro.db", help="SQLite DB path")
    args = parser.parse_args()

    engine = get_engine(args.db)
    init_db(engine)
    session = get_session(engine)
    try:
        drafts = get_drafts_by_status(session, args.status)
    finally:
        session.close()

    print("draft_id\tticket_id\tstatus\tcreated_at\treviewer\ttitle")
    for draft in drafts:
        print(
            f"{draft.draft_id}\t{draft.ticket_id}\t{draft.status}\t"
            f"{draft.created_at}\t{draft.reviewer or ''}\t{draft.title}"
        )


if __name__ == "__main__":
    main()
