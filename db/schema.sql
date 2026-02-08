-- Trust-Me-Bro Database Schema
-- Permissive schema (TEXT fields) to ensure ingestion never fails
-- Target: Neon Postgres

-- Drop existing tables (for hackathon reloads)
DROP TABLE IF EXISTS kb_lineage CASCADE;
DROP TABLE IF EXISTS learning_events CASCADE;
DROP TABLE IF EXISTS conversations CASCADE;
DROP TABLE IF EXISTS tickets CASCADE;
DROP TABLE IF EXISTS knowledge_articles CASCADE;
DROP TABLE IF EXISTS existing_knowledge_articles CASCADE;
DROP TABLE IF EXISTS scripts_master CASCADE;
DROP TABLE IF EXISTS placeholder_dictionary CASCADE;

-- =============================================================================
-- TICKETS
-- =============================================================================
CREATE TABLE tickets (
    ticket_number TEXT PRIMARY KEY,
    conversation_id TEXT,
    created_at TEXT,
    closed_at TEXT,
    status TEXT,
    priority TEXT,
    tier TEXT,
    product TEXT,
    module TEXT,
    category TEXT,
    case_type TEXT,
    account_name TEXT,
    property_name TEXT,
    property_city TEXT,
    property_state TEXT,
    contact_name TEXT,
    contact_role TEXT,
    contact_email TEXT,
    contact_phone TEXT,
    subject TEXT,
    description TEXT,
    resolution TEXT,
    root_cause TEXT,
    tags TEXT,
    kb_article_id TEXT,
    generation_source_record TEXT,
    script_id TEXT,
    generated_kb_article_id TEXT
);

-- =============================================================================
-- CONVERSATIONS
-- =============================================================================
CREATE TABLE conversations (
    conversation_id TEXT,
    ticket_number TEXT,
    channel TEXT,
    conversation_start TEXT,
    conversation_end TEXT,
    customer_role TEXT,
    agent_name TEXT,
    product TEXT,
    category TEXT,
    issue_summary TEXT,
    transcript TEXT,
    sentiment TEXT,
    generation_source_record TEXT,
    PRIMARY KEY (conversation_id, ticket_number)
);

-- =============================================================================
-- KNOWLEDGE_ARTICLES (generated/learned KBs)
-- =============================================================================
CREATE TABLE knowledge_articles (
    kb_article_id TEXT PRIMARY KEY,
    title TEXT,
    body TEXT,
    tags TEXT,
    module TEXT,
    category TEXT,
    created_at TEXT,
    updated_at TEXT,
    status TEXT,  -- Draft, Active, Published, Archived
    source_type TEXT
);

-- =============================================================================
-- EXISTING_KNOWLEDGE_ARTICLES (seed KBs - baseline for retrieval)
-- =============================================================================
CREATE TABLE existing_knowledge_articles (
    kb_article_id TEXT PRIMARY KEY,
    source_pk TEXT,
    title TEXT,
    url TEXT,
    body TEXT,
    product TEXT,
    experience TEXT,
    source_table TEXT,
    source_type TEXT
);

-- =============================================================================
-- SCRIPTS_MASTER
-- =============================================================================
CREATE TABLE scripts_master (
    script_id TEXT PRIMARY KEY,
    script_title TEXT,
    script_purpose TEXT,
    script_inputs TEXT,
    module TEXT,
    category TEXT,
    source TEXT,
    script_text_sanitized TEXT
);

-- =============================================================================
-- PLACEHOLDER_DICTIONARY
-- =============================================================================
CREATE TABLE placeholder_dictionary (
    placeholder TEXT PRIMARY KEY,
    meaning TEXT,
    example TEXT
);

-- =============================================================================
-- KB_LINEAGE (provenance tracking)
-- =============================================================================
CREATE TABLE kb_lineage (
    lineage_id SERIAL PRIMARY KEY,
    kb_article_id TEXT,
    source_type TEXT,
    source_id TEXT,
    relationship TEXT,
    evidence_snippet TEXT,
    event_timestamp TEXT
);

-- =============================================================================
-- LEARNING_EVENTS (audit trail for gap detection, drafts, approvals)
-- =============================================================================
CREATE TABLE learning_events (
    event_id TEXT PRIMARY KEY,
    event_type TEXT,
    draft_id TEXT,
    ticket_id TEXT,
    metadata_json TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    trigger_ticket_number TEXT,
    detected_gap TEXT,
    proposed_kb_article_id TEXT,
    event_timestamp TEXT
);

-- =============================================================================
-- INDEXES for retrieval performance
-- =============================================================================
CREATE INDEX idx_tickets_ticket_number ON tickets(ticket_number);
CREATE INDEX idx_conversations_ticket_number ON conversations(ticket_number);
CREATE INDEX idx_knowledge_articles_status ON knowledge_articles(status);
CREATE INDEX idx_existing_kb_title ON existing_knowledge_articles(title);
CREATE INDEX idx_learning_events_ticket ON learning_events(ticket_id);
CREATE INDEX idx_learning_events_type ON learning_events(event_type);

-- =============================================================================
-- COMPATIBILITY VIEWS (allow raw_* queries on Postgres)
-- =============================================================================
CREATE VIEW raw_tickets AS
SELECT
    ticket_number AS "Ticket_Number",
    conversation_id AS "Conversation_ID",
    script_id AS "Script_ID",
    kb_article_id AS "KB_Article_ID",
    subject AS "Subject",
    description AS "Description",
    root_cause AS "Root_Cause",
    resolution AS "Resolution",
    status AS "Status",
    product AS "Product",
    module AS "Module",
    category AS "Category"
FROM tickets;

CREATE VIEW raw_conversations AS
SELECT
    conversation_id AS "Conversation_ID",
    ticket_number AS "Ticket_Number",
    issue_summary AS "Issue_Summary",
    transcript AS "Transcript"
FROM conversations;

CREATE VIEW raw_scripts_master AS
SELECT
    script_id AS "Script_ID",
    script_text_sanitized AS "Script_Text_Sanitized",
    script_purpose AS "Script_Purpose"
FROM scripts_master;

CREATE VIEW raw_placeholder_dictionary AS
SELECT
    placeholder AS "Placeholder",
    meaning AS "Meaning",
    example AS "Example"
FROM placeholder_dictionary;

-- =============================================================================
-- MISSING ORM TABLES
-- =============================================================================
CREATE TABLE IF NOT EXISTS evidence_units (
    evidence_unit_id TEXT PRIMARY KEY,
    source_type TEXT NOT NULL,
    source_id TEXT NOT NULL,
    field_name TEXT NOT NULL,
    char_offset_start INTEGER NOT NULL,
    char_offset_end INTEGER NOT NULL,
    chunk_index INTEGER NOT NULL,
    snippet_text TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kb_drafts (
    draft_id TEXT PRIMARY KEY,
    ticket_id TEXT NOT NULL,
    title TEXT NOT NULL,
    body_markdown TEXT NOT NULL,
    case_json TEXT NOT NULL,
    status TEXT NOT NULL,
    reviewer TEXT,
    reviewed_at TIMESTAMP,
    review_notes TEXT,
    published_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS published_kb_articles (
    kb_article_id TEXT PRIMARY KEY,
    latest_draft_id TEXT NOT NULL,
    title TEXT NOT NULL,
    body_markdown TEXT NOT NULL,
    module TEXT NOT NULL,
    category TEXT NOT NULL,
    tags_json TEXT,
    source_type TEXT NOT NULL,
    source_ticket_id TEXT NOT NULL,
    current_version INTEGER NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kb_article_versions (
    version_id TEXT PRIMARY KEY,
    kb_article_id TEXT NOT NULL,
    version INTEGER NOT NULL,
    source_draft_id TEXT,
    body_markdown TEXT NOT NULL,
    title TEXT NOT NULL,
    reviewer TEXT,
    change_note TEXT,
    is_rollback BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS kb_lineage_edges (
    edge_id TEXT PRIMARY KEY,
    draft_id TEXT NOT NULL,
    evidence_unit_id TEXT NOT NULL,
    relationship TEXT NOT NULL,
    section_label TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_evidence_source ON evidence_units(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_kb_drafts_status ON kb_drafts(status);
CREATE INDEX IF NOT EXISTS idx_kb_drafts_ticket ON kb_drafts(ticket_id);

-- =============================================================================
-- INDEXABLE ARTICLES VIEW (seed + published learned)
-- =============================================================================
CREATE VIEW indexable_articles AS
SELECT
    kb_article_id,
    title,
    body,
    product,
    source_type
FROM existing_knowledge_articles
WHERE body IS NOT NULL AND body != ''

UNION ALL

SELECT
    kb_article_id,
    title,
    body_markdown AS body,
    module AS product,
    source_type
FROM published_kb_articles
WHERE body_markdown IS NOT NULL AND body_markdown != '';
