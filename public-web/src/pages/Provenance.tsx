import { useState, useCallback, useMemo, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  Node,
  Edge,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { FileText, BookOpen, Network, MessageSquare, Code, ChevronDown } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { api, GroupedProvenance, EvidenceUnit, PublishedArticle } from "@/lib/api";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { cn } from "@/lib/utils";

// Custom node components
import { TicketNode } from "@/components/graph/TicketNode";
import { DraftNode } from "@/components/graph/DraftNode";
import { PublishedNode } from "@/components/graph/PublishedNode";
import { SectionNode } from "@/components/graph/SectionNode";
import { EvidenceGroupNode } from "@/components/graph/EvidenceGroupNode";

const nodeTypes = {
  ticket: TicketNode,
  draft: DraftNode,
  published: PublishedNode,
  section: SectionNode,
  evidenceGroup: EvidenceGroupNode,
};

interface SelectedGroup {
  sectionLabel: string;
  sourceType: string;
  count: number;
}

const convertToSelectedGroup = (group: GroupedProvenance): SelectedGroup => ({
  sectionLabel: group.section_label,
  sourceType: group.source_type,
  count: group.count,
});

export default function Provenance() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { isDemoMode } = useDemoMode();
  const [selectedArticleId, setSelectedArticleId] = useState<string | null>(
    searchParams.get("kb_article_id")
  );
  const [selectedGroup, setSelectedGroup] = useState<SelectedGroup | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showBuildAnimation, setShowBuildAnimation] = useState(isDemoMode);

  // Fetch all published articles for dropdown
  const { data: articles, isLoading: articlesLoading } = useQuery({
    queryKey: ["articles"],
    queryFn: () => api.getArticles({ limit: 50 }),
  });

  // Auto-select the latest article if none selected
  useEffect(() => {
    if (!selectedArticleId && articles && articles.length > 0) {
      const latestArticle = articles[0]; // Already sorted by created_at desc
      setSelectedArticleId(latestArticle.kb_article_id);
      setSearchParams({ kb_article_id: latestArticle.kb_article_id });
    }
  }, [articles, selectedArticleId, setSearchParams]);

  // Fetch provenance data for selected article
  const { data: provenance, isLoading: provenanceLoading } = useQuery({
    queryKey: ["provenance", selectedArticleId],
    queryFn: () => api.getProvenance(selectedArticleId!),
    enabled: !!selectedArticleId,
    retry: 1,
  });

  const handleArticleSelect = (articleId: string) => {
    setSelectedArticleId(articleId);
    setSearchParams({ kb_article_id: articleId });
  };

  // Build graph nodes and edges using REAL data from provenance
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    if (!provenance) {
      return { nodes, edges };
    }

    // Center positions
    const centerX = 400;
    let yPos = 50;

    // Ticket node - USE REAL DATA
    nodes.push({
      id: "ticket",
      type: "ticket",
      position: { x: centerX - 75, y: yPos },
      data: { ticketNumber: provenance.source_ticket_id || "Unknown" },
    });
    yPos += 120;

    // Draft node - USE REAL DATA
    nodes.push({
      id: "draft",
      type: "draft",
      position: { x: centerX - 75, y: yPos },
      data: { draftId: provenance.latest_draft_id, status: "approved" },
    });
    edges.push({
      id: "e-ticket-draft",
      source: "ticket",
      target: "draft",
      animated: true,
      style: { stroke: "hsl(var(--edge-created))" },
      markerEnd: { type: MarkerType.ArrowClosed },
      label: "CREATED_FROM",
    });
    yPos += 120;

    // Published node - USE REAL DATA
    nodes.push({
      id: "published",
      type: "published",
      position: { x: centerX - 75, y: yPos },
      data: { kbArticleId: provenance.kb_article_id, version: provenance.current_version || 1 },
    });
    edges.push({
      id: "e-draft-published",
      source: "draft",
      target: "published",
      animated: true,
      style: { stroke: "hsl(var(--edge-created))" },
      markerEnd: { type: MarkerType.ArrowClosed },
      label: "CREATED_FROM",
    });
    yPos += 150;

    // Section nodes
    const sections = [...new Set(provenance.grouped.map((g) => g.section_label))];
    const sectionWidth = 160;
    const totalWidth = sections.length * sectionWidth;
    const startX = centerX - totalWidth / 2 + sectionWidth / 2 - 70;

    sections.forEach((section, idx) => {
      const sectionId = `section-${section}`;
      nodes.push({
        id: sectionId,
        type: "section",
        position: { x: startX + idx * sectionWidth, y: yPos },
        data: { label: section },
      });
      edges.push({
        id: `e-published-${section}`,
        source: "published",
        target: sectionId,
        style: { stroke: "hsl(var(--edge-references))", strokeDasharray: "5,5" },
        markerEnd: { type: MarkerType.ArrowClosed },
      });
    });
    yPos += 130;

    // Evidence group nodes
    provenance.grouped.forEach((group, idx) => {
      const groupId = `group-${group.section_label}-${group.source_type}`;
      const sectionIdx = sections.indexOf(group.section_label);
      const sectionX = startX + sectionIdx * sectionWidth;
      
      // Offset groups horizontally within section
      const groupsInSection = provenance.grouped.filter(
        (g) => g.section_label === group.section_label
      );
      const groupIdxInSection = groupsInSection.findIndex(
        (g) => g.source_type === group.source_type
      );
      const offsetX = (groupIdxInSection - (groupsInSection.length - 1) / 2) * 90;

      nodes.push({
        id: groupId,
        type: "evidenceGroup",
        position: { x: sectionX + offsetX, y: yPos + groupIdxInSection * 70 },
        data: {
          sectionLabel: group.section_label,
          sourceType: group.source_type,
          count: group.count,
          onClick: () => {
            setSelectedGroup(convertToSelectedGroup(group));
            setDrawerOpen(true);
          },
        },
      });
      edges.push({
        id: `e-section-${groupId}`,
        source: `section-${group.section_label}`,
        target: groupId,
        style: { stroke: "hsl(var(--muted-foreground))", strokeDasharray: "3,3" },
      });
    });

    return { nodes, edges };
  }, [provenance]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Update nodes when provenance changes
  useEffect(() => {
    setNodes(initialNodes);
    setEdges(initialEdges);
  }, [initialNodes, initialEdges, setNodes, setEdges]);

  // Fetch evidence units for selected group
  const { data: evidenceData, isLoading: evidenceLoading } = useQuery({
    queryKey: ["evidence", selectedArticleId, selectedGroup?.sectionLabel, selectedGroup?.sourceType],
    queryFn: () =>
      api.getEvidenceUnits({
        kbArticleId: selectedArticleId!,
        sectionLabel: selectedGroup!.sectionLabel,
        sourceType: selectedGroup!.sourceType,
        limit: 20,
      }),
    enabled: !!selectedGroup && !!selectedArticleId,
    retry: 1,
  });

  const displayEvidence = evidenceData?.evidence_units || [];

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case "TICKET": return FileText;
      case "CONVERSATION": return MessageSquare;
      case "SCRIPT": return Code;
      case "PLACEHOLDER": return BookOpen;
      default: return FileText;
    }
  };

  const selectedArticle = articles?.find(a => a.kb_article_id === selectedArticleId);

  if (articlesLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Provenance Graph</h1>
          <p className="text-muted-foreground">Loading articles...</p>
        </div>
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (!articles || articles.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Network className="h-6 w-6" />
            Provenance Graph
          </h1>
          <p className="text-muted-foreground">
            No published articles yet. Complete the Guided Flow to create one!
          </p>
        </div>
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">
            Go to <strong>Guided Flow</strong> to create your first KB article with full provenance tracking.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Network className="h-6 w-6" />
            Provenance Graph
          </h1>
          <p className="text-muted-foreground">
            Trace every KB article section back to its source evidence
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
                  </div>
                  <span className="text-xs text-muted-foreground truncate max-w-full">
                    {article.title}
                  </span>
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Build Animation Toggle */}
          <div className="flex items-center gap-2">
            <Switch
              id="build-animation"
              checked={showBuildAnimation}
              onCheckedChange={setShowBuildAnimation}
            />
            <Label htmlFor="build-animation" className="text-xs text-muted-foreground cursor-pointer">
              Show build animation
            </Label>
          </div>
          <Badge variant="outline" className="gap-1">
            {provenance?.total_edges || 0} edges
          </Badge>
        </div>
      </div>

      {/* Graph Info */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-3 flex items-center gap-4">
          <div className="flex items-center gap-2 text-sm">
            <div className="h-3 w-8 rounded bg-success" />
            <span className="text-muted-foreground">CREATED_FROM (solid)</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <div className="h-3 w-8 rounded bg-primary" style={{ backgroundImage: 'repeating-linear-gradient(90deg, transparent, transparent 2px, hsl(var(--primary)) 2px, hsl(var(--primary)) 4px)' }} />
            <span className="text-muted-foreground">REFERENCES (dashed)</span>
          </div>
          <div className="ml-auto text-xs text-muted-foreground">
            Read-only visualization • Click grouped nodes to view evidence
          </div>
        </CardContent>
      </Card>

      {provenanceLoading ? (
        <Skeleton className="h-[600px] w-full" />
      ) : (
        <Card className="overflow-hidden">
          <div className="h-[600px] w-full">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              fitView
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              edgesReconnectable={false}
              panOnScroll
              zoomOnScroll
            >
              <Background />
              <Controls showInteractive={false} />
              <MiniMap 
                nodeColor={(node) => {
                  switch (node.type) {
                    case "ticket": return "hsl(var(--node-ticket))";
                    case "draft": return "hsl(var(--node-draft))";
                    case "published": return "hsl(var(--node-published))";
                    case "section": return "hsl(var(--node-section))";
                    default: return "hsl(var(--node-evidence))";
                  }
                }}
                maskColor="hsl(var(--background) / 0.8)"
              />
            </ReactFlow>
          </div>
        </Card>
      )}

      {/* Evidence Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-[400px] sm:w-[540px]">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              {selectedGroup && (
                <>
                  {(() => {
                    const Icon = getSourceIcon(selectedGroup.sourceType);
                    return <Icon className="h-5 w-5" />;
                  })()}
                  {selectedGroup.sectionLabel.replace(/_/g, " ")} × {selectedGroup.sourceType}
                </>
              )}
            </SheetTitle>
            <SheetDescription>
              {selectedGroup?.count} evidence units from this source
            </SheetDescription>
          </SheetHeader>

          <ScrollArea className="h-[calc(100vh-120px)] mt-4">
            <div className="space-y-3 pr-4">
              {evidenceLoading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <Skeleton className="h-4 w-24 mb-2" />
                      <Skeleton className="h-16 w-full" />
                    </CardContent>
                  </Card>
                ))
              ) : displayEvidence.length === 0 ? (
                <Card>
                  <CardContent className="p-4 text-center text-muted-foreground">
                    No evidence units found for this selection.
                  </CardContent>
                </Card>
              ) : (
                displayEvidence.map((unit) => (
                  <Card key={unit.evidence_unit_id}>
                    <CardContent className="p-4 space-y-2">
                      <div className="flex items-center justify-between">
                        <code className="text-xs font-mono text-muted-foreground">
                          {unit.evidence_unit_id}
                        </code>
                        <Badge variant="outline" className="text-xs">
                          {unit.source_type}
                        </Badge>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        Source: <code>{unit.source_id}</code> • Field: <code>{unit.field_name}</code>
                      </div>
                      <p className="text-sm bg-muted/50 rounded p-2 border-l-2 border-primary">
                        {unit.snippet_text}
                      </p>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          </ScrollArea>
        </SheetContent>
      </Sheet>
    </div>
  );
}
