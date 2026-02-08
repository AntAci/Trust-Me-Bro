import { useEffect, useState } from "react";
import { Search, Ticket as TicketIcon, ArrowRight, Sparkles } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { api, Ticket } from "@/lib/api";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { FlowState } from "@/pages/GuidedFlow";

interface StepSelectTicketProps {
  flowState: FlowState;
  updateFlowState: (updates: Partial<FlowState>) => void;
  onNext: () => void;
  setIsLoading: (loading: boolean) => void;
}

// Mock tickets for when API is unavailable
const mockTickets: Ticket[] = [
  { ticket_id: "1", ticket_number: "CS-38908386", subject: "Unable to process payment - timeout error", status: "Resolved", category: "Payments" },
  { ticket_id: "2", ticket_number: "CS-38908387", subject: "Login issues after password reset", status: "Resolved", category: "Authentication" },
  { ticket_id: "3", ticket_number: "CS-38908388", subject: "Dashboard not loading data correctly", status: "Resolved", category: "UI/UX" },
  { ticket_id: "4", ticket_number: "CS-38908389", subject: "API rate limiting errors", status: "Resolved", category: "API" },
  { ticket_id: "5", ticket_number: "CS-38908390", subject: "Email notifications not sending", status: "Resolved", category: "Notifications" },
];

export function StepSelectTicket({
  flowState,
  updateFlowState,
  onNext,
  setIsLoading,
}: StepSelectTicketProps) {
  const { isDemoMode, defaultTicketId, autoDemoStatus } = useDemoMode();
  const [search, setSearch] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(
    isDemoMode
      ? mockTickets.find((t) => t.ticket_number === defaultTicketId) || null
      : null
  );

  const { data: tickets, isLoading: ticketsLoading, error } = useQuery({
    queryKey: ["tickets", search],
    queryFn: () => api.getTickets({ limit: 50, search: search || undefined }),
    retry: 1,
    staleTime: 30000,
  });

  const displayTickets = tickets || (error ? mockTickets : []);
  const filteredTickets = displayTickets.filter(
    (t) =>
      t.ticket_number.toLowerCase().includes(search.toLowerCase()) ||
      t.subject.toLowerCase().includes(search.toLowerCase())
  );

  const handleSelectTicket = (ticket: Ticket) => {
    setSelectedTicket(ticket);
    updateFlowState({
      ticketId: ticket.ticket_id,
      ticketNumber: ticket.ticket_number,
    });
    if (autoDemoStatus === "running") {
      onNext();
    }
  };

  const handleUseDemoTicket = () => {
    const demoTicket = displayTickets.find((t) => t.ticket_number === defaultTicketId);
    if (demoTicket) {
      handleSelectTicket(demoTicket);
    } else {
      // Create a mock demo ticket if not found
      const mockDemo: Ticket = {
        ticket_id: defaultTicketId,
        ticket_number: defaultTicketId,
        subject: "Unable to process payment - timeout error",
        status: "Resolved",
        category: "Payments",
      };
      handleSelectTicket(mockDemo);
    }
  };

  const handleNext = () => {
    if (selectedTicket) {
      onNext();
    }
  };

  useEffect(() => {
    if (!isDemoMode) return;
    const handler = () => handleUseDemoTicket();
    window.addEventListener("auto-demo:select-ticket", handler);
    return () => window.removeEventListener("auto-demo:select-ticket", handler);
  }, [isDemoMode, displayTickets, defaultTicketId]);

  return (
    <div className="space-y-6">
      {/* Demo Mode Quick Select */}
      {isDemoMode && (
        <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
          <Sparkles className="h-5 w-5 text-primary" />
          <div className="flex-1">
            <p className="text-sm font-medium">Demo Mode</p>
            <p className="text-xs text-muted-foreground">
              Quick select the example ticket for the demo
            </p>
          </div>
          <Button variant="secondary" size="sm" onClick={handleUseDemoTicket}>
            Use {defaultTicketId}
          </Button>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search by ticket number or subject..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* API Status */}
      {error && (
        <p className="text-xs text-muted-foreground">
          API unavailable — showing sample tickets
        </p>
      )}

      {/* Tickets List */}
      <ScrollArea className="h-[280px] rounded-lg border">
        {ticketsLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-center gap-3 p-3">
                <Skeleton className="h-10 w-10 rounded-lg" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-24" />
                  <Skeleton className="h-3 w-48" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredTickets.length === 0 ? (
          <div className="flex h-full items-center justify-center p-4">
            <p className="text-sm text-muted-foreground">No tickets found</p>
          </div>
        ) : (
          <div className="p-2">
            {filteredTickets.map((ticket) => (
              <button
                key={ticket.ticket_id}
                onClick={() => handleSelectTicket(ticket)}
                className={`w-full flex items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-accent ${
                  selectedTicket?.ticket_id === ticket.ticket_id
                    ? "bg-primary/10 ring-1 ring-primary"
                    : ""
                }`}
              >
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-muted">
                  <TicketIcon className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-medium">
                      {ticket.ticket_number}
                    </span>
                    <Badge variant="secondary" className="text-xs">
                      {ticket.status}
                    </Badge>
                    {ticket.category && (
                      <Badge variant="outline" className="text-xs">
                        {ticket.category}
                      </Badge>
                    )}
                  </div>
                  <p className="truncate text-sm text-muted-foreground mt-0.5">
                    {ticket.subject}
                  </p>
                </div>
              </button>
            ))}
          </div>
        )}
      </ScrollArea>

      {/* Selected Ticket Display */}
      {selectedTicket && (
        <div className="rounded-lg border bg-muted/50 p-4">
          <p className="text-xs font-medium text-muted-foreground mb-1">
            Selected Ticket
          </p>
          <p className="font-mono font-medium">{selectedTicket.ticket_number}</p>
          <p className="text-sm text-muted-foreground">{selectedTicket.subject}</p>
        </div>
      )}

      {/* Next Button */}
      <div className="flex justify-end">
        <Button onClick={handleNext} disabled={!selectedTicket} className="gap-2">
          Continue to Generate Draft
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
