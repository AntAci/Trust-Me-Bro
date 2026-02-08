from __future__ import annotations

from datetime import datetime
from typing import List, Optional

from pydantic import BaseModel, Field


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
