from __future__ import annotations

import json
import os
import re
import time
import uuid
from datetime import datetime
from typing import Any, Dict, List, Optional

from generation.openai_client import OpenAIUnavailable, get_openai_client


def generate_synthetic_scenario(
    api_key: str,
    mode: str = "new",
    existing_kb_context: Optional[str] = None,
    category_hint: Optional[str] = None,
    max_retries: int = 1,
) -> Dict[str, Any]:
    client = get_openai_client(api_key=api_key)
    model = os.getenv("OPENAI_MODEL", "gpt-4o-mini")
    unique_seed = str(uuid.uuid4())

    system_prompt = (
        "You generate realistic, resolved support ticket scenarios for RealPage-style "
        "property management software. Output must be valid JSON only. "
        "Domain areas: Payments, Leasing, Maintenance, Resident Portal, Reporting, Integrations."
    )

    base_requirements = [
        "Output JSON with keys: ticket, transcript, draft, evidenceUnits, evidenceSummary.",
        "ticket.ticket_number format: CS-{8 digits}.",
        "transcript: 6-10 messages alternating customer/agent/system.",
        "The conversation MUST start with the company/agent greeting first.",
        "First transcript message should be an agent welcome like: 'Thanks for contacting support...'",
        "draft.body_markdown: Problem, Symptoms, Root Cause, Resolution Steps, Placeholders Needed.",
        "evidenceUnits: 6-10 items linked to transcript (evidenceUnitId).",
        "evidenceUnits MUST include section_label and source_type.",
        "evidenceSummary must match evidenceUnits counts.",
        f"Unique seed: {unique_seed}.",
    ]

    if mode == "v2_update":
        user_prompt = (
            "Generate a NEW resolved ticket that adds an edge case or new fix to an existing KB.\n"
            "Existing KB context:\n"
            f"{existing_kb_context or '[missing KB context]'}\n\n"
            + "\n".join(base_requirements)
        )
    else:
        user_prompt = (
            "Generate a NEW resolved support ticket.\n"
            f"Category hint: {category_hint or 'any'}\n\n"
            + "\n".join(base_requirements)
        )

    last_error: Optional[Exception] = None
    for attempt in range(max_retries + 1):
        try:
            response = client.chat.completions.create(
                model=model,
                temperature=0.9,
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": user_prompt},
                ],
            )
            content = response.choices[0].message.content or ""
            payload = _extract_json(content)
            scenario = _normalize_scenario(payload)
            _validate_scenario(scenario)
            return scenario
        except Exception as exc:
            last_error = exc
            if attempt < max_retries:
                user_prompt = (
                    "Return ONLY JSON. Do not include markdown or commentary.\n"
                    + user_prompt
                )
            else:
                break

    raise RuntimeError(f"Failed to generate scenario: {last_error}")


def _extract_json(content: str) -> Dict[str, Any]:
    content = content.strip()
    if content.startswith("```"):
        content = re.sub(r"^```[a-zA-Z]*", "", content).strip()
        content = re.sub(r"```$", "", content).strip()
    start = content.find("{")
    end = content.rfind("}")
    if start == -1 or end == -1:
        raise ValueError("No JSON object found in response.")
    return json.loads(content[start : end + 1])


def _normalize_scenario(payload: Dict[str, Any]) -> Dict[str, Any]:
    now = datetime.utcnow().isoformat()
    ticket = payload.get("ticket") or {}
    if not isinstance(ticket, dict):
        ticket = {}
    transcript = payload.get("transcript") or []
    if not isinstance(transcript, list):
        transcript = []
    draft = payload.get("draft") or {}
    if not isinstance(draft, dict):
        draft = {}
    evidence_units = payload.get("evidenceUnits") or []
    if not isinstance(evidence_units, list):
        evidence_units = []
    evidence_summary = payload.get("evidenceSummary") or {}
    if not isinstance(evidence_summary, dict):
        evidence_summary = {}

    ticket_number = ticket.get("ticket_number") or _generate_ticket_number()
    if not _valid_ticket_number(ticket_number):
        ticket_number = _generate_ticket_number()

    ticket = {
        "ticket_id": ticket.get("ticket_id") or ticket_number,
        "ticket_number": ticket_number,
        "subject": str(ticket.get("subject") or "Support request"),
        "status": ticket.get("status") or "Resolved",
        "category": ticket.get("category") or "General",
        "module": ticket.get("module") or "Platform",
    }

    normalized_transcript = []
    for idx, message in enumerate(transcript):
        if isinstance(message, str):
            message = {"text": message}
        if not isinstance(message, dict):
            continue
        role = str(message.get("role") or "").lower()
        if role not in {"agent", "customer", "system"}:
            role = "agent" if idx % 2 == 0 else "customer"
        speaker = str(message.get("speaker") or "").strip()
        if not speaker:
            speaker = "Agent" if role == "agent" else "Caller" if role == "customer" else "System"
        text = str(
            message.get("text")
            or message.get("content")
            or message.get("message")
            or ""
        ).strip()
        normalized_transcript.append(
            {
                "id": message.get("id") or f"msg-{idx + 1}",
                "role": role,
                "speaker": speaker,
                "text": text,
                "timestamp": message.get("timestamp") or f"{9 + idx // 2}:{10 + idx * 2:02d}",
                "evidenceUnitId": message.get("evidenceUnitId"),
                "sourceType": message.get("sourceType"),
                "sourceId": message.get("sourceId"),
                "fieldName": message.get("fieldName"),
            }
        )

    if normalized_transcript:
        first = normalized_transcript[0]
        if first.get("role") != "agent":
            normalized_transcript.insert(
                0,
                {
                    "id": "msg-0",
                    "role": "agent",
                    "speaker": "Agent",
                    "text": "Thanks for contacting support. I can help with this.",
                    "timestamp": "09:00",
                },
            )
        elif not str(first.get("text") or "").strip():
            first["text"] = "Thanks for contacting support. I can help with this."

    normalized_evidence_units = []
    for idx, unit in enumerate(evidence_units):
        if not isinstance(unit, dict):
            continue
        normalized_evidence_units.append(
            {
                "evidence_unit_id": unit.get("evidence_unit_id") or f"eu-{idx + 1}",
                "source_type": unit.get("source_type") or "TICKET",
                "source_id": unit.get("source_id") or ticket_number,
                "field_name": unit.get("field_name") or "description",
                "snippet_text": unit.get("snippet_text") or "",
                "section_label": unit.get("section_label") or _infer_section(unit.get("field_name")),
            }
        )

    summary = _compute_summary(normalized_evidence_units)
    if evidence_summary and isinstance(evidence_summary, dict):
        summary = {
            "total": evidence_summary.get("total") or summary["total"],
            "bySection": evidence_summary.get("bySection") or summary["bySection"],
            "bySourceType": evidence_summary.get("bySourceType") or summary["bySourceType"],
        }

    draft_body = _format_draft_body(draft.get("body_markdown") or draft.get("body") or draft)
    draft = {
        "draft_id": draft.get("draft_id") or str(uuid.uuid4()),
        "ticket_id": ticket["ticket_id"],
        "title": draft.get("title") or ticket["subject"],
        "body_markdown": draft_body,
        "status": draft.get("status") or "pending",
        "created_at": draft.get("created_at") or now,
    }

    return {
        "ticket": ticket,
        "transcript": normalized_transcript,
        "draft": draft,
        "evidenceUnits": normalized_evidence_units,
        "evidenceSummary": summary,
        "kbArticleId": payload.get("kbArticleId") or "",
        "versions": payload.get("versions") or [],
    }


def _validate_scenario(scenario: Dict[str, Any]) -> None:
    for key in ["ticket", "transcript", "draft", "evidenceUnits", "evidenceSummary"]:
        if key not in scenario:
            raise ValueError(f"Missing key: {key}")

    transcript = scenario["transcript"]
    if len(transcript) < 6:
        raise ValueError("Transcript too short")

    evidence_units = scenario["evidenceUnits"]
    evidence_ids = {unit["evidence_unit_id"] for unit in evidence_units}
    for message in transcript:
        if message.get("evidenceUnitId") and message["evidenceUnitId"] not in evidence_ids:
            raise ValueError("Transcript evidenceUnitId not found in evidenceUnits")

    summary = _compute_summary(evidence_units)
    expected = scenario["evidenceSummary"]
    if summary["total"] != expected.get("total"):
        raise ValueError("Evidence summary total mismatch")


def _compute_summary(evidence_units: List[Dict[str, Any]]) -> Dict[str, Any]:
    by_section: Dict[str, int] = {}
    by_source: Dict[str, int] = {}
    for unit in evidence_units:
        section = unit.get("section_label") or "problem"
        source = unit.get("source_type") or "TICKET"
        by_section[section] = by_section.get(section, 0) + 1
        by_source[source] = by_source.get(source, 0) + 1
    total = sum(by_source.values())
    return {"total": total, "bySection": by_section, "bySourceType": by_source}


def _infer_section(field_name: Optional[str]) -> str:
    if not field_name:
        return "problem"
    name = field_name.lower()
    if "root" in name:
        return "root_cause"
    if "resolution" in name or "step" in name:
        return "resolution_steps"
    if "placeholder" in name:
        return "placeholders_needed"
    if "symptom" in name:
        return "symptoms"
    return "problem"


def _format_draft_body(value: Any) -> str:
    if isinstance(value, str):
        trimmed = value.strip()
        if trimmed.startswith("{") and trimmed.endswith("}"):
            try:
                parsed = json.loads(trimmed)
                if isinstance(parsed, dict):
                    return _draft_dict_to_markdown(parsed)
            except Exception:
                return value
        return value
    if isinstance(value, dict):
        return _draft_dict_to_markdown(value)
    return ""


def _draft_dict_to_markdown(data: Dict[str, Any]) -> str:
    sections = [
        "Summary",
        "Problem",
        "Symptoms",
        "Environment",
        "Root Cause",
        "Resolution Steps",
        "Verification Steps",
        "Required Inputs",
        "Placeholders Needed",
        "Evidence Sources",
    ]
    lines = []
    for key in sections:
        if key not in data:
            continue
        value = data.get(key)
        if value in (None, ""):
            continue
        lines.append(f"## {key}")
        if isinstance(value, list):
            for item in value:
                if item:
                    lines.append(f"- {item}")
        elif isinstance(value, dict):
            for sub_key, sub_value in value.items():
                lines.append(f"- {sub_key}: {sub_value}")
        else:
            lines.append(str(value))
        lines.append("")
    if not lines:
        return ""
    return "\n".join(lines).strip() + "\n"


def _generate_ticket_number() -> str:
    seed = int(time.time() * 1000) % 100000000
    return f"CS-{seed:08d}"


def _valid_ticket_number(value: str) -> bool:
    return bool(re.match(r"^CS-\\d{8}$", value))
