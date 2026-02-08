import { Network } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EvidenceSummary } from "@/lib/mockData";

interface ProvenanceSectionProps {
  evidenceSummary: EvidenceSummary;
  onOpenProvenance: () => void;
}

export function ProvenanceSection({ evidenceSummary, onOpenProvenance }: ProvenanceSectionProps) {
  const sourceCount = Object.keys(evidenceSummary.bySourceType).length;

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Provenance (Proof)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-xs text-muted-foreground">
          {evidenceSummary.total} evidence units from {sourceCount} sources
        </div>
        <div className="h-20 rounded-md border bg-muted/30 flex items-center justify-center text-xs text-muted-foreground">
          Trace map snapshot (read-only)
        </div>
        <Button variant="outline" className="w-full gap-2" onClick={onOpenProvenance}>
          <Network className="h-4 w-4" />
          View Full Provenance
        </Button>
      </CardContent>
    </Card>
  );
}
