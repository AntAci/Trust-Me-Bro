from __future__ import annotations

from datetime import datetime
import re
from typing import Any, Dict, List


def render_kb_draft(case_json: Any) -> str:
    data = _to_dict(case_json)
    title = data.get("title", "Untitled")
    ticket_id = data.get("ticket_id", "UNKNOWN")
    product = data.get("product", "N/A")
    module = data.get("module", "N/A")
    category = data.get("category", "N/A")
    problem = data.get("problem", "").strip()
    symptoms = data.get("symptoms", [])
    environment = data.get("environment") or "N/A"
    root_cause = data.get("root_cause") or "N/A"
    resolution_steps = data.get("resolution_steps", [])
    verification_steps = data.get("verification_steps", [])
    placeholders_needed = data.get("placeholders_needed", [])
    evidence_sources = data.get("evidence_sources", [])

    summary_lines = [problem] if problem else []
    summary_lines.extend(symptoms)
    summary_text = _format_paragraphs(summary_lines)

    resolution_text = _format_steps(resolution_steps)
    verification_text = _format_steps(verification_steps)
    placeholders_text = _format_placeholders(placeholders_needed)
    evidence_text = _format_bullets(evidence_sources)

    timestamp = data.get("generated_at") or datetime.utcnow().isoformat()
    # Note: Title is NOT included here - frontend displays it separately
    return (
        "## Summary\n"
        f"{summary_text}\n\n"
        "## Problem Statement\n"
        f"{problem or 'N/A'}\n\n"
        "## Environment\n"
        f"- **Product:** {product}\n"
        f"- **Module:** {module}\n"
        f"- **Category:** {category}\n\n"
        "## Root Cause\n"
        f"{root_cause}\n\n"
        "## Resolution Steps\n"
        f"{resolution_text}\n\n"
        "## Verification Steps\n"
        f"{verification_text}\n\n"
        "## Required Inputs\n"
        f"{placeholders_text}\n\n"
        "## Evidence Sources\n"
        f"{evidence_text}\n\n"
        "---\n"
        f"*Draft generated from Ticket {ticket_id} | {timestamp}*"
    )


def _to_dict(case_json: Any) -> Dict[str, Any]:
    if hasattr(case_json, "model_dump"):
        return case_json.model_dump()
    if isinstance(case_json, dict):
        return case_json
    raise TypeError("case_json must be a dict or a Pydantic model")


def _format_paragraphs(lines: List[str]) -> str:
    cleaned = [line.strip() for line in lines if line and line.strip()]
    if not cleaned:
        return "N/A"
    return "\n".join(cleaned)


def _format_steps(steps: List[Dict[str, Any]]) -> str:
    if not steps:
        return "N/A"
    lines = []
    leading_number_re = re.compile(r"^\s*(\d+[\.\)]\s+|[-•]\s+)")
    for idx, step in enumerate(steps, start=1):
        text = step.get("text", "").strip()
        if not text:
            continue
        text = leading_number_re.sub("", text).strip()
        if text:
            lines.append(f"{idx}. {text}")
    return "\n".join(lines) if lines else "N/A"


def _format_placeholders(placeholders: List[Dict[str, Any]]) -> str:
    if not placeholders:
        return "N/A"
    lines = []
    for item in placeholders:
        token = item.get("placeholder", "").strip()
        meaning = item.get("meaning", "").strip()
        if token and meaning:
            lines.append(f"- `{token}`: {meaning}")
        elif token:
            lines.append(f"- `{token}`")
    return "\n".join(lines) if lines else "N/A"


def _format_bullets(items: List[str]) -> str:
    if not items:
        return "N/A"
    return "\n".join([f"- {item}" for item in items])
