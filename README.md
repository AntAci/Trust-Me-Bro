# Trust Me Bro

## Overview

**Trust Me Bro** is a self-updating knowledge engine with human-gated publishing, provenance tracking, and measurable retrieval lift. The system ingests support tickets and conversations, detects knowledge gaps in existing KB articles, generates draft articles with full lineage, and enables human review before publishing. Once published, articles become searchable and improve retrieval quality, with complete traceability from ticket → gap → draft → approval → published article.

**Demo narrative:** A support ticket arrives → weak KB search results → gap detected → draft KB article generated → human approves → article published → now retrievable with full lineage showing ticket origin and evidence snippets.

## Core Concepts

- **KB Articles**: Knowledge base articles that serve as the searchable corpus. Each article has versions, status (draft/published), and metadata.
- **Versions**: Append-only version history for all KB articles, preserving full audit trail.
- **Lineage/Provenance**: Complete traceability from source tickets/conversations → gap detection → draft generation → approval → publication. Each article links to its evidence snippets.
- **Learning Events**: Records of gap detection, draft generation, approvals, and publications. Used for evaluation and metrics.
- **Gap Detection**: Algorithmic identification of knowledge gaps when retrieval fails to surface relevant articles for a ticket query.
- **Publish Gates**: Human review workflow that prevents drafts from entering the searchable index until approved.

**Trust Core:** Every published article includes evidence snippets (source ticket excerpts), full traceability (lineage graph), and append-only version history (immutable audit trail).

## What We Completed (Final)

- **db/**: SQLite engine, session, and `init_db` with ORM; migration that adds reviewer/reviewed_at/review_notes/published_at to `kb_drafts`. Models: `EvidenceUnit`, `KBDraft`, `KBLineageEdge`, `LearningEvent`, `PublishedKBArticle`, `KBArticleVersion`.
- **ingestion/workbook_loader.py**: Load Excel workbook (Tickets, Conversations, Scripts_Master, Placeholder_Dictionary) into raw_* tables; extract evidence units with chunking (paragraph/sentence, resolution steps, transcript lines, script text, placeholders). Evidence unit IDs like `EU-TICKET-{id}-{field}-{offset}`.
- **generation/templates.py**: `render_kb_draft(case_json)` → markdown KB article (Summary, Problem, Environment, Root Cause, Resolution Steps, Verification Steps, Required Inputs, Evidence Sources).
- **generation/generator.py**: `build_case_bundle(ticket_id, session)`, `build_case_json_deterministic(bundle)`, `build_case_json_llm(bundle, api_key)` (optional OpenAI), `generate_kb_draft(ticket_id, session, api_key)` → draft + CaseJSON; Pydantic `CaseJSON` with steps/placeholders and evidence_unit_ids.
- **generation/lineage.py**: `write_lineage_edges(draft, case_json, session)` (CREATED_FROM / REFERENCES by section), `get_provenance_report(draft_id, session)` for provenance output.
- **generation/governance.py**: `get_drafts_by_status`, `approve_draft`, `reject_draft` with status transitions (draft→approved/rejected, approved→published/rejected).
- **generation/publish.py**: `publish_draft` (create/update published article + append version), `rollback_version`, `get_published_article`, `export_for_indexer(session, kb_article_id)` for indexer payload.
- **scripts/demo.py**: One-command SQLite demo for Feature 1 (Self-Updating Knowledge Engine): loads workbook (default `Data/SupportMind__Final_Data.xlsx`), extracts evidence, generates draft, writes lineage, approves, publishes; prints KB draft, CaseJSON, provenance, export payload.
- **scripts/list_drafts.py**: List drafts by `--status draft|approved|rejected|published|superseded`.
- **scripts/review_draft.py**: Approve or reject a draft (`--action approve|reject`, `--reviewer`, `--notes`).
- **scripts/publish_draft.py**: Publish an approved draft (`--reviewer`, `--note`, optional `--kb-article-id` for v2+). Ensures lineage edges exist before publish (traceability preserved).
- **scripts/show_provenance.py**: Show provenance by `--draft-id` or `--kb-article-id`.
- **scripts/run_pipeline.py**: Optional Postgres demo pipeline: gap detect → draft → approve/publish → reindex (requires `DATABASE_URL`).
- **tests/**: `test_case_json.py` (CaseJSON build/validation), `test_evidence.py` (evidence extraction chunking), `test_lineage.py` (write_lineage_edges from CaseJSON). Run with `pytest tests/`.
- **requirements.txt**: pandas, sqlalchemy, openpyxl, pydantic, pytest, openai. Data workbook in `Data/SupportMind__Final_Data.xlsx`.

## Why BM25 Over Embeddings?

We chose **BM25** as the primary retrieval method because the core problem is **trust and gap detection**, not fuzzy semantic search.

### The Core Question

> "Do we already have reliable knowledge for this ticket, or is this a true knowledge gap?"

### Why BM25 is Right for This

| Property | BM25 | Embeddings |
|----------|------|------------|
| **Can say "I don't know"** | ✅ Low score = no match | ❌ Always returns "similar" results |
| **Deterministic** | ✅ Same query = same score | ⚠️ Varies by model/version |
| **Explainable** | ✅ "These words matched" | ❌ "Vectors are close in 768D" |
| **Defensible thresholds** | ✅ "Score < X = gap" is verifiable | ❌ Thresholds are arbitrary |
| **Conservative** | ✅ Requires term overlap | ❌ Finds "kind of related" things |

### The Trust Architecture

BM25 acts as the **truth gate**:
- **High BM25 confidence** → System answers from existing KB
- **Low BM25 confidence** → System flags gap, triggers learning
- **Draft knowledge** → Never trusted until published and reindexed

Embeddings are designed to find things that are "kind of similar in meaning." They almost always return something that feels related, even when the match is weak. This makes embeddings **bad at saying "I don't know"** — which is dangerous in a system that gives operational instructions.

### Key Benefits

1. **Deterministic, reproducible scores** — Critical for before/after evaluation
2. **Explainable matches** — You can point to exact overlapping terms
3. **Defensible thresholds** — "Score below X means no coverage"

> **Embeddings can be added later** as a secondary tool (candidate expansion, reranking), but they should never override the BM25 gap decision. The system must confidently say "we do not know" before it can safely learn.

## System Architecture

```
┌─────────────┐
│   Tickets   │ ──┐
│Conversations│   │
└─────────────┘   │
                  ▼
         ┌─────────────────┐
         │   Ingestion     │ ──► Seed Index (existing KB articles)
         └─────────────────┘
                  │
                  ▼
         ┌─────────────────┐
         │   Retrieval     │ ──► Query ticket → Top-K articles (BM25)
         └─────────────────┘
                  │
                  ▼
         ┌─────────────────┐
         │  Gap Detection  │ ──► Weak results → GAP → Trigger draft
         └─────────────────┘
                  │
                  ▼
         ┌─────────────────┐
         │ Draft Generation│ ──► Template + Evidence → Draft KB
         └─────────────────┘       (Person 2 scope)
                  │
                  ▼
         ┌─────────────────┐
         │  Review UI      │ ──► Human approval/rejection
         └─────────────────┘       (Person 2 scope)
                  │
                  ▼
         ┌─────────────────┐
         │    Publish      │ ──► Reindex → Full Index (seed + learned)
         └─────────────────┘
                  │
                  ▼
         ┌─────────────────┐
         │  Evaluation     │ ──► Metrics: gap counts, retrieval lift
         └─────────────────┘
```

**Two Indices Concept:**
- **Seed Index**: Contains only `existing_knowledge_articles` (baseline articles).
- **Full Index**: Seed + published learned KBs (via `indexable_articles` on Postgres; SQLite demo publishes into `published_kb_articles`).
- **Drafts**: NEVER indexed. Only published KBs enter the searchable index.

## Repository Structure

```
Trust-Me-Bro/
├── db/                         # ORM + schema
│   ├── __init__.py             # SQLite engine/session + migrations
│   ├── models.py               # EvidenceUnit, KBDraft, Lineage, Versions
│   └── schema.sql              # Postgres tables (permissive TEXT fields)
│
├── ingestion/                  # SQLite workbook ingestion + evidence
│   ├── __init__.py
│   └── workbook_loader.py
│
├── ingest/                     # Postgres ingestion
│   ├── __init__.py
│   └── load_excel_to_neon.py
│
├── retrieval/                  # BM25 indexing and search
│   ├── __init__.py
│   ├── index.py
│   ├── search.py
│   ├── query_builder.py
│   └── reindex.py
│
├── gap/                        # Gap detection
│   ├── __init__.py
│   └── detect_gap.py
│
├── eval/                       # Evaluation
│   ├── __init__.py
│   └── before_after.py
│
├── generation/                 # Draft KB article generation
│   ├── __init__.py
│   ├── templates.py
│   ├── generator.py
│   ├── lineage.py
│   ├── governance.py
│   └── publish.py
│
├── scripts/                    # Utility scripts
│   ├── demo.py
│   ├── list_drafts.py
│   ├── review_draft.py
│   ├── publish_draft.py
│   └── show_provenance.py
│
├── Data/                       # Source workbook (SQLite demo)
│   └── SupportMind__Final_Data.xlsx
│
├── data/
│   ├── raw/                    # Workbook for Postgres ingestion
│   └── index_cache/            # Cached BM25 indices
│
├── tests/
│   ├── test_case_json.py
│   ├── test_evidence.py
│   └── test_lineage.py
│
├── requirements.txt
├── environment.yml
├── activate_env.sh
├── trust_me_bro.db
└── README.md
```

### Module Responsibilities

**Backend Person 1 (Engine & Truth Layer):** ✅ IMPLEMENTED
| Module | Purpose | Main Entrypoints |
|--------|---------|------------------|
| `db/` | Database schema | `schema.sql` — all table definitions |
| `ingest/` | Excel → Neon ingestion | `load_excel_to_neon.py` — load workbook |
| `retrieval/` | BM25 search over KBs | `search_kb()`, `ticket_to_query()` |
| `gap/` | Gap detection + logging | `detect_gap()` → logs to `learning_events` |
| `eval/` | Before/after evaluation | `run_before_after_evaluation()` |

**Backend Person 2 / UI (Draft Generation & Review):** 🔜 PLANNED
| Module | Purpose | Suggested Location |
|--------|---------|-------------------|
| `generation/` | Generate KB drafts from evidence | `generator.py`, `lineage.py` |
| `ui/` | Review interface, lineage viz | `app.py`, `templates/`, `routes/` |

## Data Model (Workbook → DB Tables)

The schema uses permissive TEXT fields to ensure ingestion never fails.

### Tables

| Table | Rows | Purpose |
|-------|------|---------|
| `tickets` | 400 | Support tickets with subject, description, module |
| `conversations` | 400 | Ticket conversations with transcripts |
| `existing_knowledge_articles` | 3,046 | Seed KB articles (baseline corpus) |
| `knowledge_articles` | 3,207 | Generated/learned KB articles |
| `learning_events` | 161+ | Gap detection, approvals, reindex events |
| `scripts_master` | 714 | Agent scripts for templating |
| `placeholder_dictionary` | 25 | Template substitution values |
| `kb_lineage` | 483 | Provenance: KB → source ticket/evidence |

### Key Fields

**tickets**
- `ticket_number` (PK), `subject`, `description`, `module`, `category`, `product`

**existing_knowledge_articles** (Seed Index)
- `kb_article_id` (PK), `title`, `body`, `product`, `source_type`

**knowledge_articles** (Learned KBs)
- `kb_article_id` (PK), `title`, `body`, `status` (Draft/Active/Published), `source_type`

**learning_events**
- `event_id` (PK), `trigger_ticket_number`, `event_type`, `metadata` (JSONB)
- Event types: `gap_detected`, `draft_generated`, `approved`, `published`, `reindexed`

**kb_lineage**
- `kb_article_id` (FK), `source_type`, `source_id`, `evidence_snippet`, `relationship`

## How It Works

### Step-by-Step Pipeline

1. **Ingest Workbook** ✅
   ```bash
   python -m ingest.load_excel_to_neon
   ```
   - Loads Excel sheets → Neon Postgres tables
   - Normalizes column names (snake_case)
   - Truncates and reloads (idempotent for hackathon)

2. **Build Seed Index** ✅
   ```python
   from retrieval.index import build_seed_index
   index = build_seed_index()  # 3,046 articles
   ```
   - BM25 index over `existing_knowledge_articles`
   - Cached to `data/index_cache/seed_index.pkl`

3. **Retrieve Top-K for Ticket Query** ✅
   ```python
   from retrieval import ticket_to_query, search_kb
   query = ticket_to_query("CS-38908386")
   results = search_kb(query, top_k=5)
   ```
   - Extracts keywords from ticket subject + description
   - Removes noise (emails, IDs, greetings)
   - Returns `[{kb_id, title, score, body_preview}, ...]`

4. **Gap Detection** ✅
   ```python
   from gap import detect_gap
   result = detect_gap("CS-38908386")
   # result.is_gap, result.top1_score, result.reason
   ```
   - Gap if: top-1 score < 8.0 OR avg score < 5.0
   - Logs `learning_event` with `event_type='gap_detected'`
   - Stores scores and top-k in `metadata` JSONB

5. **Generate KB Draft** 🔜 (Person 2)
   - Collect evidence snippets from ticket/conversations
   - Apply template → generate draft
   - Write `KB_Lineage` edges

6. **Review/Approve** 🔜 (Person 2)
   - UI displays draft with evidence and lineage
   - Human approves → `status='Published'`

7. **Publish + Reindex** ✅
   ```python
   from retrieval.reindex import reindex_on_publish
   result = reindex_on_publish(kb_article_id="KB-NEW-001")
   ```
   - Rebuilds Full Index (seed + published learned)
   - Logs `learning_event` with `event_type='reindexed'`

8. **Evaluation** ✅
   ```bash
   python -m eval.before_after --batch --limit 20
   ```
   - Compares Seed Index vs Full Index retrieval
   - Shows score improvement and gap closure rate

## Running Locally
### Prerequisites

```bash
# Create conda environment
conda create -n trustmebro python=3.12 -y
conda activate trustmebro

# Install dependencies
pip install -r requirements.txt
```

### SQLite demo pipeline (draft generation)

```bash
# Full demo: load workbook, extract evidence, generate one draft, approve, publish (uses first closed ticket if --ticket omitted)
python scripts/demo.py --workbook Data/SupportMind__Final_Data.xlsx [--ticket TICKET_ID] [--db trust_me_bro.db] [--openai-key KEY]

# List drafts by status
python scripts/list_drafts.py --status draft   # or approved | rejected | published | superseded

# Approve or reject a draft (CLI review)
python scripts/review_draft.py <draft_id> --action approve --reviewer "Name" [--notes "LGTM"]

# Publish an approved draft (optional --kb-article-id for new version of existing article)
python scripts/publish_draft.py <draft_id> --reviewer "Name" [--note "Initial publish"]

# Show provenance for a draft or published article
python scripts/show_provenance.py --draft-id <draft_id>
python scripts/show_provenance.py --kb-article-id <kb_article_id>

# Run tests
pytest tests/
```

### Postgres/BM25 pipeline

Create `.env` file:
```
DATABASE_URL=postgresql://user:pass@host/dbname?sslmode=require
```

### Commands

```bash
# 1. Ingest workbook into Neon
python -m ingest.load_excel_to_neon
# 2. Test retrieval
python -m retrieval.index  # Builds seed index and runs test search

# 3. Test gap detection
python -m gap.detect_gap  # Runs on sample tickets

# 4. Run before/after evaluation
python -m eval.before_after --batch --limit 10

# 5. Reindex after publishing (after Person 2 approves drafts)
python -m retrieval.reindex
```

## Demo Script (Feature 1: Self-Updating Knowledge Engine)
**Status:** Demo script is implemented in `scripts/demo.py`.

### Quickstart (SQLite, no DATABASE_URL)
Runs the full loop: resolved ticket + transcript → draft → approve → publish, with provenance and versioning support.

```bash
python scripts/demo.py --db trust_me_bro.db
```

Optional:

```bash
python scripts/demo.py --db trust_me_bro.db --ticket CS-38908386
python scripts/demo.py --db trust_me_bro.db --openai-key YOUR_KEY
```

### Versioning demo (publish v2 of the same KB)
1) Generate a new draft for the same ticket (prints a `draft_id`):

```bash
python -c "import sys; sys.path.insert(0,'.'); from db import get_engine,get_session,init_db; from generation.generator import generate_kb_draft; engine=get_engine('trust_me_bro.db'); init_db(engine); s=get_session(engine); d,_=generate_kb_draft('CS-38908386', s); print(d.draft_id); s.close()"
```

2) Approve the draft:

```bash
python scripts/review_draft.py <draft_id> --action approve --reviewer \"Demo\" --db trust_me_bro.db
```

3) Publish as v2 by passing `--kb-article-id`:

```bash
python scripts/publish_draft.py <draft_id> --reviewer \"Demo\" --kb-article-id <kb_article_id> --note \"v2 update\" --db trust_me_bro.db
```

4) Show provenance (traceability):

```bash
python scripts/show_provenance.py --kb-article-id <kb_article_id> --db trust_me_bro.db
```

### Hackathon Demo Sequence

1. **Show Data Load**
   ```bash
   python -m ingest.load_excel_to_neon
   ```
   - Verify: 400 tickets, 3,046 seed KBs loaded

2. **Demonstrate Gap Detection**
   ```bash
   python -m gap.detect_gap
   ```
   - Show: Ticket query, top-1 score, gap decision
   - Explain threshold logic

3. **Before/After Evaluation**
   ```bash
   python -m eval.before_after --ticket CS-38908386
   ```
   - **BEFORE**: Seed index only, score = 34.56
   - **AFTER**: Full index (with published learned KBs), score = 80.61
   - Show: +46 point improvement, new learned KB in top-1

4. **Provenance Check**
   - Query `kb_lineage` table
   - Show: KB-SYN-0001 → source ticket → evidence snippet

5. **Batch Evaluation Summary**
   ```bash
   python -m eval.before_after --batch --limit 20
   ```
   - Show: Gap reduction rate, average score improvement

## Evaluation

### Metrics

| Metric | Description | How to Compute |
|--------|-------------|----------------|
| Gap Count | Tickets where top-1 < threshold | `detect_gap()` on all tickets |
| Retrieval Lift | Score improvement (before vs after) | `eval.before_after` |
| Hit@k | % tickets with relevant KB in top-k | Compare before/after |
| Gap Closure Rate | % gaps closed by learning | `(gaps_before - gaps_after) / gaps_before` |

### Sample Output

```
🏆 TRUST-ME-BRO EVALUATION SUMMARY
============================================================
📊 RETRIEVAL LIFT METRICS
Tickets evaluated:     20
Gaps BEFORE learning:  8 (40.0%)
Gaps AFTER learning:   2 (10.0%)
Gaps CLOSED:           6 ✅

📈 KEY RESULTS
Gap reduction rate:    75.0%
Avg score improvement: +45.23

🔐 TRUST GUARANTEES
✓ All new KBs have provenance (lineage to source tickets)
✓ Drafts are NEVER searchable until approved
✓ Learning events are logged with full audit trail
✓ Before/after metrics prove measurable improvement
```

## Roadmap

### Phase 1: MVP ✅
- ✅ Repository structure
- ✅ SQLite ingestion + evidence extraction
- ✅ Postgres ingestion (Neon)
- ✅ BM25 seed index + query builder
- ✅ Gap detection with event logging
- ✅ Draft generation (template-based, CaseJSON deterministic + optional LLM)
- ✅ Review (approve/reject via CLI)
- ✅ Publish + versioning + reindex
- ✅ Before/after evaluation

### Phase 2: Governance & Versioning
- ✅ Rollback capability (publish.rollback_version)
- Versioning UI (view article history)
- Multi-reviewer workflow
- Approval chains
- Lineage visualization (graph view)
- Evidence snippet highlighting

### Phase 3: Scale & Dashboard
- Real-time ingestion (API endpoints)
- Advanced gap detection (embeddings + ML)
- Evaluation dashboard
- A/B testing framework

### Future Work: RLM-Style Upgrade
- Tool-based evidence slicing (LLM extracts precise snippets)
- Recursive verification (generate variants, verify against source)
- Self-correction (detect KB contradictions)
- Active learning (prioritize high-impact gaps)

## Contributing

### Adding a New Retrieval Method

1. Implement in `retrieval/index.py` or create new module
2. Follow `KBIndex` interface: `load_from_db()`, `search()`, `save()`, `load()`
3. Update `retrieval/search.py` to expose new method

### Adding Gap Detection Logic

1. Modify `gap/detect_gap.py`
2. Add new thresholds or scoring logic
3. Update `_log_gap_event()` metadata if needed

### Commit Guidelines

- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`
- Keep commits focused (one logical change per commit)
- Test before committing: `python -m gap.detect_gap`

## License

**License TBD** — To be determined.

---

**Note:** This README covers both BM25 gap detection and draft generation flows. The core pipeline is implemented; UI review and lineage visualization are still planned.
