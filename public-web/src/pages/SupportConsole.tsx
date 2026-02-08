import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { api, Draft, EvidenceUnit, Ticket, ArticleVersion } from "@/lib/api";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { PreviewDrawer } from "@/components/flow/PreviewDrawer";
import Provenance from "@/pages/Provenance";
import VersionHistory from "@/pages/VersionHistory";
import { TicketListPanel } from "@/components/console/TicketListPanel";
import { TicketDetailPanel } from "@/components/console/TicketDetailPanel";
import { TrustMeBroPlugin } from "@/components/plugin/TrustMeBroPlugin";
import { TrustLedgerEvent } from "@/components/plugin/TrustLedger";
import { loadDemoScenario, TranscriptMessage, EvidenceSummary, DemoScenario } from "@/lib/mockData";

type DraftStatus = "idle" | "generating" | "ready" | "approved" | "rejected";

function buildEvidenceSummary(fallback: EvidenceSummary, caseJson?: string | null) {
  if (!caseJson) return fallback;
  try {
    const parsed = JSON.parse(caseJson);
    const sectionCounts = parsed.section_counts || {};
    const evidenceCounts = parsed.evidence_counts || {};
    const total = Object.values(evidenceCounts).reduce((sum: number, count: number) => sum + count, 0);
    return {
      total: total || fallback.total,
      bySection: Object.keys(sectionCounts).length ? sectionCounts : fallback.bySection,
      bySourceType: Object.keys(evidenceCounts).length ? evidenceCounts : fallback.bySourceType,
    } as EvidenceSummary;
  } catch {
    return fallback;
  }
}

function upsertVersion(prev: ArticleVersion[], next: ArticleVersion) {
  const existingIndex = prev.findIndex((item) => item.version === next.version);
  if (existingIndex === -1) {
    return [...prev, next];
  }
  const updated = [...prev];
  updated[existingIndex] = next;
  return updated;
}

export default function SupportConsole() {
  const { isDemoMode, defaultReviewer, setKnowledgeMapPhase } = useDemoMode();
  const scenario = useMemo(() => loadDemoScenario(), []);
  const emptyEvidenceSummary = useMemo<EvidenceSummary>(
    () => ({ total: 0, bySection: {}, bySourceType: {} }),
    []
  );
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [draftStatus, setDraftStatus] = useState<DraftStatus>("idle");
  const [evidenceUnits, setEvidenceUnits] = useState<EvidenceUnit[]>(scenario.evidenceUnits);
  const [kbArticleId, setKbArticleId] = useState<string | null>(null);
  const [currentVersion, setCurrentVersion] = useState<number>(0);
  const [lastPublishedDraftId, setLastPublishedDraftId] = useState<string | null>(null);
  const [versions, setVersions] = useState<ArticleVersion[]>([]);
  const [reviewer, setReviewer] = useState(defaultReviewer);
  const [reviewNotes, setReviewNotes] = useState("");
  const [trustLedgerEvents, setTrustLedgerEvents] = useState<TrustLedgerEvent[]>([]);
  const [syntheticTickets, setSyntheticTickets] = useState<Ticket[]>([]);
  const [syntheticScenarios, setSyntheticScenarios] = useState<Record<string, DemoScenario>>({});
  const [isGeneratingScenario, setIsGeneratingScenario] = useState(false);
  const [provenanceDrawerOpen, setProvenanceDrawerOpen] = useState(false);
  const [versionsDrawerOpen, setVersionsDrawerOpen] = useState(false);
  const [evidenceDrawerOpen, setEvidenceDrawerOpen] = useState(false);
  const [selectedEvidence, setSelectedEvidence] = useState<EvidenceUnit | null>(null);
  const [evidenceSummary, setEvidenceSummary] = useState<EvidenceSummary>(scenario.evidenceSummary);

  const { data: tickets, isLoading: ticketsLoading, error: ticketsError } = useQuery({
    queryKey: ["tickets", "console"],
    queryFn: () => api.getTickets({ limit: 50 }),
    retry: 1,
    staleTime: 30000,
  });

  const displayTickets = useMemo(() => {
    const baseTickets = tickets || (ticketsError ? [scenario.ticket] : []);
    const merged = new Map<string, Ticket>();
    [...syntheticTickets, ...baseTickets].forEach((ticket) => {
      merged.set(ticket.ticket_number, ticket);
    });
    return Array.from(merged.values());
  }, [tickets, ticketsError, scenario.ticket, syntheticTickets]);

  const syntheticTicketNumbers = useMemo(
    () => new Set(syntheticTickets.map((ticket) => ticket.ticket_number)),
    [syntheticTickets]
  );

  const addTrustEvent = useCallback((type: TrustLedgerEvent["type"], label: string) => {
    setTrustLedgerEvents((prev) => [
      ...prev,
      {
        id: `${type}-${Date.now()}`,
        type,
        label,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      },
    ]);
  }, []);

  const loadDemo = useCallback(() => {
    setSelectedTicket(scenario.ticket);
    setTranscript(scenario.transcript);
    setEvidenceUnits(scenario.evidenceUnits);
    setEvidenceSummary(scenario.evidenceSummary);
    setDraft(null);
    setDraftStatus("idle");
    setKbArticleId(null);
    setCurrentVersion(0);
    setLastPublishedDraftId(null);
    setVersions([]);
    setTrustLedgerEvents([]);
    setReviewer(defaultReviewer);
    setReviewNotes("");
    addTrustEvent("evidence_extracted", "Loaded demo ticket + transcript");
  }, [scenario, addTrustEvent, defaultReviewer]);

  const handleSelectTicket = useCallback(
    async (ticket: Ticket) => {
      // Don't reset anything if selecting the same ticket
      if (selectedTicket?.ticket_number === ticket.ticket_number) {
        return;
      }
      
      setSelectedTicket(ticket);
      // Reset draft state when switching to a different ticket
      setDraft(null);
      setDraftStatus("idle");
      setKbArticleId(null);
      setCurrentVersion(0);
      setLastPublishedDraftId(null);
      setVersions([]);
      setTrustLedgerEvents([]);
      
      if (ticket.ticket_number === scenario.ticket.ticket_number) {
        setTranscript(scenario.transcript);
        setEvidenceUnits(scenario.evidenceUnits);
        setEvidenceSummary(scenario.evidenceSummary);
        return;
      }

      const syntheticScenario = syntheticScenarios[ticket.ticket_number];
      if (syntheticScenario) {
        setTranscript(syntheticScenario.transcript);
        setEvidenceUnits(syntheticScenario.evidenceUnits);
        setEvidenceSummary(syntheticScenario.evidenceSummary);
        return;
      }

      try {
        const response = await api.getTicketTranscript(ticket.ticket_id);
        setTranscript(response.transcript);
      } catch {
        setTranscript([]);
      }

      setEvidenceUnits([]);
      setEvidenceSummary(emptyEvidenceSummary);
    },
    [scenario, emptyEvidenceSummary, syntheticScenarios, selectedTicket]
  );

  const handleGenerateScenario = useCallback(
    async (mode: "new" | "v2_update") => {
      setIsGeneratingScenario(true);
      setKnowledgeMapPhase("generating");
      try {
        const generated = await api.generateSyntheticScenario({
          mode,
          existingKbContext: mode === "v2_update" ? draft?.body_markdown : undefined,
          categoryHint: selectedTicket?.category,
        });

        setSelectedTicket(generated.ticket);
        setTranscript(generated.transcript);
        setEvidenceUnits(generated.evidenceUnits);
        setEvidenceSummary(generated.evidenceSummary);
        setDraft(null);
        setDraftStatus("idle");
        setTrustLedgerEvents([]);

        const nextKbId =
          mode === "v2_update" ? kbArticleId || generated.kbArticleId : null;
        setKbArticleId(nextKbId);
        setCurrentVersion(nextKbId ? Math.max(currentVersion, 1) : 0);
        if (mode === "new") {
          setVersions([]);
          setLastPublishedDraftId(null);
        }

        setSyntheticTickets((prev) => [generated.ticket, ...prev]);
        setSyntheticScenarios((prev) => ({
          ...prev,
          [generated.ticket.ticket_number]: generated,
        }));
        addTrustEvent("evidence_extracted", "Generated synthetic ticket + transcript");
      } catch {
        loadDemo();
      } finally {
        setKnowledgeMapPhase("at_gate");
        setIsGeneratingScenario(false);
      }
    },
    [
      addTrustEvent,
      currentVersion,
      draft?.body_markdown,
      kbArticleId,
      loadDemo,
      selectedTicket?.category,
      setKnowledgeMapPhase,
    ]
  );

  const handleGenerateDraft = useCallback(async () => {
    if (!selectedTicket) return;
    setDraftStatus("generating");
    setKnowledgeMapPhase("generating");

    try {
      const response = await api.generateDraft(selectedTicket.ticket_id);
      setDraft(response.draft);
      setEvidenceSummary(buildEvidenceSummary(scenario.evidenceSummary, response.draft.case_json));
      setDraftStatus("ready");
    } catch {
      const syntheticScenario = syntheticScenarios[selectedTicket.ticket_number];
      if (syntheticScenario) {
        setDraft(syntheticScenario.draft);
        setEvidenceSummary(syntheticScenario.evidenceSummary);
        setDraftStatus("ready");
      } else {
        setDraft(scenario.draft);
        setEvidenceSummary(scenario.evidenceSummary);
        setDraftStatus("ready");
      }
    }

    setKnowledgeMapPhase("at_gate");
    addTrustEvent("draft_created", "Draft created from evidence");
  }, [
    selectedTicket,
    scenario,
    addTrustEvent,
    setKnowledgeMapPhase,
    syntheticTicketNumbers,
    syntheticScenarios,
  ]);

  const handleApproveDraft = useCallback(async () => {
    if (!draft) return;
    try {
      await api.approveDraft(draft.draft_id, reviewer, reviewNotes || undefined);
    } catch {
      // demo fallback
    }
    setDraftStatus("approved");
    setKnowledgeMapPhase("approved");
    addTrustEvent("approved", `Approved by ${reviewer || "Reviewer"}`);
  }, [draft, reviewer, reviewNotes, addTrustEvent, setKnowledgeMapPhase]);

  const handleRejectDraft = useCallback(async () => {
    if (!draft) return;
    try {
      await api.rejectDraft(draft.draft_id, reviewer, reviewNotes || undefined);
    } catch {
      // demo fallback
    }
    setDraftStatus("rejected");
    addTrustEvent("rejected", `Rejected by ${reviewer || "Reviewer"}`);
  }, [draft, reviewer, reviewNotes, addTrustEvent]);

  const handlePublishV1 = useCallback(async () => {
    if (!draft || currentVersion >= 1) return;
    setKnowledgeMapPhase("publishing_v1");
    try {
      const response = await api.publishDraft(draft.draft_id, reviewer, "Initial publication");
      setKbArticleId(response.kb_article_id);
      setCurrentVersion(response.version);
      setLastPublishedDraftId(draft.draft_id);
      setVersions((prev) =>
        upsertVersion(prev, {
          version_id: `v${response.version}`,
          kb_article_id: response.kb_article_id,
          version: response.version,
          source_draft_id: draft.draft_id,
          body_markdown: draft.body_markdown,
          title: draft.title,
          reviewer: reviewer || "Reviewer",
          change_note: "Initial publication",
          is_rollback: false,
          created_at: new Date().toISOString(),
        })
      );
    } catch {
      setKbArticleId(scenario.kbArticleId);
      setCurrentVersion(1);
      setLastPublishedDraftId(draft.draft_id);
      setVersions((prev) => (prev.length ? prev : [scenario.versions[0]]));
    }
    addTrustEvent("published_v1", "Published v1 (append-only)");
  }, [draft, reviewer, scenario, addTrustEvent, setKnowledgeMapPhase, currentVersion]);

  const handlePublishV2 = useCallback(async () => {
    if (!draft || !kbArticleId || draftStatus !== "approved") return;
    if (draft.draft_id === lastPublishedDraftId) return;
    setKnowledgeMapPhase("publishing_v2");
    try {
      const response = await api.publishDraft(
        draft.draft_id,
        reviewer,
        "Version 2 update",
        kbArticleId
      );
      setCurrentVersion(response.version);
      setLastPublishedDraftId(draft.draft_id);
      setVersions((prev) =>
        upsertVersion(prev, {
          version_id: `v${response.version}`,
          kb_article_id: kbArticleId,
          version: response.version,
          source_draft_id: draft.draft_id,
          body_markdown: draft?.body_markdown || "",
          title: draft?.title || "Knowledge Base Update",
          reviewer: reviewer || "Reviewer",
          change_note: "Version 2 update",
          is_rollback: false,
          created_at: new Date().toISOString(),
        })
      );
    } catch {
      setCurrentVersion(2);
      setVersions((prev) => (prev.length > 1 ? prev : scenario.versions));
    }
    addTrustEvent("published_v2", "Published v2 (append-only)");
  }, [
    draft,
    reviewer,
    kbArticleId,
    scenario,
    addTrustEvent,
    setKnowledgeMapPhase,
    draftStatus,
    lastPublishedDraftId,
  ]);

  const handleEvidenceClick = useCallback((evidenceUnitId: string) => {
    const unit = evidenceUnits.find((item) => item.evidence_unit_id === evidenceUnitId);
    if (!unit) return;
    setSelectedEvidence(unit);
    setEvidenceDrawerOpen(true);
  }, [evidenceUnits]);

  const handleProvenanceDrawer = useCallback((open: boolean) => {
    setProvenanceDrawerOpen(open);
    if (open) {
      setKnowledgeMapPhase("provenance_highlight");
      setTimeout(() => {
        if (currentVersion >= 2) {
          setKnowledgeMapPhase("publishing_v2");
        } else if (currentVersion >= 1) {
          setKnowledgeMapPhase("publishing_v1");
        } else {
          setKnowledgeMapPhase("idle");
        }
      }, 1200);
    }
  }, [currentVersion, setKnowledgeMapPhase]);

  useEffect(() => {
    if (isDemoMode && !selectedTicket) {
      loadDemo();
    }
  }, [isDemoMode, selectedTicket, loadDemo]);

  useEffect(() => {
    if (draft && (draftStatus === "idle" || draftStatus === "generating")) {
      setDraftStatus("ready");
    }
  }, [draft, draftStatus]);

  useEffect(() => {
    const onSelect = () => loadDemo();
    const onGenerate = () => handleGenerateDraft();
    const onApprove = () => handleApproveDraft();
    const onPublishV1 = () => handlePublishV1();
    const onPublishV2 = () => handlePublishV2();
    const onOpenProvenance = () => {
      handleProvenanceDrawer(true);
      setTimeout(() => handleProvenanceDrawer(false), 1200);
    };

    window.addEventListener("auto-demo:select-ticket", onSelect);
    window.addEventListener("auto-demo:generate-draft", onGenerate);
    window.addEventListener("auto-demo:approve-draft", onApprove);
    window.addEventListener("auto-demo:publish-v1", onPublishV1);
    window.addEventListener("auto-demo:publish-v2", onPublishV2);
    window.addEventListener("auto-demo:open-provenance", onOpenProvenance);

    return () => {
      window.removeEventListener("auto-demo:select-ticket", onSelect);
      window.removeEventListener("auto-demo:generate-draft", onGenerate);
      window.removeEventListener("auto-demo:approve-draft", onApprove);
      window.removeEventListener("auto-demo:publish-v1", onPublishV1);
      window.removeEventListener("auto-demo:publish-v2", onPublishV2);
    window.removeEventListener("auto-demo:open-provenance", onOpenProvenance);
    };
  }, [
    loadDemo,
    handleGenerateDraft,
    handleApproveDraft,
    handlePublishV1,
    handlePublishV2,
    handleProvenanceDrawer,
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Support Console</h1>
          <p className="text-sm text-muted-foreground">
            Embedded Trust-Me-Bro plugin for governed knowledge generation
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          Enterprise Console Simulation
        </Badge>
      </div>

      <div className="grid gap-4 xl:grid-cols-[280px_1fr_420px]">
        <TicketListPanel
          tickets={displayTickets}
          isLoading={ticketsLoading}
          selectedTicket={selectedTicket}
          onSelectTicket={handleSelectTicket}
          onLoadDemoScenario={loadDemo}
        />

        <TicketDetailPanel
          ticket={selectedTicket}
          transcript={transcript}
          onEvidenceClick={handleEvidenceClick}
        />

        <TrustMeBroPlugin
          ticket={selectedTicket}
          draft={draft}
          draftStatus={draftStatus}
          kbArticleId={kbArticleId}
          currentVersion={currentVersion}
          evidenceSummary={evidenceSummary}
          reviewer={reviewer}
          reviewNotes={reviewNotes}
          versions={versions}
          canPublishV1={draftStatus === "approved" && currentVersion < 1}
          canPublishV2={
            draftStatus === "approved" &&
            currentVersion >= 1 &&
            draft?.draft_id !== lastPublishedDraftId
          }
          onReviewerChange={setReviewer}
          onReviewNotesChange={setReviewNotes}
          onGenerateDraft={handleGenerateDraft}
          onApproveDraft={handleApproveDraft}
          onRejectDraft={handleRejectDraft}
          onPublishV1={handlePublishV1}
          onPublishV2={handlePublishV2}
          onOpenProvenance={() => handleProvenanceDrawer(true)}
          onOpenVersions={() => setVersionsDrawerOpen(true)}
          onLoadDemoScenario={loadDemo}
          onGenerateScenario={handleGenerateScenario}
          isGeneratingScenario={isGeneratingScenario}
          trustLedgerEvents={trustLedgerEvents}
        />
      </div>

      <PreviewDrawer
        open={provenanceDrawerOpen}
        onOpenChange={handleProvenanceDrawer}
        title="Provenance Graph"
        description="Read-only trace map from ticket to evidence units"
      >
        <Provenance kbArticleId={kbArticleId || undefined} />
      </PreviewDrawer>

      <PreviewDrawer
        open={versionsDrawerOpen}
        onOpenChange={setVersionsDrawerOpen}
        title="Version History"
        description="Append-only version timeline with reviewer audit trail"
      >
        <VersionHistory kbArticleId={kbArticleId || undefined} />
      </PreviewDrawer>

      <Sheet open={evidenceDrawerOpen} onOpenChange={setEvidenceDrawerOpen}>
        <SheetContent side="right" className="w-[400px] sm:w-[520px]">
          <SheetHeader>
            <SheetTitle>Evidence Unit</SheetTitle>
            <SheetDescription>Source excerpt used in the draft</SheetDescription>
          </SheetHeader>
          {selectedEvidence ? (
            <Card className="mt-4">
              <CardContent className="space-y-3 p-4">
                <div className="flex items-center justify-between">
                  <code className="text-xs text-muted-foreground">
                    {selectedEvidence.evidence_unit_id}
                  </code>
                  <Badge variant="outline" className="text-xs">
                    {selectedEvidence.source_type}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">
                  Source: <code>{selectedEvidence.source_id}</code> • Field:{" "}
                  <code>{selectedEvidence.field_name}</code>
                </div>
                <div className="rounded-md border bg-muted/40 p-3 text-sm">
                  {selectedEvidence.snippet_text}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="mt-4">
              <CardContent className="p-4 text-sm text-muted-foreground">
                No evidence unit selected.
              </CardContent>
            </Card>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
