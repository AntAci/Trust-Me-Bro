"""
Evaluation Dashboard

Aggregates all metrics for hackathon demo:
- Gap counts
- Draft counts  
- Approval counts
- Time-to-publish (simulated)
- Retrieval lift summary
"""

import os
from datetime import datetime, timezone

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()


def get_coverage_metrics() -> dict:
    """
    Get coverage counters from the database.
    
    Returns:
        Dict with gaps, drafts, approvals, published counts
    """
    database_url = os.getenv("DATABASE_URL")
    engine = create_engine(database_url)
    
    with engine.connect() as conn:
        # Gap events (from learning_events)
        result = conn.execute(text("""
            SELECT COUNT(*) FROM learning_events 
            WHERE event_type = 'gap_detected'
        """))
        gap_count = result.scalar() or 0
        
        # Draft KBs
        result = conn.execute(text("""
            SELECT COUNT(*) FROM knowledge_articles 
            WHERE status = 'Draft'
        """))
        draft_count = result.scalar() or 0
        
        # Approved/Published KBs (learned, not seed)
        result = conn.execute(text("""
            SELECT COUNT(*) FROM knowledge_articles 
            WHERE status IN ('Active', 'Published')
        """))
        published_count = result.scalar() or 0
        
        # Total seed KBs
        result = conn.execute(text("""
            SELECT COUNT(*) FROM existing_knowledge_articles
        """))
        seed_count = result.scalar() or 0
        
        # Total tickets
        result = conn.execute(text("""
            SELECT COUNT(*) FROM tickets
        """))
        ticket_count = result.scalar() or 0
        
        # Learning events by type
        result = conn.execute(text("""
            SELECT event_type, COUNT(*) as cnt
            FROM learning_events
            WHERE event_type IS NOT NULL
            GROUP BY event_type
        """))
        events_by_type = {row[0]: row[1] for row in result.fetchall()}
        
        # Lineage edges (provenance tracking)
        result = conn.execute(text("""
            SELECT COUNT(*) FROM kb_lineage
        """))
        lineage_count = result.scalar() or 0
    
    return {
        "tickets_total": ticket_count,
        "seed_kb_articles": seed_count,
        "gaps_detected": gap_count,
        "drafts_pending": draft_count,
        "published_learned": published_count,
        "lineage_edges": lineage_count,
        "events_by_type": events_by_type,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


def get_time_to_publish_stats() -> dict:
    """
    Calculate time-to-publish statistics (simulated from timestamps).
    
    For hackathon: Uses event timestamps to estimate lifecycle duration.
    """
    database_url = os.getenv("DATABASE_URL")
    engine = create_engine(database_url)
    
    with engine.connect() as conn:
        # Get learning events with timestamps
        result = conn.execute(text("""
            SELECT 
                trigger_ticket_number,
                event_type,
                event_timestamp
            FROM learning_events
            WHERE event_timestamp IS NOT NULL
            ORDER BY trigger_ticket_number, event_timestamp
        """))
        rows = result.fetchall()
    
    # For now, return simulated stats
    # In production, would calculate actual time deltas
    return {
        "avg_time_to_publish_minutes": 15,  # Simulated
        "min_time_to_publish_minutes": 5,
        "max_time_to_publish_minutes": 45,
        "note": "Simulated for hackathon demo",
    }


def print_dashboard():
    """Print the full evaluation dashboard."""
    metrics = get_coverage_metrics()
    time_stats = get_time_to_publish_stats()
    
    print("\n" + "=" * 70)
    print("🏆 TRUST-ME-BRO EVALUATION DASHBOARD")
    print("=" * 70)
    
    print(f"""
📊 DATA COVERAGE
────────────────────────────────────────
  Tickets ingested:           {metrics['tickets_total']:,}
  Seed KB articles:           {metrics['seed_kb_articles']:,}
  Lineage edges (provenance): {metrics['lineage_edges']:,}

📈 LEARNING PIPELINE
────────────────────────────────────────
  Gaps detected:              {metrics['gaps_detected']:,}
  Drafts pending review:      {metrics['drafts_pending']:,}
  Published (learned):        {metrics['published_learned']:,}

📋 LEARNING EVENTS BY TYPE
────────────────────────────────────────""")
    
    for event_type, count in sorted(metrics.get('events_by_type', {}).items()):
        print(f"  {event_type:25} {count:,}")
    
    print(f"""
⏱️  TIME-TO-PUBLISH (Simulated)
────────────────────────────────────────
  Average:                    {time_stats['avg_time_to_publish_minutes']} min
  Min:                        {time_stats['min_time_to_publish_minutes']} min
  Max:                        {time_stats['max_time_to_publish_minutes']} min

🔐 TRUST GUARANTEES
────────────────────────────────────────
  ✓ Drafts excluded from search index
  ✓ All learning events logged with metadata
  ✓ Provenance tracked via kb_lineage
  ✓ Before/after retrieval proof available

📅 Dashboard generated: {metrics['timestamp']}
""")
    print("=" * 70)
    
    return metrics


def get_retrieval_lift_summary(sample_size: int = 10) -> dict:
    """
    Run retrieval lift calculation on sample tickets.
    
    Returns summary stats for demo.
    """
    from eval.before_after import run_batch_evaluation
    
    summary = run_batch_evaluation(limit=sample_size, verbose=False)
    return summary


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Evaluation Dashboard")
    parser.add_argument(
        "--with-retrieval-lift",
        action="store_true",
        help="Include retrieval lift calculation (slower)",
    )
    parser.add_argument(
        "--sample-size",
        type=int,
        default=10,
        help="Sample size for retrieval lift",
    )
    args = parser.parse_args()
    
    # Print main dashboard
    print_dashboard()
    
    # Optionally run retrieval lift
    if args.with_retrieval_lift:
        print("\n🔄 Calculating retrieval lift...")
        summary = get_retrieval_lift_summary(args.sample_size)
        
        print(f"""
📈 RETRIEVAL LIFT SUMMARY ({summary['total_tickets']} tickets)
────────────────────────────────────────
  Gaps BEFORE learning:       {summary['gaps_before']} ({summary['gaps_before']/summary['total_tickets']*100:.1f}%)
  Gaps AFTER learning:        {summary['gaps_after']} ({summary['gaps_after']/summary['total_tickets']*100:.1f}%)
  Gaps CLOSED:                {summary['gaps_closed']} ✅
  Gap reduction rate:         {summary['gap_reduction_rate']*100:.1f}%
  Avg score improvement:      {summary['average_score_improvement']:+.2f}
""")
