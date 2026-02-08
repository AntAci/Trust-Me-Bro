// API client for FastAPI backend
// Default to localhost:8000, can be overridden via environment variable

import type { DemoScenario, TranscriptMessage } from "@/lib/mockData";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

interface ApiError {
  message: string;
  status: number;
}

async function fetchApi<T>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = `${API_BASE_URL}${endpoint}`;
  
  const response = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error: ApiError = {
      message: `API error: ${response.statusText}`,
      status: response.status,
    };
    throw error;
  }

  return response.json();
}

// Types
export interface Metrics {
  tickets_count: number;
  evidence_units_count: number;
  drafts_pending: number;
  drafts_approved: number;
  drafts_rejected: number;
  published_articles_count: number;
  provenance_edges_count: number;
}

export interface Ticket {
  ticket_id: string;
  ticket_number: string;
  subject: string;
  status: string;
  category?: string;
  module?: string;
}

export interface Draft {
  draft_id: string;
  ticket_id: string;
  title: string;
  body_markdown: string;
  case_json?: string;
  status: "pending" | "approved" | "rejected";
  reviewer?: string;
  reviewed_at?: string;
  review_notes?: string;
  published_at?: string;
  created_at: string;
}

export interface PublishedArticle {
  kb_article_id: string;
  latest_draft_id: string;
  title: string;
  body_markdown: string;
  module?: string;
  category?: string;
  tags_json?: string;
  source_type: string;
  source_ticket_id: string;
  current_version: number;
  created_at: string;
  updated_at: string;
}

export interface ArticleVersion {
  version_id: string;
  kb_article_id: string;
  version: number;
  source_draft_id: string;
  body_markdown: string;
  title: string;
  reviewer: string;
  change_note?: string;
  is_rollback: boolean;
  created_at: string;
}

export interface GroupedProvenance {
  section_label: string;
  source_type: string;
  count: number;
}

// Alias for use in components
export type { GroupedProvenance as GroupedProvenanceItem };

export interface ProvenanceResponse {
  kb_article_id: string;
  latest_draft_id: string;
  grouped: GroupedProvenance[];
  total_edges: number;
}

export interface EvidenceUnit {
  evidence_unit_id: string;
  source_type: string;
  source_id: string;
  field_name: string;
  snippet_text: string;
}

export interface EvidenceUnitsResponse {
  evidence_units: EvidenceUnit[];
  total: number;
  limit: number;
  offset: number;
}

export interface GalaxyNode {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  created_at?: string | null;
  status?: string | null;
  version?: number | null;
  meta?: Record<string, string | number | null>;
}

export interface GalaxyEdge {
  from: string;
  to: string;
  type: string;
}

export interface GalaxyResponse {
  computed_at: string;
  layout: { method: string; seed: number; limit: number };
  nodes: GalaxyNode[];
  edges: GalaxyEdge[];
  highlights: { latest_published_version_node_id?: string | null };
}

export interface PublishV2Response {
  kb_article_id: string;
  version: number;
  latest_draft_id: string;
}

// API functions
export const api = {
  // Metrics
  getMetrics: () => fetchApi<Metrics>("/api/metrics"),

  // Tickets
  getTickets: (params?: { limit?: number; search?: string }) => {
    const searchParams = new URLSearchParams();
    if (params?.limit) searchParams.set("limit", String(params.limit));
    if (params?.search) searchParams.set("search", params.search);
    const query = searchParams.toString();
    return fetchApi<Ticket[]>(`/api/tickets${query ? `?${query}` : ""}`);
  },

  getTicketTranscript: (ticketId: string) =>
    fetchApi<{ ticket_id: string; transcript: TranscriptMessage[] }>(
      `/api/tickets/${ticketId}/transcript`
    ),

  // Drafts
  generateDraft: (ticketId: string) =>
    fetchApi<{ draft_id: string; draft: Draft }>("/api/drafts/generate", {
      method: "POST",
      body: JSON.stringify({ ticket_id: ticketId }),
    }),

  getDraft: (draftId: string) => fetchApi<Draft>(`/api/drafts/${draftId}`),

  approveDraft: (draftId: string, reviewer: string, notes?: string) =>
    fetchApi<Draft>(`/api/drafts/${draftId}/approve`, {
      method: "POST",
      body: JSON.stringify({ reviewer, notes }),
    }),

  rejectDraft: (draftId: string, reviewer: string, notes?: string) =>
    fetchApi<Draft>(`/api/drafts/${draftId}/reject`, {
      method: "POST",
      body: JSON.stringify({ reviewer, notes }),
    }),

  publishDraft: (
    draftId: string,
    reviewer: string,
    note?: string,
    kbArticleId?: string
  ) =>
    fetchApi<{ kb_article_id: string; version: number }>(
      `/api/drafts/${draftId}/publish`,
      {
        method: "POST",
        body: JSON.stringify({
          reviewer,
          note,
          kb_article_id: kbArticleId,
        }),
      }
    ),

  generateSyntheticScenario: (params: {
    mode: "new" | "v2_update";
    existingKbContext?: string;
    categoryHint?: string;
  }) =>
    fetchApi<DemoScenario>("/api/demo/generate-scenario", {
      method: "POST",
      body: JSON.stringify({
        mode: params.mode,
        existing_kb_context: params.existingKbContext,
        category_hint: params.categoryHint,
      }),
    }),

  // Articles
  getArticle: (kbArticleId: string) =>
    fetchApi<PublishedArticle>(`/api/articles/${kbArticleId}`),

  getArticleVersions: (kbArticleId: string) =>
    fetchApi<ArticleVersion[]>(`/api/articles/${kbArticleId}/versions`),

  // Provenance
  getProvenance: (kbArticleId: string) =>
    fetchApi<ProvenanceResponse>(`/api/provenance?kb_article_id=${kbArticleId}`),

  getEvidenceUnits: (params: {
    kbArticleId: string;
    sectionLabel: string;
    sourceType: string;
    limit?: number;
    offset?: number;
  }) => {
    const searchParams = new URLSearchParams({
      kb_article_id: params.kbArticleId,
      section_label: params.sectionLabel,
      source_type: params.sourceType,
      limit: String(params.limit || 20),
      offset: String(params.offset || 0),
    });
    return fetchApi<EvidenceUnitsResponse>(
      `/api/provenance/evidence?${searchParams.toString()}`
    );
  },

  // Galaxy
  getGalaxy: () => fetchApi<GalaxyResponse>("/api/galaxy"),

  // Demo publish v2
  publishV2Demo: (kbArticleId: string, ticketId: string, reviewer?: string, note?: string) =>
    fetchApi<PublishV2Response>("/api/demo/publish_v2", {
      method: "POST",
      body: JSON.stringify({
        kb_article_id: kbArticleId,
        ticket_id: ticketId,
        reviewer,
        note,
      }),
    }),
};
