from __future__ import annotations

import json
import os
import re
import time
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple

import pandas as pd
from sqlalchemy import case, desc, func
from sqlalchemy.orm import Session

from db.models import EvidenceUnit
from generation.case_models import CaseJSON, PlaceholderNeed, Step
from generation.openai_client import OpenAIUnavailable, get_openai_client
from generation.rlm_verifier import verify_case_json

SECTION_RULES: Dict[str, Dict[str, List[str]]] = {
    "problem": {"source_types": ["TICKET"], "field_names": ["Description"]},
    "symptoms": {
        "source_types": ["CONVERSATION", "TICKET"],
        "field_names": ["Issue_Summary", "Description"],
    },
    "root_cause": {"source_types": ["TICKET"], "field_names": ["Root_Cause"]},
    "resolution_steps": {"source_types": ["TICKET"], "field_names": ["Resolution"]},
    "verification_steps": {"source_types": ["TICKET"], "field_names": ["Resolution"]},
    "placeholders_needed": {
        "source_types": ["SCRIPT", "PLACEHOLDER"],
        "field_names": ["Script_Text_Sanitized", "Meaning"],
    },
}


def build_case_json_rlm(
    session: Session, ticket_id: str, api_key: Optional[str] = None
) -> Tuple[CaseJSON, Dict[str, Any]]:
    started_at = datetime.utcnow().isoformat()
    ticket, conversations, scripts, placeholders = _load_ticket_context(
        session, ticket_id
    )
    ticket_meta = {
        "ticket_id": ticket_id,
        "title": str(ticket.get("Subject") or "").strip(),
        "module": str(ticket.get("Module") or "").strip(),
        "category": str(ticket.get("Category") or "").strip(),
    }
    source_ids = _collect_source_ids(ticket_id, conversations, scripts)
    placeholder_tokens = _collect_placeholder_tokens(placeholders)

    trace: Dict[str, Any] = {
        "generation_mode": "rlm",
        "started_at": started_at,
        "completed_at": None,
        "sections": {},
        "verifier": None,
    }

    openai_client = None
    try:
        openai_client = get_openai_client(api_key=api_key)
        if openai_client:
            trace["generation_mode"] = "rlm_openai"
    except OpenAIUnavailable:
        openai_client = None

    used_ids: set[str] = set()

    problem_text, problem_ids, problem_trace = _build_text_section(
        session,
        section_name="problem",
        source_ids=source_ids,
        ticket_meta=ticket_meta,
        used_ids=used_ids,
        openai_client=openai_client,
    )
    trace["sections"]["problem"] = problem_trace

    symptoms_text, symptoms_ids, symptoms_trace = _build_text_section(
        session,
        section_name="symptoms",
        source_ids=source_ids,
        ticket_meta=ticket_meta,
        used_ids=used_ids,
        openai_client=openai_client,
    )
    trace["sections"]["symptoms"] = symptoms_trace

    root_cause_text, root_cause_ids, root_cause_trace = _build_text_section(
        session,
        section_name="root_cause",
        source_ids=source_ids,
        ticket_meta=ticket_meta,
        used_ids=used_ids,
        openai_client=openai_client,
    )
    trace["sections"]["root_cause"] = root_cause_trace

    resolution_steps, resolution_ids, resolution_trace = _build_resolution_steps(
        session=session,
        source_ids=source_ids,
        ticket_meta=ticket_meta,
        used_ids=used_ids,
    )
    trace["sections"]["resolution_steps"] = resolution_trace

    verification_steps = _filter_verification_steps(resolution_steps)
    trace["sections"]["verification_steps"] = {
        "candidate_count": len(resolution_steps),
        "selected_evidence_unit_ids": _dedupe_ids(
            [eid for step in verification_steps for eid in step.evidence_unit_ids]
        ),
        "db_query_ms": 0,
        "openai_call": None,
        "verifier_status": "skipped",
    }

    placeholders_needed, placeholder_ids, placeholder_trace = _build_placeholders_needed(
        session=session,
        scripts=scripts,
        placeholders=placeholders,
        placeholder_tokens=placeholder_tokens,
        ticket_meta=ticket_meta,
        used_ids=used_ids,
    )
    trace["sections"]["placeholders_needed"] = placeholder_trace

    evidence_sources = _build_evidence_sources(
        problem_ids=problem_ids,
        symptom_ids=symptoms_ids,
        root_cause_ids=root_cause_ids,
        resolution_steps=resolution_steps,
        verification_steps=verification_steps,
        placeholders_needed=placeholders_needed,
    )

    case_json = CaseJSON(
        ticket_id=ticket_id,
        title=str(ticket.get("Subject") or "Untitled").strip() or "Untitled",
        product=str(ticket.get("Product") or "N/A").strip() or "N/A",
        module=str(ticket.get("Module") or "N/A").strip() or "N/A",
        category=str(ticket.get("Category") or "N/A").strip() or "N/A",
        problem=problem_text or "N/A",
        symptoms=[symptoms_text] if symptoms_text else [],
        environment=None,
        root_cause=root_cause_text or None,
        resolution_steps=resolution_steps,
        verification_steps=verification_steps,
        when_to_escalate=[],
        placeholders_needed=placeholders_needed,
        evidence_sources=evidence_sources,
        generated_at=datetime.utcnow().isoformat(),
    )

    ok, errors, checks = verify_case_json(case_json, session)
    trace["verifier"] = {"ok": ok, "errors": errors, "checks": checks}
    trace["completed_at"] = datetime.utcnow().isoformat()
    return case_json, trace


def _load_ticket_context(
    session: Session, ticket_id: str
) -> Tuple[Dict[str, Any], List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    engine = session.bind
    if engine is None:
        raise ValueError("Session is not bound to an engine")

    ticket_df = pd.read_sql_query(
        "SELECT * FROM raw_tickets WHERE Ticket_Number = :ticket_id",
        engine,
        params={"ticket_id": ticket_id},
    )
    if ticket_df.empty:
        raise ValueError(f"Ticket not found: {ticket_id}")
    ticket = ticket_df.iloc[0].to_dict()

    conversations = pd.read_sql_query(
        "SELECT * FROM raw_conversations WHERE Ticket_Number = :ticket_id",
        engine,
        params={"ticket_id": ticket_id},
    ).to_dict(orient="records")

    script_id = ticket.get("Script_ID")
    scripts = []
    if script_id:
        scripts = pd.read_sql_query(
            "SELECT * FROM raw_scripts_master WHERE Script_ID = :script_id",
            engine,
            params={"script_id": script_id},
        ).to_dict(orient="records")

    placeholders = pd.read_sql_query(
        "SELECT * FROM raw_placeholder_dictionary",
        engine,
    ).to_dict(orient="records")

    return ticket, conversations, scripts, placeholders


def _collect_source_ids(
    ticket_id: str,
    conversations: List[Dict[str, Any]],
    scripts: List[Dict[str, Any]],
) -> List[str]:
    source_ids = [ticket_id]
    for convo in conversations:
        convo_id = convo.get("Conversation_ID")
        if convo_id:
            source_ids.append(str(convo_id))
    for script in scripts:
        script_id = script.get("Script_ID")
        if script_id:
            source_ids.append(str(script_id))
    return source_ids


def _collect_placeholder_tokens(placeholders: List[Dict[str, Any]]) -> List[str]:
    tokens = []
    for placeholder in placeholders:
        token = placeholder.get("Placeholder")
        if token:
            tokens.append(str(token))
    return tokens


def _build_text_section(
    session: Session,
    section_name: str,
    source_ids: List[str],
    ticket_meta: Dict[str, Any],
    used_ids: set[str],
    openai_client: Any,
) -> Tuple[str, List[str], Dict[str, Any]]:
    start = time.perf_counter()
    candidates = _select_candidates_for_section(
        session=session,
        section_name=section_name,
        source_ids=source_ids,
        ticket_meta=ticket_meta,
    )
    query_ms = int((time.perf_counter() - start) * 1000)

    candidates = [c for c in candidates if c.evidence_unit_id not in used_ids]
    if not candidates:
        candidates = _fallback_ticket_candidates(
            session=session,
            section_name=section_name,
            source_ids=source_ids,
            ticket_meta=ticket_meta,
            exclude_ids=used_ids,
        )

    text = ""
    selected_ids: List[str] = []
    openai_call = None

    if openai_client and candidates:
        text, selected_ids, openai_call = _synthesize_section_openai(
            openai_client=openai_client,
            section_name=section_name,
            candidates=candidates,
        )

    if not text:
        text, selected_ids = _synthesize_section_deterministic(section_name, candidates)

    used_ids.update(selected_ids)
    trace = {
        "candidate_count": len(candidates),
        "selected_evidence_unit_ids": selected_ids,
        "db_query_ms": query_ms,
        "openai_call": openai_call,
        "verifier_status": "pending",
    }
    return text, selected_ids, trace


def _build_resolution_steps(
    session: Session,
    source_ids: List[str],
    ticket_meta: Dict[str, Any],
    used_ids: set[str],
) -> Tuple[List[Step], List[str], Dict[str, Any]]:
    start = time.perf_counter()
    candidates = _select_candidates_for_section(
        session=session,
        section_name="resolution_steps",
        source_ids=source_ids,
        ticket_meta=ticket_meta,
    )
    query_ms = int((time.perf_counter() - start) * 1000)

    candidates = [c for c in candidates if c.evidence_unit_id not in used_ids]
    if not candidates:
        candidates = _fallback_ticket_candidates(
            session=session,
            section_name="resolution_steps",
            source_ids=source_ids,
            ticket_meta=ticket_meta,
            exclude_ids=used_ids,
        )

    steps = _steps_from_evidence(candidates)
    selected_ids = _dedupe_ids([eid for step in steps for eid in step.evidence_unit_ids])
    used_ids.update(selected_ids)
    trace = {
        "candidate_count": len(candidates),
        "selected_evidence_unit_ids": selected_ids,
        "db_query_ms": query_ms,
        "openai_call": None,
        "verifier_status": "pending",
    }
    return steps, selected_ids, trace


def _build_placeholders_needed(
    session: Session,
    scripts: List[Dict[str, Any]],
    placeholders: List[Dict[str, Any]],
    placeholder_tokens: List[str],
    ticket_meta: Dict[str, Any],
    used_ids: set[str],
) -> Tuple[List[PlaceholderNeed], List[str], Dict[str, Any]]:
    start = time.perf_counter()
    script_ids = [str(script.get("Script_ID")) for script in scripts if script.get("Script_ID")]
    script_evidence_units: List[EvidenceUnit] = []
    if script_ids:
        script_evidence_units = (
            session.query(EvidenceUnit)
            .filter(
                EvidenceUnit.source_id.in_(script_ids),
                EvidenceUnit.source_type == "SCRIPT",
                EvidenceUnit.field_name == "Script_Text_Sanitized",
            )
            .all()
        )

    placeholder_evidence_units: Dict[str, EvidenceUnit] = {}
    if placeholder_tokens:
        placeholder_rows = (
            session.query(EvidenceUnit)
            .filter(
                EvidenceUnit.source_id.in_(placeholder_tokens),
                EvidenceUnit.source_type == "PLACEHOLDER",
            )
            .all()
        )
        placeholder_evidence_units = {row.source_id: row for row in placeholder_rows}

    query_ms = int((time.perf_counter() - start) * 1000)

    placeholder_map = {
        str(p.get("Placeholder")): str(p.get("Meaning") or "")
        for p in placeholders
        if p.get("Placeholder")
    }

    found: Dict[str, PlaceholderNeed] = {}
    for script in scripts:
        text = str(script.get("Script_Text_Sanitized") or "")
        for token in set(re.findall(r"<[A-Z0-9_]+>", text)):
            meaning = placeholder_map.get(token, "")
            evidence_ids: List[str] = []
            for eu in script_evidence_units:
                if token in eu.snippet_text and eu.evidence_unit_id not in used_ids:
                    evidence_ids.append(eu.evidence_unit_id)
            placeholder_eu = placeholder_evidence_units.get(token)
            if placeholder_eu and placeholder_eu.evidence_unit_id not in used_ids:
                evidence_ids.append(placeholder_eu.evidence_unit_id)
            evidence_ids = _dedupe_ids(evidence_ids)
            if evidence_ids:
                used_ids.update(evidence_ids)
            found[token] = PlaceholderNeed(
                placeholder=token, meaning=meaning, evidence_unit_ids=evidence_ids
            )

    selected_ids = _dedupe_ids(
        [eid for placeholder in found.values() for eid in placeholder.evidence_unit_ids]
    )
    trace = {
        "candidate_count": len(script_evidence_units) + len(placeholder_evidence_units),
        "selected_evidence_unit_ids": selected_ids,
        "db_query_ms": query_ms,
        "openai_call": None,
        "verifier_status": "pending",
    }
    return list(found.values()), selected_ids, trace


def _select_candidates_for_section(
    session: Session,
    section_name: str,
    source_ids: List[str],
    ticket_meta: Dict[str, Any],
    limit: int = 20,
) -> List[EvidenceUnit]:
    rules = SECTION_RULES.get(section_name)
    if not rules:
        return []

    query = session.query(EvidenceUnit).filter(
        EvidenceUnit.source_id.in_(source_ids),
        EvidenceUnit.source_type.in_(rules["source_types"]),
        EvidenceUnit.field_name.in_(rules["field_names"]),
    )

    keywords = _extract_keywords(ticket_meta)
    if keywords:
        score = None
        for keyword in keywords:
            term = case(
                (func.lower(EvidenceUnit.snippet_text).like(f"%{keyword}%"), 1),
                else_=0,
            )
            score = term if score is None else score + term
        query = query.order_by(desc(score))
    return query.order_by(EvidenceUnit.char_offset_start.asc()).limit(limit).all()


def _fallback_ticket_candidates(
    session: Session,
    section_name: str,
    source_ids: List[str],
    ticket_meta: Dict[str, Any],
    exclude_ids: set[str],
) -> List[EvidenceUnit]:
    if not source_ids:
        return []
    query = (
        session.query(EvidenceUnit)
        .filter(
            EvidenceUnit.source_id.in_(source_ids),
            EvidenceUnit.source_type == "TICKET",
        )
        .order_by(EvidenceUnit.char_offset_start.asc())
    )
    candidates = [row for row in query.limit(10).all() if row.evidence_unit_id not in exclude_ids]
    return candidates


def _synthesize_section_openai(
    openai_client: Any, section_name: str, candidates: List[EvidenceUnit]
) -> Tuple[str, List[str], Optional[Dict[str, Any]]]:
    evidence_list = [
        {
            "evidence_unit_id": eu.evidence_unit_id,
            "field_name": eu.field_name,
            "snippet_text": eu.snippet_text[:280],
        }
        for eu in candidates
    ]
    prompt = {
        "instruction": (
            "Use only evidence_unit_ids from the list. Output JSON only. "
            "Return a concise section text and the evidence_unit_ids used."
        ),
        "section": section_name,
        "evidence_units": evidence_list,
        "output_schema": {
            "text": "string",
            "evidence_unit_ids": ["string"],
        },
    }
    try:
        response = openai_client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            temperature=0,
            response_format={"type": "json_object"},
            messages=[
                {"role": "system", "content": "Output JSON only."},
                {"role": "user", "content": json.dumps(prompt)},
            ],
        )
        content = response.choices[0].message.content or "{}"
        data = json.loads(content)
        text = str(data.get("text") or "").strip()
        selected_ids = [str(eid) for eid in data.get("evidence_unit_ids", []) if eid]
        selected_ids = _dedupe_ids(
            [eid for eid in selected_ids if eid in {c.evidence_unit_id for c in candidates}]
        )
        usage = getattr(response, "usage", None)
        openai_call = {
            "model": os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            "tokens": getattr(usage, "total_tokens", None) if usage else None,
            "latency_ms": None,
        }
        if not text or not selected_ids:
            return "", [], openai_call
        return text, selected_ids, openai_call
    except Exception:
        return "", [], {"error": "openai_call_failed"}


def _synthesize_section_deterministic(
    section_name: str, candidates: List[EvidenceUnit]
) -> Tuple[str, List[str]]:
    snippets = [c.snippet_text.strip() for c in candidates if c.snippet_text.strip()]
    text = " ".join(snippets).strip()
    selected_ids = _dedupe_ids([c.evidence_unit_id for c in candidates])
    return text, selected_ids


def _steps_from_evidence(units: List[EvidenceUnit]) -> List[Step]:
    steps: List[Step] = []
    for unit in units:
        text = unit.snippet_text.strip()
        if not text:
            continue
        steps.append(Step(text=text, evidence_unit_ids=[unit.evidence_unit_id]))
    return steps


def _filter_verification_steps(steps: List[Step]) -> List[Step]:
    verification = []
    for step in steps:
        if re.match(r"^(verify|confirm|validate)\b", step.text.strip(), flags=re.I):
            verification.append(step)
    return verification


def _build_evidence_sources(
    problem_ids: List[str],
    symptom_ids: List[str],
    root_cause_ids: List[str],
    resolution_steps: List[Step],
    verification_steps: List[Step],
    placeholders_needed: List[PlaceholderNeed],
) -> List[str]:
    sources: List[str] = []
    problem_ids = _dedupe_ids(problem_ids)
    symptom_ids = _dedupe_ids(symptom_ids)
    root_cause_ids = _dedupe_ids(root_cause_ids)
    if problem_ids:
        sources.append(f"problem: {', '.join(problem_ids)}")
    if symptom_ids:
        sources.append(f"symptoms: {', '.join(symptom_ids)}")
    if root_cause_ids:
        sources.append(f"root_cause: {', '.join(root_cause_ids)}")
    if resolution_steps:
        ids = _dedupe_ids([eid for step in resolution_steps for eid in step.evidence_unit_ids])
        sources.append(f"resolution_steps: {', '.join(ids)}")
    if verification_steps:
        ids = _dedupe_ids([eid for step in verification_steps for eid in step.evidence_unit_ids])
        sources.append(f"verification_steps: {', '.join(ids)}")
    if placeholders_needed:
        ids = _dedupe_ids([eid for p in placeholders_needed for eid in p.evidence_unit_ids])
        sources.append(f"placeholders_needed: {', '.join(ids)}")
    return sources


def _dedupe_ids(ids: List[str]) -> List[str]:
    seen = set()
    deduped = []
    for eid in ids:
        if eid in seen:
            continue
        seen.add(eid)
        deduped.append(eid)
    return deduped


def _extract_keywords(ticket_meta: Dict[str, Any]) -> List[str]:
    keywords: List[str] = []
    for key in ("title", "module", "category"):
        value = ticket_meta.get(key)
        if value:
            keywords.extend(str(value).lower().split())
    return keywords[:3]
