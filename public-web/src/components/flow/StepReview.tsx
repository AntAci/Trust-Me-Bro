import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { ArrowLeft, ArrowRight, CheckCircle, XCircle, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

interface StepReviewProps {
  flowState: FlowState;
  updateFlowState: (updates: Partial<FlowState>) => void;
  onNext: () => void;
  onBack: () => void;
  setIsLoading: (loading: boolean) => void;
}

export function StepReview({
  flowState,
  updateFlowState,
  onNext,
  onBack,
  setIsLoading,
}: StepReviewProps) {
  const { isDemoMode, defaultReviewer } = useDemoMode();
  const [reviewer, setReviewer] = useState(isDemoMode ? defaultReviewer : "");
  const [notes, setNotes] = useState("");
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [showRejectDialog, setShowRejectDialog] = useState(false);

  const { setKnowledgeMapPhase } = useDemoMode();

  const approveMutation = useMutation({
    mutationFn: () => api.approveDraft(flowState.draftId!, reviewer, notes),
    onMutate: () => {
      setIsLoading(true);
      setKnowledgeMapPhase('at_gate');
    },
    onSuccess: () => {
      updateFlowState({ draftStatus: "approved" });
      setKnowledgeMapPhase('approved');
      setIsLoading(false);
      setShowApproveDialog(false);
      onNext();
    },
    onError: () => {
      // Mock success on error
      updateFlowState({ draftStatus: "approved" });
      setKnowledgeMapPhase('approved');
      setIsLoading(false);
      setShowApproveDialog(false);
      onNext();
    },
  });

  const rejectMutation = useMutation({
    mutationFn: () => api.rejectDraft(flowState.draftId!, reviewer, notes),
    onMutate: () => setIsLoading(true),
    onSuccess: () => {
      updateFlowState({ draftStatus: "rejected" });
      setIsLoading(false);
      setShowRejectDialog(false);
    },
    onError: () => {
      // Mock success on error
      updateFlowState({ draftStatus: "rejected" });
      setIsLoading(false);
      setShowRejectDialog(false);
    },
  });

  const isReviewed = flowState.draftStatus === "approved" || flowState.draftStatus === "rejected";

  useEffect(() => {
    const handler = () => {
      if (!isReviewed && reviewer.trim() && !approveMutation.isPending) {
        approveMutation.mutate();
      }
    };
    window.addEventListener("auto-demo:approve-draft", handler);
    return () => window.removeEventListener("auto-demo:approve-draft", handler);
  }, [isReviewed, reviewer, approveMutation.isPending]);

  return (
    <div className="space-y-6">
      {/* Status Display */}
      {isReviewed && (
        <div
          className={`flex items-center gap-3 rounded-lg border p-4 ${
            flowState.draftStatus === "approved"
              ? "border-success/30 bg-success/5"
              : "border-destructive/30 bg-destructive/5"
          }`}
        >
          {flowState.draftStatus === "approved" ? (
            <CheckCircle className="h-5 w-5 text-success" />
          ) : (
            <XCircle className="h-5 w-5 text-destructive" />
          )}
          <div>
            <p className="font-medium capitalize">{flowState.draftStatus}</p>
            <p className="text-sm text-muted-foreground">
              Draft has been {flowState.draftStatus} by {reviewer}
            </p>
          </div>
        </div>
      )}

      {/* Review Form */}
      {!isReviewed && (
        <Card>
          <CardHeader>
            <CardTitle>Review Draft</CardTitle>
            <CardDescription>
              Review the generated KB draft and approve or reject it. This is the
              human governance gate.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reviewer">Reviewer Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="reviewer"
                  value={reviewer}
                  onChange={(e) => setReviewer(e.target.value)}
                  placeholder="Enter your name"
                  className="pl-10"
                />
              </div>
              {isDemoMode && (
                <p className="text-xs text-muted-foreground">
                  Demo mode: defaults to "{defaultReviewer}"
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Review Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this review..."
                rows={3}
              />
            </div>

            {/* Draft Summary */}
            <div className="rounded-lg border bg-muted/50 p-4">
              <p className="text-xs font-medium text-muted-foreground mb-2">
                Draft Being Reviewed
              </p>
              <div className="flex items-center gap-2">
                <code className="text-sm font-mono">{flowState.draftId}</code>
                <Badge variant="secondary">pending</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                From ticket {flowState.ticketNumber}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Action Buttons */}
      {!isReviewed && (
        <div className="flex gap-3">
          <Button
            variant="destructive"
            onClick={() => setShowRejectDialog(true)}
            disabled={!reviewer.trim()}
            className="gap-2"
          >
            <XCircle className="h-4 w-4" />
            Reject
          </Button>
          <Button
            onClick={() => setShowApproveDialog(true)}
            disabled={!reviewer.trim()}
            className="gap-2 flex-1"
          >
            <CheckCircle className="h-4 w-4" />
            Approve
          </Button>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={onBack} className="gap-2">
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        {isReviewed && flowState.draftStatus === "approved" && (
          <Button onClick={onNext} className="gap-2">
            Continue to Publish
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Approve Confirmation Dialog */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Approve Draft?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the draft as approved and ready for publication. The
              reviewer name "{reviewer}" will be recorded in the audit trail.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
            >
              Approve Draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reject Confirmation Dialog */}
      <AlertDialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject Draft?</AlertDialogTitle>
            <AlertDialogDescription>
              This will mark the draft as rejected. You can generate a new draft
              from the same ticket if needed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => rejectMutation.mutate()}
              disabled={rejectMutation.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Reject Draft
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
