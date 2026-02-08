import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, BookCheck, Loader2, Network, History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { api } from "@/lib/api";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { FlowState } from "@/pages/GuidedFlow";
import { TrustShockButton } from "./TrustShockButton";
import { useToast } from "@/hooks/use-toast";

interface StepPublishProps {
  flowState: FlowState;
  updateFlowState: (updates: Partial<FlowState>) => void;
  onNext: () => void;
  onBack: () => void;
  setIsLoading: (loading: boolean) => void;
}

export function StepPublish({
  flowState,
  updateFlowState,
  onNext,
  onBack,
  setIsLoading,
}: StepPublishProps) {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isDemoMode, defaultReviewer, setKnowledgeMapPhase, autoDemoStatus } = useDemoMode();
  const [reviewer, setReviewer] = useState(isDemoMode ? defaultReviewer : "");
  const [changeNote, setChangeNote] = useState("Initial publication");
  const [showPublishDialog, setShowPublishDialog] = useState(false);

  const publishMutation = useMutation({
    mutationFn: () =>
      api.publishDraft(flowState.draftId!, reviewer, changeNote),
    onMutate: () => {
      setIsLoading(true);
      setKnowledgeMapPhase('publishing_v1');
    },
    onSuccess: (data) => {
      updateFlowState({
        kbArticleId: data.kb_article_id,
        currentVersion: data.version,
      });
      setIsLoading(false);
      setShowPublishDialog(false);
      if (autoDemoStatus === "running") {
        onNext();
      }
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Publish failed",
        description: "Make sure the draft is approved and the API server is running.",
      });
      setIsLoading(false);
      setShowPublishDialog(false);
    },
  });

  const isPublished = !!flowState.kbArticleId;

  useEffect(() => {
    const handler = () => {
      if (!isPublished && reviewer.trim() && !publishMutation.isPending && flowState.draftStatus === "approved") {
        publishMutation.mutate();
      }
    };
    window.addEventListener("auto-demo:publish-v1", handler);
    return () => window.removeEventListener("auto-demo:publish-v1", handler);
  }, [isPublished, reviewer, publishMutation.isPending, flowState.draftStatus]);

  return (
    <div className="space-y-6">
      {/* Published Status */}
      {isPublished && (
        <div className="space-y-3">
          <div className="flex items-center gap-3 rounded-lg border border-success/30 bg-success/5 p-4 animate-reveal">
            <BookCheck className="h-5 w-5 text-success" />
            <div className="flex-1">
              <p className="font-medium">Published Successfully!</p>
              <p className="text-sm text-muted-foreground">
                KB Article is now live in the knowledge base
              </p>
            </div>
            <Badge className="bg-success/10 text-success hover:bg-success/20 animate-pulse-once">
              v{flowState.currentVersion}
            </Badge>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={onNext} className="gap-2">
              Continue to Update (v2)
              <ArrowRight className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => navigate(`/provenance?kb_article_id=${flowState.kbArticleId}`)}
            >
              <Network className="h-4 w-4" />
              View Provenance
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => navigate(`/versions?kb_article_id=${flowState.kbArticleId}`)}
            >
              <History className="h-4 w-4" />
              View Versions
            </Button>
          </div>
        </div>
      )}

      {/* Article Info (after publish) */}
      {isPublished && (
        <Card className="animate-slide-in-up">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg">Published Article</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-lg border bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground mb-1">Article ID</p>
                <code className="text-sm font-mono id-reveal">{flowState.kbArticleId}</code>
              </div>
              <div className="rounded-lg border bg-muted/50 p-3">
                <p className="text-xs text-muted-foreground mb-1">Version</p>
                <div className="flex items-center gap-2">
                  <span className="text-lg font-bold">v{flowState.currentVersion}</span>
                  <Badge variant="secondary" className="text-xs">
                    Initial
                  </Badge>
                </div>
              </div>
            </div>
            <div className="rounded-lg border bg-muted/50 p-3">
              <p className="text-xs text-muted-foreground mb-1">Source</p>
              <p className="text-sm">
                From draft <code className="font-mono">{flowState.draftId}</code> →
                Ticket <code className="font-mono">{flowState.ticketNumber}</code>
              </p>
            </div>

            {/* Trust Shock Button */}
            <div className="pt-2 border-t">
              <TrustShockButton version={1} onNavigateToV2={onNext} />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Publish Form */}
      {!isPublished && (
        <Card>
          <CardHeader>
            <CardTitle>Publish KB Article</CardTitle>
            <CardDescription>
              Create a new Knowledge Base article from the approved draft. This
              will be version 1.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="publisher">Publisher Name</Label>
              <Input
                id="publisher"
                value={reviewer}
                onChange={(e) => setReviewer(e.target.value)}
                placeholder="Enter your name"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">Change Note</Label>
              <Input
                id="note"
                value={changeNote}
                onChange={(e) => setChangeNote(e.target.value)}
                placeholder="Initial publication"
              />
            </div>

            {/* Draft Summary */}
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Draft to Publish
              </p>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono">{flowState.draftId}</code>
                <Badge variant="default" className="bg-success/10 text-success">
                  approved
                </Badge>
              </div>
            </div>

            <Button
              onClick={() => setShowPublishDialog(true)}
              disabled={
                !reviewer.trim() ||
                publishMutation.isPending ||
                flowState.draftStatus !== "approved"
              }
              className="w-full gap-2"
              size="lg"
            >
              {publishMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <BookCheck className="h-4 w-4" />
              )}
              Publish as v1
            </Button>
            {flowState.draftStatus !== "approved" && (
              <p className="text-xs text-muted-foreground">
                You can only publish after the draft is approved (Step 3).
              </p>
            )}
          </CardContent>
        </Card>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        {isPublished && (
          <Button onClick={onNext} variant="outline" className="gap-2">
            Continue to Update (v2)
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Publish Confirmation Dialog */}
      <AlertDialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Publish KB Article?</AlertDialogTitle>
            <AlertDialogDescription>
              This will create a new published Knowledge Base article (v1). The
              article will be live and traceable back to its source evidence.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => publishMutation.mutate()}
              disabled={publishMutation.isPending}
            >
              Publish Article
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
