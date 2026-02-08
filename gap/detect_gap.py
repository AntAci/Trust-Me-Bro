"""
Gap Detection Module

Detects knowledge gaps by analyzing retrieval quality for tickets.
Logs gap detection events to learning_events table.

This is the core trust logic - it decides whether the system
has sufficient knowledge to answer a ticket.
"""

import os
import json
import uuid
from datetime import datetime
from dataclasses import dataclass, asdict

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

from retrieval.search import search_kb
from retrieval.query_builder import ticket_to_query, ticket_to_query_with_metadata

load_dotenv()


# Gap detection thresholds
GAP_THRESHOLD_TOP1 = 8.0   # BM25 score threshold for top-1 result
GAP_THRESHOLD_AVG = 5.0    # Average score threshold for top-k
MIN_RESULTS_REQUIRED = 1   # Minimum results needed to not be a gap


@dataclass
class GapDetectionResult:
    """Result of gap detection for a ticket."""
    ticket_number: str
    is_gap: bool
    query: str
    top_results: list[dict]
    top1_score: float
    avg_score: float
    threshold_top1: float
    threshold_avg: float
    reason: str
    event_id: str | None = None  # Set after logging
    
    def to_dict(self) -> dict:
        return asdict(self)


def detect_gap(
    ticket_number: str,
    threshold_top1: float = GAP_THRESHOLD_TOP1,
    threshold_avg: float = GAP_THRESHOLD_AVG,
    top_k: int = 5,
    log_event: bool = True,
) -> GapDetectionResult:
    """
    Detect if a ticket represents a knowledge gap.
    
    A gap is detected when:
    - No results are returned, OR
    - Top-1 score < threshold_top1, OR
    - Average score of top-k < threshold_avg
    
    Args:
        ticket_number: The ticket to analyze
        threshold_top1: Minimum acceptable top-1 score
        threshold_avg: Minimum acceptable average score
        top_k: Number of results to consider
        log_event: Whether to log the event to learning_events
    
    Returns:
        GapDetectionResult with is_gap, scores, and reasoning
    """
    # Build query from ticket
    query = ticket_to_query(ticket_number)
    
    if not query.strip():
        result = GapDetectionResult(
            ticket_number=ticket_number,
            is_gap=True,
            query=query,
            top_results=[],
            top1_score=0.0,
            avg_score=0.0,
            threshold_top1=threshold_top1,
            threshold_avg=threshold_avg,
            reason="Empty query generated from ticket",
        )
        if log_event:
            _log_gap_event(result)
        return result
    
    # Search KB
    results = search_kb(query, top_k=top_k, index_type="seed")
    
    # Calculate scores
    if not results:
        top1_score = 0.0
        avg_score = 0.0
    else:
        top1_score = results[0]["score"]
        avg_score = sum(r["score"] for r in results) / len(results)
    
    # Determine if gap
    is_gap = False
    reason = "Knowledge coverage is sufficient"
    
    if len(results) < MIN_RESULTS_REQUIRED:
        is_gap = True
        reason = f"Insufficient results: {len(results)} < {MIN_RESULTS_REQUIRED} required"
    elif top1_score < threshold_top1:
        is_gap = True
        reason = f"Top-1 score {top1_score:.2f} < threshold {threshold_top1}"
    elif avg_score < threshold_avg:
        is_gap = True
        reason = f"Average score {avg_score:.2f} < threshold {threshold_avg}"
    
    result = GapDetectionResult(
        ticket_number=ticket_number,
        is_gap=is_gap,
        query=query,
        top_results=results,
        top1_score=top1_score,
        avg_score=avg_score,
        threshold_top1=threshold_top1,
        threshold_avg=threshold_avg,
        reason=reason,
    )
    
    # Log event if gap detected
    if log_event and is_gap:
        _log_gap_event(result)
    
    return result


def _log_gap_event(result: GapDetectionResult) -> str:
    """
    Log gap detection event to learning_events table.
    
    Returns the event_id.
    """
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL not found in environment")
    
    engine = create_engine(database_url)
    
    # Generate event ID
    event_id = f"gap_{result.ticket_number}_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
    
    # Build metadata JSON
    metadata = {
        "query": result.query,
        "top1_score": result.top1_score,
        "avg_score": result.avg_score,
        "threshold_top1": result.threshold_top1,
        "threshold_avg": result.threshold_avg,
        "reason": result.reason,
        "top_results": [
            {
                "kb_id": r["kb_id"],
                "title": r["title"],
                "score": r["score"],
            }
            for r in result.top_results[:5]
        ],
    }
    
    # Insert learning event
    with engine.connect() as conn:
        conn.execute(text("""
            INSERT INTO learning_events (
                event_id,
                event_type,
                ticket_id,
                metadata_json,
                created_at,
                trigger_ticket_number,
                detected_gap,
                event_timestamp
            ) VALUES (
                :event_id,
                'gap_detected',
                :ticket_number,
                :metadata,
                NOW(),
                :ticket_number,
                :detected_gap,
                :timestamp
            )
        """), {
            "event_id": event_id,
            "ticket_number": result.ticket_number,
            "detected_gap": "Yes" if result.is_gap else "No",
            "timestamp": datetime.utcnow().isoformat(),
            "metadata": json.dumps(metadata),
        })
        conn.commit()
    
    result.event_id = event_id
    return event_id


def run_gap_detection_batch(
    ticket_numbers: list[str] | None = None,
    limit: int = 50,
    log_events: bool = True,
) -> dict:
    """
    Run gap detection on multiple tickets.
    
    Args:
        ticket_numbers: Specific tickets to analyze (None = sample from DB)
        limit: Max tickets to process if sampling
        log_events: Whether to log events
    
    Returns:
        Summary dict with gap_count, total, gap_rate, gaps list
    """
    database_url = os.getenv("DATABASE_URL")
    engine = create_engine(database_url)
    
    # Get tickets to analyze
    if ticket_numbers is None:
        with engine.connect() as conn:
            result = conn.execute(text(f"""
                SELECT ticket_number FROM tickets LIMIT {limit}
            """))
            ticket_numbers = [row[0] for row in result.fetchall()]
    
    gaps = []
    non_gaps = []
    errors = []
    
    for ticket_num in ticket_numbers:
        try:
            result = detect_gap(ticket_num, log_event=log_events)
            if result.is_gap:
                gaps.append(result)
            else:
                non_gaps.append(result)
        except Exception as e:
            errors.append({"ticket_number": ticket_num, "error": str(e)})
    
    return {
        "total": len(ticket_numbers),
        "gap_count": len(gaps),
        "non_gap_count": len(non_gaps),
        "error_count": len(errors),
        "gap_rate": len(gaps) / len(ticket_numbers) if ticket_numbers else 0,
        "gaps": [g.to_dict() for g in gaps],
        "errors": errors,
    }


if __name__ == "__main__":
    import sys
    
    print("🔍 Gap Detection Test")
    print("=" * 50)
    
    # Get a sample ticket
    database_url = os.getenv("DATABASE_URL")
    engine = create_engine(database_url)
    
    with engine.connect() as conn:
        result = conn.execute(text("SELECT ticket_number FROM tickets LIMIT 5"))
        tickets = [row[0] for row in result.fetchall()]
    
    if not tickets:
        print("No tickets found. Run ingestion first.")
        sys.exit(1)
    
    for ticket_num in tickets:
        print(f"\n📋 Ticket: {ticket_num}")
        
        try:
            result = detect_gap(ticket_num, log_event=False)
            
            print(f"   Query: {result.query[:60]}...")
            print(f"   Top-1 Score: {result.top1_score:.2f}")
            print(f"   Avg Score: {result.avg_score:.2f}")
            print(f"   Is Gap: {'🔴 YES' if result.is_gap else '🟢 NO'}")
            print(f"   Reason: {result.reason}")
            
            if result.top_results:
                print(f"   Top result: {result.top_results[0]['title'][:50]}...")
        except Exception as e:
            print(f"   ❌ Error: {e}")
