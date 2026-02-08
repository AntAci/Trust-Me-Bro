import { useQuery } from "@tanstack/react-query";
import { Shield, FileText, MessageSquare, Code, BookOpen, Network, Hash, User } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { AnimatedBadge } from "@/components/ui/animated-badge";
import { api } from "@/lib/api";
import { FlowState } from "@/pages/GuidedFlow";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

interface TrustPanelProps {
  flowState: FlowState;
}

const sourceTypeIcons: Record<string, React.ElementType> = {
  TICKET: FileText,
  CONVERSATION: MessageSquare,
  SCRIPT: Code,
  PLACEHOLDER: BookOpen,
};

// Mock provenance data
const mockProvenance = {
  kb_article_id: "kb-001",
  latest_draft_id: "draft-001",
  grouped: [
    { section_label: "problem", source_type: "TICKET", count: 2 },
    { section_label: "symptoms", source_type: "TICKET", count: 2 },
    { section_label: "symptoms", source_type: "CONVERSATION", count: 3 },
    { section_label: "root_cause", source_type: "TICKET", count: 1 },
    { section_label: "root_cause", source_type: "CONVERSATION", count: 3 },
    { section_label: "resolution_steps", source_type: "CONVERSATION", count: 4 },
    { section_label: "resolution_steps", source_type: "SCRIPT", count: 1 },
    { section_label: "placeholders_needed", source_type: "SCRIPT", count: 2 },
    { section_label: "placeholders_needed", source_type: "PLACEHOLDER", count: 3 },
  ],
  total_edges: 21,
};

export function TrustPanel({ flowState }: TrustPanelProps) {
  const [prevVersion, setPrevVersion] = useState<number | null>(null);
  const [versionPulse, setVersionPulse] = useState(false);
  const [idRevealed, setIdRevealed] = useState(false);

  // Fetch provenance when article is published
  const { data: provenance, isLoading } = useQuery({
    queryKey: ["provenance", flowState.kbArticleId],
    queryFn: () => api.getProvenance(flowState.kbArticleId!),
    enabled: !!flowState.kbArticleId,
    retry: 1,
  });

  const displayProvenance = provenance || (flowState.kbArticleId ? mockProvenance : null);

  // Calculate edge count based on flow state
  const calculateEdgeCount = () => {
    let count = 0;
    if (flowState.ticketId) count += 1;
    if (flowState.draftId) count += 8;
    if (flowState.draftStatus === "approved") count += 2;
    if (flowState.kbArticleId) count += 6;
    if (flowState.currentVersion && flowState.currentVersion > 1) count += 4;
    return count;
  };

  const edgeCount = displayProvenance?.total_edges || calculateEdgeCount();

  // Calculate source breakdown
  const sourceBreakdown = displayProvenance?.grouped.reduce(
    (acc, item) => {
      acc[item.source_type] = (acc[item.source_type] || 0) + item.count;
      return acc;
    },
    {} as Record<string, number>
  ) || {};

  // Detect version changes and trigger pulse
  useEffect(() => {
    if (flowState.currentVersion !== prevVersion) {
      if (prevVersion !== null) {
        setVersionPulse(true);
        setTimeout(() => setVersionPulse(false), 300);
      }
      setPrevVersion(flowState.currentVersion);
    }
  }, [flowState.currentVersion, prevVersion]);

  // Reveal KB Article ID with animation
  useEffect(() => {
    if (flowState.kbArticleId && !idRevealed) {
      setIdRevealed(true);
    } else if (!flowState.kbArticleId) {
      setIdRevealed(false);
    }
  }, [flowState.kbArticleId, idRevealed]);

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield className="h-4 w-4 text-primary" />
          Trust Signals
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Article Info */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Hash className="h-3 w-3" />
              Article ID
            </span>
            {flowState.kbArticleId ? (
              <code className={cn(
                "text-xs font-mono truncate max-w-[120px]",
                idRevealed && "id-reveal"
              )}>
                {flowState.kbArticleId}
              </code>
            ) : (
              <span className="text-xs text-muted-foreground">Not published</span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">Version</span>
            {flowState.currentVersion ? (
              <AnimatedBadge 
                variant="default" 
                className="text-xs"
                pulse={versionPulse}
              >
                v{flowState.currentVersion}
              </AnimatedBadge>
            ) : flowState.draftId ? (
              <Badge variant="secondary" className="text-xs">
                DRAFT
              </Badge>
            ) : (
              <span className="text-xs text-muted-foreground">—</span>
            )}
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <User className="h-3 w-3" />
              Reviewer
            </span>
            <span className="text-xs">Demo</span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground flex items-center gap-1">
              <Network className="h-3 w-3" />
              Provenance Edges
            </span>
            {isLoading ? (
              <Skeleton className="h-4 w-8" />
            ) : (
              <Badge variant="outline" className={cn("text-xs", edgeCount > 0 && "counter-glow")}>
                <AnimatedCounter value={edgeCount} duration={300} />
              </Badge>
            )}
          </div>
        </div>

        {/* Source Breakdown */}
        {Object.keys(sourceBreakdown).length > 0 && (
          <div className="space-y-2 pt-2 border-t">
            <p className="text-xs font-medium text-muted-foreground">
              Source Breakdown
            </p>
            {Object.entries(sourceBreakdown).map(([sourceType, count], idx) => {
              const Icon = sourceTypeIcons[sourceType] || FileText;
              const totalEdges = displayProvenance?.total_edges || edgeCount;
              const percentage = totalEdges > 0 ? (count / totalEdges) * 100 : 0;
              return (
                <div 
                  key={sourceType} 
                  className="space-y-1"
                  style={{ animationDelay: `${idx * 50}ms` }}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1">
                      <Icon className="h-3 w-3" />
                      {sourceType}
                    </span>
                    <span className="text-muted-foreground">
                      <AnimatedCounter value={count} duration={400} />
                    </span>
                  </div>
                  <Progress value={percentage} className="h-1 progress-animate" />
                </div>
              );
            })}
          </div>
        )}

        {/* Helper Text */}
        <div className="pt-2 border-t space-y-2">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            RLM builds each section from evidence, then verifies traceability.
          </p>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Every claim is linked to evidence. Click Provenance to audit.
          </p>
          <p className="text-[10px] text-primary/80 leading-relaxed font-medium">
            Append-only lineage. Every node is auditable.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
