import { Pause, Play, Square, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { AutoDemoStatus } from "@/hooks/use-auto-demo";

interface AutoDemoControllerProps {
  status: AutoDemoStatus;
  currentStep: number;
  totalSteps: number;
  currentStepName: string;
  progress: number;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
}

export function AutoDemoController({
  status,
  currentStep,
  totalSteps,
  currentStepName,
  progress,
  onPause,
  onResume,
  onStop,
}: AutoDemoControllerProps) {
  if (status === "idle") return null;

  return (
    <div
      className={cn(
        "fixed bottom-6 left-1/2 -translate-x-1/2 z-50",
        "flex items-center gap-3 px-4 py-3 rounded-full",
        "bg-background/95 backdrop-blur-sm border shadow-lg",
        "animate-slide-in-up"
      )}
    >
      {/* Status indicator */}
      <div className="flex items-center gap-2">
        <div className={cn(
          "h-2 w-2 rounded-full",
          status === "running" && "bg-success animate-pulse",
          status === "paused" && "bg-warning",
          status === "complete" && "bg-primary"
        )} />
        <span className="text-xs font-medium">
          {status === "complete" ? "Tour Complete" : currentStepName}
        </span>
      </div>

      {/* Progress bar */}
      <div className="w-32">
        <Progress value={progress} className="h-1.5" />
      </div>

      {/* Step counter */}
      <span className="text-xs text-muted-foreground">
        {currentStep}/{totalSteps}
      </span>

      {/* Controls */}
      {status !== "complete" && (
        <div className="flex items-center gap-1">
          {status === "running" ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onPause}
            >
              <Pause className="h-3.5 w-3.5" />
            </Button>
          ) : status === "paused" ? (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onResume}
            >
              <Play className="h-3.5 w-3.5" />
            </Button>
          ) : null}
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-destructive hover:text-destructive"
            onClick={onStop}
          >
            <Square className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Complete state */}
      {status === "complete" && (
        <Button
          variant="ghost"
          size="sm"
          className="h-7 text-xs"
          onClick={onStop}
        >
          Done
        </Button>
      )}
    </div>
  );
}
