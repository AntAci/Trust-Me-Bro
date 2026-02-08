import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, ChevronRight, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDemoMode } from "@/contexts/DemoModeContext";

// Step components
import { StepSelectTicket } from "@/components/flow/StepSelectTicket";
import { StepGenerateDraft } from "@/components/flow/StepGenerateDraft";
import { StepReview } from "@/components/flow/StepReview";
import { StepPublish } from "@/components/flow/StepPublish";
import { StepUpdate } from "@/components/flow/StepUpdate";
import { TrustPanel } from "@/components/flow/TrustPanel";
import { ProvenancePreview } from "@/components/flow/ProvenancePreview";
import { VersionPreview } from "@/components/flow/VersionPreview";
import { PreviewDrawer } from "@/components/flow/PreviewDrawer";

// Full view content (imported from pages)
import Provenance from "@/pages/Provenance";
import VersionHistory from "@/pages/VersionHistory";

export interface FlowState {
  ticketId: string | null;
  ticketNumber: string | null;
  draftId: string | null;
  draftStatus: "pending" | "approved" | "rejected" | null;
  kbArticleId: string | null;
  currentVersion: number | null;
}

const steps = [
  { id: 1, name: "Select Ticket", description: "Choose a support case" },
  { id: 2, name: "Generate Draft (AI)", description: "Extract evidence & create KB draft" },
  { id: 3, name: "Review", description: "Approve or reject" },
  { id: 4, name: "Publish v1", description: "Create KB article" },
  { id: 5, name: "Update (v2)", description: "Self-updating proof" },
];

function StepIndicator({
  step,
  currentStep,
  isCompleted,
}: {
  step: typeof steps[0];
  currentStep: number;
  isCompleted: boolean;
}) {
  const isActive = step.id === currentStep;

  return (
    <div className="flex items-center">
      <div className="flex flex-col items-center">
        <div
          className={cn(
            "flex h-10 w-10 items-center justify-center rounded-full border-2 text-sm font-medium transition-all duration-200",
            isCompleted
              ? "border-green-500 bg-green-500 text-white animate-pulse-once"
              : isActive
              ? "border-primary bg-primary text-primary-foreground"
              : "border-muted-foreground/30 bg-background text-muted-foreground"
          )}
        >
          {isCompleted ? <Check className="h-5 w-5" /> : step.id}
        </div>
        <div className="mt-2 hidden text-center md:block">
          <p
            className={cn(
              "text-xs font-medium",
              isActive ? "text-foreground" : "text-muted-foreground"
            )}
          >
            {step.name}
          </p>
        </div>
      </div>
      {step.id < steps.length && (
        <ChevronRight className="mx-2 h-5 w-5 text-muted-foreground/50 hidden md:block" />
      )}
    </div>
  );
}

export default function GuidedFlow() {
  const { isDemoMode, defaultTicketId } = useDemoMode();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentStep, setCurrentStep] = useState(1);
  const [flowState, setFlowState] = useState<FlowState>({
    ticketId: isDemoMode ? defaultTicketId : null,
    ticketNumber: isDemoMode ? defaultTicketId : null,
    draftId: null,
    draftStatus: null,
    kbArticleId: null,
    currentVersion: null,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [provenanceDrawerOpen, setProvenanceDrawerOpen] = useState(false);
  const [versionsDrawerOpen, setVersionsDrawerOpen] = useState(false);

  const updateFlowState = (updates: Partial<FlowState>) => {
    setFlowState((prev) => ({ ...prev, ...updates }));
  };

  // Open provenance drawer with correct article ID
  const openProvenanceDrawer = () => {
    if (flowState.kbArticleId) {
      setSearchParams({ kb_article_id: flowState.kbArticleId });
    }
    setProvenanceDrawerOpen(true);
  };

  // Open versions drawer with correct article ID
  const openVersionsDrawer = () => {
    if (flowState.kbArticleId) {
      setSearchParams({ kb_article_id: flowState.kbArticleId });
    }
    setVersionsDrawerOpen(true);
  };

  const goToStep = (step: number) => {
    setCurrentStep(step);
  };

  const getCompletedSteps = () => {
    const completed = new Set<number>();
    if (flowState.ticketId) completed.add(1);
    if (flowState.draftId) completed.add(2);
    if (flowState.draftStatus === "approved") completed.add(3);
    if (flowState.kbArticleId && flowState.currentVersion === 1) completed.add(4);
    if (flowState.currentVersion && flowState.currentVersion > 1) completed.add(5);
    return completed;
  };

  const completedSteps = getCompletedSteps();
  const showPreviews = flowState.draftId || flowState.kbArticleId;

  const renderStepContent = () => {
    switch (currentStep) {
      case 1:
        return (
          <StepSelectTicket
            flowState={flowState}
            updateFlowState={updateFlowState}
            onNext={() => goToStep(2)}
            setIsLoading={setIsLoading}
          />
        );
      case 2:
        return (
          <StepGenerateDraft
            flowState={flowState}
            updateFlowState={updateFlowState}
            onNext={() => goToStep(3)}
            onBack={() => goToStep(1)}
            setIsLoading={setIsLoading}
          />
        );
      case 3:
        return (
          <StepReview
            flowState={flowState}
            updateFlowState={updateFlowState}
            onNext={() => goToStep(4)}
            onBack={() => goToStep(2)}
            setIsLoading={setIsLoading}
          />
        );
      case 4:
        return (
          <StepPublish
            flowState={flowState}
            updateFlowState={updateFlowState}
            onNext={() => goToStep(5)}
            onBack={() => goToStep(3)}
            setIsLoading={setIsLoading}
          />
        );
      case 5:
        return (
          <StepUpdate
            flowState={flowState}
            updateFlowState={updateFlowState}
            setIsLoading={setIsLoading}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex gap-6">
      {/* Main Content */}
      <div className="flex-1 space-y-6">
        {/* Stepper */}
        <Card>
          <CardContent className="py-6">
            <div className="flex items-center justify-between overflow-x-auto pb-2">
              {steps.map((step) => (
                <StepIndicator
                  key={step.id}
                  step={step}
                  currentStep={currentStep}
                  isCompleted={completedSteps.has(step.id)}
                />
              ))}
            </div>
            {/* Mobile step name */}
            <div className="mt-4 text-center md:hidden">
              <p className="font-medium">{steps[currentStep - 1].name}</p>
              <p className="text-sm text-muted-foreground">
                {steps[currentStep - 1].description}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Step Content */}
        <Card className="relative min-h-[400px]">
          {isLoading && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-background/80 backdrop-blur-sm">
              <div className="flex items-center gap-2">
                <Loader2 className="h-5 w-5 animate-spin text-primary" />
                <span className="text-sm text-muted-foreground">Processing...</span>
              </div>
            </div>
          )}
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>{steps[currentStep - 1].name}</CardTitle>
              <Badge variant="outline">Step {currentStep} of {steps.length}</Badge>
            </div>
          </CardHeader>
          <CardContent>{renderStepContent()}</CardContent>
        </Card>

        {/* Demo Runway - Previews */}
        {showPreviews && (
          <Card className="animate-slide-in-up">
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Live Previews</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="provenance" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="provenance">Provenance</TabsTrigger>
                  <TabsTrigger value="versions">Versions</TabsTrigger>
                </TabsList>
                <TabsContent value="provenance" className="mt-4">
                  <ProvenancePreview 
                    flowState={flowState} 
                    onOpenFullView={openProvenanceDrawer}
                  />
                </TabsContent>
                <TabsContent value="versions" className="mt-4">
                  <VersionPreview 
                    flowState={flowState} 
                    onOpenFullView={openVersionsDrawer}
                  />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Trust Panel - Sticky Sidebar */}
      <div className="hidden w-80 lg:block">
        <div className="sticky top-6">
          <TrustPanel flowState={flowState} />
        </div>
      </div>

      {/* Full View Drawers */}
      <PreviewDrawer
        open={provenanceDrawerOpen}
        onOpenChange={setProvenanceDrawerOpen}
        title="Provenance Graph"
        description="Full traceability from article to source evidence"
      >
        <Provenance />
      </PreviewDrawer>

      <PreviewDrawer
        open={versionsDrawerOpen}
        onOpenChange={setVersionsDrawerOpen}
        title="Version History"
        description="Complete timeline of all article versions"
      >
        <VersionHistory />
      </PreviewDrawer>
    </div>
  );
}
