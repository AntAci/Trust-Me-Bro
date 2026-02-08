import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, Sparkles, FileText, MessageSquare, Code, BookOpen } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { api, Draft } from "@/lib/api";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { FlowState } from "@/pages/GuidedFlow";

interface StepGenerateDraftProps {
  flowState: FlowState;
  updateFlowState: (updates: Partial<FlowState>) => void;
  onNext: () => void;
  onBack: () => void;
  setIsLoading: (loading: boolean) => void;
}

// Mock draft for when API is unavailable
const mockDraft: Draft = {
  draft_id: "draft-001",
  ticket_id: "1",
  title: "Payment Processing Timeout Error Resolution",
  body_markdown: `# Payment Processing Timeout Error Resolution

## Problem
Users are experiencing timeout errors when attempting to process payments through the checkout flow.

## Symptoms
- Payment form hangs after clicking "Submit"
- Error message: "Request timed out. Please try again."
- Issue occurs more frequently during peak hours

## Root Cause
The payment gateway API endpoint was experiencing increased latency due to:
1. Database connection pool exhaustion
2. Missing index on the transactions table
3. Retry logic causing cascading timeouts

## Resolution Steps
1. Increase connection pool size from 10 to 50
2. Add index on \`transactions.created_at\` column
3. Implement exponential backoff for API retries
4. Add circuit breaker pattern for payment gateway calls

## Placeholders Needed
- \`{{PAYMENT_GATEWAY_URL}}\` - The payment gateway endpoint URL
- \`{{CONNECTION_POOL_SIZE}}\` - Recommended connection pool configuration
- \`{{TIMEOUT_THRESHOLD}}\` - Maximum allowed response time
`,
  case_json: JSON.stringify({
    evidence_counts: {
      TICKET: 4,
      CONVERSATION: 7,
      SCRIPT: 2,
      PLACEHOLDER: 3,
    },
    section_counts: {
      problem: 2,
      symptoms: 3,
      root_cause: 4,
      resolution_steps: 5,
      placeholders_needed: 3,
    },
  }),
  status: "pending",
  created_at: new Date().toISOString(),
};

const sourceTypeIcons: Record<string, React.ElementType> = {
  TICKET: FileText,
  CONVERSATION: MessageSquare,
  SCRIPT: Code,
  PLACEHOLDER: BookOpen,
};

const sourceTypeColors: Record<string, string> = {
  TICKET: "bg-warning/10 text-warning",
  CONVERSATION: "bg-primary/10 text-primary",
  SCRIPT: "bg-success/10 text-success",
  PLACEHOLDER: "bg-muted text-muted-foreground",
};

export function StepGenerateDraft({
  flowState,
  updateFlowState,
  onNext,
  onBack,
  setIsLoading,
}: StepGenerateDraftProps) {
  const { setKnowledgeMapPhase, autoDemoStatus } = useDemoMode();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [evidenceCounts, setEvidenceCounts] = useState<Record<string, number>>({});
  const [sectionCounts, setSectionCounts] = useState<Record<string, number>>({});

  const generateMutation = useMutation({
    mutationFn: () => api.generateDraft(flowState.ticketId!),
    onMutate: () => {
      setIsLoading(true);
      setKnowledgeMapPhase('generating');
    },
    onSuccess: (data) => {
      setDraft(data.draft);
      updateFlowState({ draftId: data.draft_id, draftStatus: "pending" });
      
      // Parse evidence counts from case_json if available
      if (data.draft.case_json) {
        try {
          const caseData = JSON.parse(data.draft.case_json);
          setEvidenceCounts(caseData.evidence_counts || {});
          setSectionCounts(caseData.section_counts || {});
        } catch {
          // Ignore parse errors
        }
      }
      setIsLoading(false);
      if (autoDemoStatus === "running") {
        onNext();
      }
    },
    onError: () => {
      // Use mock data on error
      setDraft(mockDraft);
      updateFlowState({ draftId: mockDraft.draft_id, draftStatus: "pending" });
      
      const caseData = JSON.parse(mockDraft.case_json || "{}");
      setEvidenceCounts(caseData.evidence_counts || {});
      setSectionCounts(caseData.section_counts || {});
      setIsLoading(false);
      if (autoDemoStatus === "running") {
        onNext();
      }
    },
  });

  const handleGenerate = () => {
    generateMutation.mutate();
  };

  useEffect(() => {
    const handler = () => {
      if (!flowState.ticketId) {
        return;
      }
      if (!draft && !generateMutation.isPending) {
        handleGenerate();
      }
    };
    window.addEventListener("auto-demo:generate-draft", handler);
    return () => window.removeEventListener("auto-demo:generate-draft", handler);
  }, [draft, generateMutation.isPending, flowState.ticketId, handleGenerate]);

  return (
    <div className="space-y-6">
      {/* Generate Button (if no draft yet) */}
      {!draft && (
        <div className="flex flex-col items-center justify-center py-12">
          <div className="mb-6 rounded-full bg-primary/10 p-6">
            <Sparkles className="h-12 w-12 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">Ready to Generate KB Draft</h3>
          <p className="text-muted-foreground text-center mb-6 max-w-md">
            AI will extract evidence from ticket{" "}
            <code className="rounded bg-muted px-1">{flowState.ticketNumber}</code>{" "}
            and generate a structured knowledge article draft.
          </p>
          <div className="mb-4 flex items-center gap-2 text-xs text-muted-foreground">
            <Badge variant="outline" className="text-[10px]">
              RLM Verified
            </Badge>
            <span>Section-by-section evidence synthesis</span>
          </div>
          <Button
            size="lg"
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
            className="gap-2"
          >
            <Sparkles className="h-4 w-4" />
            Generate Draft (AI)
          </Button>
        </div>
      )}

      {/* Draft Preview */}
      {draft && (
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">Draft ID</p>
                <p className="font-mono text-sm">{draft.draft_id}</p>
              </div>
              <Badge variant="secondary">{draft.status}</Badge>
            </div>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">{draft.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[300px]">
                  <div className="kb-markdown">
                    <ReactMarkdown>{draft.body_markdown}</ReactMarkdown>
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Evidence Summary Sidebar */}
          <div className="space-y-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Evidence Sources</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(evidenceCounts).map(([sourceType, count]) => {
                  const Icon = sourceTypeIcons[sourceType] || FileText;
                  const colorClass = sourceTypeColors[sourceType] || "bg-muted text-muted-foreground";
                  return (
                    <div
                      key={sourceType}
                      className="flex items-center justify-between gap-2 rounded-lg border p-3"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <div className={`rounded-md p-1.5 ${colorClass}`}>
                          <Icon className="h-4 w-4" />
                        </div>
                        <span className="text-sm truncate">{sourceType}</span>
                      </div>
                      <Badge variant="secondary" className="shrink-0">
                        {count}
                      </Badge>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium">Sections Covered</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {Object.entries(sectionCounts).map(([section, count]) => (
                    <div
                      key={section}
                      className="flex items-center justify-between gap-2 text-sm"
                    >
                      <span className="min-w-0 capitalize text-muted-foreground truncate">
                        {section.replace(/_/g, " ")}
                      </span>
                      <Badge variant="outline" className="text-xs shrink-0">
                        {count} units
                      </Badge>
                    </div>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <Button onClick={onNext} disabled={!draft} className="gap-2">
          Continue to Review
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
