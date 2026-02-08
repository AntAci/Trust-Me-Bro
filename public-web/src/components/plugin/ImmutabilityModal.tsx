import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ImmutabilityModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ImmutabilityModal({ open, onOpenChange }: ImmutabilityModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Immutable Version Policy</DialogTitle>
          <DialogDescription>
            Published KB versions are locked for audit integrity. Updates must follow the
            governed workflow: new draft → human approval → publish as a new version (v2+).
          </DialogDescription>
        </DialogHeader>
        <div className="rounded-md border bg-muted/40 p-3 text-xs">
          Policy ID: <Badge variant="outline">POL-IMMUTABLE-VERSIONS</Badge>
        </div>
        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Understood</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
