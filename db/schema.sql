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
    trigger_ticket_number TEXT,
    trigger_conversation_id TEXT,
    detected_gap TEXT,
    proposed_kb_article_id TEXT,
    draft_summary TEXT,
    final_status TEXT,
    reviewer_role TEXT,
    event_timestamp TEXT,
    event_type TEXT,  -- gap_detected, draft_generated, approved, published, reindexed
    metadata JSONB    -- stores scores, top-k results, etc.
);

-- =============================================================================
-- INDEXES for retrieval performance
-- =============================================================================
CREATE INDEX idx_tickets_ticket_number ON tickets(ticket_number);
CREATE INDEX idx_conversations_ticket_number ON conversations(ticket_number);
CREATE INDEX idx_knowledge_articles_status ON knowledge_articles(status);
CREATE INDEX idx_existing_kb_title ON existing_knowledge_articles(title);
CREATE INDEX idx_learning_events_ticket ON learning_events(trigger_ticket_number);
CREATE INDEX idx_learning_events_type ON learning_events(event_type);
