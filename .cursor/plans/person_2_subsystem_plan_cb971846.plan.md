---
name: Person 2 Subsystem Plan
overview: Implement Person 2 with fast ingestion (pandas), deterministic evidence chunking, structured CaseJSON fields, strict KB templating, and reproducible lineage from EvidenceUnits with stable IDs/offsets.
todos:
  - id: scaffolding
    content: "Create project scaffolding: directories, __init__.py files, requirements.txt"
    status: completed
  - id: db-models
    content: Implement db/models.py with EvidenceUnit, KBDraft, KBLineageEdge, LearningEvent + db/__init__.py helpers
    status: completed
  - id: workbook-loader
    content: "Implement ingestion/workbook_loader.py: pandas load_workbook_to_db + chunked extract_evidence_units"
    status: completed
  - id: templates
    content: "Implement generation/templates.py: KB_TEMPLATE + render_kb_draft() for structured CaseJSON"
    status: completed
  - id: generator
    content: "Implement generation/generator.py: structured CaseJSON schema, deterministic builder, LLM guardrails, generate_kb_draft"
    status: completed
  - id: lineage
    content: "Implement generation/lineage.py: write_lineage_edges + get_provenance_report"
    status: completed
  - id: demo-script
    content: "Implement scripts/demo.py: CLI-driven end-to-end run on one resolved ticket"
    status: completed
  - id: tests
    content: "Implement tests/: test_evidence.py, test_case_json.py, test_lineage.py (3 minimal tests)"
    status: completed
isProject: false
---

# Person 2 Subsystem: Evidence-First KB Draft Generation

## Change Review (Good/Bad)

1. Ingestion strategy: **GOOD**. Using `pandas.read_excel(...)` + `df.to_sql(if_exists="replace")` is faster to implement and handles schema drift without hand-maintained raw table definitions. We can preserve join-key safety by validating that required columns exist before proceeding and by failing fast if any are missing or renamed.
2. EvidenceUnit granularity: **GOOD**. Deterministic chunking yields clearer provenance for judges and avoids rework later when you need smaller evidence slices. The extra effort is limited to a few deterministic split functions with stable offsets, so the refactor risk is low.
3. CaseJSON schema shape: **GOOD**. Structured fields improve validation and template rendering, and map better to evidence-backed step lists. Keep a derived `sections[]` only for rendering convenience, not as the primary payload.
4. Placeholder handling: **GOOD**. Regex extraction of placeholders and joining to `Placeholder_Dictionary` adds high judge value with modest complexity, and the dataset already supports this. Store placeholder definitions as EvidenceUnits so all snippets are reproducible.
5. Optional LLM slot-filler guardrails: **GOOD**. Strict JSON-only output with evidence ID validation greatly reduces demo risk, and a deterministic fallback keeps robustness high. This aligns with the reproducibility constraint.
6. Acceptance criteria / demo focus: **GOOD**. Avoiding hardcoded row counts prevents brittleness, and showing multiple short evidence units directly demonstrates provenance quality.

---

## A) Architecture Summary

Person 2 is an **evidence-to-draft pipeline** that ingests Person-2 tabs into SQLite via pandas, deterministically chunks source text into small `EvidenceUnit` rows with stable IDs and offsets, then builds a structured `CaseJSON` for a resolved ticket with evidence-backed lists (problem, symptoms, resolution steps, verification, escalation, placeholders). A strict template renders the CaseJSON into a `KBDraft`, and lineage edges link each draft section back to the specific EvidenceUnits. An optional LLM can enrich the structured text only when it outputs JSON referencing known evidence IDs; otherwise the deterministic builder is used.

---

## B) Revised Step-by-Step Plan (6–10 steps)

### Step 1 -- Project scaffolding + dependencies

Create package structure and `requirements.txt`.

**Files to create:**

- `requirements.txt`
- `db/__init__.py`
- `ingestion/__init__.py`
- `generation/__init__.py`
- `tests/__init__.py`
- `scripts/__init__.py`

**Dependencies (minimum):**

- `pandas`, `sqlalchemy`, `pydantic`, `openpyxl`, `pytest`, `openai` (optional)

---

### Step 2 -- `db/models.py`: SQLAlchemy models + indexes

**File:** `[c:/Users/anton/Desktop/Trust-Me-Bro/db/models.py](c:/Users/anton/Desktop/Trust-Me-Bro/db/models.py)`

Define these ORM models only (no raw_* schemas in SQLAlchemy):

```python
class EvidenceUnit(Base):
    __tablename__ = "evidence_units"
    evidence_unit_id: Mapped[str]       # PK: EU-{src_type}-{src_id}-{field}-{offset_start}
    source_type: Mapped[str]            # TICKET | CONVERSATION | SCRIPT | PLACEHOLDER
    source_id: Mapped[str]              # Ticket_Number / Conversation_ID / Script_ID / Placeholder token
    field_name: Mapped[str]             # Description, Resolution, Transcript, Script_Text_Sanitized, Meaning, Example
    char_offset_start: Mapped[int]
    char_offset_end: Mapped[int]
    chunk_index: Mapped[int]            # deterministic order
    snippet_text: Mapped[str]
    created_at: Mapped[datetime]
```

```python
class KBDraft(Base):
    __tablename__ = "kb_drafts"
    draft_id: Mapped[str]
    ticket_id: Mapped[str]
    title: Mapped[str]
    body_markdown: Mapped[str]
    case_json: Mapped[str]
    status: Mapped[str]
    created_at: Mapped[datetime]
```

```python
class KBLineageEdge(Base):
    __tablename__ = "kb_lineage_edges"
    edge_id: Mapped[str]
    draft_id: Mapped[str]
    evidence_unit_id: Mapped[str]
    relationship: Mapped[str]           # CREATED_FROM | REFERENCES
    section_label: Mapped[str]
    created_at: Mapped[datetime]
```

```python
class LearningEvent(Base):
    __tablename__ = "learning_events"
    event_id: Mapped[str]
    event_type: Mapped[str]
    draft_id: Mapped[Optional[str]]
    ticket_id: Mapped[Optional[str]]
    metadata_json: Mapped[Optional[str]]
    created_at: Mapped[datetime]
```

`**db/__init__.py**` exports:

- `get_engine(db_path)` -> SQLite engine
- `init_db(engine)` -> `Base.metadata.create_all`
- `get_session(engine)` -> session factory

---

### Step 3 -- `ingestion/workbook_loader.py`: pandas load + deterministic chunking

**File:** `[c:/Users/anton/Desktop/Trust-Me-Bro/ingestion/workbook_loader.py](c:/Users/anton/Desktop/Trust-Me-Bro/ingestion/workbook_loader.py)`

**Functions:**

```python
def load_workbook_to_db(workbook_path: str, engine) -> dict[str, int]:
    """Use pandas.read_excel to load Tickets, Conversations, Scripts_Master,
    Placeholder_Dictionary into SQLite via df.to_sql(if_exists='replace')."""
```

- Uses `pandas.read_excel(sheet_name=...)`
- Writes `raw_tickets`, `raw_conversations`, `raw_scripts_master`, `raw_placeholder_dictionary`
- Validates join-key columns exist: `Ticket_Number`, `Conversation_ID`, `Script_ID`, `KB_Article_ID`
- Returns discovered counts; prints in demo (no hardcoding)

```python
def extract_evidence_units(engine) -> int:
    """Deterministically chunk fields into EvidenceUnit rows with offsets."""
```

Deterministic chunking rules:

- Tickets: `Subject`, `Description`, `Root_Cause` -> split by blank lines, then sentence-ish split on `. ? !` with min-length guard
- Tickets: `Resolution` -> split by newline; further split on bullets/numbering
- Conversations: `Transcript` -> split by newline (turns), preserve offsets
- Conversations: `Issue_Summary` -> sentence-ish split
- Scripts_Master: `Script_Text_Sanitized` -> split by blank lines and `--` section markers
- Scripts_Master: `Script_Purpose` -> sentence-ish split
- Placeholder_Dictionary: store `Meaning` and `Example` as evidence units (source_type=PLACEHOLDER)

IDs and offsets:

- `evidence_unit_id = f"EU-{source_type}-{source_id}-{field_name}-{offset_start}"`
- `chunk_index` increments per field
- `char_offset_start/end` refer to offsets within the original field

---

### Step 4 -- `generation/generator.py`: Structured CaseJSON + LLM guardrails

**File:** `[c:/Users/anton/Desktop/Trust-Me-Bro/generation/generator.py](c:/Users/anton/Desktop/Trust-Me-Bro/generation/generator.py)`

**Primary CaseJSON schema (Pydantic):**

- `problem: str`
- `symptoms: list[str]`
- `environment: Optional[str]`
- `root_cause: Optional[str]`
- `resolution_steps: list[Step]` (each step has `text`, `evidence_unit_ids`)
- `verification_steps: list[Step]`
- `when_to_escalate: list[str]` (with evidence ids if present, else empty)
- `placeholders_needed: list[PlaceholderNeed]` (placeholder token + meaning + evidence_unit_ids)
- `ticket_id`, `title`, `product`, `module`, `category`, `generated_at`

**Builder functions:**

- `build_case_bundle(ticket_id, session)` queries raw tables + evidence units via SQL (pandas read_sql or SQLAlchemy text)
- `build_case_json_deterministic(bundle)` constructs structured fields from evidence:
  - problem/symptoms from ticket description + conversation issue summary
  - root_cause from `Root_Cause` chunks
  - resolution_steps from ticket resolution chunks
  - verification_steps from resolution chunks that start with “verify/confirm”
  - placeholders_needed from script evidence + placeholder dictionary
- `build_case_json_llm(bundle, api_key=None)` is optional:
  - temp=0, JSON-only output
  - must reference only provided `evidence_unit_ids`
  - validate: `ids ⊆ known_ids`, else fallback to deterministic

---

### Step 5 -- `generation/templates.py`: Template over structured CaseJSON

**File:** `[c:/Users/anton/Desktop/Trust-Me-Bro/generation/templates.py](c:/Users/anton/Desktop/Trust-Me-Bro/generation/templates.py)`

Define a strict KB markdown template that renders:

- Summary (from problem + symptoms)
- Environment
- Root Cause (if present)
- Resolution Steps (numbered list)
- Verification Steps (numbered list)
- Required Inputs (placeholders section)
- Evidence Sources (list of evidence_unit_ids grouped by section)

---

### Step 6 -- `generation/lineage.py`: Lineage edges from evidence units

**File:** `[c:/Users/anton/Desktop/Trust-Me-Bro/generation/lineage.py](c:/Users/anton/Desktop/Trust-Me-Bro/generation/lineage.py)`

`write_lineage_edges(draft, case_json, session)`:

- For each structured field and each step, link every `evidence_unit_id`
- `relationship = CREATED_FROM` for ticket/conversation, `REFERENCES` for script/placeholder
- `edge_id = EDGE-{draft_id}-{evidence_unit_id}-{section_label}`

`get_provenance_report(draft_id, session)` returns concise evidence references with snippet previews.

---

### Step 7 -- `scripts/demo.py`: End-to-end demo

**File:** `[c:/Users/anton/Desktop/Trust-Me-Bro/scripts/demo.py](c:/Users/anton/Desktop/Trust-Me-Bro/scripts/demo.py)`

Workflow:

1. CLI args: `--workbook`, `--ticket`, `--db`, `--openai-key` (optional)
2. Load tabs via pandas + counts printed
3. Extract chunked evidence units
4. Build deterministic CaseJSON (or LLM if key provided)
5. Render KB draft + write lineage
6. Print KB draft, structured CaseJSON, and provenance with multiple short evidence units

---

### Step 8 -- `tests/`: Three minimal tests (updated for chunking)

**Files:**

- `[c:/Users/anton/Desktop/Trust-Me-Bro/tests/test_evidence.py](c:/Users/anton/Desktop/Trust-Me-Bro/tests/test_evidence.py)`
- `[c:/Users/anton/Desktop/Trust-Me-Bro/tests/test_case_json.py](c:/Users/anton/Desktop/Trust-Me-Bro/tests/test_case_json.py)`
- `[c:/Users/anton/Desktop/Trust-Me-Bro/tests/test_lineage.py](c:/Users/anton/Desktop/Trust-Me-Bro/tests/test_lineage.py)`

Coverage:

- Evidence chunking produces multiple units with correct offsets and deterministic IDs
- CaseJSON validates and contains evidence IDs per step
- Lineage edges reference only known evidence units

---

## B) Build Batch A / Build Batch B

**Build Batch A (core data + evidence):**

- `requirements.txt`, `db/__init__.py`, `db/models.py`
- `ingestion/workbook_loader.py` (pandas ingestion + chunking)

**Build Batch B (generation + demo + tests):**

- `generation/generator.py`, `generation/templates.py`, `generation/lineage.py`
- `scripts/demo.py`
- `tests/` files

---

## C) Minimal Dependencies (include pandas)

```
sqlalchemy>=2.0,<3
pandas>=2.0,<3
openpyxl>=3.1,<4
pydantic>=2.0,<3
pytest>=8.0,<9
openai>=1.0,<2
```

`openai` is optional and only used when `--openai-key` is provided.

---

## D) Acceptance Checklist for "Person 2 Done"

- Demo runs end-to-end and prints discovered row counts (no hardcoded totals)
- Evidence units are chunked (multiple short units) for ticket description/resolution/transcript
- Every KB draft section lists evidence_unit_ids that exist in `evidence_units`
- `kb_lineage_edges` contains one edge per evidence unit used, with correct relationship
- Placeholder extraction produces a “Required Inputs” section with dictionary definitions
- LLM enrichment only proceeds when output IDs ⊆ known evidence IDs; otherwise deterministic fallback is used
- No retrieval/embeddings/vector DB/gap detection/reranking/scoring code exists

