"""
Ticket → Query Builder

Converts a ticket into a search query for KB retrieval.
This must be deterministic and explainable.
"""

import os
import re

from dotenv import load_dotenv
from sqlalchemy import create_engine, text

load_dotenv()


# Patterns to remove from queries (noise reduction)
NOISE_PATTERNS = [
    r"\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b",  # Emails
    r"\b\d{3}[-.]?\d{3}[-.]?\d{4}\b",  # Phone numbers
    r"\b[A-Z]{2,}-\d{4,}\b",  # Ticket/case IDs (e.g., TKT-12345)
    r"\b\d{5,}\b",  # Long numbers (IDs, zips, etc.)
    r"http[s]?://\S+",  # URLs
    r"\b(hi|hello|thanks|thank you|please|regards|sincerely)\b",  # Greetings
]

# Stopwords to remove
STOPWORDS = {
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "have", "has", "had", "do", "does", "did", "will", "would", "could",
    "should", "may", "might", "must", "shall", "can", "need", "dare",
    "ought", "used", "to", "of", "in", "for", "on", "with", "at", "by",
    "from", "as", "into", "through", "during", "before", "after", "above",
    "below", "between", "under", "again", "further", "then", "once", "here",
    "there", "when", "where", "why", "how", "all", "each", "few", "more",
    "most", "other", "some", "such", "no", "nor", "not", "only", "own",
    "same", "so", "than", "too", "very", "just", "also", "now", "i", "me",
    "my", "we", "our", "you", "your", "he", "she", "it", "they", "them",
    "this", "that", "these", "those", "am", "get", "got", "getting",
}


def clean_text(text: str) -> str:
    """Remove noise patterns from text."""
    if not text:
        return ""
    
    result = text
    
    # Apply noise patterns
    for pattern in NOISE_PATTERNS:
        result = re.sub(pattern, " ", result, flags=re.IGNORECASE)
    
    # Remove extra whitespace
    result = re.sub(r"\s+", " ", result).strip()
    
    return result


def extract_keywords(text: str, max_words: int = 20) -> str:
    """Extract meaningful keywords from text."""
    if not text:
        return ""
    
    # Lowercase and split
    words = text.lower().split()
    
    # Filter stopwords and short words
    keywords = [
        w for w in words 
        if w not in STOPWORDS 
        and len(w) > 2
        and w.isalpha()
    ]
    
    # Deduplicate while preserving order
    seen = set()
    unique_keywords = []
    for kw in keywords:
        if kw not in seen:
            seen.add(kw)
            unique_keywords.append(kw)
    
    # Limit to max_words
    return " ".join(unique_keywords[:max_words])


def ticket_to_query(ticket_number: str) -> str:
    """
    Convert a ticket to a search query.
    
    Uses:
    - Ticket subject
    - Ticket description
    - Module/category if present
    
    Removes:
    - IDs, emails, phone numbers
    - Greetings and noise words
    
    Args:
        ticket_number: The ticket ID to convert
    
    Returns:
        Clean, deterministic search query string
    """
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        raise ValueError("DATABASE_URL not found in environment")
    
    engine = create_engine(database_url)
    
    # Fetch ticket data
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT subject, description, module, category, product, tags
            FROM tickets
            WHERE ticket_number = :ticket_number
        """), {"ticket_number": ticket_number})
        row = result.fetchone()
    
    if not row:
        raise ValueError(f"Ticket not found: {ticket_number}")
    
    subject, description, module, category, product, tags = row
    
    # Build query components
    components = []
    
    # Subject is highest priority
    if subject and str(subject).strip() and str(subject).lower() != "nan":
        clean_subject = clean_text(str(subject))
        components.append(extract_keywords(clean_subject, max_words=10))
    
    # Description provides context
    if description and str(description).strip() and str(description).lower() != "nan":
        clean_desc = clean_text(str(description))
        components.append(extract_keywords(clean_desc, max_words=15))
    
    # Module/category add domain context
    for field in [module, category, product]:
        if field and str(field).strip() and str(field).lower() != "nan":
            components.append(str(field).lower())
    
    # Combine and deduplicate
    query = " ".join(c for c in components if c)
    query = extract_keywords(query, max_words=25)
    
    return query


def ticket_to_query_with_metadata(ticket_number: str) -> dict:
    """
    Convert ticket to query with full metadata for debugging.
    
    Returns:
        Dict with query, original_subject, original_description, etc.
    """
    database_url = os.getenv("DATABASE_URL")
    engine = create_engine(database_url)
    
    with engine.connect() as conn:
        result = conn.execute(text("""
            SELECT subject, description, module, category, product, tags
            FROM tickets
            WHERE ticket_number = :ticket_number
        """), {"ticket_number": ticket_number})
        row = result.fetchone()
    
    if not row:
        raise ValueError(f"Ticket not found: {ticket_number}")
    
    subject, description, module, category, product, tags = row
    query = ticket_to_query(ticket_number)
    
    return {
        "ticket_number": ticket_number,
        "query": query,
        "original_subject": str(subject) if subject else None,
        "original_description": str(description)[:500] if description else None,
        "module": str(module) if module and str(module).lower() != "nan" else None,
        "category": str(category) if category and str(category).lower() != "nan" else None,
        "product": str(product) if product and str(product).lower() != "nan" else None,
    }


if __name__ == "__main__":
    import sys
    
    # Test with a ticket
    database_url = os.getenv("DATABASE_URL")
    engine = create_engine(database_url)
    
    # Get first ticket
    with engine.connect() as conn:
        result = conn.execute(text("SELECT ticket_number FROM tickets LIMIT 1"))
        row = result.fetchone()
    
    if row:
        ticket_number = row[0]
        print(f"Testing ticket_to_query for: {ticket_number}")
        
        meta = ticket_to_query_with_metadata(ticket_number)
        print(f"\nOriginal subject: {meta['original_subject']}")
        print(f"Original description: {meta['original_description'][:200]}...")
        print(f"Module: {meta['module']}")
        print(f"Category: {meta['category']}")
        print(f"\n🔍 Generated query: {meta['query']}")
    else:
        print("No tickets found in database. Run ingestion first.")
