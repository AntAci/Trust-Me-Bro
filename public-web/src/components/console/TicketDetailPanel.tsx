import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Ticket as TicketIcon, Tag, Layers, AlertCircle, Globe } from "lucide-react";
import { Ticket } from "@/lib/api";
import { TranscriptMessage } from "@/lib/mockData";
import { TranscriptViewer } from "@/components/console/TranscriptViewer";

interface TicketDetailPanelProps {
  ticket: Ticket | null;
  transcript: TranscriptMessage[];
  onEvidenceClick: (evidenceUnitId: string) => void;
}

export function TicketDetailPanel({
  ticket,
  transcript,
  onEvidenceClick,
}: TicketDetailPanelProps) {
  if (!ticket) {
    return (
      <Card className="h-[calc(100vh-180px)] min-h-[500px]">
        <CardContent className="flex h-full flex-col items-center justify-center text-center">
          <TicketIcon className="h-12 w-12 text-muted-foreground/30 mb-4" />
          <p className="text-sm font-medium text-muted-foreground">No ticket selected</p>
          <p className="text-xs text-muted-foreground/70 mt-1">
            Select a ticket from the list to view details
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-4 h-[calc(100vh-180px)] min-h-[500px]">
      {/* Ticket Header Card - Fixed height */}
      <Card className="shrink-0">
        <CardHeader className="pb-3 border-b">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg font-semibold leading-tight line-clamp-2">
                {ticket.subject}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1.5 flex items-center gap-1.5">
                <TicketIcon className="h-3 w-3" />
                Ticket {ticket.ticket_number}
              </p>
            </div>
            <Badge 
              variant={ticket.status === "Closed" ? "secondary" : "default"}
              className="shrink-0"
            >
              {ticket.status}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="pt-3 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {ticket.category && (
              <Badge variant="outline" className="text-[11px] gap-1">
                <Tag className="h-3 w-3" />
                {ticket.category}
              </Badge>
            )}
            {ticket.module && (
              <Badge variant="outline" className="text-[11px] gap-1">
                <Layers className="h-3 w-3" />
                {ticket.module}
              </Badge>
            )}
            <Badge variant="outline" className="text-[11px] gap-1">
              <AlertCircle className="h-3 w-3" />
              Priority: P2
            </Badge>
            <Badge variant="outline" className="text-[11px] gap-1">
              <Globe className="h-3 w-3" />
              Channel: Web
            </Badge>
          </div>
          <div className="rounded-lg border bg-muted/30 p-3 text-sm leading-relaxed">
            {ticket.description || "Customers reported intermittent timeouts while submitting payments through the resident portal. Issue confirmed after log review."}
          </div>
        </CardContent>
      </Card>

      {/* Transcript Card - Flexible height, takes remaining space */}
      <div className="flex-1 min-h-0">
        <TranscriptViewer
          transcript={transcript}
          onEvidenceClick={onEvidenceClick}
        />
      </div>
    </div>
  );
}
