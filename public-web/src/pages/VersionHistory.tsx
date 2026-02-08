import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { History, Eye, Clock, User, FileText, StickyNote, Plus, RefreshCw, Minus } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { api, ArticleVersion } from "@/lib/api";

// Mock versions for when API is unavailable
const mockVersions: ArticleVersion[] = [
  {
    version_id: "ver-1",
    kb_article_id: "kb-001",
    version: 1,
    source_draft_id: "draft-001",
    body_markdown: `# Payment Processing Timeout Error Resolution

## Problem
Users are experiencing timeout errors when attempting to process payments through the checkout flow.

## Symptoms
- Payment form hangs after clicking "Submit"
- Error message: "Request timed out. Please try again."
- Issue occurs more frequently during peak hours

## Root Cause
The payment gateway API endpoint was experiencing increased latency due to database connection pool exhaustion.

## Resolution Steps
1. Increase connection pool size from 10 to 50
2. Add index on \`transactions.created_at\` column
`,
    title: "Payment Processing Timeout Error Resolution",
    reviewer: "Demo",
    change_note: "Initial publication",
    is_rollback: false,
    created_at: new Date(Date.now() - 7200000).toISOString(),
  },
  {
    version_id: "ver-2",
    kb_article_id: "kb-001",
    version: 2,
    source_draft_id: "draft-002",
    body_markdown: `# Payment Processing Timeout Error Resolution

## Problem
Users are experiencing timeout errors when attempting to process payments through the checkout flow.

## Symptoms
- Payment form hangs after clicking "Submit"
- Error message: "Request timed out. Please try again."
- Issue occurs more frequently during peak hours
- **NEW:** Some users see partial charges on their accounts

## Root Cause
The payment gateway API endpoint was experiencing increased latency due to:
1. Database connection pool exhaustion
2. Missing index on the transactions table
3. **NEW:** Retry logic causing cascading timeouts

## Resolution Steps
1. Increase connection pool size from 10 to 50
2. Add index on \`transactions.created_at\` column
3. **NEW:** Implement exponential backoff for API retries
4. **NEW:** Add circuit breaker pattern for payment gateway calls

## Placeholders Needed
- \`{{PAYMENT_GATEWAY_URL}}\` - The payment gateway endpoint URL
- \`{{CONNECTION_POOL_SIZE}}\` - Recommended connection pool configuration
- \`{{TIMEOUT_THRESHOLD}}\` - Maximum allowed response time
`,
    title: "Payment Processing Timeout Error Resolution",
    reviewer: "Demo (Update)",
    change_note: "Added retry logic and circuit breaker documentation",
    is_rollback: false,
    created_at: new Date(Date.now() - 3600000).toISOString(),
  },
];

// Derive change summary from markdown content
function deriveChangeSummary(current: ArticleVersion, previous?: ArticleVersion) {
  if (!previous) {
    // Initial version - list all sections as "Added"
    const headings = current.body_markdown.match(/^## .+$/gm) || [];
    return {
      added: headings.map((h) => h.replace("## ", "")),
      updated: [],
      removed: [],
    };
  }

  const currentHeadings = new Set(
    (current.body_markdown.match(/^## .+$/gm) || []).map((h) => h.replace("## ", ""))
  );
  const previousHeadings = new Set(
    (previous.body_markdown.match(/^## .+$/gm) || []).map((h) => h.replace("## ", ""))
  );

  const added: string[] = [];
  const removed: string[] = [];
  const updated: string[] = [];

  // Find added headings
  currentHeadings.forEach((h) => {
    if (!previousHeadings.has(h)) {
      added.push(h);
    }
  });

  // Find removed headings
  previousHeadings.forEach((h) => {
    if (!currentHeadings.has(h)) {
      removed.push(h);
    }
  });

  // Check for updated sections (exist in both but content changed)
  currentHeadings.forEach((heading) => {
    if (previousHeadings.has(heading)) {
      const currentSection = extractSection(current.body_markdown, heading);
      const previousSection = extractSection(previous.body_markdown, heading);
      if (currentSection !== previousSection) {
        updated.push(heading);
      }
    }
  });

  return { added, updated, removed };
}

function extractSection(markdown: string, heading: string): string {
  const regex = new RegExp(`## ${heading}\\n([\\s\\S]*?)(?=\\n## |$)`, "m");
  const match = markdown.match(regex);
  return match ? match[1].trim() : "";
}

export default function VersionHistory() {
  const [searchParams] = useSearchParams();
  const kbArticleId = searchParams.get("kb_article_id") || "kb-001";
  const [selectedVersion, setSelectedVersion] = useState<ArticleVersion | null>(null);

  // Fetch versions
  const { data: versions, isLoading } = useQuery({
    queryKey: ["versions", kbArticleId],
    queryFn: () => api.getArticleVersions(kbArticleId),
    retry: 1,
  });

  const displayVersions = versions || mockVersions;
  const latestVersion = displayVersions[displayVersions.length - 1];
  const currentView = selectedVersion || latestVersion;

  // Calculate change summary
  const changeSummary = useMemo(() => {
    if (!currentView) return null;
    const versionIndex = displayVersions.findIndex((v) => v.version_id === currentView.version_id);
    const previousVersion = versionIndex > 0 ? displayVersions[versionIndex - 1] : undefined;
    return deriveChangeSummary(currentView, previousVersion);
  }, [currentView, displayVersions]);

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Version History</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-[500px]" />
          <Skeleton className="h-[500px] lg:col-span-2" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History className="h-6 w-6" />
            Version History
          </h1>
          <p className="text-muted-foreground">
            Article: <code className="text-xs font-mono">{kbArticleId}</code>
          </p>
        </div>
        <Badge variant="outline">
          {displayVersions.length} version{displayVersions.length !== 1 ? "s" : ""}
        </Badge>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Version Timeline */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Timeline</CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[500px]">
              <div className="space-y-0">
                {displayVersions
                  .slice()
                  .reverse()
                  .map((version, idx) => {
                    const isSelected = currentView?.version_id === version.version_id;
                    const isLatest = version.version === latestVersion?.version;
                    
                    return (
                      <div key={version.version_id} className="relative">
                        {/* Timeline line */}
                        {idx < displayVersions.length - 1 && (
                          <div className="absolute left-[17px] top-10 h-full w-0.5 bg-border" />
                        )}
                        
                        <button
                          onClick={() => setSelectedVersion(version)}
                          className={`w-full flex items-start gap-3 rounded-lg p-3 text-left transition-colors hover:bg-accent ${
                            isSelected ? "bg-primary/10 ring-1 ring-primary" : ""
                          }`}
                        >
                          {/* Version badge */}
                          <div
                            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold ${
                              isLatest
                                ? "border-success bg-success text-success-foreground"
                                : isSelected
                                ? "border-primary bg-primary text-primary-foreground"
                                : "border-muted-foreground bg-background"
                            }`}
                          >
                            v{version.version}
                          </div>
                          
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              <span className="font-medium text-sm">
                                Version {version.version}
                              </span>
                              {isLatest && (
                                <Badge variant="secondary" className="text-[10px]">
                                  Current
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground truncate">
                              {version.change_note || "No note"}
                            </p>
                            <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                              <User className="h-3 w-3" />
                              <span>{version.reviewer}</span>
                              <span>•</span>
                              <Clock className="h-3 w-3" />
                              <span>{formatDate(version.created_at)}</span>
                            </div>
                          </div>
                        </button>
                      </div>
                    );
                  })}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>

        {/* Content Viewer */}
        <Card className="lg:col-span-2">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Version {currentView?.version}
                </CardTitle>
                <CardDescription>
                  {currentView?.title}
                </CardDescription>
              </div>
              <Badge
                variant={
                  currentView?.version === latestVersion?.version
                    ? "default"
                    : "secondary"
                }
              >
                v{currentView?.version}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            {/* Change Summary Box */}
            {changeSummary && currentView && currentView.version > 1 && (
              <div className="rounded-lg border bg-muted/30 p-4 mb-4 animate-slide-in-up">
                <h4 className="text-sm font-medium mb-3 flex items-center gap-2">
                  Changes in v{currentView.version}
                </h4>
                <div className="space-y-2">
                  {changeSummary.added.length > 0 && (
                    <div className="flex items-start gap-2">
                      <Plus className="h-4 w-4 text-success shrink-0 mt-0.5" />
                      <div className="flex flex-wrap gap-1">
                        {changeSummary.added.map((item) => (
                          <Badge key={item} variant="outline" className="text-xs bg-success/10 text-success border-success/30">
                            {item}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {changeSummary.updated.length > 0 && (
                    <div className="flex items-start gap-2">
                      <RefreshCw className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <div className="flex flex-wrap gap-1">
                        {changeSummary.updated.map((item) => (
                          <Badge key={item} variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                            {item}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {changeSummary.removed.length > 0 && (
                    <div className="flex items-start gap-2">
                      <Minus className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                      <div className="flex flex-wrap gap-1">
                        {changeSummary.removed.map((item) => (
                          <Badge key={item} variant="outline" className="text-xs bg-destructive/10 text-destructive border-destructive/30">
                            {item}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {changeSummary.added.length === 0 && changeSummary.updated.length === 0 && changeSummary.removed.length === 0 && (
                    <p className="text-xs text-muted-foreground">No structural changes detected</p>
                  )}
                </div>
              </div>
            )}

            {/* Metadata */}
            <div className="grid grid-cols-3 gap-4 mb-4 p-3 rounded-lg bg-muted/50 border">
              <div>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <FileText className="h-3 w-3" />
                  Draft ID
                </p>
                <code className="text-xs font-mono">
                  {currentView?.source_draft_id}
                </code>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <User className="h-3 w-3" />
                  Reviewer
                </p>
                <p className="text-xs font-medium">{currentView?.reviewer}</p>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                  <StickyNote className="h-3 w-3" />
                  Change Note
                </p>
                <p className="text-xs">{currentView?.change_note || "—"}</p>
              </div>
            </div>

            <Separator className="my-4" />

            {/* Content */}
            <ScrollArea className="h-[400px]">
              <div className="kb-markdown pr-4">
                <ReactMarkdown>{currentView?.body_markdown || ""}</ReactMarkdown>
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Self-Updating Explanation */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-4">
          <h3 className="font-semibold mb-2">Append-Only Version History</h3>
          <ul className="text-sm text-muted-foreground space-y-1">
            <li>• Each version is immutable — past versions are never modified</li>
            <li>• New resolved cases create new drafts, which publish as new versions</li>
            <li>• Every version traces back to its source evidence through provenance edges</li>
            <li>• Rollbacks create new versions, preserving the full history</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
