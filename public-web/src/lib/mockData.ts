import { Draft, EvidenceUnit, Ticket, ArticleVersion } from "@/lib/api";

export type TranscriptRole = "customer" | "agent" | "system";

export interface TranscriptMessage {
  id: string;
  role: TranscriptRole;
  speaker?: string;
  text: string;
  timestamp: string;
  evidenceUnitId?: string;
  sourceType?: EvidenceUnit["source_type"];
  sourceId?: string;
  fieldName?: string;
}

export interface EvidenceSummary {
  total: number;
  bySection: Record<string, number>;
  bySourceType: Record<string, number>;
}

export interface DemoScenario {
  ticket: Ticket;
  transcript: TranscriptMessage[];
  draft: Draft;
  kbArticleId: string;
  evidenceUnits: EvidenceUnit[];
  evidenceSummary: EvidenceSummary;
  versions: ArticleVersion[];
}

export const demoScenario: DemoScenario = {
  ticket: {
    ticket_id: "1",
    ticket_number: "CS-38908386",
    subject: "Unable to process payment - timeout error",
    status: "Resolved",
    category: "Payments",
    module: "Billing",
  },
  transcript: [
    {
      id: "msg-1",
      role: "customer",
      text: "Our residents are seeing payment timeouts after clicking Pay Now. It started yesterday.",
      timestamp: "09:12",
      evidenceUnitId: "eu-1",
      sourceType: "CONVERSATION",
      sourceId: "conv-001",
      fieldName: "customer_message",
    },
    {
      id: "msg-2",
      role: "agent",
      text: "Thanks for the details. I’m checking the payment service logs for errors.",
      timestamp: "09:14",
      evidenceUnitId: "eu-3",
      sourceType: "CONVERSATION",
      sourceId: "conv-001",
      fieldName: "agent_response",
    },
    {
      id: "msg-3",
      role: "agent",
      text: "We’re seeing connection pool exhaustion on the payments DB.",
      timestamp: "09:18",
      evidenceUnitId: "eu-4",
      sourceType: "CONVERSATION",
      sourceId: "conv-001",
      fieldName: "agent_response",
    },
    {
      id: "msg-4",
      role: "customer",
      text: "Is there a mitigation we can apply today?",
      timestamp: "09:20",
      evidenceUnitId: "eu-2",
      sourceType: "CONVERSATION",
      sourceId: "conv-001",
      fieldName: "customer_message",
    },
    {
      id: "msg-5",
      role: "agent",
      text: "Yes. Increase pool size and recycle idle connections. Then retry payment.",
      timestamp: "09:22",
      evidenceUnitId: "eu-5",
      sourceType: "CONVERSATION",
      sourceId: "conv-001",
      fieldName: "agent_response",
    },
    {
      id: "msg-6",
      role: "system",
      text: "Resolution confirmed: payments completed after pool update.",
      timestamp: "09:29",
      evidenceUnitId: "eu-6",
      sourceType: "TICKET",
      sourceId: "CS-38908386",
      fieldName: "resolution",
    },
  ],
  draft: {
    draft_id: "draft-001",
    ticket_id: "1",
    title: "Payment timeouts caused by DB connection pool limits",
    body_markdown: `# Payment timeouts caused by DB connection pool limits

## Problem
Residents cannot complete payments due to timeout errors in the Pay Now flow.

## Symptoms
- Payments hang or time out after clicking Pay Now
- Spikes in payment API latency

## Root Cause
Connection pool exhaustion on the payments database.

## Resolution Steps
1. Increase DB connection pool size from 10 to 50.
2. Recycle idle connections older than 5 minutes.
3. Retry payment and confirm transaction success.

## Placeholders Needed
- {{PROPERTY_ID}}
- {{RESIDENT_ID}}
`,
    status: "pending",
    created_at: "2026-02-08T09:30:00Z",
  },
  kbArticleId: "kb-001",
  evidenceUnits: [
    {
      evidence_unit_id: "eu-1",
      source_type: "CONVERSATION",
      source_id: "conv-001",
      field_name: "customer_message",
      snippet_text: "Residents are seeing payment timeouts after clicking Pay Now.",
    },
    {
      evidence_unit_id: "eu-2",
      source_type: "CONVERSATION",
      source_id: "conv-001",
      field_name: "customer_message",
      snippet_text: "Is there a mitigation we can apply today?",
    },
    {
      evidence_unit_id: "eu-3",
      source_type: "CONVERSATION",
      source_id: "conv-001",
      field_name: "agent_response",
      snippet_text: "Checking payment service logs for errors.",
    },
    {
      evidence_unit_id: "eu-4",
      source_type: "CONVERSATION",
      source_id: "conv-001",
      field_name: "agent_response",
      snippet_text: "Connection pool exhaustion on the payments DB.",
    },
    {
      evidence_unit_id: "eu-5",
      source_type: "CONVERSATION",
      source_id: "conv-001",
      field_name: "agent_response",
      snippet_text: "Increase pool size and recycle idle connections.",
    },
    {
      evidence_unit_id: "eu-6",
      source_type: "TICKET",
      source_id: "CS-38908386",
      field_name: "resolution",
      snippet_text: "Payments completed after pool update.",
    },
    {
      evidence_unit_id: "eu-7",
      source_type: "SCRIPT",
      source_id: "script-payment",
      field_name: "step_3",
      snippet_text: "Verify database connection pool settings in config.",
    },
    {
      evidence_unit_id: "eu-8",
      source_type: "PLACEHOLDER",
      source_id: "placeholder-1",
      field_name: "required_input",
      snippet_text: "Property ID is required to verify payment routing.",
    },
  ],
  evidenceSummary: {
    total: 8,
    bySection: {
      problem: 2,
      symptoms: 2,
      root_cause: 1,
      resolution_steps: 2,
      placeholders_needed: 1,
    },
    bySourceType: {
      TICKET: 1,
      CONVERSATION: 5,
      SCRIPT: 1,
      PLACEHOLDER: 1,
    },
  },
  versions: [
    {
      version_id: "v-1",
      kb_article_id: "kb-001",
      version: 1,
      source_draft_id: "draft-001",
      body_markdown: "v1 body",
      title: "Payment timeouts caused by DB connection pool limits",
      reviewer: "Demo",
      change_note: "Initial publication",
      is_rollback: false,
      created_at: "2026-02-08T09:38:00Z",
    },
    {
      version_id: "v-2",
      kb_article_id: "kb-001",
      version: 2,
      source_draft_id: "draft-002",
      body_markdown: "v2 body",
      title: "Payment timeouts caused by DB connection pool limits",
      reviewer: "Demo",
      change_note: "Added pool recycle step details",
      is_rollback: false,
      created_at: "2026-02-08T09:55:00Z",
    },
  ],
};

export function loadDemoScenario(): DemoScenario {
  return demoScenario;
}
