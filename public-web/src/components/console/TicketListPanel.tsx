import { useMemo, useState } from "react";
import { Search, Sparkles, Ticket as TicketIcon } from "lucide-react";
import { Ticket } from "@/lib/api";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TicketListPanelProps {
  tickets: Ticket[];
  isLoading: boolean;
  selectedTicket: Ticket | null;
  onSelectTicket: (ticket: Ticket) => void;
  onLoadDemoScenario: () => void;
}

export function TicketListPanel({
  tickets,
  isLoading,
  selectedTicket,
  onSelectTicket,
  onLoadDemoScenario,
}: TicketListPanelProps) {
  const [search, setSearch] = useState("");

  const filteredTickets = useMemo(() => {
    if (!search.trim()) return tickets;
    return tickets.filter(
      (ticket) =>
        ticket.ticket_number.toLowerCase().includes(search.toLowerCase()) ||
        ticket.subject.toLowerCase().includes(search.toLowerCase())
    );
  }, [tickets, search]);

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-semibold">Ticket Queue</CardTitle>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            className="gap-2"
            onClick={onLoadDemoScenario}
          >
            <Sparkles className="h-4 w-4" />
            Load Demo Scenario
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 overflow-hidden">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search tickets..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="pl-9"
          />
        </div>

        <ScrollArea className="h-[calc(100vh-320px)] min-h-[360px] rounded-lg border">
          {isLoading ? (
            <div className="space-y-2 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="flex items-center gap-3 p-3">
                  <Skeleton className="h-10 w-10 rounded-lg" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-24" />
                    <Skeleton className="h-3 w-40" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="flex h-full items-center justify-center p-6 text-sm text-muted-foreground">
              No tickets found
            </div>
          ) : (
            <div className="p-2">
              {filteredTickets.map((ticket) => (
                <button
                  key={ticket.ticket_id}
                  onClick={() => onSelectTicket(ticket)}
                  className={`flex w-full items-start gap-3 rounded-lg p-3 text-left transition-colors hover:bg-accent overflow-hidden ${
                    selectedTicket?.ticket_id === ticket.ticket_id
                      ? "bg-primary/10 ring-1 ring-primary"
                      : ""
                  }`}
                >
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted">
                    <TicketIcon className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold">
                        {ticket.ticket_number}
                      </span>
                      <Badge variant="secondary" className="text-[10px]">
                        {ticket.status}
                      </Badge>
                      {ticket.category && (
                        <Badge variant="outline" className="text-[10px]">
                          {ticket.category}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-2 break-words">
                      {ticket.subject}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </CardContent>
    </Card>
  );
}
