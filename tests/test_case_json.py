from __future__ import annotations

from generation.generator import CaseJSON, build_case_json_deterministic
from db.models import EvidenceUnit


def test_case_json_validation():
    ticket = {
        "Ticket_Number": "CS-1",
        "Subject": "Login fails",
        "Product": "ExampleCo",
        "Module": "Auth",
        "Category": "Login",
    }
    bundle = {
        "ticket": ticket,
        "conversations": [],
        "scripts": [],
        "placeholders": [],
        "evidence_units": [
            EvidenceUnit(
                evidence_unit_id="EU-TICKET-CS-1-Description-0",
                source_type="TICKET",
                source_id="CS-1",
                field_name="Description",
                char_offset_start=0,
                char_offset_end=20,
                chunk_index=0,
                snippet_text="User cannot login.",
            ),
            EvidenceUnit(
                evidence_unit_id="EU-TICKET-CS-1-Resolution-0",
                source_type="TICKET",
                source_id="CS-1",
                field_name="Resolution",
                char_offset_start=0,
                char_offset_end=20,
                chunk_index=0,
                snippet_text="Reset token",
            ),
        ],
    }

    case_json = build_case_json_deterministic(bundle)
    validated = CaseJSON.model_validate(case_json.model_dump())
    assert validated.ticket_id == "CS-1"
    assert validated.title
    assert validated.resolution_steps
    assert all(step.evidence_unit_ids for step in validated.resolution_steps)

