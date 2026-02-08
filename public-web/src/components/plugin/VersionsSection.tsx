import { History } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface VersionsSectionProps {
  currentVersion: number;
  onOpenVersions: () => void;
}

export function VersionsSection({ currentVersion, onOpenVersions }: VersionsSectionProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Version History</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">Current version</div>
          <Badge variant="secondary">v{currentVersion || 0}</Badge>
        </div>
        <Button variant="outline" className="w-full gap-2" onClick={onOpenVersions}>
          <History className="h-4 w-4" />
          View Version History
        </Button>
      </CardContent>
    </Card>
  );
}
