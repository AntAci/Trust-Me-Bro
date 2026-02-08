from __future__ import annotations

from typing import Any, Dict, Iterable, List

from sqlalchemy.orm import Session

from db.models import EvidenceUnit, KBLineageEdge, KBDraft


def write_lineage_edges(
    draft: KBDraft, case_json: Any, session: Session
) -> List[KBLineageEdge]:
    data = _to_dict(case_json)
    evidence_by_section = _collect_evidence_by_section(data)
    all_ids = {eid for ids in evidence_by_section.values() for eid in ids}
    if not all_ids:
        return []

    units = (
        session.query(EvidenceUnit)
        .filter(EvidenceUnit.evidence_unit_id.in_(list(all_ids)))
        .all()
    )
    unit_map = {u.evidence_unit_id: u for u in units}

    edges: List[KBLineageEdge] = []
    for section_label, evidence_ids in evidence_by_section.items():
        seen_ids = set()
        for evidence_unit_id in evidence_ids:
            if evidence_unit_id in seen_ids:
                continue
            seen_ids.add(evidence_unit_id)
            unit = unit_map.get(evidence_unit_id)
            if not unit:
                continue
            relationship = "REFERENCES" if unit.source_type in {"SCRIPT", "PLACEHOLDER"} else "CREATED_FROM"
            edge_id = f"EDGE-{draft.draft_id}-{evidence_unit_id}-{section_label}"
            edge = KBLineageEdge(
                edge_id=edge_id,
                draft_id=draft.draft_id,
                evidence_unit_id=evidence_unit_id,
                relationship=relationship,
                section_label=section_label,
            )
            edges.append(edge)
            session.add(edge)
    session.commit()
    return edges


def get_provenance_report(draft_id: str, session: Session) -> Dict[str, Any]:
    edges = (
        session.query(KBLineageEdge)
        .filter(KBLineageEdge.draft_id == draft_id)
        .all()
    )
    evidence_ids = [e.evidence_unit_id for e in edges]
    units = (
        session.query(EvidenceUnit)
        .filter(EvidenceUnit.evidence_unit_id.in_(evidence_ids))
        .all()
    )
    unit_map = {u.evidence_unit_id: u for u in units}
    return {
        "draft_id": draft_id,
        "edges": [
            {
                "edge_id": e.edge_id,
                "evidence_unit_id": e.evidence_unit_id,
                "snippet_preview": unit_map.get(e.evidence_unit_id).snippet_text[:160]
                if unit_map.get(e.evidence_unit_id)
                else "",
                "source_type": unit_map.get(e.evidence_unit_id).source_type
                if unit_map.get(e.evidence_unit_id)
                else "",
                "source_id": unit_map.get(e.evidence_unit_id).source_id
                if unit_map.get(e.evidence_unit_id)
                else "",
                "relationship": e.relationship,
                "section": e.section_label,
            }
            for e in edges
        ],
    }


def _collect_evidence_by_section(data: Dict[str, Any]) -> Dict[str, List[str]]:
    section_map: Dict[str, List[str]] = {}

    for step in data.get("resolution_steps", []):
        section_map.setdefault("resolution_steps", []).extend(
            step.get("evidence_unit_ids", [])
        )
    for step in data.get("verification_steps", []):
        section_map.setdefault("verification_steps", []).extend(
            step.get("evidence_unit_ids", [])
        )
    for placeholder in data.get("placeholders_needed", []):
        section_map.setdefault("placeholders_needed", []).extend(
            placeholder.get("evidence_unit_ids", [])
        )
    for entry in data.get("evidence_sources", []):
        if ":" not in entry:
            continue
        label, ids = entry.split(":", 1)
        parsed_ids = [e.strip() for e in ids.split(",") if e.strip()]
        if parsed_ids:
            section_map.setdefault(label.strip(), []).extend(parsed_ids)
    # Deduplicate while preserving order per section
    for label, ids in section_map.items():
        seen = set()
        deduped = []
        for eid in ids:
            if eid in seen:
                continue
            seen.add(eid)
            deduped.append(eid)
        section_map[label] = deduped
    return section_map


def _to_dict(case_json: Any) -> Dict[str, Any]:
    if hasattr(case_json, "model_dump"):
        return case_json.model_dump()
    if isinstance(case_json, dict):
        return case_json
    raise TypeError("case_json must be a dict or a Pydantic model")
