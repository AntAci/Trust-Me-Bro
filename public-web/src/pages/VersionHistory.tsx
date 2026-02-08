import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSearchParams } from "react-router-dom";
import { History, Eye, Clock, User, FileText, StickyNote, Plus, RefreshCw, Minus, ChevronDown } from "lucide-react";
import ReactMarkdown from "react-markdown";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api, ArticleVersion, PublishedArticle } from "@/lib/api";
import { cn } from "@/lib/utils";

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(
    searchParams.get("kb_article_id")
  );
  const [selectedVersion, setSelectedVersion] = useState<ArticleVersion | null>(null);

  // Fetch all published articles for dropdown
  const { data: articles, isLoading: articlesLoading } = useQuery({
    queryKey: ["articles"],
    queryFn: () => api.getArticles({ limit: 50 }),
  });

  // Auto-select the latest article if none selected
  useEffect(() => {
    if (!selectedArticleId && articles && articles.length > 0) {
      // Find article with the most versions (most interesting for demo)
      const articlesWithVersions = articles.filter(a => a.current_version > 1);
      const selectedArticle = articlesWithVersions.length > 0 
        ? articlesWithVersions[0] 
        : articles[0];
      setSelectedArticleId(selectedArticle.kb_article_id);
      setSearchParams({ kb_article_id: selectedArticle.kb_article_id });
    }
  }, [articles, selectedArticleId, setSearchParams]);

  const handleArticleSelect = (articleId: string) => {
    setSelectedArticleId(articleId);
    setSearchParams({ kb_article_id: articleId });
    setSelectedVersion(null); // Reset version selection
  };

  // Fetch versions for selected article
  const { data: versions, isLoading: versionsLoading } = useQuery({
    queryKey: ["versions", selectedArticleId],
    queryFn: () => api.getArticleVersions(selectedArticleId!),
    enabled: !!selectedArticleId,
    retry: 1,
  });

  const displayVersions = versions || [];
  const latestVersion = displayVersions.length > 0 ? displayVersions[displayVersions.length - 1] : null;
  const currentView = selectedVersion || latestVersion;

  // Calculate change summary
  const changeSummary = useMemo(() => {
    if (!currentView || displayVersions.length === 0) return null;
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

  const selectedArticle = articles?.find(a => a.kb_article_id === selectedArticleId);

  if (articlesLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Version History</h1>
          <p className="text-muted-foreground">Loading articles...</p>
        </div>
        <Skeleton className="h-[400px] w-full" />
      </div>
    );
  }

  if (!articles || articles.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History className="h-6 w-6" />
            Version History
          </h1>
          <p className="text-muted-foreground">
            No published articles yet. Complete the Guided Flow to create one!
          </p>
        </div>
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            Go to <strong>Guided Flow</strong> to create your first KB article with version tracking.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with Article Selector */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History className="h-6 w-6" />
            Version History
          </h1>
          <p className="text-muted-foreground">
            Article: <code className="text-xs bg-muted px-1 py-0.5 rounded">
              {selectedArticle?.source_ticket_id || "Select an article"}
            </code>
          </p>
        </div>
        <div className="flex items-center gap-4">
          {/* Article Selector Dropdown */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2 min-w-[200px] justify-between">
                <span className="truncate max-w-[180px]">
                  {selectedArticle 
                    ? `${selectedArticle.source_ticket_id} (v${selectedArticle.current_version})`
                    : "Select Article"}
                </span>
                <ChevronDown className="h-4 w-4 shrink-0" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-[300px] max-h-[300px] overflow-y-auto">
              {articles.map((article) => (
                <DropdownMenuItem
                  key={article.kb_article_id}
                  onClick={() => handleArticleSelect(article.kb_article_id)}
                  className={cn(
                    "flex flex-col items-start gap-1 cursor-pointer",
                    article.kb_article_id === selectedArticleId && "bg-accent"
                  )}
                >
                  <div className="flex items-center gap-2 w-full">
                    <span className="font-mono text-sm">{article.source_ticket_id}</span>
                    <Badge variant="outline" className="text-xs">v{article.current_version}</Badge>
                    {article.current_version > 1 && (
                      <Badge variant="secondary" className="text-xs">Updated</Badge>
                    )}
                  </div>
                  <span className="text-xs text-muted-foreground truncate max-w-full">
                    {article.title}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
          <Badge variant="outline">{displayVersions.length} versions</Badge>
        </div>
      </div>

      {versionsLoading ? (
        <Skeleton className="h-[400px] w-full" />
      ) : displayVersions.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            No versions found for this article.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Timeline Column */}
          <Card className="lg:col-span-1">
            <CardHeader>
              <CardTitle className="text-lg">Timeline</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px] pr-4">
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-border" />

                  {/* Version items - reverse order to show newest first */}
                  <div className="space-y-6">
                    {[...displayVersions].reverse().map((version, idx) => {
                      const isSelected = currentView?.version_id === version.version_id;
                      const isLatest = idx === 0;

                      return (
                        <div
                          key={version.version_id}
                          className={cn(
                            "relative pl-10 cursor-pointer group",
                            isSelected && "opacity-100",
                            !isSelected && "opacity-60 hover:opacity-100"
                          )}
                          onClick={() => setSelectedVersion(version)}
                        >
                          {/* Timeline dot */}
                          <div
                            className={cn(
                              "absolute left-2.5 w-3 h-3 rounded-full border-2 transition-all",
                              isSelected
                                ? "bg-primary border-primary scale-125"
                                : "bg-background border-muted-foreground group-hover:border-primary"
                            )}
                          />

                          {/* Version card */}
                          <div
                            className={cn(
                              "p-3 rounded-lg border transition-all",
                              isSelected
                                ? "border-primary bg-primary/5"
                                : "border-transparent hover:border-muted-foreground/30 hover:bg-muted/50"
                            )}
                          >
                            <div className="flex items-center justify-between mb-1">
                              <Badge
                                variant={isLatest ? "default" : "secondary"}
                                className="text-xs"
                              >
                                v{version.version}
                              </Badge>
                              {version.is_rollback && (
                                <Badge variant="destructive" className="text-xs">
                                  Rollback
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(version.created_at)}
                            </div>
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <User className="h-3 w-3" />
                              {version.reviewer}
                            </div>
                            {version.change_note && (
                              <p className="text-xs mt-2 text-muted-foreground line-clamp-2">
                                {version.change_note}
                              </p>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Version Detail Column */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Eye className="h-5 w-5 text-primary" />
                  <div>
                    <CardTitle>Version {currentView?.version || "-"}</CardTitle>
                    <CardDescription>
                      {currentView ? formatDate(currentView.created_at) : "Select a version"}
                    </CardDescription>
                  </div>
                </div>
                {currentView && (
                  <Badge variant={currentView.version === latestVersion?.version ? "default" : "secondary"}>
                    {currentView.version === latestVersion?.version ? "Latest" : "Historical"}
                  </Badge>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Metadata row */}
              {currentView && (
                <div className="flex flex-wrap gap-4 text-sm">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <FileText className="h-4 w-4" />
                    Draft: <code className="text-xs">{currentView.source_draft_id.slice(0, 8)}...</code>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <User className="h-4 w-4" />
                    Reviewer: {currentView.reviewer}
                  </div>
                  {currentView.change_note && (
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <StickyNote className="h-4 w-4" />
                      Change Note: {currentView.change_note}
                    </div>
                  )}
                </div>
              )}

              <Separator />

              {/* Change Summary */}
              {changeSummary && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Changes in this version:</h4>
                  <div className="flex flex-wrap gap-2">
                    {changeSummary.added.map((item) => (
                      <Badge key={`add-${item}`} variant="outline" className="gap-1 text-green-600 border-green-200 bg-green-50">
                        <Plus className="h-3 w-3" />
                        {item}
                      </Badge>
                    ))}
                    {changeSummary.updated.map((item) => (
                      <Badge key={`upd-${item}`} variant="outline" className="gap-1 text-amber-600 border-amber-200 bg-amber-50">
                        <RefreshCw className="h-3 w-3" />
                        {item}
                      </Badge>
                    ))}
                    {changeSummary.removed.map((item) => (
                      <Badge key={`rem-${item}`} variant="outline" className="gap-1 text-red-600 border-red-200 bg-red-50">
                        <Minus className="h-3 w-3" />
                        {item}
                      </Badge>
                    ))}
                    {changeSummary.added.length === 0 &&
                      changeSummary.updated.length === 0 &&
                      changeSummary.removed.length === 0 && (
                        <span className="text-xs text-muted-foreground">No structural changes</span>
                      )}
                  </div>
                </div>
              )}

              <Separator />

              {/* Markdown Content */}
              <ScrollArea className="h-[350px]">
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  {currentView ? (
                    <ReactMarkdown>{currentView.body_markdown}</ReactMarkdown>
                  ) : (
                    <p className="text-muted-foreground text-center py-8">
                      Select a version from the timeline to view its content
                    </p>
                  )}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Append-only explanation */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-4">
          <h4 className="font-medium mb-2">Append-Only Version History</h4>
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
