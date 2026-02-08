import { useState, useCallback, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useDemoMode } from "@/contexts/DemoModeContext";

export type AutoDemoStatus = "idle" | "running" | "paused" | "complete";

interface AutoDemoStep {
  id: number;
  name: string;
  duration: number;
  action: () => void;
}

interface UseAutoDemoOptions {
  onStepChange?: (step: number, stepName: string) => void;
  onComplete?: () => void;
}

export function useAutoDemo(options: UseAutoDemoOptions = {}) {
  const navigate = useNavigate();
  const { setIsDemoMode } = useDemoMode();
  const [status, setStatus] = useState<AutoDemoStatus>("idle");
  const [currentStep, setCurrentStep] = useState(0);
  const [progress, setProgress] = useState(0);
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const pausedAtRef = useRef<number>(0);
  const stepStartTimeRef = useRef<number>(0);

  // External callbacks to trigger step actions
  const stepCallbacksRef = useRef<{
    selectTicket?: () => void;
    generateDraft?: () => void;
    approveDraft?: () => void;
    publishV1?: () => void;
    publishV2?: () => void;
    openProvenance?: () => void;
  }>({});

  const registerStepCallback = useCallback((
    step: "selectTicket" | "generateDraft" | "approveDraft" | "publishV1" | "publishV2" | "openProvenance",
    callback: () => void
  ) => {
    stepCallbacksRef.current[step] = callback;
  }, []);

  const emit = (eventName: string) => {
    window.dispatchEvent(new CustomEvent(eventName));
  };

  const steps: AutoDemoStep[] = [
    { 
      id: 1, 
      name: "Select Ticket", 
      duration: 1500,
      action: () => {
        stepCallbacksRef.current.selectTicket?.();
        emit("auto-demo:select-ticket");
      }
    },
    { 
      id: 2, 
      name: "Generate Draft", 
      duration: 3000,
      action: () => {
        stepCallbacksRef.current.generateDraft?.();
        emit("auto-demo:generate-draft");
      }
    },
    { 
      id: 3, 
      name: "Approve Draft", 
      duration: 1500,
      action: () => {
        stepCallbacksRef.current.approveDraft?.();
        emit("auto-demo:approve-draft");
      }
    },
    { 
      id: 4, 
      name: "Publish v1", 
      duration: 2500,
      action: () => {
        stepCallbacksRef.current.publishV1?.();
        emit("auto-demo:publish-v1");
      }
    },
    {
      id: 5, 
      name: "Publish v2", 
      duration: 2500,
      action: () => {
        stepCallbacksRef.current.publishV2?.();
        emit("auto-demo:publish-v2");
      }
    },
    {
      id: 6,
      name: "Provenance Proof",
      duration: 1500,
      action: () => {
        stepCallbacksRef.current.openProvenance?.();
        emit("auto-demo:open-provenance");
      },
    },
  ];

  const totalDuration = steps.reduce((sum, step) => sum + step.duration, 0);

  const runStep = useCallback((stepIndex: number) => {
    if (stepIndex >= steps.length) {
      setStatus("complete");
      setProgress(100);
      options.onComplete?.();
      return;
    }

    const step = steps[stepIndex];
    setCurrentStep(stepIndex + 1);
    stepStartTimeRef.current = Date.now();
    options.onStepChange?.(stepIndex + 1, step.name);

    // Execute step action
    step.action();

    // Schedule next step
    timeoutRef.current = setTimeout(() => {
      runStep(stepIndex + 1);
    }, step.duration);
  }, [steps, options]);

  const start = useCallback(() => {
    // Enable demo mode
    setIsDemoMode(true);
    
    // Navigate to plugin demo
    navigate("/plugin");

    // Start after a brief delay for navigation
    setTimeout(() => {
      setStatus("running");
      setProgress(0);
      setCurrentStep(0);
      runStep(0);
    }, 500);
  }, [setIsDemoMode, navigate, runStep]);

  const pause = useCallback(() => {
    if (status !== "running") return;
    
    setStatus("paused");
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    pausedAtRef.current = Date.now() - stepStartTimeRef.current;
  }, [status]);

  const resume = useCallback(() => {
    if (status !== "paused") return;
    
    setStatus("running");
    const currentStepData = steps[currentStep - 1];
    const remainingTime = currentStepData.duration - pausedAtRef.current;

    timeoutRef.current = setTimeout(() => {
      runStep(currentStep);
    }, remainingTime);
  }, [status, currentStep, steps, runStep]);

  const stop = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    setStatus("idle");
    setCurrentStep(0);
    setProgress(0);
  }, []);

  // Update progress
  useEffect(() => {
    if (status !== "running") return;

    const interval = setInterval(() => {
      const completedDuration = steps
        .slice(0, currentStep - 1)
        .reduce((sum, step) => sum + step.duration, 0);
      const elapsed = Date.now() - stepStartTimeRef.current;
      const currentStepProgress = Math.min(elapsed, steps[currentStep - 1]?.duration || 0);
      const totalProgress = ((completedDuration + currentStepProgress) / totalDuration) * 100;
      setProgress(Math.min(totalProgress, 100));
    }, 50);

    return () => clearInterval(interval);
  }, [status, currentStep, steps, totalDuration]);

  // Cleanup
  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  return {
    status,
    currentStep,
    progress,
    totalSteps: steps.length,
    currentStepName: steps[currentStep - 1]?.name || "",
    start,
    pause,
    resume,
    stop,
    registerStepCallback,
  };
}
