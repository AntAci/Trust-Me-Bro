import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { CheckCircle2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Draft } from "@/lib/api";
import { EvidenceSummary } from "@/lib/mockData";

interface GenerateDraftSectionProps {
  draft: Draft | null;
  draftStatus: "idle" | "generating" | "ready" | "approved" | "rejected";
  evidenceSummary: EvidenceSummary;
  onGenerate: () => void;
  onPublish?: () => void;
  canPublish?: boolean;
  disabled?: boolean;
}

export function GenerateDraftSection({
  draft,
  draftStatus,
  evidenceSummary,
  onGenerate,
  onPublish,
  canPublish = false,
  disabled = false,
}: GenerateDraftSectionProps) {
  const draftBody = formatDraftBody(draft?.body_markdown);
  const [progressOpen, setProgressOpen] = useState(false);
  const [progressStep, setProgressStep] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const steps = [
    "Ingest ticket + transcript",
    "RLM extraction + normalization",
    "Evidence linking + trace map",
    "Draft composed",
    "Governance gate ready",
  ];

  useEffect(() => {
    if (!progressOpen) {
      timerRef.current.forEach(clearTimeout);
      timerRef.current = [];
      return;
    }

    timerRef.current.forEach(clearTimeout);
    timerRef.current = [];

    if (draftStatus === "generating") {
      setProgressStep(0);
      [600, 1200, 1800, 2400, 3000].forEach((delay, index) => {
        timerRef.current.push(
          setTimeout(() => {
            // progressStep is treated as an "active index" while generating, and as a
            // "complete all steps" sentinel when generation finishes.
            setProgressStep(Math.min(index + 1, steps.length - 1));
          }, delay)
        );
      });
    } else if (draftStatus === "ready" || draftStatus === "approved") {
      // Mark all steps completed (including governance-ready).
      setProgressStep(steps.length);
    } else {
      setProgressStep(0);
    }
  }, [progressOpen, draftStatus, steps.length]);

  const handleGenerate = () => {
    setProgressOpen(true);
    setProgressStep(0);
    onGenerate();
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Generate Draft</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-xs text-muted-foreground">
            Draft ID: {draft?.draft_id || "Not generated"}
          </div>
          <Badge variant="outline" className="text-[10px]">
            {draftStatus === "generating" ? "Generating" : draftStatus}
          </Badge>
        </div>

        <Button
          onClick={handleGenerate}
          disabled={disabled || draftStatus === "generating"}
          className="w-full"
        >
          {draftStatus === "generating" ? "Generating..." : "Generate Draft"}
        </Button>

        <div className="rounded-lg border bg-muted/30 p-3">
          <div className="text-xs font-medium text-muted-foreground mb-2">
            Draft Preview
          </div>
          <div className="max-h-48 overflow-auto text-xs leading-relaxed">
            {draft ? (
              <ReactMarkdown>{draftBody}</ReactMarkdown>
            ) : (
              <div className="text-xs text-muted-foreground">
                Draft will appear here after generation.
              </div>
            )}
          </div>
        </div>

        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2">
            Evidence Summary
          </div>
          <div className="flex flex-wrap gap-2">
            {Object.entries(evidenceSummary.bySection).map(([section, count]) => (
              <Badge key={section} variant="secondary" className="text-[10px]">
                {section.replace(/_/g, " ")} • {count}
              </Badge>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.entries(evidenceSummary.bySourceType).map(([source, count]) => (
              <Badge key={source} variant="outline" className="text-[10px]">
                {source} • {count}
              </Badge>
            ))}
          </div>
        </div>

        <Badge variant="secondary" className="text-[10px]">
          Traceable: yes ({evidenceSummary.total} evidence units linked)
        </Badge>
      </CardContent>
      <Dialog open={progressOpen} onOpenChange={setProgressOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Draft Generation Pipeline</DialogTitle>
            <DialogDescription>
              Tracking the RLM workflow from ingest → draft → governance.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {steps.map((step, index) => {
              const isDone = progressStep > index;
              const isActive = draftStatus === "generating" && progressStep === index;
              return (
                <div key={step} className="flex items-center gap-2 text-sm">
                  {isDone ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : isActive ? (
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  ) : (
                    <div className="h-4 w-4 rounded-full border border-muted-foreground/40" />
                  )}
                  <span className={isDone ? "text-foreground" : "text-muted-foreground"}>
                    {step}
                  </span>
                </div>
              );
            })}
          </div>
          <DialogFooter className="gap-2">
            {progressStep >= steps.length && canPublish && onPublish && (
              <Button onClick={onPublish} disabled={!canPublish}>
                Publish v1
              </Button>
            )}
            <Button variant="outline" onClick={() => setProgressOpen(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function formatDraftBody(body: Draft["body_markdown"] | undefined) {
  if (!body) return "";
  if (typeof body !== "string") {
    return JSON.stringify(body, null, 2);
  }

  const trimmed = body.trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}")) {
    try {
      const parsed = JSON.parse(trimmed);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        return draftObjectToMarkdown(parsed as Record<string, unknown>);
      }
    } catch {
      return body;
    }
  }
  return body;
}

function draftObjectToMarkdown(data: Record<string, unknown>) {
  const sections = [
    "Summary",
    "Problem",
    "Symptoms",
    "Environment",
    "Root Cause",
    "Resolution Steps",
    "Verification Steps",
    "Required Inputs",
    "Placeholders Needed",
    "Evidence Sources",
  ];
  const lines: string[] = [];
  sections.forEach((key) => {
    if (!(key in data)) return;
    const value = data[key];
    if (value === null || value === undefined || value === "") return;
    lines.push(`## ${key}`);
    if (Array.isArray(value)) {
      value.forEach((item) => {
        if (item) lines.push(`- ${String(item)}`);
      });
    } else if (typeof value === "object") {
      Object.entries(value as Record<string, unknown>).forEach(([subKey, subValue]) => {
        lines.push(`- ${subKey}: ${String(subValue)}`);
      });
    } else {
      lines.push(String(value));
    }
    lines.push("");
  });
  return lines.join("\n").trim() + "\n";
}
