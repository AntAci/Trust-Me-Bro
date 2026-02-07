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

## System Architecture

```
┌─────────────┐
│   Tickets   │ ──┐
│Conversations│   │
└─────────────┘   │
                  ▼
         ┌─────────────────┐
         │   Ingestion     │ ──► Seed Index (KB articles only)
         └─────────────────┘
                  │
                  ▼
         ┌─────────────────┐
         │   Retrieval     │ ──► Query ticket → Top-K articles
         └─────────────────┘
                  │
                  ▼
         ┌─────────────────┐
         │  Gap Detection  │ ──► Weak results → Generate draft
         └─────────────────┘
                  │
                  ▼
         ┌─────────────────┐
         │ Draft Generation│ ──► Template + Evidence → Draft KB
         └─────────────────┘
                  │
                  ▼
         ┌─────────────────┐
         │  Review UI      │ ──► Human approval/rejection
         └─────────────────┘
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
- **Seed Index**: Contains only pre-existing/seed KB articles (baseline corpus).
- **Full Index**: Contains seed + published learned articles (complete searchable corpus).
- **Drafts**: Not searchable until approved/published. Stored separately with lineage metadata.

## Repository Structure

**Current Status:** Repository is newly initialized. Structure below is **proposed/canonical**. Folders marked as "Planned / Not yet implemented" should be created during development.

```
Trust-Me-Bro/
├── ingestion/              # Planned: Ticket/conversation ingestion
│   ├── __init__.py
│   ├── workbook_loader.py # Excel/CSV → DB tables
│   └── extractors.py      # Extract text from tickets/conversations
│
├── db/                     # Planned: Database models and migrations
│   ├── __init__.py
│   ├── models.py          # SQLAlchemy/ORM models
│   ├── schema.sql         # Table definitions
│   └── migrations/        # DB migration scripts
│
├── retrieval/              # Planned: Search and retrieval logic
│   ├── __init__.py
│   ├── indexer.py         # Build vector/semantic indices
│   ├── searcher.py        # Query → Top-K results
│   └── embeddings.py      # Text → embeddings
│
├── gap/                    # Planned: Gap detection algorithms
│   ├── __init__.py
│   ├── detector.py        # Identify knowledge gaps
│   └── thresholds.py      # Configurable thresholds
│
├── generation/             # Planned: Draft KB article generation
│   ├── __init__.py
│   ├── templates.py       # KB article templates
│   ├── generator.py       # Generate draft from evidence
│   └── lineage.py         # Write lineage edges
│
├── ui/                     # Planned: Review and management UI
│   ├── __init__.py
│   ├── app.py             # Flask/FastAPI backend
│   ├── templates/         # HTML templates
│   ├── static/            # CSS/JS assets
│   └── routes/            # API endpoints
│
├── eval/                   # Planned: Evaluation and metrics
│   ├── __init__.py
│   ├── metrics.py         # Hit@k, retrieval lift, completeness
│   └── reports.py         # Generate evaluation reports
│
├── scripts/                # Planned: Utility scripts
│   ├── load_data.py       # Load workbook into DB
│   ├── build_index.py     # Build seed/full indices
│   ├── run_eval.py        # Run evaluation pipeline
│   └── demo.py            # Demo script
│
├── data/                   # Planned: Sample data and workbooks
│   ├── workbook.xlsx      # Source workbook (Tickets, KB, etc.)
│   └── samples/           # Sample tickets/conversations
│
├── notebooks/              # Planned: Analysis and experimentation
│   └── exploration.ipynb  # Data exploration, gap analysis
│
├── tests/                  # Planned: Unit and integration tests
│   ├── test_ingestion.py
│   ├── test_retrieval.py
│   └── test_gap_detection.py
│
├── requirements.txt        # Planned: Python dependencies
├── pyproject.toml          # Planned: Project metadata (optional)
├── .env.example           # Planned: Environment variables template
├── docker-compose.yml      # Planned: Docker setup (optional)
└── README.md              # This file
```

### Module Responsibilities

**Backend Person 1:**
- **ingestion/**: Load workbook data, extract tickets/conversations, normalize formats
- **retrieval/**: Build indices (seed/full), implement search (vector/semantic), return top-K
- **gap/**: Detect weak retrieval results, identify knowledge gaps, trigger draft generation
- **eval/**: Compute metrics (gap counts, retrieval lift, Hit@k), generate reports
- **scripts/load_data.py, scripts/build_index.py, scripts/run_eval.py**

**Backend Person 2 / UI:**
- **generation/**: Generate draft KB articles from templates + evidence, write lineage edges
- **ui/**: Review interface (approve/reject drafts), versioning UI, lineage visualization
- **db/models.py**: Define KB_Lineage, Learning_Events, versioning tables
- **scripts/demo.py**: End-to-end demo workflow

## Data Model (Workbook → DB Tables)

The system aligns to workbook tabs with the following schema:

### Tables

**Tickets**
- `ticket_id` (PK)
- `title`, `description`, `status`, `created_at`
- Relationships: → `conversations` (1:N)

**Conversations**
- `conversation_id` (PK)
- `ticket_id` (FK)
- `speaker`, `message`, `timestamp`
- Relationships: `ticket_id` → `Tickets`

**Scripts_Master**
- `script_id` (PK)
- `script_name`, `content`, `category`
- (Reference data for KB article generation)

**Knowledge_Articles**
- `kb_id` (PK)
- `title`, `content`, `status` (draft/published), `version`, `created_at`, `updated_at`
- `source_type` (seed/learned)
- Relationships: → `KB_Lineage` (1:N)

**KB_Lineage**
- `lineage_id` (PK)
- `kb_id` (FK), `source_type` (ticket/conversation/script), `source_id`
- `evidence_snippet`, `edge_type` (gap_detected, generated_from, approved_by)
- Relationships: `kb_id` → `Knowledge_Articles`

**Learning_Events**
- `event_id` (PK)
- `event_type` (gap_detected, draft_generated, approved, published, reindexed)
- `kb_id` (FK, nullable), `ticket_id` (FK, nullable)
- `metadata` (JSON), `timestamp`
- Relationships: `kb_id` → `Knowledge_Articles`, `ticket_id` → `Tickets`

**Placeholder_Dictionary**
- `placeholder_id` (PK)
- `key`, `value`, `context`
- (Template substitution dictionary)

### Relationships Summary

```
Tickets (1) ──→ (N) Conversations
Knowledge_Articles (1) ──→ (N) KB_Lineage
Knowledge_Articles (1) ──→ (N) Learning_Events
Tickets (1) ──→ (N) Learning_Events
```

## How It Works

### Step-by-Step Pipeline

1. **Ingest Workbook**
   - Load `workbook.xlsx` → parse tabs (Tickets, Conversations, Knowledge_Articles, etc.)
   - Insert into database tables
   - Extract text from tickets/conversations (normalize, clean)

2. **Build Seed Index**
   - Query `Knowledge_Articles` where `status='published'` AND `source_type='seed'`
   - Generate embeddings for article content
   - Build vector index (FAISS/Pinecone/Chroma) → **Seed Index**

3. **Retrieve Top-K for Ticket Query**
   - For each ticket, extract query (title + description)
   - Search Seed Index → return top-K articles
   - Compute relevance scores

4. **Gap Detection Thresholds**
   - If top-1 score < threshold (e.g., 0.7) OR top-K average < threshold → **GAP DETECTED**
   - Record `Learning_Event` (event_type='gap_detected', ticket_id, metadata={scores})
   - Trigger draft generation

5. **Generate KB Draft**
   - Collect evidence snippets from ticket/conversations
   - Apply template (from `Scripts_Master` or default)
   - Generate draft article → insert `Knowledge_Articles` (status='draft', source_type='learned')
   - Write `KB_Lineage` edges: ticket_id → kb_id (edge_type='generated_from', evidence_snippet=...)
   - Record `Learning_Event` (event_type='draft_generated')

6. **Review/Approve**
   - UI displays draft with evidence snippets and lineage
   - Human reviewer approves/rejects
   - If approved: update `Knowledge_Articles.status='approved'`
   - Record `Learning_Event` (event_type='approved')

7. **Publish + Reindex**
   - Update `Knowledge_Articles.status='published'`
   - Rebuild **Full Index** (seed + published learned articles)
   - Record `Learning_Event` (event_type='published', event_type='reindexed')

8. **Evaluation Metrics**
   - Count gaps detected, drafts generated, approvals, publications
   - Compute retrieval lift: compare Seed Index vs Full Index performance
   - Hit@k: % of tickets where relevant article in top-K (before vs after)
   - Top-1 shift: % of tickets where top-1 result improved

## Running Locally

**Status:** Commands below are **suggested** based on proposed structure. Implement during development.

### Prerequisites

```bash
# Python 3.9+
python --version

# Install dependencies
pip install -r requirements.txt
```

### Setup

```bash
# 1. Load workbook data into database
python scripts/load_data.py --workbook data/workbook.xlsx

# 2. Build seed index
python scripts/build_index.py --index-type seed

# 3. Run gap detection and draft generation
python scripts/generate_drafts.py

# 4. Start UI server (review interface)
cd ui && python app.py
# Or: uvicorn ui.app:app --reload  # if FastAPI
```

### Evaluation

```bash
# Run evaluation pipeline
python scripts/run_eval.py --output eval/report.json
```

**Note:** These scripts should be implemented in `scripts/` directory. See "Repository Structure" for proposed file locations.

## Demo Script

**Status:** Demo script should be implemented in `scripts/demo.py`. Below is the intended workflow.

### Hackathon Demo Sequence

1. **Load Data**
   - Run `python scripts/load_data.py --workbook data/workbook.xlsx`
   - Verify: Check DB for tickets and seed KB articles

2. **Build Seed Index**
   - Run `python scripts/build_index.py --index-type seed`
   - Verify: Seed index contains only pre-existing KB articles

3. **Simulate Ticket Query (Before)**
   - Query: "How do I reset my password?"
   - Show: Weak results from Seed Index (low scores, irrelevant articles)
   - **Gap detected** → Draft generated

4. **Review Draft**
   - Open UI: `http://localhost:5000/review`
   - Show: Draft article with evidence snippets (ticket excerpts)
   - Show: Lineage graph (ticket → draft)
   - **Click "Approve"**

5. **Publish & Reindex**
   - System publishes article → rebuilds Full Index
   - Show: Learning_Event log (gap_detected → draft_generated → approved → published)

6. **Simulate Ticket Query (After)**
   - Same query: "How do I reset my password?"
   - Show: **Improved results** (new article in top-1, higher score)
   - **Click provenance** → Show lineage: ticket → gap → draft → approval → published article

7. **Evaluation Dashboard**
   - Show metrics: X gaps detected, Y drafts generated, Z approvals
   - Show retrieval lift: Hit@1 improved from 45% → 72%

## Evaluation

### Metrics

- **Gap Counts**: Number of tickets where gap detected (weak retrieval)
- **Drafts Generated**: Number of draft KB articles created
- **Approvals**: Number of drafts approved by humans
- **Retrieval Lift**: 
  - **Hit@k**: Percentage of tickets where relevant article appears in top-K (Seed Index vs Full Index)
  - **Top-1 Shift**: Percentage of tickets where top-1 result improved after publishing learned articles
  - **Average Score Improvement**: Mean relevance score increase
- **Completeness Checks**: Coverage of ticket topics by KB articles (before/after)

### Evaluation Reports

Reports should be generated by `eval/metrics.py` and output to `eval/reports/`. Include:
- Gap detection statistics
- Draft generation success rate
- Approval/rejection rates
- Retrieval performance comparison (Seed vs Full Index)
- Lineage completeness (all published articles have traceable origins)

## Roadmap

### Phase 1: MVP (Current Focus)
- ✅ Repository structure
- ⏳ Ingestion pipeline (workbook → DB)
- ⏳ Seed index building
- ⏳ Basic retrieval (vector search)
- ⏳ Gap detection (threshold-based)
- ⏳ Draft generation (template-based)
- ⏳ Review UI (approve/reject)
- ⏳ Publish + reindex
- ⏳ Basic evaluation metrics

### Phase 2: Governance & Versioning
- Versioning UI (view article history)
- Rollback capability
- Multi-reviewer workflow
- Approval chains
- Lineage visualization (graph view)
- Evidence snippet highlighting

### Phase 3: Scale & Dashboard
- Real-time ingestion (API endpoints)
- Advanced gap detection (ML-based)
- Multi-index support (domain-specific indices)
- Evaluation dashboard (real-time metrics)
- A/B testing framework (retrieval methods)

### Future Work: RLM-Style Upgrade
- **Tool-based evidence slicing**: Use LLM tools to extract precise evidence snippets from tickets
- **Recursive verification**: Generate multiple draft variants, verify against source, select best
- **Self-correction**: Detect contradictions in KB, trigger re-review
- **Active learning**: Prioritize gaps with highest impact on retrieval lift

## Contributing

### Adding a New Extractor

1. Create `ingestion/extractors/your_extractor.py`
2. Implement `extract(ticket_id)` → returns text
3. Register in `ingestion/extractors.py`
4. Add tests in `tests/test_ingestion.py`

### Adding a New Retrieval Method

1. Implement in `retrieval/searcher.py` (e.g., `hybrid_search`, `rerank_search`)
2. Add configuration in `retrieval/config.py`
3. Update `retrieval/indexer.py` to support new index type
4. Add evaluation in `eval/metrics.py`

### Adding a New UI View

1. Create route in `ui/routes/your_view.py`
2. Add template in `ui/templates/your_view.html`
3. Register route in `ui/app.py`
4. Add static assets if needed in `ui/static/`

### Commit Guidelines

- Use conventional commits: `feat:`, `fix:`, `docs:`, `refactor:`, `test:`
- Keep commits focused (one logical change per commit)
- Write clear commit messages explaining "what" and "why"
- Run tests before committing: `pytest tests/`

## License

**License TBD** — To be determined.

---

**Note:** This README reflects the proposed architecture. As modules are implemented, update this document to reflect actual file locations and working commands.
