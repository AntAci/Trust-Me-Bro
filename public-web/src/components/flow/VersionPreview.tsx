import { History, ExternalLink, ArrowRight, Lock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FlowState } from "@/pages/GuidedFlow";
import { cn } from "@/lib/utils";

interface VersionPreviewProps {
  flowState: FlowState;
  onOpenFullView: () => void;
}

// Mock change summary data
const getChangeSummary = (version: number) => {
  if (version === 1) {
    return {
      sections: ["Problem", "Symptoms", "Root Cause", "Resolution Steps"],
      changeNote: "Initial publication",
    };
  }
  return {
    added: ["Circuit breaker pattern", "Retry logic steps"],
    updated: ["Root cause section", "Resolution steps"],
    removed: [],
    changeNote: "Added retry logic and circuit breaker documentation",
  };
};

export function VersionPreview({ flowState, onOpenFullView }: VersionPreviewProps) {
  const hasVersion = !!flowState.kbArticleId;
  const currentVersion = flowState.currentVersion || 0;
  const changeSummary = getChangeSummary(currentVersion);

  return (
    <Card className="overflow-hidden">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            Version Preview
          </CardTitle>
          <Button 
            variant="ghost" 
            size="sm" 
            onClick={onOpenFullView}
            className="h-7 text-xs gap-1"
          >
            <ExternalLink className="h-3 w-3" />
            Full View
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0">
        {hasVersion ? (
          <div className="space-y-3">
            {/* Version badges timeline */}
            <div className="flex items-center gap-2">
              {Array.from({ length: currentVersion }, (_, i) => i + 1).map((v, idx) => (
                <div key={v} className="flex items-center">
                  <Badge 
                    variant={v === currentVersion ? "default" : "secondary"}
                    className={cn(
                      "gap-1",
                      v < currentVersion && "opacity-60"
                    )}
                  >
                    {v < currentVersion && <Lock className="h-2.5 w-2.5" />}
                    v{v}
                  </Badge>
                  {idx < currentVersion - 1 && (
                    <ArrowRight className="h-3 w-3 mx-1 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>

            {/* Change note */}
            <div className="text-xs text-muted-foreground">
              {changeSummary.changeNote}
            </div>

            {/* Changed sections (for v2+) */}
            {currentVersion > 1 && "added" in changeSummary && (
              <div className="flex flex-wrap gap-1.5">
                {changeSummary.added.map((item) => (
                  <Badge key={item} variant="outline" className="text-[10px] bg-success/10 text-success border-success/30">
                    + {item}
                  </Badge>
                ))}
                {changeSummary.updated.map((item) => (
                  <Badge key={item} variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/30">
                    ↻ {item}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="py-4 text-center text-sm text-muted-foreground">
            <p>Version history appears after publishing</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
