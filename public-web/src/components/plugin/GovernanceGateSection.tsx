import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";

interface GovernanceGateSectionProps {
  reviewer: string;
  reviewNotes: string;
  draftStatus: "idle" | "generating" | "ready" | "approved" | "rejected";
  onReviewerChange: (value: string) => void;
  onReviewNotesChange: (value: string) => void;
  onApprove: () => void;
  onReject: () => void;
}

export function GovernanceGateSection({
  reviewer,
  reviewNotes,
  draftStatus,
  onReviewerChange,
  onReviewNotesChange,
  onApprove,
  onReject,
}: GovernanceGateSectionProps) {
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingAction, setPendingAction] = useState<"approve" | "reject" | null>(null);

  const openConfirm = (action: "approve" | "reject") => {
    setPendingAction(action);
    setConfirmOpen(true);
  };

  const handleConfirm = () => {
    if (pendingAction === "approve") onApprove();
    if (pendingAction === "reject") onReject();
    setConfirmOpen(false);
    setPendingAction(null);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Governance Gate</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Input
          value={reviewer}
          onChange={(event) => onReviewerChange(event.target.value)}
          placeholder="Reviewer name"
        />
        <Textarea
          value={reviewNotes}
          onChange={(event) => onReviewNotesChange(event.target.value)}
          placeholder="Optional notes"
          rows={3}
        />
        <div className="flex items-center gap-2">
          <Button
            className="flex-1"
            onClick={() => openConfirm("approve")}
            disabled={draftStatus !== "ready"}
          >
            Approve
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => openConfirm("reject")}
            disabled={draftStatus !== "ready"}
          >
            Reject
          </Button>
        </div>
      </CardContent>

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Governance Action</DialogTitle>
            <DialogDescription>
              {pendingAction === "approve"
                ? "I approve this draft for publication."
                : "I reject this draft and it will not be published."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleConfirm}>Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
