import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ReactFlow,
  Background,
  Controls,
  Node,
  Edge,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

type GalaxyNode = {
  id: string;
  type: string;
  label: string;
  x: number;
  y: number;
  status?: string | null;
  version?: number | null;
  meta?: Record<string, string | null | number>;
};

type GalaxyEdge = {
  from: string;
  to: string;
  type: string;
};

type GalaxyResponse = {
  computed_at: string;
  layout: { method: string; seed: number; limit: number };
  nodes: GalaxyNode[];
  edges: GalaxyEdge[];
  highlights: { latest_published_version_node_id?: string | null };
};

const NODE_COLORS: Record<string, string> = {
  ticket: "hsl(var(--node-ticket))",
  draft: "hsl(var(--node-draft))",
  article: "hsl(var(--node-published))",
  version: "hsl(var(--node-version))",
};

const EDGE_COLORS: Record<string, string> = {
  ticket_to_draft: "hsl(var(--edge-created))",
  draft_to_article: "hsl(var(--edge-created))",
  version_chain: "hsl(var(--edge-references))",
};

const scalePoint = (value: number, size: number, padding = 80) =>
  (value + 1) * ((size - padding * 2) / 2) + padding;

export default function Galaxy() {
  const { data, isLoading } = useQuery({
    queryKey: ["galaxy"],
    queryFn: () => api.getGalaxy(),
    retry: 1,
  });

  const { nodes, edges } = useMemo(() => {
    if (!data) {
      return { nodes: [], edges: [] };
    }
    const width = 960;
    const height = 620;
    const nodes: Node[] = data.nodes.map((node) => {
      const color = NODE_COLORS[node.type] || "hsl(var(--muted-foreground))";
      const isHighlighted = node.id === data.highlights?.latest_published_version_node_id;
      return {
        id: node.id,
        position: {
          x: scalePoint(node.x, width),
          y: scalePoint(node.y, height),
        },
        data: {
          label: node.label,
          type: node.type,
          version: node.version,
          status: node.status,
        },
        style: {
          borderRadius: 999,
          border: isHighlighted
            ? "2px solid hsl(var(--primary))"
            : "1px solid hsl(var(--border))",
          background: isHighlighted
            ? "hsl(var(--primary) / 0.1)"
            : "hsl(var(--background))",
          padding: "6px 10px",
          fontSize: "12px",
          color: "hsl(var(--foreground))",
          boxShadow: `0 0 0 2px ${color}40`,
        },
      };
    });

    const edges: Edge[] = data.edges.map((edge, index) => ({
      id: `edge-${index}`,
      source: edge.from,
      target: edge.to,
      animated: edge.type === "ticket_to_draft" || edge.type === "draft_to_article",
      style: {
        stroke: EDGE_COLORS[edge.type] || "hsl(var(--muted-foreground))",
        strokeDasharray: edge.type === "version_chain" ? "6 4" : undefined,
      },
      markerEnd: { type: MarkerType.ArrowClosed },
    }));
    return { nodes, edges };
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Galaxy</h1>
          <p className="text-muted-foreground">Loading semantic layout...</p>
        </div>
        <Skeleton className="h-[620px] w-full" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Galaxy</h1>
          <p className="text-muted-foreground">No galaxy data available.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-primary" />
            Knowledge Galaxy
          </h1>
          <p className="text-muted-foreground">
            Semantic clustering of tickets, drafts, and published knowledge
          </p>
        </div>
        <Badge variant="outline" className="text-xs">
          {data.layout.method} • seed {data.layout.seed} • {data.nodes.length} nodes
        </Badge>
      </div>

      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="py-3 flex flex-wrap items-center gap-4 text-sm">
          <span className="text-muted-foreground">Legend</span>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-warning" />
            <span className="text-muted-foreground">Tickets</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-primary" />
            <span className="text-muted-foreground">Drafts</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-success" />
            <span className="text-muted-foreground">Published</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-muted-foreground" />
            <span className="text-muted-foreground">Versions</span>
          </div>
        </CardContent>
      </Card>

      <Card className="overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Galaxy Layout</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="h-[620px] w-full">
            <ReactFlow
              nodes={nodes}
              edges={edges}
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
            </ReactFlow>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
