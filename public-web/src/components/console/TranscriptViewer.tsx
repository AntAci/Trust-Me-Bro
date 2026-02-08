import { MessageSquare } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TranscriptMessage } from "@/lib/mockData";
import { cn } from "@/lib/utils";

interface TranscriptViewerProps {
  transcript: TranscriptMessage[];
  onEvidenceClick: (evidenceUnitId: string) => void;
}

export function TranscriptViewer({ transcript, onEvidenceClick }: TranscriptViewerProps) {
  const highlightEvidence = true;

  return (
    <Card className="flex flex-col h-full min-h-[300px]">
      <CardHeader className="pb-3 border-b bg-muted/30">
        <CardTitle className="flex items-center gap-2 text-sm font-medium">
          <MessageSquare className="h-4 w-4 text-primary" />
          Transcript
          {transcript.length > 0 && (
            <Badge variant="secondary" className="ml-auto text-[10px]">
              {transcript.length} messages
            </Badge>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4">
            {transcript.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <MessageSquare className="h-10 w-10 text-muted-foreground/30 mb-3" />
                <p className="text-sm text-muted-foreground">
                  No transcript loaded.
                </p>
                <p className="text-xs text-muted-foreground/70 mt-1">
                  Select a ticket or load the demo scenario.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
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
                          "max-w-[80%] rounded-2xl px-4 py-3 text-left text-sm shadow-md transition-all duration-200",
                          isAgent
                            ? "bg-primary text-primary-foreground hover:bg-primary/90"
                            : "bg-card border border-border hover:border-primary/30",
                          highlightEvidence && isEvidence && "ring-2 ring-primary/50 bg-primary/5",
                          message.evidenceUnitId && "cursor-pointer hover:scale-[1.02]",
                          !message.evidenceUnitId && "cursor-default"
                        )}
                      >
                        <div className={cn(
                          "flex items-center gap-2 text-[11px] font-medium uppercase tracking-wide mb-1.5",
                          isAgent ? "text-primary-foreground/80" : "text-muted-foreground"
                        )}>
                          <span>{message.speaker || message.role}</span>
                          <span className="opacity-50">•</span>
                          <span>{message.timestamp}</span>
                          {highlightEvidence && isEvidence && (
                            <Badge 
                              variant="secondary" 
                              className={cn(
                                "text-[9px] uppercase ml-1",
                                isAgent ? "bg-white/20 text-white" : "bg-primary/10 text-primary"
                              )}
                            >
                              Evidence
                            </Badge>
                          )}
                        </div>
                        <p className="leading-relaxed">{message.text}</p>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
