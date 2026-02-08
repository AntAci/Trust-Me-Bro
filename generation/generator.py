from __future__ import annotations

import json
import os
import re
import uuid
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional

import pandas as pd
from pydantic import BaseModel, Field, ValidationError
from sqlalchemy.orm import Session

from db.models import EvidenceUnit, KBDraft, LearningEvent
from generation.governance import supersede_other_drafts
from generation.templates import render_kb_draft


class Step(BaseModel):
    text: str
    evidence_unit_ids: List[str] = Field(default_factory=list)


class PlaceholderNeed(BaseModel):
    placeholder: str
    meaning: str
    evidence_unit_ids: List[str] = Field(default_factory=list)


class CaseJSON(BaseModel):
    ticket_id: str
    title: str
    product: str
    module: str
    category: str
    problem: str
    symptoms: List[str] = Field(default_factory=list)
    environment: Optional[str] = None
    root_cause: Optional[str] = None
    resolution_steps: List[Step] = Field(default_factory=list)
    verification_steps: List[Step] = Field(default_factory=list)
    when_to_escalate: List[str] = Field(default_factory=list)
    placeholders_needed: List[PlaceholderNeed] = Field(default_factory=list)
    evidence_sources: List[str] = Field(default_factory=list)
    generated_at: str


def build_case_bundle(ticket_id: str, session: Session) -> Dict[str, Any]:
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

    source_ids = [ticket_id]
    source_ids.extend([c.get("Conversation_ID") for c in conversations if c.get("Conversation_ID")])
    if script_id:
        source_ids.append(script_id)

    evidence_units = (
        session.query(EvidenceUnit)
        .filter(EvidenceUnit.source_id.in_(source_ids))
        .all()
    )
    placeholder_evidence = session.query(EvidenceUnit).filter(
        EvidenceUnit.source_type == "PLACEHOLDER"
    ).all()
    evidence_units.extend(placeholder_evidence)

    return {
        "ticket": ticket,
        "conversations": conversations,
        "scripts": scripts,
        "placeholders": placeholders,
        "evidence_units": evidence_units,
    }


def build_case_json_deterministic(bundle: Dict[str, Any]) -> CaseJSON:
    ticket = bundle["ticket"]
    conversations = bundle["conversations"]
    scripts = bundle["scripts"]
    placeholders = bundle["placeholders"]
    evidence_units = bundle["evidence_units"]

    ticket_id = str(ticket.get("Ticket_Number", "")).strip()
    title = str(ticket.get("Subject", "")).strip() or "Untitled"
    product = str(ticket.get("Product", "")).strip() or "N/A"
    module = str(ticket.get("Module", "")).strip() or "N/A"
    category = str(ticket.get("Category", "")).strip() or "N/A"

    evidence_by_field = _group_evidence_by_field(evidence_units)

    problem_text = _concat_snippets(evidence_by_field.get("Description", []))
    symptoms_texts = [
        _concat_snippets(evidence_by_field.get("Issue_Summary", []))
    ]
    symptoms = [s for s in symptoms_texts if s]
    root_cause = _concat_snippets(evidence_by_field.get("Root_Cause", [])) or None

    resolution_steps = _steps_from_evidence(evidence_by_field.get("Resolution", []))
    verification_steps = _filter_verification_steps(resolution_steps)

    placeholders_needed = _build_placeholders_needed(
        scripts, placeholders, evidence_units
    )

    problem_ids = [u.evidence_unit_id for u in evidence_by_field.get("Description", [])]
    symptom_ids = [u.evidence_unit_id for u in evidence_by_field.get("Issue_Summary", [])]
    root_cause_ids = [u.evidence_unit_id for u in evidence_by_field.get("Root_Cause", [])]
    evidence_sources = _build_evidence_sources(
        problem_ids,
        symptom_ids,
        root_cause_ids,
        resolution_steps,
        verification_steps,
        placeholders_needed,
    )

    return CaseJSON(
        ticket_id=ticket_id,
        title=title,
        product=product,
        module=module,
        category=category,
        problem=problem_text or "N/A",
        symptoms=symptoms,
        environment=None,
        root_cause=root_cause,
        resolution_steps=resolution_steps,
        verification_steps=verification_steps,
        when_to_escalate=[],
        placeholders_needed=placeholders_needed,
        evidence_sources=evidence_sources,
        generated_at=datetime.utcnow().isoformat(),
    )


def build_case_json_llm(bundle: Dict[str, Any], api_key: str | None = None) -> CaseJSON:
    if not api_key:
        return build_case_json_deterministic(bundle)
    try:
        from openai import OpenAI
    except Exception:
        return build_case_json_deterministic(bundle)

    evidence_units = bundle["evidence_units"]
    known_ids = {eu.evidence_unit_id for eu in evidence_units}
    evidence_list = [
        {
            "evidence_unit_id": eu.evidence_unit_id,
            "source_type": eu.source_type,
            "source_id": eu.source_id,
            "field_name": eu.field_name,
            "snippet_text": eu.snippet_text[:200],
        }
        for eu in evidence_units
    ]

    prompt = {
        "instruction": (
            "Generate JSON for CaseJSON. Use only evidence_unit_ids from the list. "
            "All Step items must include evidence_unit_ids. Output JSON only."
        ),
        "ticket": bundle["ticket"],
        "conversations": bundle["conversations"],
        "scripts": bundle["scripts"],
        "placeholders": bundle["placeholders"],
        "evidence_units": evidence_list,
    }

    client = OpenAI(api_key=api_key)
    response = client.chat.completions.create(
        model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
        temperature=0,
        response_format={"type": "json_object"},
        messages=[{"role": "system", "content": "Output JSON only."},
                  {"role": "user", "content": json.dumps(prompt)}],
    )
    content = response.choices[0].message.content or "{}"
    try:
        data = json.loads(content)
        case_json = CaseJSON.model_validate(data)
        if not _evidence_ids_subset(case_json, known_ids):
            return build_case_json_deterministic(bundle)
        if not case_json.evidence_sources:
            case_json.evidence_sources = _build_evidence_sources(
                [],
                [],
                [],
                case_json.resolution_steps,
                case_json.verification_steps,
                case_json.placeholders_needed,
            )
        return case_json
    except (json.JSONDecodeError, ValidationError):
        return build_case_json_deterministic(bundle)


def generate_kb_draft(
    ticket_id: str, session: Session, api_key: str | None = None
) -> tuple[KBDraft, CaseJSON]:
    bundle = build_case_bundle(ticket_id, session)
    case_json = build_case_json_llm(bundle, api_key=api_key)
    body_markdown = render_kb_draft(case_json)

    draft_id = str(uuid.uuid4())
    supersede_other_drafts(
        session,
        ticket_id=case_json.ticket_id,
        keep_draft_id=draft_id,
        reason="Superseded by newer draft generation.",
        reviewer=None,
        statuses={"draft", "approved"},
    )
    draft = KBDraft(
        draft_id=draft_id,
        ticket_id=case_json.ticket_id,
        title=case_json.title,
        body_markdown=body_markdown,
        case_json=case_json.model_dump_json(),
        status="draft",
    )
    session.add(draft)
    event = LearningEvent(
        event_id=str(uuid.uuid4()),
        event_type="draft_generated",
        draft_id=draft.draft_id,
        ticket_id=case_json.ticket_id,
        metadata_json=json.dumps({"source": "person2"}),
    )
    session.add(event)
    session.commit()
    return draft, case_json


def _group_evidence_by_field(evidence_units: Iterable[EvidenceUnit]) -> Dict[str, List[EvidenceUnit]]:
    grouped: Dict[str, List[EvidenceUnit]] = {}
    for unit in evidence_units:
        grouped.setdefault(unit.field_name, []).append(unit)
    for field_units in grouped.values():
        field_units.sort(key=lambda u: (u.source_id, u.char_offset_start))
    return grouped


def _concat_snippets(units: List[EvidenceUnit]) -> str:
    return " ".join([u.snippet_text.strip() for u in units if u.snippet_text.strip()]).strip()


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


def _build_placeholders_needed(
    scripts: List[Dict[str, Any]],
    placeholders: List[Dict[str, Any]],
    evidence_units: Iterable[EvidenceUnit],
) -> List[PlaceholderNeed]:
    placeholder_map = {
        str(p.get("Placeholder")): str(p.get("Meaning") or "")
        for p in placeholders
        if p.get("Placeholder")
    }
    placeholder_evidence = {
        eu.source_id: eu.evidence_unit_id
        for eu in evidence_units
        if eu.source_type == "PLACEHOLDER"
    }
    script_evidence = [
        eu for eu in evidence_units if eu.field_name == "Script_Text_Sanitized"
    ]

    found: Dict[str, PlaceholderNeed] = {}
    for script in scripts:
        text = str(script.get("Script_Text_Sanitized") or "")
        for token in set(re.findall(r"<[A-Z0-9_]+>", text)):
            meaning = placeholder_map.get(token, "")
            evidence_ids = []
            for eu in script_evidence:
                if token in eu.snippet_text:
                    evidence_ids.append(eu.evidence_unit_id)
            if token in placeholder_evidence:
                evidence_ids.append(placeholder_evidence[token])
            found[token] = PlaceholderNeed(
                placeholder=token, meaning=meaning, evidence_unit_ids=evidence_ids
            )
    return list(found.values())


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


def _evidence_ids_subset(case_json: CaseJSON, known_ids: set[str]) -> bool:
    for step in case_json.resolution_steps + case_json.verification_steps:
        for eid in step.evidence_unit_ids:
            if eid not in known_ids:
                return False
    for placeholder in case_json.placeholders_needed:
        for eid in placeholder.evidence_unit_ids:
            if eid not in known_ids:
                return False
    return True
