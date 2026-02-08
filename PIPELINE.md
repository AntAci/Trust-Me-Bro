# Trust-Me-Bro Pipeline (End-to-End)

This document explains the full pipeline, the algorithms used, and what each file/module is responsible for. It reflects the **final demo-ready** state we implemented for the RealPage track feature:

> **Self-Updating Knowledge Engine** — automatically generate and update knowledge articles from resolved cases and transcripts, with **versioning** and **traceability**.

---

## 1) What the system does (demo story)

### SQLite demo path (no cloud required)

1. Load the Excel workbook into SQLite `raw_*` tables
2. Extract **EvidenceUnits** (chunked snippets) from tickets, conversations, scripts, placeholders
3. Build a **CaseJSON** bundle for a ticket (deterministic; optionally LLM-enhanced)
4. Render a KB draft markdown article from CaseJSON
5. Write **lineage edges** (provenance) linking article sections → evidence units
6. Human governance step: approve/reject
7. Publish the article:
   - Create/Update `published_kb_articles`
   - Append a row to `kb_article_versions` (append-only audit trail)
8. Repeat publish on the same `kb_article_id` to produce **v2+** (self-updating via versioning)

### Optional Postgres path (Neon) for “production-like” demos

Same concept, but the workbook is loaded to Postgres and a minimal orchestrator runs:

- gap detection → draft → approve/publish → reindex

This requires `DATABASE_URL` in `.env`.

---

## 2) High-level architecture

```text
Excel Workbook
  ├─ Tickets, Conversations, Scripts_Master, Placeholder_Dictionary
  └─ (Optional) Existing_Knowledge_Articles for retrieval demos

SQLite demo pipeline:
  workbook_loader.py → raw_* tables
  workbook_loader.py → evidence_units
  generator.py       → kb_drafts + CaseJSON + body_markdown
  lineage.py         → kb_lineage_edges (section → evidence_unit_id)
  governance.py      → approve/reject (status transitions)
  publish.py         → published_kb_articles + kb_article_versions

Postgres pipeline (optional):
  ingest/load_excel_to_neon.py → Postgres tables + evidence_units
  retrieval/index.py           → BM25 seed/full index
  gap/detect_gap.py            → gap_detected event
  scripts/run_pipeline.py      → glue/orchestration
```

---

## 3) Algorithms used

### A) Evidence extraction (traceability substrate)

**Goal:** Create stable, explainable, linkable snippets so every KB sentence/step can point back to source evidence.

**Where:** `ingestion/workbook_loader.py`

**Key idea:** Convert long fields into smaller chunks:

- Ticket `Subject/Description/Root_Cause`: paragraph → sentence-ish chunks
- Ticket `Resolution`: split numbered/bulleted steps (preserves “steps” semantics)
- Conversation `Transcript`: split by lines
- Script `Script_Text_Sanitized`: split by paragraphs/lines
- Placeholders: keep meaning/example as single chunks

Each chunk becomes an `EvidenceUnit`:

- `evidence_unit_id` is deterministic (includes source_type/source_id/field/offset)
- stored with `source_type`, `source_id`, `field_name`, `char_offset_*`, `snippet_text`

This makes provenance **auditable** and **inspectable**.

---

### B) Draft generation (deterministic CaseJSON + template rendering)

**Goal:** Produce a KB draft article from the ticket + transcript + scripts + placeholder dictionary, while preserving evidence IDs.

**Where:** `generation/generator.py`, `generation/templates.py`

**CaseJSON**

- A structured object capturing:
  - problem statement
  - symptoms
  - root cause
  - resolution steps
  - verification steps
  - required inputs (placeholders)
  - evidence_sources (lists of evidence_unit_ids)

**Deterministic path**

- `build_case_json_deterministic(bundle)` groups evidence units by field and assembles CaseJSON.

**Optional LLM path**

- `build_case_json_llm(bundle, api_key=...)`
- If OpenAI is configured, attempts JSON-only output; falls back to deterministic if invalid.
- Enforces “evidence_unit_ids must come from known IDs” for safety.

**Rendering**

- `render_kb_draft(case_json)` produces a clean markdown KB article.

---

### C) Governance (human gate)

**Goal:** Drafts are never “trusted” until approved.

**Where:** `generation/governance.py`

State machine:

- `draft` → `approved` / `rejected` / `superseded`
- `approved` → `published` / `rejected` / `superseded`
- published/rejected/superseded are terminal for that draft

This enforces a trust boundary: **drafts are not searchable / not canonical**.

---

### D) Publishing + versioning (self-updating)

**Goal:** Turn approved drafts into a published KB and support updates over time without losing history.

**Where:** `generation/publish.py`, `scripts/publish_draft.py`

Publishing creates/updates:

- `published_kb_articles`:
  - current canonical text (`body_markdown`)
  - `current_version`
  - `latest_draft_id`
  - taxonomy fields (module/category/tags)
- `kb_article_versions`:
  - append-only history of every published version
  - reviewer + change note
  - rollback support (if needed)

**Self-updating bit:** publishing v2+ is done by reusing the same `kb_article_id` and appending a new `kb_article_versions` row.

---

### E) Provenance / lineage graph (traceability)

**Goal:** Every KB section is traceable to source evidence units and therefore to the underlying ticket/transcript/script.

**Where:** `generation/lineage.py`, `scripts/show_provenance.py`

- `write_lineage_edges(draft, case_json, session)`
  - Reads evidence_unit_ids from CaseJSON
  - Writes `kb_lineage_edges` rows with:
    - relationship:
      - `CREATED_FROM` (ticket/conversation)
      - `REFERENCES` (scripts/placeholders)
    - section label (problem/symptoms/root_cause/resolution_steps/placeholders_needed/…)

`scripts/publish_draft.py` additionally ensures lineage exists before publish, so v2+ preserves traceability even if a user skips the lineage step.

---

### F) Retrieval + gap detection (optional track / Postgres)

**Goal:** Demonstrate learning by detecting weak retrieval and showing improvement after publishing.

**Where:** `retrieval/index.py`, `retrieval/search.py`, `retrieval/query_builder.py`, `gap/detect_gap.py`, `eval/before_after.py`

**BM25**

- uses `rank-bm25` with simple tokenization
- deterministic and threshold-friendly (good for trust/gap decisions)

**Gap detection thresholds**

- `GAP_THRESHOLD_TOP1 = 8.0`
- `GAP_THRESHOLD_AVG = 5.0`
- gap if:
  - no results, OR
  - top1 < threshold_top1, OR
  - avg(top_k) < threshold_avg

This is optional for Feature 1, but useful for “learning loop” demonstrations.

---

## 4) Database schemas

### SQLite (demo)

ORM models live in `db/models.py` and are created via `db/init_db()`:

- `evidence_units`
- `kb_drafts`
- `kb_lineage_edges`
- `learning_events`
- `published_kb_articles`
- `kb_article_versions`

Plus `raw_*` tables created by workbook ingestion:

- `raw_tickets`, `raw_conversations`, `raw_scripts_master`, `raw_placeholder_dictionary`

### Postgres (optional)

`db/schema.sql` defines a permissive schema for hackathon reloads and includes:

- core workbook tables (`tickets`, `conversations`, …)
- missing ORM tables (added for compatibility)
- **compatibility views** mapping Postgres → `raw_*` so generator code can run unmodified:
  - `raw_tickets`, `raw_conversations`, `raw_scripts_master`, `raw_placeholder_dictionary`
- unified `learning_events` schema
- `indexable_articles` view (seed + published learned) for BM25 full index

---

## 5) File-by-file objectives (what each file does)

### `db/`

- `db/__init__.py`
  - Objective: SQLite engine/session utilities; `init_db()` creates ORM tables and performs small SQLite migrations.
- `db/models.py`
  - Objective: ORM models for drafts, evidence, provenance edges, published articles, and version history.
- `db/schema.sql` (Postgres optional)
  - Objective: Postgres schema + compatibility shims (views) + indexing view.

### `ingestion/`

- `ingestion/workbook_loader.py`
  - Objective: Load workbook tabs into SQLite `raw_*` tables and extract `EvidenceUnit` chunks.

### `ingest/` (Postgres optional)

- `ingest/load_excel_to_neon.py`
  - Objective: Load Excel tabs into Postgres tables and extract basic evidence units into `evidence_units`.

### `generation/`

- `generation/generator.py`
  - Objective: Build a case bundle (ticket + transcript + scripts + placeholders + evidence units), build CaseJSON, generate and store KB draft.
- `generation/templates.py`
  - Objective: Render a KB markdown article from CaseJSON.
- `generation/lineage.py`
  - Objective: Write and read provenance edges (section → evidence units).
- `generation/governance.py`
  - Objective: Human approval gate (status transitions) and superseding logic.
- `generation/publish.py`
  - Objective: Publish approved drafts into `published_kb_articles` and append `kb_article_versions`. Supports rollback.

### `retrieval/` (optional)

- `retrieval/index.py`
  - Objective: Build BM25 index from DB tables; provides seed and full index builds.
- `retrieval/search.py`
  - Objective: User-facing search API with caching + load/save index.
- `retrieval/query_builder.py`
  - Objective: Deterministic ticket → query building and cleaning.
- `retrieval/reindex.py`
  - Objective: Rebuild full index after publishing (Postgres mode).

### `gap/` (optional)

- `gap/detect_gap.py`
  - Objective: Evaluate retrieval quality and log gap events.

### `eval/` (optional)

- `eval/before_after.py`
  - Objective: Before/after retrieval evaluation showing measurable lift.
- `eval/dashboard.py`
  - Objective: Aggregated counts/metrics dashboard (Postgres mode).

### `scripts/`

- `scripts/demo.py`
  - Objective: One-command SQLite Feature 1 demo: load workbook → evidence → draft → lineage → approve → publish → print outputs.
- `scripts/list_drafts.py`
  - Objective: List drafts by status from SQLite DB.
- `scripts/review_draft.py`
  - Objective: Approve/reject a draft by ID.
- `scripts/publish_draft.py`
  - Objective: Publish approved draft; supports v2+ via `--kb-article-id`; ensures lineage exists.
- `scripts/show_provenance.py`
  - Objective: Print provenance table for a draft or published article.
- `scripts/run_pipeline.py` (Postgres optional)
  - Objective: Glue script for gap→draft→publish→reindex flow.

---

## 6) What we changed / added during integration

### Demo-readiness fixes

- `scripts/demo.py`: `--workbook` is optional and defaults to `Data/SupportMind__Final_Data.xlsx`
- `scripts/review_draft.py`: fixed DetachedInstanceError by printing fields before session closes
- `scripts/publish_draft.py`: ensures lineage edges exist before publishing so traceability is preserved for v2+

### Postgres integration (optional)

- `db/schema.sql`: added missing ORM tables, compatibility `raw_*` views, unified `learning_events`, and `indexable_articles` view
- `gap/detect_gap.py` + `retrieval/reindex.py`: aligned writes to unified `learning_events`
- `ingest/load_excel_to_neon.py`: added evidence extraction to `evidence_units`
- `retrieval/index.py`: full index now reads from `indexable_articles`
- `scripts/run_pipeline.py`: orchestrator for Postgres mode
- `.env.example`: template for `DATABASE_URL` and optional OpenAI vars

### Repo hygiene

- `.gitignore`: added ignores for `.venv/`, `*.db`, caches, `.cursor/`

---

## 7) How to run (Feature 1, SQLite)

```bash
python scripts/demo.py --db trust_me_bro.db --ticket CS-38908386
```

To publish v2 on the same KB:

1) Generate a new draft for the same ticket (prints a `draft_id`)
2) Approve it
3) Publish with `--kb-article-id <kb_article_id>` (creates version 2)
4) Show provenance for the article ID

See `README.md` for exact commands.

---

## 8) “Self-updating” clarification (for judges)

This system is **self-updating with human governance**:

- The KB content is **automatically generated** from resolved cases/transcripts
- A human approval gate decides what becomes canonical
- Updates are published as **new versions** of the same KB article
- Every version remains **traceable** to evidence units (auditability)

