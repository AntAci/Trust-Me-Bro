from __future__ import annotations

import json
import os
import re
import uuid
from datetime import datetime
from typing import Any, Dict, Iterable, List, Optional

import pandas as pd
from pydantic import ValidationError
from sqlalchemy.orm import Session

from db.models import EvidenceUnit, KBDraft, LearningEvent
from generation.case_models import CaseJSON, PlaceholderNeed, Step
from generation.governance import supersede_other_drafts
from generation.rlm import build_case_json_rlm
from generation.templates import render_kb_draft


def build_case_bundle(ticket_id: str, session: Session) -> Dict[str, Any]:
    engine = session.bind
    if engine is None:
        raise ValueError("Session is not bound to an engine")

    if engine.dialect.name == "sqlite":
        ticket_query = "SELECT * FROM tickets WHERE ticket_number = :ticket_id"
    else:
        ticket_query = "SELECT * FROM raw_tickets WHERE Ticket_Number = :ticket_id"

    ticket_df = pd.read_sql_query(
        ticket_query,
        engine,
        params={"ticket_id": ticket_id},
    )
    if ticket_df.empty:
        raise ValueError(f"Ticket not found: {ticket_id}")
    ticket = ticket_df.iloc[0].to_dict()

    if engine.dialect.name == "sqlite":
        convo_query = "SELECT * FROM conversations WHERE ticket_number = :ticket_id"
    else:
        convo_query = "SELECT * FROM raw_conversations WHERE Ticket_Number = :ticket_id"

    conversations = pd.read_sql_query(
        convo_query,
        engine,
        params={"ticket_id": ticket_id},
    ).to_dict(orient="records")

    script_id = ticket.get("Script_ID") if engine.dialect.name != "sqlite" else ticket.get("script_id")
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
    conversation_id_key = "Conversation_ID" if engine.dialect.name != "sqlite" else "conversation_id"
    source_ids.extend(
        [c.get(conversation_id_key) for c in conversations if c.get(conversation_id_key)]
    )
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

    ticket_id = str(ticket.get("Ticket_Number") or ticket.get("ticket_number") or "").strip()
    title = str(ticket.get("Subject") or ticket.get("subject") or "").strip() or "Untitled"
    product = str(ticket.get("Product") or ticket.get("product") or "").strip() or "N/A"
    module = str(ticket.get("Module") or ticket.get("module") or "").strip() or "N/A"
    category = str(ticket.get("Category") or ticket.get("category") or "").strip() or "N/A"

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


def _generate_quality_article(case_json: Any, api_key: str) -> Optional[str]:
    """
    Generate a high-quality KB article using a single comprehensive OpenAI call.
    This produces better content by:
    - Writing the entire article at once (no repetition)
    - Using professional technical writing style
    - Synthesizing evidence into coherent narrative
    """
    try:
        from openai import OpenAI
    except Exception:
        return None
    
    # Convert case_json to dict if needed
    if hasattr(case_json, "model_dump"):
        data = case_json.model_dump()
    else:
        data = case_json
    
    # Build context for the LLM
    title = data.get("title", "Untitled")
    product = data.get("product", "N/A")
    module = data.get("module", "N/A")
    category = data.get("category", "N/A")
    problem = data.get("problem", "")
    symptoms = data.get("symptoms", [])
    root_cause = data.get("root_cause", "")
    resolution_steps = data.get("resolution_steps", [])
    placeholders = data.get("placeholders_needed", [])
    evidence_sources = data.get("evidence_sources", [])
    
    # Format resolution steps
    steps_text = ""
    for i, step in enumerate(resolution_steps, 1):
        step_text = step.get("text", "") if isinstance(step, dict) else str(step)
        steps_text += f"{i}. {step_text}\n"
    
    # Format placeholders
    placeholders_text = ""
    for p in placeholders:
        token = p.get("placeholder", "") if isinstance(p, dict) else ""
        meaning = p.get("meaning", "") if isinstance(p, dict) else ""
        if token:
            placeholders_text += f"- {token}: {meaning}\n"
    
    prompt = f"""You are a technical writer creating a knowledge base article for a support team.

CONTEXT:
- Product: {product}
- Module: {module}  
- Category: {category}
- Issue: {title}

RAW INFORMATION FROM TICKET:
Problem: {problem}
Symptoms: {'; '.join(symptoms) if symptoms else 'Not specified'}
Root Cause: {root_cause or 'Not determined'}
Resolution Steps: 
{steps_text or 'Not specified'}

Required Placeholders:
{placeholders_text or 'None'}

INSTRUCTIONS:
Write a professional, concise knowledge base article. Follow these rules:
1. DO NOT repeat the same information in multiple sections
2. Be specific and actionable - avoid vague language like "doesn't look right"
3. If the source information is vague, say "Customer reported [issue type]" once and move on
4. Resolution steps should be numbered and clear
5. Keep it under 400 words total
6. Use markdown formatting

FORMAT:
## Summary
(2-3 sentences max - what is this article about)

## Problem
(What specific issue does this address)

## Environment
- Product: [product]
- Module: [module]

## Root Cause
(Brief explanation)

## Resolution
(Numbered steps)

## Verification
(How to confirm the fix worked)

## Evidence
(List the evidence source IDs)
{', '.join(evidence_sources) if evidence_sources else 'See ticket for details'}

Write the article now:"""

    try:
        client = OpenAI(api_key=api_key)
        response = client.chat.completions.create(
            model=os.getenv("OPENAI_MODEL", "gpt-4o-mini"),
            temperature=0.3,  # Slightly creative but consistent
            max_tokens=800,
            messages=[
                {"role": "system", "content": "You are a technical writer. Write concise, professional KB articles. Never repeat information."},
                {"role": "user", "content": prompt}
            ],
        )
        content = response.choices[0].message.content
        if content and len(content) > 100:
            # Add footer with timestamp
            timestamp = datetime.utcnow().isoformat()
            ticket_id = data.get("ticket_id", "UNKNOWN")
            content += f"\n\n---\n*Generated from Ticket {ticket_id} | {timestamp}*"
            return content
    except Exception as e:
        print(f"Quality generation failed: {e}")
    
    return None


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
    ticket_id: str,
    session: Session,
    api_key: str | None = None,
    generation_mode: str = "deterministic",
) -> tuple[KBDraft, CaseJSON]:
    rlm_trace_json = None
    generation_tag = "deterministic"
    
    if generation_mode == "rlm":
        case_json, rlm_trace = build_case_json_rlm(
            session, ticket_id, api_key=api_key
        )
        # Try high-quality generation if API key available
        if api_key:
            body_markdown = _generate_quality_article(case_json, api_key)
            if body_markdown:
                generation_tag = "rlm_quality"
            else:
                body_markdown = render_kb_draft(case_json)
                generation_tag = rlm_trace.get("generation_mode", "rlm")
        else:
            body_markdown = render_kb_draft(case_json)
            generation_tag = rlm_trace.get("generation_mode", "rlm")
        rlm_trace_json = json.dumps(rlm_trace)
    else:
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
        generation_mode=generation_tag,
        rlm_trace_json=rlm_trace_json,
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
