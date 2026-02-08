from __future__ import annotations

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from db import init_db
from db.models import EvidenceUnit, KBDraft
from generation.generator import CaseJSON, Step
from generation.lineage import write_lineage_edges


def test_lineage_edges_written():
    engine = create_engine("sqlite:///:memory:")
    init_db(engine)
    session = sessionmaker(bind=engine)()

    unit = EvidenceUnit(
        evidence_unit_id="EU-TICKET-CS-1-Resolution-0",
        source_type="TICKET",
        source_id="CS-1",
        field_name="Resolution",
        char_offset_start=0,
        char_offset_end=10,
        chunk_index=0,
        snippet_text="Reset token",
    )
    session.add(unit)

    draft = KBDraft(
        draft_id="DRAFT-1",
        ticket_id="CS-1",
        title="Login fails",
        body_markdown="Body",
        case_json="{}",
        status="draft",
    )
    session.add(draft)
    session.commit()

    case_json = CaseJSON(
        ticket_id="CS-1",
        title="Login fails",
        product="ExampleCo",
        module="Auth",
        category="Login",
        problem="Login fails",
        symptoms=[],
        resolution_steps=[Step(text="Reset token", evidence_unit_ids=[unit.evidence_unit_id])],
        verification_steps=[],
        when_to_escalate=[],
        placeholders_needed=[],
        evidence_sources=[f"resolution_steps: {unit.evidence_unit_id}"],
        generated_at="2026-02-07T00:00:00Z",
    )

    edges = write_lineage_edges(draft, case_json, session)
    assert len(edges) == 1
    assert edges[0].relationship == "CREATED_FROM"
    assert edges[0].evidence_unit_id == unit.evidence_unit_id
