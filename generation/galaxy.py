from __future__ import annotations

import uuid
from datetime import datetime
from typing import List

from sqlalchemy.orm import Session

from db.models import KBGalaxyPoint, PublishedKBArticle

try:
    import numpy as np
    from sklearn.decomposition import TruncatedSVD
    from sklearn.feature_extraction.text import TfidfVectorizer

    _SKLEARN_AVAILABLE = True
except Exception:
    _SKLEARN_AVAILABLE = False


def recompute_galaxy_points(session: Session) -> None:
    if not _SKLEARN_AVAILABLE:
        return

    articles = (
        session.query(PublishedKBArticle)
        .order_by(PublishedKBArticle.updated_at.desc())
        .all()
    )
    if not articles:
        return

    texts = [f"{article.title or ''} {article.body_markdown or ''}" for article in articles]
    vectorizer = TfidfVectorizer(max_features=300, stop_words="english")
    tfidf_matrix = vectorizer.fit_transform(texts)

    if tfidf_matrix.shape[0] < 2:
        coords = np.zeros((len(articles), 2), dtype=float)
    else:
        svd = TruncatedSVD(n_components=2, random_state=42)
        coords = svd.fit_transform(tfidf_matrix)

    coords = _normalize_coords(coords)

    method = "tfidf_svd2"
    by_article_id = {
        point.kb_article_id: point
        for point in session.query(KBGalaxyPoint).all()
    }

    for article, (x_val, y_val) in zip(articles, coords):
        existing = by_article_id.get(article.kb_article_id)
        if existing:
            existing.x = float(x_val)
            existing.y = float(y_val)
            existing.method = method
            existing.updated_at = datetime.utcnow()
        else:
            session.add(
                KBGalaxyPoint(
                    point_id=str(uuid.uuid4()),
                    kb_article_id=article.kb_article_id,
                    x=float(x_val),
                    y=float(y_val),
                    method=method,
                    updated_at=datetime.utcnow(),
                )
            )
    session.commit()


def _normalize_coords(coords: "np.ndarray") -> "np.ndarray":
    if coords.size == 0:
        return coords
    mean = coords.mean(axis=0)
    std = coords.std(axis=0)
    std = np.where(std == 0, 1.0, std)
    return (coords - mean) / std
