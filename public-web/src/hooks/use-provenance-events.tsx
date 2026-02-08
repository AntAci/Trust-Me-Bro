import { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type ProvenanceEventType = 
  | "TICKET_SELECTED"
  | "DRAFT_GENERATED"
  | "DRAFT_APPROVED"
  | "V1_PUBLISHED"
  | "V2_PUBLISHED";

export interface ProvenanceEvent {
  type: ProvenanceEventType;
  timestamp: number;
  data?: Record<string, unknown>;
}

interface ProvenanceEventsContextType {
  events: ProvenanceEvent[];
  emit: (type: ProvenanceEventType, data?: Record<string, unknown>) => void;
  clear: () => void;
  lastEventType: ProvenanceEventType | null;
  edgeCount: number;
}

const ProvenanceEventsContext = createContext<ProvenanceEventsContextType | undefined>(undefined);

const EVENT_EDGE_COUNTS: Record<ProvenanceEventType, number> = {
  TICKET_SELECTED: 1,
  DRAFT_GENERATED: 8,
  DRAFT_APPROVED: 2,
  V1_PUBLISHED: 6,
  V2_PUBLISHED: 4,
};

export function ProvenanceEventsProvider({ children }: { children: ReactNode }) {
  const [events, setEvents] = useState<ProvenanceEvent[]>([]);

  const emit = useCallback((type: ProvenanceEventType, data?: Record<string, unknown>) => {
    const event: ProvenanceEvent = {
      type,
      timestamp: Date.now(),
      data,
    };
    setEvents((prev) => [...prev, event]);
  }, []);

  const clear = useCallback(() => {
    setEvents([]);
  }, []);

  const lastEventType = events.length > 0 ? events[events.length - 1].type : null;

  const edgeCount = events.reduce((sum, event) => {
    return sum + (EVENT_EDGE_COUNTS[event.type] || 0);
  }, 0);

  return (
    <ProvenanceEventsContext.Provider value={{ events, emit, clear, lastEventType, edgeCount }}>
      {children}
    </ProvenanceEventsContext.Provider>
  );
}

export function useProvenanceEvents() {
  const context = useContext(ProvenanceEventsContext);
  if (context === undefined) {
    throw new Error("useProvenanceEvents must be used within a ProvenanceEventsProvider");
  }
  return context;
}
