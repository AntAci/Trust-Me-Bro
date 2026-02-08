import { Draft, Ticket, ArticleVersion } from "@/lib/api";
import { EvidenceSummary } from "@/lib/mockData";
import { PluginHeader } from "@/components/plugin/PluginHeader";
import { GenerateDraftSection } from "@/components/plugin/GenerateDraftSection";
import { GovernanceGateSection } from "@/components/plugin/GovernanceGateSection";
import { PublishSection } from "@/components/plugin/PublishSection";
import { ProvenanceSection } from "@/components/plugin/ProvenanceSection";
import { VersionsSection } from "@/components/plugin/VersionsSection";
import { TrustLedger, TrustLedgerEvent } from "@/components/plugin/TrustLedger";

interface TrustMeBroPluginProps {
  ticket: Ticket | null;
  draft: Draft | null;
  draftStatus: "idle" | "generating" | "ready" | "approved" | "rejected";
  kbArticleId: string | null;
  currentVersion: number;
  evidenceSummary: EvidenceSummary;
  reviewer: string;
  reviewNotes: string;
  versions: ArticleVersion[];
  trustLedgerEvents: TrustLedgerEvent[];
  canPublishV1: boolean;
  canPublishV2: boolean;
  onReviewerChange: (value: string) => void;
  onReviewNotesChange: (value: string) => void;
  onGenerateDraft: () => void;
  onApproveDraft: () => void;
  onRejectDraft: () => void;
  onPublishV1: () => void;
  onPublishV2: () => void;
  onOpenProvenance: () => void;
  onOpenVersions: () => void;
  onLoadDemoScenario: () => void;
  onGenerateScenario: (mode: "new" | "v2_update") => void;
  isGeneratingScenario?: boolean;
}

export function TrustMeBroPlugin({
  ticket,
  draft,
  draftStatus,
  kbArticleId,
  currentVersion,
  evidenceSummary,
  reviewer,
  reviewNotes,
  versions,
  trustLedgerEvents,
  canPublishV1,
  canPublishV2,
  onReviewerChange,
  onReviewNotesChange,
  onGenerateDraft,
  onApproveDraft,
  onRejectDraft,
  onPublishV1,
  onPublishV2,
  onOpenProvenance,
  onOpenVersions,
  onLoadDemoScenario,
  onGenerateScenario,
  isGeneratingScenario,
}: TrustMeBroPluginProps) {
  return (
    <div className="space-y-4">
      <PluginHeader
        onLoadDemoScenario={onLoadDemoScenario}
        onGenerateScenario={onGenerateScenario}
        isGeneratingScenario={isGeneratingScenario}
      />

      <GenerateDraftSection
        draft={draft}
        draftStatus={draftStatus}
        evidenceSummary={evidenceSummary}
        onGenerate={onGenerateDraft}
        onPublish={onPublishV1}
        canPublish={canPublishV1}
        disabled={!ticket}
      />

      <GovernanceGateSection
        reviewer={reviewer}
        reviewNotes={reviewNotes}
        draftStatus={draftStatus}
        onReviewerChange={onReviewerChange}
        onReviewNotesChange={onReviewNotesChange}
        onApprove={onApproveDraft}
        onReject={onRejectDraft}
      />

      <PublishSection
        draftStatus={draftStatus}
        kbArticleId={kbArticleId}
        currentVersion={currentVersion}
        versions={versions}
        canPublishV1={canPublishV1}
        canPublishV2={canPublishV2}
        onPublishV1={onPublishV1}
        onPublishV2={onPublishV2}
      />

      <ProvenanceSection
        evidenceSummary={evidenceSummary}
        onOpenProvenance={onOpenProvenance}
      />

      <VersionsSection
        currentVersion={currentVersion}
        onOpenVersions={onOpenVersions}
      />

      <TrustLedger events={trustLedgerEvents} />
      {!ticket && (
        <div className="text-xs text-muted-foreground text-center">
          Select a ticket to enable plugin actions.
        </div>
      )}
    </div>
  );
}
