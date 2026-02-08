from __future__ import annotations

import argparse
import json
import os
import sys

REPO_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), os.pardir))
if REPO_ROOT not in sys.path:
    sys.path.insert(0, REPO_ROOT)

from analytics.galaxy import build_galaxy_layout
from db import get_engine, get_session, init_db


def main() -> None:
    parser = argparse.ArgumentParser(description="Precompute galaxy layout JSON.")
    parser.add_argument("--db", default="trust_me_bro.db")
    parser.add_argument("--limit", type=int, default=800)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--output", default="galaxy_cache.json")
    args = parser.parse_args()

    engine = get_engine(args.db)
    init_db(engine)
    session = get_session(engine)
    try:
        nodes, edges, highlights = build_galaxy_layout(
            session, limit=args.limit, seed=args.seed
        )
    finally:
        session.close()

    payload = {
        "computed_at": None,
        "layout": {"method": "tfidf+svd2", "seed": args.seed, "limit": args.limit},
        "nodes": nodes,
        "edges": edges,
        "highlights": highlights,
    }
    with open(args.output, "w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)


if __name__ == "__main__":
    main()
