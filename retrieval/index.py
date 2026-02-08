"""
BM25 Index for Knowledge Base Articles

Provides BM25-based indexing over existing_knowledge_articles (seed KBs).
This is the baseline index used for gap detection.
"""

import os
import pickle
from pathlib import Path
from dataclasses import dataclass

from rank_bm25 import BM25Okapi
from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()

# Index cache path
INDEX_CACHE_DIR = Path(__file__).parent.parent / "data" / "index_cache"


@dataclass
class KBDocument:
    """A knowledge base document for indexing."""
    kb_article_id: str
    title: str
    body: str
    product: str = ""
    source_type: str = ""
    
    @property
    def text(self) -> str:
        """Combined text for indexing."""
        parts = [self.title or "", self.body or ""]
        if self.product:
            parts.append(self.product)
        return " ".join(p for p in parts if p)
    
    def tokenize(self) -> list[str]:
        """Simple whitespace tokenization with lowercasing."""
        text = self.text.lower()
        # Remove punctuation and split
        tokens = []
        for word in text.split():
            # Strip punctuation
            clean = "".join(c for c in word if c.isalnum())
            if clean and len(clean) > 1:  # Skip single chars
                tokens.append(clean)
        return tokens


class KBIndex:
    """BM25 index over knowledge base articles."""
    
    def __init__(self):
        self.documents: list[KBDocument] = []
        self.bm25: BM25Okapi | None = None
        self._id_to_idx: dict[str, int] = {}
    
    def load_from_db(self, table: str = "existing_knowledge_articles", 
                     status_filter: str | None = None) -> int:
        """
        Load documents from database and build index.
        
        Args:
            table: Table to load from (existing_knowledge_articles or knowledge_articles)
            status_filter: Optional status filter (e.g., 'Active', 'Published')
        
        Returns:
            Number of documents indexed
        """
        database_url = os.getenv("DATABASE_URL")
        if not database_url:
            raise ValueError("DATABASE_URL not found in environment")
        
        engine = create_engine(database_url)
        
        # Build query based on table
        if table == "existing_knowledge_articles":
            query = """
                SELECT kb_article_id, title, body, product, source_type
                FROM existing_knowledge_articles
                WHERE body IS NOT NULL AND body != ''
            """
        elif table == "knowledge_articles":
            query = """
                SELECT kb_article_id, title, body, module as product, source_type
                FROM knowledge_articles
                WHERE body IS NOT NULL AND body != ''
            """
            if status_filter:
                query += f" AND status IN ('{status_filter}')"
        else:
            raise ValueError(f"Unknown table: {table}")
        
        # Load documents
        with engine.connect() as conn:
            result = conn.execute(text(query))
            rows = result.fetchall()
        
        self.documents = []
        for row in rows:
            doc = KBDocument(
                kb_article_id=str(row[0]),
                title=str(row[1]) if row[1] else "",
                body=str(row[2]) if row[2] else "",
                product=str(row[3]) if row[3] else "",
                source_type=str(row[4]) if row[4] else "",
            )
            self.documents.append(doc)
        
        # Build index
        self._build_index()
        
        return len(self.documents)
    
    def _build_index(self) -> None:
        """Build BM25 index from loaded documents."""
        if not self.documents:
            raise ValueError("No documents loaded")
        
        # Tokenize all documents
        tokenized_corpus = [doc.tokenize() for doc in self.documents]
        
        # Build BM25 index
        self.bm25 = BM25Okapi(tokenized_corpus)
        
        # Build ID lookup
        self._id_to_idx = {
            doc.kb_article_id: idx 
            for idx, doc in enumerate(self.documents)
        }
    
    def search(self, query: str, top_k: int = 5) -> list[dict]:
        """
        Search the index and return top-k results.
        
        Args:
            query: Search query string
            top_k: Number of results to return
        
        Returns:
            List of dicts with kb_id, title, score, body_preview
        """
        if self.bm25 is None:
            raise ValueError("Index not built. Call load_from_db first.")
        
        # Tokenize query
        query_tokens = query.lower().split()
        query_tokens = ["".join(c for c in t if c.isalnum()) for t in query_tokens]
        query_tokens = [t for t in query_tokens if t and len(t) > 1]
        
        if not query_tokens:
            return []
        
        # Get BM25 scores
        scores = self.bm25.get_scores(query_tokens)
        
        # Get top-k indices
        top_indices = sorted(
            range(len(scores)), 
            key=lambda i: scores[i], 
            reverse=True
        )[:top_k]
        
        # Build results
        results = []
        for idx in top_indices:
            doc = self.documents[idx]
            score = float(scores[idx])
            
            # Skip zero-score results
            if score <= 0:
                continue
            
            results.append({
                "kb_id": doc.kb_article_id,
                "title": doc.title,
                "score": round(score, 4),
                "body_preview": doc.body[:200] + "..." if len(doc.body) > 200 else doc.body,
                "product": doc.product,
            })
        
        return results
    
    def save(self, name: str = "seed_index") -> Path:
        """Save index to disk."""
        INDEX_CACHE_DIR.mkdir(parents=True, exist_ok=True)
        path = INDEX_CACHE_DIR / f"{name}.pkl"
        
        with open(path, "wb") as f:
            pickle.dump({
                "documents": self.documents,
                "bm25": self.bm25,
                "id_to_idx": self._id_to_idx,
            }, f)
        
        return path
    
    def load(self, name: str = "seed_index") -> bool:
        """Load index from disk. Returns True if successful."""
        path = INDEX_CACHE_DIR / f"{name}.pkl"
        
        if not path.exists():
            return False
        
        with open(path, "rb") as f:
            data = pickle.load(f)
        
        self.documents = data["documents"]
        self.bm25 = data["bm25"]
        self._id_to_idx = data["id_to_idx"]
        
        return True
    
    @property
    def size(self) -> int:
        """Number of documents in index."""
        return len(self.documents)


def build_seed_index() -> KBIndex:
    """Build and return the seed index from existing_knowledge_articles."""
    index = KBIndex()
    count = index.load_from_db(table="existing_knowledge_articles")
    print(f"📚 Built seed index with {count} articles")
    index.save("seed_index")
    return index


def build_full_index() -> KBIndex:
    """
    Build full index including both seed KBs and published learned KBs.
    
    Combines:
    - existing_knowledge_articles (all)
    - knowledge_articles WHERE status IN ('Active', 'Published')
    """
    index = KBIndex()
    
    database_url = os.getenv("DATABASE_URL")
    engine = create_engine(database_url)
    
    # Load seed articles
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT kb_article_id, title, body, product, source_type, 'seed' as origin
            FROM existing_knowledge_articles
            WHERE body IS NOT NULL AND body != ''
            
            UNION ALL
            
            SELECT kb_article_id, title, body, module, source_type, 'learned' as origin
            FROM knowledge_articles
            WHERE body IS NOT NULL AND body != ''
              AND status IN ('Active', 'Published')
        """))
        rows = result.fetchall()
    
    index.documents = []
    for row in rows:
        doc = KBDocument(
            kb_article_id=str(row[0]),
            title=str(row[1]) if row[1] else "",
            body=str(row[2]) if row[2] else "",
            product=str(row[3]) if row[3] else "",
            source_type=str(row[4]) if row[4] else "",
        )
        index.documents.append(doc)
    
    index._build_index()
    print(f"📚 Built full index with {index.size} articles (seed + published)")
    index.save("full_index")
    
    return index


if __name__ == "__main__":
    # Build seed index when run directly
    idx = build_seed_index()
    print(f"Index size: {idx.size}")
    
    # Test search
    results = idx.search("password reset", top_k=3)
    print("\nTest search for 'password reset':")
    for r in results:
        print(f"  [{r['score']:.2f}] {r['kb_id']}: {r['title'][:50]}")
