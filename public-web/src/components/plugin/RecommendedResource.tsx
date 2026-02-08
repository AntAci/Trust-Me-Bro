import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface RecommendedResourceProps {
  action: string;
  confidence: number;
  reasons: string[];
}

export function RecommendedResource({
  action,
  confidence,
  reasons,
}: RecommendedResourceProps) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Recommended Resource</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium">Best next action</div>
          <Badge variant="secondary" className="text-xs">
            {action}
          </Badge>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Confidence</div>
          <div className="mt-1 h-2 w-full rounded-full bg-muted">
            <div
              className="h-2 rounded-full bg-primary"
              style={{ width: `${confidence}%` }}
            />
          </div>
          <div className="mt-1 text-[10px] text-muted-foreground">
            {confidence}% confidence
          </div>
        </div>
        <div className="space-y-1">
          {reasons.map((reason) => (
            <div key={reason} className="text-xs text-muted-foreground">
              • {reason}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
