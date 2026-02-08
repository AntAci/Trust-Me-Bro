"""
Reindex Module

Rebuilds the search index after KB articles are published.
This is called when drafts are approved and published.

Key rule: Draft KBs are NEVER indexed. Only published/active KBs.
"""

import os
import json
from datetime import datetime

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

from .index import build_seed_index, build_full_index, KBIndex
from .search import reset_index

load_dotenv()


def reindex_on_publish(kb_article_id: str | None = None) -> dict:
    """
    Rebuild the full index after a KB article is published.
    
    This:
    1. Rebuilds the full index (seed + published learned articles)
    2. Logs a reindex event to learning_events
    3. Resets the global index cache
    
    Args:
        kb_article_id: The KB that was just published (for logging)
    
    Returns:
        Dict with index stats and event_id
    """
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL not found in environment")
    
    engine = create_engine(database_url)
    
    # Reset cached index
    reset_index()
    
    # Rebuild full index
    print("🔄 Rebuilding full index...")
    full_index = build_full_index()
    
    # Also rebuild seed index for comparison
    print("🔄 Rebuilding seed index...")
    seed_index = build_seed_index()
    
    # Log reindex event
    event_id = f"reindex_{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
    
    metadata = {
        "full_index_size": full_index.size,
        "seed_index_size": seed_index.size,
        "new_articles": full_index.size - seed_index.size,
        "triggered_by_kb": kb_article_id,
    }
    
    with engine.connect() as conn:
        conn.execute(text("""
            INSERT INTO learning_events (
                event_id,
                proposed_kb_article_id,
                event_type,
                event_timestamp,
                metadata
            ) VALUES (
                :event_id,
                :kb_article_id,
                'reindexed',
                :timestamp,
                :metadata
            )
        """), {
            "event_id": event_id,
            "kb_article_id": kb_article_id,
            "timestamp": datetime.utcnow().isoformat(),
            "metadata": json.dumps(metadata),
        })
        conn.commit()
    
    print(f"✅ Reindex complete:")
    print(f"   Seed index: {seed_index.size} articles")
    print(f"   Full index: {full_index.size} articles")
    print(f"   New learned: {full_index.size - seed_index.size} articles")
    
    return {
        "event_id": event_id,
        "seed_index_size": seed_index.size,
        "full_index_size": full_index.size,
        "new_articles_count": full_index.size - seed_index.size,
    }


def get_index_stats() -> dict:
    """Get current index statistics."""
    database_url = os.getenv("DATABASE_URL")
    engine = create_engine(database_url)
    
    with engine.connect() as conn:
        # Count seed articles
        result = conn.execute(text("""
            SELECT COUNT(*) FROM existing_knowledge_articles
            WHERE body IS NOT NULL AND body != ''
        """))
        seed_count = result.scalar()
        
        # Count published learned articles
        result = conn.execute(text("""
            SELECT COUNT(*) FROM knowledge_articles
            WHERE body IS NOT NULL AND body != ''
              AND status IN ('Active', 'Published')
        """))
        published_count = result.scalar()
        
        # Count draft articles (not indexed)
        result = conn.execute(text("""
            SELECT COUNT(*) FROM knowledge_articles
            WHERE status = 'Draft'
        """))
        draft_count = result.scalar()
    
    return {
        "seed_articles": seed_count,
        "published_learned_articles": published_count,
        "draft_articles_not_indexed": draft_count,
        "total_indexed": seed_count + published_count,
    }


def verify_draft_not_indexed(kb_article_id: str) -> bool:
    """
    Verify that a draft KB article is NOT in the index.
    
    This is a safety check to ensure drafts never leak into search.
    """
    from .search import search_kb
    
    database_url = os.getenv("DATABASE_URL")
    engine = create_engine(database_url)
    
    # Get the KB title
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT title, status FROM knowledge_articles
            WHERE kb_article_id = :kb_id
        """), {"kb_id": kb_article_id})
        row = result.fetchone()
    
    if not row:
        print(f"KB article {kb_article_id} not found")
        return True
    
    title, status = row
    
    if status not in ("Draft", "Pending"):
        print(f"KB {kb_article_id} is not a draft (status={status})")
        return True
    
    # Search for the exact title
    results = search_kb(str(title), top_k=10, index_type="full")
    
    # Check if this KB ID appears in results
    for r in results:
        if r["kb_id"] == kb_article_id:
            print(f"❌ VIOLATION: Draft KB {kb_article_id} found in index!")
            return False
    
    print(f"✅ Draft KB {kb_article_id} correctly excluded from index")
    return True


if __name__ == "__main__":
    print("📊 Index Statistics")
    print("=" * 50)
    
    stats = get_index_stats()
    for key, value in stats.items():
        print(f"  {key}: {value}")
    
    print("\n🔄 Running reindex...")
    result = reindex_on_publish()
    
    print(f"\n✅ Reindex complete. Event ID: {result['event_id']}")
