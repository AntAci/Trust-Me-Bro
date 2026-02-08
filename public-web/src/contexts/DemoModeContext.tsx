import { createContext, useContext, useState, ReactNode, useCallback } from "react";
import { AutoDemoStatus } from "@/hooks/use-auto-demo";
import { KnowledgeMapPhase } from "@/components/knowledge-map/mapConfig";

export interface KnowledgeMapState {
  phase: KnowledgeMapPhase;
  activeTicketId: string | null;
  publishedVersion: number;
}

interface DemoModeContextType {
  isDemoMode: boolean;
  setIsDemoMode: (value: boolean) => void;
  defaultTicketId: string;
  defaultReviewer: string;
  autoDemoStatus: AutoDemoStatus;
  setAutoDemoStatus: (status: AutoDemoStatus) => void;
  knowledgeMapState: KnowledgeMapState;
  setKnowledgeMapPhase: (phase: KnowledgeMapPhase) => void;
  resetKnowledgeMap: () => void;
}

const DemoModeContext = createContext<DemoModeContextType | undefined>(undefined);

const initialKnowledgeMapState: KnowledgeMapState = {
  phase: 'idle',
  activeTicketId: null,
  publishedVersion: 0,
};

export function DemoModeProvider({ children }: { children: ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(true);
  const [autoDemoStatus, setAutoDemoStatus] = useState<AutoDemoStatus>("idle");
  const [knowledgeMapState, setKnowledgeMapState] = useState<KnowledgeMapState>(initialKnowledgeMapState);

  const setKnowledgeMapPhase = useCallback((phase: KnowledgeMapPhase) => {
    setKnowledgeMapState(prev => {
      const newState = { ...prev, phase };
      if (phase === 'publishing_v1') {
        newState.publishedVersion = 1;
      } else if (phase === 'publishing_v2') {
        newState.publishedVersion = 2;
      }
      return newState;
    });
  }, []);

  const resetKnowledgeMap = useCallback(() => {
    setKnowledgeMapState(initialKnowledgeMapState);
  }, []);

  return (
    <DemoModeContext.Provider
      value={{
        isDemoMode,
        setIsDemoMode,
        defaultTicketId: "CS-38908386",
        defaultReviewer: "Demo",
        autoDemoStatus,
        setAutoDemoStatus,
        knowledgeMapState,
        setKnowledgeMapPhase,
        resetKnowledgeMap,
      }}
    >
      {children}
    </DemoModeContext.Provider>
  );
}

export function useDemoMode() {
  const context = useContext(DemoModeContext);
  if (context === undefined) {
    throw new Error("useDemoMode must be used within a DemoModeProvider");
  }
  return context;
}
