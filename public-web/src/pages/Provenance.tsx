import { useState, useCallback, useMemo } from "react";
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
import { FileText, BookOpen, Network, MessageSquare, Code, Play, Pause } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { api, GroupedProvenance, EvidenceUnit } from "@/lib/api";
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

// Mock provenance data
const mockProvenance = {
  kb_article_id: "kb-001",
  latest_draft_id: "draft-001",
  grouped: [
    { section_label: "problem", source_type: "TICKET", count: 2 },
    { section_label: "symptoms", source_type: "TICKET", count: 2 },
    { section_label: "symptoms", source_type: "CONVERSATION", count: 3 },
    { section_label: "root_cause", source_type: "TICKET", count: 1 },
    { section_label: "root_cause", source_type: "CONVERSATION", count: 3 },
    { section_label: "resolution_steps", source_type: "CONVERSATION", count: 4 },
    { section_label: "resolution_steps", source_type: "SCRIPT", count: 1 },
    { section_label: "placeholders_needed", source_type: "SCRIPT", count: 2 },
    { section_label: "placeholders_needed", source_type: "PLACEHOLDER", count: 3 },
  ],
  total_edges: 21,
};

// Mock evidence units
const mockEvidenceUnits: EvidenceUnit[] = [
  { evidence_unit_id: "eu-1", source_type: "TICKET", source_id: "CS-38908386", field_name: "description", snippet_text: "Users are experiencing timeout errors when attempting to process payments..." },
  { evidence_unit_id: "eu-2", source_type: "TICKET", source_id: "CS-38908386", field_name: "resolution", snippet_text: "Increased connection pool size from 10 to 50 connections..." },
  { evidence_unit_id: "eu-3", source_type: "CONVERSATION", source_id: "conv-001", field_name: "agent_response", snippet_text: "I can see the payment is timing out. Let me check the logs..." },
  { evidence_unit_id: "eu-4", source_type: "SCRIPT", source_id: "script-payment", field_name: "step_3", snippet_text: "Verify database connection pool settings in config..." },
];

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
  const [searchParams] = useSearchParams();
  const { isDemoMode } = useDemoMode();
  const kbArticleId = searchParams.get("kb_article_id") || "kb-001";
  const [selectedGroup, setSelectedGroup] = useState<SelectedGroup | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showBuildAnimation, setShowBuildAnimation] = useState(isDemoMode);

  // Fetch provenance data
  const { data: provenance, isLoading } = useQuery({
    queryKey: ["provenance", kbArticleId],
    queryFn: () => api.getProvenance(kbArticleId),
    retry: 1,
  });

  const displayProvenance = provenance || mockProvenance;

  // Build graph nodes and edges
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];

    // Center positions
    const centerX = 400;
    let yPos = 50;

    // Ticket node
    nodes.push({
      id: "ticket",
      type: "ticket",
      position: { x: centerX - 75, y: yPos },
      data: { ticketNumber: "CS-38908386" },
    });
    yPos += 120;

    // Draft node
    nodes.push({
      id: "draft",
      type: "draft",
      position: { x: centerX - 75, y: yPos },
      data: { draftId: displayProvenance.latest_draft_id, status: "approved" },
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

    // Published node
    nodes.push({
      id: "published",
      type: "published",
      position: { x: centerX - 75, y: yPos },
      data: { kbArticleId: displayProvenance.kb_article_id, version: 1 },
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
    const sections = [...new Set(displayProvenance.grouped.map((g) => g.section_label))];
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
    displayProvenance.grouped.forEach((group, idx) => {
      const groupId = `group-${group.section_label}-${group.source_type}`;
      const sectionIdx = sections.indexOf(group.section_label);
      const sectionX = startX + sectionIdx * sectionWidth;
      
      // Offset groups horizontally within section
      const groupsInSection = displayProvenance.grouped.filter(
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
  }, [displayProvenance]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  // Fetch evidence units for selected group
  const { data: evidenceData, isLoading: evidenceLoading } = useQuery({
    queryKey: ["evidence", kbArticleId, selectedGroup?.sectionLabel, selectedGroup?.sourceType],
    queryFn: () =>
      api.getEvidenceUnits({
        kbArticleId,
        sectionLabel: selectedGroup!.sectionLabel,
        sourceType: selectedGroup!.sourceType,
        limit: 20,
      }),
    enabled: !!selectedGroup,
    retry: 1,
  });

  const displayEvidence = evidenceData?.evidence_units || 
    mockEvidenceUnits.filter((e) => e.source_type === selectedGroup?.sourceType);

  const getSourceIcon = (sourceType: string) => {
    switch (sourceType) {
      case "TICKET": return FileText;
      case "CONVERSATION": return MessageSquare;
      case "SCRIPT": return Code;
      case "PLACEHOLDER": return BookOpen;
      default: return FileText;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Provenance Graph</h1>
          <p className="text-muted-foreground">Loading...</p>
        </div>
        <Skeleton className="h-[600px] w-full" />
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
            {displayProvenance.total_edges} edges
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
