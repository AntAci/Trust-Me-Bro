import { MessageSquare } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { TranscriptMessage } from "@/lib/mockData";
import { cn } from "@/lib/utils";

interface TranscriptViewerProps {
  transcript: TranscriptMessage[];
  onEvidenceClick: (evidenceUnitId: string) => void;
}

export function TranscriptViewer({ transcript, onEvidenceClick }: TranscriptViewerProps) {
  const highlightEvidence = true;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          Transcript
        </div>
      </div>

      <ScrollArea className="h-[520px] rounded-lg border bg-muted/20 p-4">
        {transcript.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No transcript loaded. Select a ticket or load the demo scenario.
          </div>
        ) : (
          <div className="space-y-3">
            {transcript.map((message) => {
              const isAgent = message.role === "agent";
              const isEvidence = Boolean(message.evidenceUnitId);
              return (
                <div
                  key={message.id}
                  className={cn(
                    "flex",
                    isAgent ? "justify-end" : "justify-start"
                  )}
                >
                  <button
                    type="button"
                    onClick={() =>
                      message.evidenceUnitId && onEvidenceClick(message.evidenceUnitId)
                    }
                    disabled={!message.evidenceUnitId}
                    className={cn(
                      "max-w-[70%] rounded-xl px-3 py-2 text-left text-sm shadow-sm transition-colors",
                      isAgent
                        ? "bg-primary text-primary-foreground"
                        : "bg-background text-foreground border",
                      highlightEvidence && isEvidence && "ring-1 ring-primary/40 bg-primary/5 text-foreground",
                      !message.evidenceUnitId && "cursor-default"
                    )}
                  >
                    <div className="flex items-center gap-2 text-[10px] uppercase tracking-wide text-muted-foreground">
                      <span className={cn(isAgent && "text-white")}>
                        {message.speaker || message.role}
                      </span>
                      <span>•</span>
                      <span className={cn(isAgent && "text-white")}>{message.timestamp}</span>
                      {highlightEvidence && isEvidence && (
                        <Badge variant="secondary" className="text-[9px] uppercase">
                          EU
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1">{message.text}</p>
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
