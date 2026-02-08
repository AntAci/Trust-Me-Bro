from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any, Dict, Iterable, List, Optional, Tuple

from sqlalchemy import func, text

from db.models import EvidenceUnit, KBLineageEdge, KBDraft, PublishedKBArticle

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity

    _SKLEARN_AVAILABLE = True
except Exception:
    _SKLEARN_AVAILABLE = False


SECTION_MAP = {
    "summary": "problem",
    "problem statement": "problem",
    "problem": "problem",
    "symptoms": "symptoms",
    "environment": "environment",
    "root cause": "root_cause",
    "resolution steps": "resolution_steps",
    "verification steps": "verification_steps",
    "required inputs": "placeholders_needed",
    "placeholders needed": "placeholders_needed",
    "evidence sources": "evidence_sources",
}


@dataclass
class EvidenceSnippet:
    evidence_unit_id: str
    score: float
    source_type: str
    source_id: str
    field_name: str
    snippet_preview: str


def compute_grounding(
    session,
    draft_id: Optional[str] = None,
    kb_article_id: Optional[str] = None,
    threshold: float = 0.28,
    max_claims: int = 80,
) -> Dict[str, Any]:
    draft = None
    article = None
    if draft_id:
        draft = session.query(KBDraft).filter(KBDraft.draft_id == draft_id).one_or_none()
        if not draft:
            raise ValueError(f"Draft {draft_id} not found")
    if kb_article_id:
        article = (
            session.query(PublishedKBArticle)
            .filter(PublishedKBArticle.kb_article_id == kb_article_id)
            .one_or_none()
        )
        if not article:
            raise ValueError(f"Article {kb_article_id} not found")
        if not draft and article.latest_draft_id:
            draft = (
                session.query(KBDraft)
                .filter(KBDraft.draft_id == article.latest_draft_id)
                .one_or_none()
            )

    if not draft and not article:
        raise ValueError("Provide draft_id or kb_article_id")

    body_markdown = ""
    if draft:
        body_markdown = draft.body_markdown or ""
    elif article:
        body_markdown = article.body_markdown or ""

    sections = extract_sections_from_markdown(body_markdown)
    if not sections:
        sections = {"problem": body_markdown or ""}

    evidence_by_section = _get_evidence_by_section(session, draft, article)

    overall_total = 0
    overall_supported = 0
    by_section: List[Dict[str, Any]] = []
    unsupported_claims: List[Dict[str, Any]] = []

    remaining = max_claims
    for section_label, text_value in sections.items():
        if remaining <= 0:
            break
        claims = split_claims(text_value)
        if len(claims) > remaining:
            claims = claims[:remaining]
        remaining -= len(claims)
        evidence_units = evidence_by_section.get(section_label) or []
        supported, unsupported, evidence_mix = compute_grounding_for_section(
            section_label, claims, evidence_units, threshold
        )
        total = len(claims)
        overall_total += total
        overall_supported += supported
        by_section.append(
            {
                "section_label": section_label,
                "total_claims": total,
                "supported_claims": supported,
                "coverage": supported / total if total else 0.0,
                "evidence_mix": evidence_mix,
            }
        )
        unsupported_claims.extend(unsupported)

    target = {
        "type": "draft" if draft else "article",
        "id": draft.draft_id if draft else article.kb_article_id,
        "draft_id": draft.draft_id if draft else None,
        "kb_article_id": article.kb_article_id if article else None,
    }

    coverage = overall_supported / overall_total if overall_total else 0.0
    return {
        "target": target,
        "overall": {
            "total_claims": overall_total,
            "supported_claims": overall_supported,
            "coverage": coverage,
            "threshold": threshold,
        },
        "by_section": by_section,
        "unsupported_claims": unsupported_claims,
        "notes": [
            "This is a heuristic grounding signal (TF-IDF cosine similarity) for demo trust gating."
        ],
    }


def extract_sections_from_markdown(md: str) -> Dict[str, str]:
    heading_re = re.compile(r"^##\s+(.*)$")
    sections: Dict[str, List[str]] = {}
    current = None
    for line in md.splitlines():
        match = heading_re.match(line.strip())
        if match:
            heading = match.group(1).strip().lower()
            section_label = SECTION_MAP.get(heading)
            current = section_label
            if current:
                sections.setdefault(current, [])
            continue
        if current:
            sections[current].append(line)
    return {label: "\n".join(lines).strip() for label, lines in sections.items()}


def split_claims(text: str) -> List[str]:
    if not text:
        return []
    claims: List[str] = []
    for line in text.splitlines():
        stripped = line.strip()
        if not stripped:
            continue
        if re.match(r"^(\d+[\.\)]\s+|[-*]\s+)", stripped):
            claims.append(stripped.lstrip("-* ").strip())
    if not claims:
        claims.extend(_split_sentences(text))
    else:
        remaining = _split_sentences(text)
        claims.extend([item for item in remaining if item not in claims])
    return [claim for claim in claims if claim]


def compute_grounding_for_section(
    section_label: str,
    claims: List[str],
    evidence_units: Iterable[EvidenceUnit],
    threshold: float,
) -> Tuple[int, List[Dict[str, Any]], Dict[str, int]]:
    evidence_list = list(evidence_units)
    evidence_mix = _count_evidence_mix(evidence_list)
    if not claims:
        return 0, [], evidence_mix
    if not evidence_list:
        unsupported = [
            {
                "section_label": section_label,
                "claim": claim,
                "best_score": 0.0,
                "top_evidence": [],
            }
            for claim in claims
        ]
        return 0, unsupported, evidence_mix

    snippets = [item.snippet_text for item in evidence_list]
    if _SKLEARN_AVAILABLE:
        scores = _tfidf_scores(claims, snippets)
    else:
        scores = _overlap_scores(claims, snippets)

    supported_count = 0
    unsupported_details: List[Dict[str, Any]] = []
    for idx, claim in enumerate(claims):
        claim_scores = scores[idx] if idx < len(scores) else []
        best_score = max(claim_scores) if claim_scores else 0.0
        if best_score >= threshold:
            supported_count += 1
            continue
        top_indices = sorted(
            range(len(claim_scores)), key=lambda i: claim_scores[i], reverse=True
        )[:3]
        top_evidence = [
            _to_evidence_snippet(evidence_list[i], claim_scores[i])
            for i in top_indices
            if i < len(evidence_list)
        ]
        unsupported_details.append(
            {
                "section_label": section_label,
                "claim": claim,
                "best_score": float(best_score),
                "top_evidence": [snippet.__dict__ for snippet in top_evidence],
            }
        )
    return supported_count, unsupported_details, evidence_mix


def _get_evidence_by_section(
    session, draft: Optional[KBDraft], article: Optional[PublishedKBArticle]
) -> Dict[str, List[EvidenceUnit]]:
    if draft:
        edges = (
            session.query(KBLineageEdge)
            .filter(KBLineageEdge.draft_id == draft.draft_id)
            .all()
        )
    else:
        edges = []

    if edges:
        evidence_ids = {edge.evidence_unit_id for edge in edges}
        evidence_rows = (
            session.query(EvidenceUnit)
            .filter(EvidenceUnit.evidence_unit_id.in_(list(evidence_ids)))
            .all()
        )
        evidence_by_id = {evidence.evidence_unit_id: evidence for evidence in evidence_rows}
        grouped: Dict[str, List[EvidenceUnit]] = {}
        for edge in edges:
            evidence = evidence_by_id.get(edge.evidence_unit_id)
            if not evidence:
                continue
            grouped.setdefault(edge.section_label, []).append(evidence)
        return grouped

    ticket_id = None
    if draft:
        ticket_id = draft.ticket_id
    elif article:
        ticket_id = article.source_ticket_id
    if not ticket_id:
        return {}
    evidence_rows = (
        session.query(EvidenceUnit)
        .filter(EvidenceUnit.source_id == ticket_id)
        .all()
    )
    return {"problem": evidence_rows}


def _tfidf_scores(claims: List[str], evidence_snippets: List[str]) -> List[List[float]]:
    vectorizer = TfidfVectorizer()
    evidence_matrix = vectorizer.fit_transform(evidence_snippets)
    claim_matrix = vectorizer.transform(claims)
    similarities = cosine_similarity(claim_matrix, evidence_matrix)
    return similarities.tolist()


def _overlap_scores(claims: List[str], evidence_snippets: List[str]) -> List[List[float]]:
    evidence_tokens = [set(_tokenize(text)) for text in evidence_snippets]
    scores = []
    for claim in claims:
        claim_tokens = set(_tokenize(claim))
        claim_scores = []
        for tokens in evidence_tokens:
            if not claim_tokens or not tokens:
                claim_scores.append(0.0)
                continue
            overlap = len(claim_tokens & tokens) / len(claim_tokens | tokens)
            claim_scores.append(float(overlap))
        scores.append(claim_scores)
    return scores


def _tokenize(text_value: str) -> List[str]:
    return [token for token in re.split(r"\W+", text_value.lower()) if token]


def _count_evidence_mix(evidence_list: List[EvidenceUnit]) -> Dict[str, int]:
    mix: Dict[str, int] = {"TICKET": 0, "CONVERSATION": 0, "SCRIPT": 0, "PLACEHOLDER": 0}
    for evidence in evidence_list:
        if evidence.source_type in mix:
            mix[evidence.source_type] += 1
        else:
            mix[evidence.source_type] = mix.get(evidence.source_type, 0) + 1
    return mix


def _split_sentences(text: str) -> List[str]:
    return [item.strip() for item in re.split(r"(?<=[.!?])\s+", text) if item.strip()]


def _to_evidence_snippet(evidence: EvidenceUnit, score: float) -> EvidenceSnippet:
    preview = (evidence.snippet_text or "")[:140]
    return EvidenceSnippet(
        evidence_unit_id=evidence.evidence_unit_id,
        score=float(score),
        source_type=evidence.source_type,
        source_id=evidence.source_id,
        field_name=evidence.field_name,
        snippet_preview=preview,
    )
