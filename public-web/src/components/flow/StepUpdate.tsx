import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowUpCircle, History, Loader2, Eye, Network, Lock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { api, ArticleVersion } from "@/lib/api";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { FlowState } from "@/pages/GuidedFlow";
import { TrustShockButton } from "./TrustShockButton";
import { cn } from "@/lib/utils";

interface StepUpdateProps {
  flowState: FlowState;
  updateFlowState: (updates: Partial<FlowState>) => void;
  setIsLoading: (loading: boolean) => void;
}

// Mock versions for when API is unavailable
const createMockVersions = (currentVersion: number): ArticleVersion[] => {
  const versions: ArticleVersion[] = [];
  for (let i = 1; i <= currentVersion; i++) {
    versions.push({
      version_id: `ver-${i}`,
      kb_article_id: "kb-001",
      version: i,
      source_draft_id: `draft-00${i}`,
      body_markdown: `# Version ${i} Content`,
      title: "Payment Processing Timeout Error Resolution",
      reviewer: i === 1 ? "Demo" : "Demo (Update)",
      change_note: i === 1 ? "Initial publication" : `Updated with new resolution steps (v${i})`,
      is_rollback: false,
      created_at: new Date(Date.now() - (currentVersion - i) * 3600000).toISOString(),
    });
  }
  return versions;
};

export function StepUpdate({
  flowState,
  updateFlowState,
  setIsLoading,
}: StepUpdateProps) {
  const navigate = useNavigate();
  const { isDemoMode, defaultReviewer, setKnowledgeMapPhase } = useDemoMode();
  const [reviewer, setReviewer] = useState(isDemoMode ? defaultReviewer : "");
  const [changeNote, setChangeNote] = useState("Updated with additional resolution steps");
  const [showUpdateDialog, setShowUpdateDialog] = useState(false);

  // Fetch version history
  const { data: versions, refetch: refetchVersions } = useQuery({
    queryKey: ["versions", flowState.kbArticleId],
    queryFn: () => api.getArticleVersions(flowState.kbArticleId!),
    enabled: !!flowState.kbArticleId,
    retry: 1,
  });

  const displayVersions = versions || createMockVersions(flowState.currentVersion || 1);

  const publishUpdateMutation = useMutation({
    mutationFn: () => {
      if (!flowState.kbArticleId || !flowState.ticketId) {
        return Promise.reject(new Error("Missing article or ticket"));
      }
      return api.publishV2Demo(flowState.kbArticleId, flowState.ticketId, reviewer, changeNote);
    },
    onMutate: () => {
      setIsLoading(true);
      setKnowledgeMapPhase('publishing_v2');
    },
    onSuccess: (data) => {
      updateFlowState({ currentVersion: data.version, draftId: data.latest_draft_id });
      refetchVersions();
      setIsLoading(false);
      setShowUpdateDialog(false);
    },
    onError: () => {
      // Mock success on error
      const newVersion = (flowState.currentVersion || 1) + 1;
      updateFlowState({ currentVersion: newVersion });
      setIsLoading(false);
      setShowUpdateDialog(false);
    },
  });

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  useEffect(() => {
    const handler = () => {
      if (!reviewer.trim() || publishUpdateMutation.isPending) return;
      if (!flowState.kbArticleId || !flowState.ticketId) return;
      publishUpdateMutation.mutate();
    };
    window.addEventListener("auto-demo:publish-v2", handler);
    return () => window.removeEventListener("auto-demo:publish-v2", handler);
  }, [reviewer, publishUpdateMutation.isPending, flowState.kbArticleId, flowState.ticketId]);

  return (
    <div className="space-y-6">
      {/* Explanation Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-4">
          <h3 className="font-semibold mb-2">Self-Updating Knowledge Engine</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• New resolved cases generate new drafts</li>
            <li>• Approved drafts publish as new versions (v2, v3, ...)</li>
            <li>• Every version is traceable to its source evidence</li>
          </ul>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Publish Update Card */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowUpCircle className="h-5 w-5 text-primary" />
              Publish Update
            </CardTitle>
            <CardDescription>
              Publish version {(flowState.currentVersion || 1) + 1} of this KB article
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="update-reviewer">Reviewer Name</Label>
              <Input
                id="update-reviewer"
                value={reviewer}
                onChange={(e) => setReviewer(e.target.value)}
                placeholder="Enter your name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="update-note">Change Note</Label>
              <Input
                id="update-note"
                value={changeNote}
                onChange={(e) => setChangeNote(e.target.value)}
                placeholder="Describe what changed"
              />
            </div>

            <Button
              onClick={() => setShowUpdateDialog(true)}
              disabled={!reviewer.trim() || publishUpdateMutation.isPending}
              className="w-full gap-2"
            >
              {publishUpdateMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUpCircle className="h-4 w-4" />
              )}
              Publish v{(flowState.currentVersion || 1) + 1}
            </Button>
          </CardContent>
        </Card>

        {/* Version Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              Version History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[200px]">
              <div className="space-y-3">
                {displayVersions.map((version) => (
                  <div
                    key={version.version_id}
                    className={cn(
                      "flex items-start gap-3 rounded-lg border p-3 transition-all",
                      version.version === flowState.currentVersion && "animate-slide-in-up"
                    )}
                  >
                    <Badge
                      variant={
                        version.version === flowState.currentVersion
                          ? "default"
                          : "secondary"
                      }
                      className={cn(
                        "gap-1",
                        version.version < (flowState.currentVersion || 1) && "opacity-60"
                      )}
                    >
                      {version.version < (flowState.currentVersion || 1) && (
                        <Lock className="h-2.5 w-2.5" />
                      )}
                      v{version.version}
                    </Badge>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {version.change_note || "No note"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        by {version.reviewer} • {formatDate(version.created_at)}
                      </p>
                    </div>
                    {version.version === flowState.currentVersion && (
                      <Badge variant="outline" className="text-xs shrink-0">
                        Current
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Trust Shock Demo */}
      {flowState.currentVersion && flowState.currentVersion >= 1 && (
        <Card className="border-warning/20 bg-warning/5">
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-medium text-sm">Test Immutability</h4>
                <p className="text-xs text-muted-foreground">
                  Attempt to overwrite a published version
                </p>
              </div>
              <TrustShockButton version={flowState.currentVersion} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="flex gap-3">
        <Button
          variant="outline"
          onClick={() => navigate("/versions")}
          className="gap-2"
        >
          <Eye className="h-4 w-4" />
          View Full History
        </Button>
        <Button
          variant="outline"
          onClick={() => navigate(`/provenance?kb_article_id=${flowState.kbArticleId}`)}
          className="gap-2"
        >
          <Network className="h-4 w-4" />
          View Provenance
        </Button>
      </div>

      {/* Update Confirmation Dialog */}
      <AlertDialog open={showUpdateDialog} onOpenChange={setShowUpdateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish Update?</AlertDialogTitle>
            <AlertDialogDescription>
              This will publish version {(flowState.currentVersion || 1) + 1} of
              the KB article. The previous version will be preserved in the
              version history.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => publishUpdateMutation.mutate()}
              disabled={publishUpdateMutation.isPending}
            >
              Publish Update
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
