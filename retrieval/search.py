"""
Search Interface for Knowledge Base

Provides the main search_kb function used by gap detection.
"""

from .index import KBIndex, build_seed_index

# Global index instance (lazy-loaded)
_index: KBIndex | None = None


def get_index(force_rebuild: bool = False, index_type: str = "seed") -> KBIndex:
    """
    Get or build the KB index.
    
    Args:
        force_rebuild: Force rebuild instead of loading from cache
        index_type: "seed" for existing_knowledge_articles only,
                   "full" for seed + published learned articles
    
    Returns:
        KBIndex instance
    """
    global _index
    
    if _index is not None and not force_rebuild:
        return _index
    
    _index = KBIndex()
    
    cache_name = f"{index_type}_index"
    
    # Try to load from cache
    if not force_rebuild and _index.load(cache_name):
        print(f"📂 Loaded {index_type} index from cache ({_index.size} articles)")
        return _index
    
    # Build fresh index
    if index_type == "seed":
        count = _index.load_from_db(table="existing_knowledge_articles")
    else:
        # Full index - use the combined builder
        from .index import build_full_index
        _index = build_full_index()
        return _index
    
    _index.save(cache_name)
    print(f"📚 Built {index_type} index with {count} articles")
    
    return _index


def search_kb(query: str, top_k: int = 5, index_type: str = "seed") -> list[dict]:
    """
    Search the knowledge base for relevant articles.
    
    This is the main search interface used by gap detection.
    
    Args:
        query: Search query string
        top_k: Number of results to return
        index_type: "seed" or "full"
    
    Returns:
        List of dicts with keys:
        - kb_id: Article ID
        - title: Article title
        - score: BM25 relevance score
        - body_preview: First 200 chars of body
        - product: Product/module
    """
    index = get_index(index_type=index_type)
    return index.search(query, top_k=top_k)


def reset_index() -> None:
    """Reset the global index (forces rebuild on next access)."""
    global _index
    _index = None


if __name__ == "__main__":
    # Test search
    print("Testing search_kb...")
    
    results = search_kb("how to reset password", top_k=5)
    
    print(f"\nResults for 'how to reset password':")
    for i, r in enumerate(results, 1):
        print(f"  {i}. [{r['score']:.2f}] {r['kb_id']}: {r['title'][:60]}")
