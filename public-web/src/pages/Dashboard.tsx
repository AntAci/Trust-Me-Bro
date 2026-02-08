import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Ticket,
  FileText,
  BookCheck,
  Network,
  CheckCircle,
  ArrowRight,
  Sparkles,
  Zap,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AnimatedCounter } from "@/components/ui/animated-counter";
import { api, Metrics } from "@/lib/api";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { useAutoDemo } from "@/hooks/use-auto-demo";
import { AutoDemoController } from "@/components/flow/AutoDemoController";
import { LivingKnowledgeMap } from "@/components/knowledge-map/LivingKnowledgeMap";

function MetricCard({
  title,
  value,
  icon: Icon,
  description,
  variant = "default",
  useCounter = false,
  numericValue,
}: {
  title: string;
  value: number | string;
  icon: React.ElementType;
  description?: string;
  variant?: "default" | "success" | "warning" | "destructive";
  useCounter?: boolean;
  numericValue?: number;
}) {
  const variantStyles = {
    default: "bg-primary/10 text-primary",
    success: "bg-green-500/10 text-green-600 dark:text-green-400",
    warning: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
    destructive: "bg-red-500/10 text-red-600 dark:text-red-400",
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">
          {title}
        </CardTitle>
        <div className={`rounded-lg p-2 ${variantStyles[variant]}`}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">
          {useCounter && numericValue !== undefined ? (
            <AnimatedCounter value={numericValue} />
          ) : (
            value
          )}
        </div>
        {description && (
          <p className="text-xs text-muted-foreground mt-1">{description}</p>
        )}
      </CardContent>
    </Card>
  );
}

function MetricsSkeleton() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Card key={i}>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-8 w-8 rounded-lg" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-32 mt-2" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// Mock data for demo when API is unavailable
const mockMetrics: Metrics = {
  tickets_count: 1247,
  evidence_units_count: 8934,
  drafts_pending: 23,
  drafts_approved: 156,
  drafts_rejected: 12,
  published_articles_count: 142,
  provenance_edges_count: 4521,
};

export default function Dashboard() {
  const navigate = useNavigate();
  const { isDemoMode, setAutoDemoStatus } = useDemoMode();
  
  const autoDemo = useAutoDemo({
    onComplete: () => setAutoDemoStatus("complete"),
  });

  const { data: metrics, isLoading, error } = useQuery({
    queryKey: ["metrics"],
    queryFn: api.getMetrics,
    retry: 1,
    staleTime: 30000,
  });

  // Use mock data if API fails
  const displayMetrics = metrics || (error ? mockMetrics : null);

  const handleAutoDemoStart = () => {
    setAutoDemoStatus("running");
    autoDemo.start();
  };

  return (
    <div className="space-y-6">
      {/* Living Knowledge Map Hero */}
      <LivingKnowledgeMap />

      {/* Metrics Grid */}
      {isLoading ? (
        <MetricsSkeleton />
      ) : displayMetrics ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          <MetricCard
            title="Tickets Loaded"
            value={displayMetrics.tickets_count.toLocaleString()}
            numericValue={displayMetrics.tickets_count}
            useCounter
            icon={Ticket}
            description="Support cases in system"
          />
          <MetricCard
            title="Evidence Units"
            value={displayMetrics.evidence_units_count.toLocaleString()}
            numericValue={displayMetrics.evidence_units_count}
            useCounter
            icon={FileText}
            description="Extracted from tickets & transcripts"
          />
          <MetricCard
            title="Drafts"
            value={`${displayMetrics.drafts_pending} pending`}
            icon={Clock}
            description={`${displayMetrics.drafts_approved} approved, ${displayMetrics.drafts_rejected} rejected`}
            variant="warning"
          />
          <MetricCard
            title="Published Articles"
            value={displayMetrics.published_articles_count.toLocaleString()}
            numericValue={displayMetrics.published_articles_count}
            useCounter
            icon={BookCheck}
            description="Live in knowledge base"
            variant="success"
          />
          <MetricCard
            title="Provenance Edges"
            value={displayMetrics.provenance_edges_count.toLocaleString()}
            numericValue={displayMetrics.provenance_edges_count}
            useCounter
            icon={Network}
            description="Traceability links"
          />
        </div>
      ) : null}

      {/* Demo Buttons */}
      <div className="flex justify-center gap-3">
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                size="lg"
                variant="outline"
                className="gap-2 border-primary/50 hover:bg-primary/10"
                onClick={handleAutoDemoStart}
                disabled={autoDemo.status !== "idle"}
              >
                <Zap className="h-4 w-4" />
                Quick Tour (15s)
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="max-w-xs">
              <p>Automated walkthrough: generates draft → human review → publish → update, with full provenance tracking.</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <Button
          size="lg"
          className="gap-2"
          onClick={() => navigate("/plugin")}
        >
          <Sparkles className="h-4 w-4" />
Open Support Console
          <ArrowRight className="h-4 w-4" />
        </Button>
      </div>

      {/* API Status Banner - only show in development */}
      {error && process.env.NODE_ENV === 'development' && (
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="border-slate-400 text-slate-600">
              Offline Mode
            </Badge>
            <span className="text-sm text-slate-600 dark:text-slate-400">
              Using cached sample dataset. Backend connection optional.
            </span>
          </div>
        </div>
      )}

      {/* Feature Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="relative overflow-hidden">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-primary/10" />
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-500" />
              Governed Workflow
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Every KB article goes through human review before publication.
            Approve or reject drafts with audit trail.
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-primary/10" />
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Network className="h-5 w-5 text-primary" />
              Full Traceability
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Every section of every article traces back to source evidence —
            tickets, transcripts, scripts, placeholders.
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-primary/10" />
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-amber-500" />
              Append-Only Versions
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            New resolved cases generate updates, not overwrites. View full
            version history with diffs.
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden">
          <div className="absolute right-0 top-0 h-24 w-24 translate-x-8 -translate-y-8 rounded-full bg-primary/10" />
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-primary" />
              RLM Verified Drafting
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Recursive Language Model builds each section with evidence IDs and
            verifies every claim before publishing.
          </CardContent>
        </Card>
      </div>

      {/* Sample Dataset Indicator */}
      {isDemoMode && (
        <Card className="border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/30">
          <CardContent className="flex items-center gap-4 py-4">
            <div className="rounded-full bg-green-100 dark:bg-green-900/50 p-3">
              <BookCheck className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-green-800 dark:text-green-200">Sample Dataset Loaded</p>
                <Badge variant="outline" className="text-xs border-green-500 text-green-700 dark:text-green-300">
                  400 Enterprise Support Tickets
                </Badge>
              </div>
              <p className="text-sm text-green-700/80 dark:text-green-300/80">
                Pre-loaded with ticket <code className="rounded bg-green-100 dark:bg-green-900 px-1 text-green-800 dark:text-green-200">CS-38908386</code>{" "}
                for guided workflow demonstration.
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Auto Demo Controller */}
      <AutoDemoController
        status={autoDemo.status}
        currentStep={autoDemo.currentStep}
        totalSteps={autoDemo.totalSteps}
        currentStepName={autoDemo.currentStepName}
        progress={autoDemo.progress}
        onPause={autoDemo.pause}
        onResume={autoDemo.resume}
        onStop={autoDemo.stop}
      />
    </div>
  );
}
