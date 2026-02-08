from __future__ import annotations

from typing import Dict, List, Tuple

from sqlalchemy.orm import Session

from db.models import EvidenceUnit
from generation.case_models import CaseJSON


def verify_case_json(
    case_json: CaseJSON, session: Session
) -> Tuple[bool, List[str], Dict[str, bool]]:
    errors: List[str] = []
    checks = {
        "all_ids_exist": True,
        "ids_deduped": True,
        "required_fields": True,
        "section_anchors": True,
    }

    if not case_json.ticket_id or not case_json.title or not case_json.problem:
        errors.append("Missing required fields: ticket_id, title, or problem.")
        checks["required_fields"] = False

    if case_json.resolution_steps is None:
        errors.append("resolution_steps must be present.")
        checks["required_fields"] = False

    for step in case_json.resolution_steps:
        if not step.text.strip():
            errors.append("resolution_steps contains empty step.text.")
            checks["required_fields"] = False
            break

    ids_by_section = _collect_section_ids(case_json)

    for section, ids in ids_by_section.items():
        if len(ids) != len(set(ids)):
            errors.append(f"Duplicate evidence_unit_ids in section: {section}")
            checks["ids_deduped"] = False

    if not _dedupe_across_sections(ids_by_section):
        errors.append("evidence_unit_ids are reused across sections.")
        checks["ids_deduped"] = False

    all_ids = [eid for ids in ids_by_section.values() for eid in ids]
    if all_ids:
        existing = (
            session.query(EvidenceUnit.evidence_unit_id)
            .filter(EvidenceUnit.evidence_unit_id.in_(list(set(all_ids))))
            .all()
        )
        existing_ids = {row[0] for row in existing}
        missing = sorted({eid for eid in all_ids if eid not in existing_ids})
        if missing:
            errors.append(f"Missing evidence_unit_ids: {', '.join(missing)}")
            checks["all_ids_exist"] = False

    if case_json.problem and not ids_by_section.get("problem"):
        errors.append("problem section must cite at least one evidence id.")
        checks["section_anchors"] = False
    if case_json.symptoms and not ids_by_section.get("symptoms"):
        errors.append("symptoms section must cite at least one evidence id.")
        checks["section_anchors"] = False
    if case_json.root_cause and not ids_by_section.get("root_cause"):
        errors.append("root_cause section must cite at least one evidence id.")
        checks["section_anchors"] = False
    if not ids_by_section.get("resolution_steps"):
        errors.append("resolution_steps must cite at least one evidence id overall.")
        checks["section_anchors"] = False

    ok = not errors
    return ok, errors, checks


def _collect_section_ids(case_json: CaseJSON) -> Dict[str, List[str]]:
    ids_by_section: Dict[str, List[str]] = {
        "problem": [],
        "symptoms": [],
        "root_cause": [],
        "resolution_steps": [],
        "verification_steps": [],
        "placeholders_needed": [],
    }

    sources = _parse_evidence_sources(case_json.evidence_sources or [])
    for section in ("problem", "symptoms", "root_cause"):
        ids_by_section[section] = sources.get(section, [])

    ids_by_section["resolution_steps"] = [
        eid
        for step in case_json.resolution_steps
        for eid in step.evidence_unit_ids
        if eid
    ]
    ids_by_section["verification_steps"] = [
        eid
        for step in case_json.verification_steps
        for eid in step.evidence_unit_ids
        if eid
    ]
    ids_by_section["placeholders_needed"] = [
        eid
        for placeholder in case_json.placeholders_needed
        for eid in placeholder.evidence_unit_ids
        if eid
    ]
    return ids_by_section


def _parse_evidence_sources(evidence_sources: List[str]) -> Dict[str, List[str]]:
    by_section: Dict[str, List[str]] = {}
    for entry in evidence_sources:
        if ":" not in entry:
            continue
        label, ids_blob = entry.split(":", 1)
        label = label.strip()
        ids = [eid.strip() for eid in ids_blob.split(",") if eid.strip()]
        by_section[label] = ids
    return by_section


def _dedupe_across_sections(ids_by_section: Dict[str, List[str]]) -> bool:
    seen: Dict[str, str] = {}
    allowed_overlap = {
        ("resolution_steps", "verification_steps"),
        ("verification_steps", "resolution_steps"),
    }
    for section, ids in ids_by_section.items():
        for eid in ids:
            if eid in seen:
                prev = seen[eid]
                if (prev, section) not in allowed_overlap:
                    return False
            else:
                seen[eid] = section
    return True
