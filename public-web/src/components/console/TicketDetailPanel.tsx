import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
      <Card className="h-full">
        <CardContent className="flex h-full items-center justify-center text-sm text-muted-foreground">
          Select a ticket to view details
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-base">
                {ticket.subject}
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Ticket {ticket.ticket_number}
              </p>
            </div>
            <Badge variant="secondary">{ticket.status}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {ticket.category && (
              <Badge variant="outline" className="text-[11px]">
                {ticket.category}
              </Badge>
            )}
            {ticket.module && (
              <Badge variant="outline" className="text-[11px]">
                {ticket.module}
              </Badge>
            )}
            <Badge variant="outline" className="text-[11px]">
              Priority: P2
            </Badge>
            <Badge variant="outline" className="text-[11px]">
              Channel: Web
            </Badge>
          </div>
          <div className="rounded-md border bg-muted/40 p-3 text-sm">
            Customers reported intermittent timeouts while submitting payments through the
            resident portal. Issue confirmed after log review.
          </div>
        </CardContent>
      </Card>

      <TranscriptViewer
        transcript={transcript}
        onEvidenceClick={onEvidenceClick}
      />
    </div>
  );
}
