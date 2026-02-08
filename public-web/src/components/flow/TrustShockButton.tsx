import { useState } from "react";
import { ShieldX, Lock, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface TrustShockButtonProps {
  version: number;
  onNavigateToV2?: () => void;
}

export function TrustShockButton({ version, onNavigateToV2 }: TrustShockButtonProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showBlockedDialog, setShowBlockedDialog] = useState(false);
  const { toast } = useToast();

  const handleAttemptOverwrite = async () => {
    setIsProcessing(true);
    
    // Brief "processing" state to build tension
    await new Promise((resolve) => setTimeout(resolve, 400));
    
    setIsProcessing(false);
    setShowBlockedDialog(true);
    
    // Also show a toast for emphasis
    toast({
      title: "Immutability preserved",
      description: "No changes were recorded to the knowledge base.",
      duration: 3000,
    });
  };

  const handleCreateV2 = () => {
    setShowBlockedDialog(false);
    onNavigateToV2?.();
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={handleAttemptOverwrite}
        disabled={isProcessing}
        className="gap-2 border-warning/50 text-warning hover:bg-warning/10 hover:text-warning"
      >
        {isProcessing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <ShieldX className="h-4 w-4" />
        )}
        Attempt overwrite v{version} (demo)
      </Button>

      <Dialog open={showBlockedDialog} onOpenChange={setShowBlockedDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10">
              <Lock className="h-6 w-6 text-destructive" />
            </div>
            <DialogTitle className="text-center">
              Blocked: Append-Only Knowledge Base
            </DialogTitle>
            <DialogDescription className="text-center">
              Published versions can&apos;t be overwritten. Create v{version + 1} to apply 
              changes with a full audit trail.
            </DialogDescription>
          </DialogHeader>
          
          <div className="rounded-lg border bg-muted/50 p-3 my-2">
            <p className="text-xs text-muted-foreground text-center">
              v{version} remains locked and immutable. All provenance edges are preserved.
            </p>
          </div>

          <DialogFooter className="sm:justify-center gap-2">
            <Button variant="outline" onClick={() => setShowBlockedDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateV2} className="gap-2">
              Create v{version + 1} instead
              <ArrowRight className="h-4 w-4" />
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
