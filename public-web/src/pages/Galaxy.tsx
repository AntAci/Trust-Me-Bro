import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  ReactFlow,
  Background,
  Controls,
  Node,
  Edge,
  MarkerType,
  Handle,
  Position,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Sparkles, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";

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

// Neon color palette
const NEON_COLORS = {
  ticket: {
    bg: "#ff9500",
    glow: "0 0 20px rgba(255, 149, 0, 0.8), 0 0 40px rgba(255, 149, 0, 0.4)",
    border: "#ffb347",
    text: "#1a1a1a",
  },
  draft: {
    bg: "#00d4ff",
    glow: "0 0 20px rgba(0, 212, 255, 0.8), 0 0 40px rgba(0, 212, 255, 0.4)",
    border: "#5ce1e6",
    text: "#1a1a1a",
  },
  article: {
    bg: "#39ff14",
    glow: "0 0 20px rgba(57, 255, 20, 0.8), 0 0 40px rgba(57, 255, 20, 0.4)",
    border: "#7fff00",
    text: "#1a1a1a",
  },
  version: {
    bg: "#bf00ff",
    glow: "0 0 20px rgba(191, 0, 255, 0.8), 0 0 40px rgba(191, 0, 255, 0.4)",
    border: "#da70d6",
    text: "#ffffff",
  },
};

// Custom neon circle node component - clean circles only
function NeonNode({ data }: { data: any }) {
  const [isHovered, setIsHovered] = useState(false);

  const getNodeConfig = () => {
    switch (data.nodeType) {
      case "ticket":
        return { colors: NEON_COLORS.ticket, size: 20 };
      case "draft":
        return { colors: NEON_COLORS.draft, size: 18 };
      case "article":
        return { colors: NEON_COLORS.article, size: 22 };
      case "version":
        return { colors: NEON_COLORS.version, size: 14 };
      default:
        return { colors: { bg: "#666", glow: "none", border: "#888", text: "#fff" }, size: 16 };
    }
  };

  const config = getNodeConfig();
  const isHighlighted = data.isHighlighted;

  return (
    <TooltipProvider delayDuration={0}>
      <Tooltip open={isHovered}>
        <TooltipTrigger asChild>
          <div
            onMouseEnter={() => setIsHovered(true)}
            onMouseLeave={() => setIsHovered(false)}
            className="rounded-full cursor-pointer transition-all duration-200"
            style={{
              width: config.size,
              height: config.size,
              background: config.colors.bg,
              boxShadow: isHovered 
                ? config.colors.glow 
                : `0 0 12px ${config.colors.bg}70`,
              border: `2px solid ${config.colors.border}`,
              transform: isHovered ? "scale(1.8)" : isHighlighted ? "scale(1.3)" : "scale(1)",
              zIndex: isHovered ? 9999 : "auto",
            }}
          >
            <Handle type="target" position={Position.Top} className="opacity-0" />
            <Handle type="source" position={Position.Bottom} className="opacity-0" />
          </div>
        </TooltipTrigger>
        <TooltipContent 
          side="top" 
          sideOffset={12}
          className="max-w-xs bg-slate-900/95 border-2 shadow-2xl px-4 py-3"
          style={{ 
            zIndex: 10000,
            borderColor: config.colors.bg,
            boxShadow: `0 0 20px ${config.colors.bg}50`,
          }}
        >
          <div className="space-y-2">
            <p className="font-bold text-sm text-white">{data.label}</p>
            <div className="flex flex-wrap items-center gap-2">
              <Badge 
                className="text-[10px] font-bold"
                style={{ 
                  background: config.colors.bg,
                  color: config.colors.text,
                }}
              >
                {data.nodeType.toUpperCase()}
              </Badge>
              {data.status && (
                <Badge variant="outline" className="text-[10px] text-slate-300 border-slate-600">
                  {data.status}
                </Badge>
              )}
              {data.version && (
                <Badge className="text-[10px] bg-purple-600 text-white">
                  v{data.version}
                </Badge>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

const nodeTypes = {
  galaxy: NeonNode,
};

const scalePoint = (value: number, size: number, padding = 100) =>
  (value + 1) * ((size - padding * 2) / 2) + padding;

export default function Galaxy() {
  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["galaxy"],
    queryFn: () => api.getGalaxy(),
    retry: 1,
    refetchOnWindowFocus: false,
  });

  const { nodes, edges, stats } = useMemo(() => {
    if (!data) {
      return { nodes: [], edges: [], stats: { tickets: 0, drafts: 0, articles: 0, versions: 0 } };
    }
    
    const width = 1200;
    const height = 700;
    const centerX = width / 2;
    const centerY = height / 2;
    
    const stats = { tickets: 0, drafts: 0, articles: 0, versions: 0 };
    
    const nodes: Node[] = data.nodes.map((node) => {
      if (node.type === "ticket") stats.tickets++;
      else if (node.type === "draft") stats.drafts++;
      else if (node.type === "article") stats.articles++;
      else if (node.type === "version") stats.versions++;
      
      const isHighlighted = node.id === data.highlights?.latest_published_version_node_id;
      
      return {
        id: node.id,
        type: "galaxy",
        position: {
          x: scalePoint(node.x, width),
          y: scalePoint(node.y, height),
        },
        data: {
          label: node.label,
          nodeType: node.type,
          version: node.version,
          status: node.status,
          isHighlighted,
        },
      };
    });
    
    // No center node - clean visualization

    // Neon edges
    const edges: Edge[] = data.edges.map((edge, index) => {
      let color = "rgba(100, 100, 100, 0.3)";
      let animated = false;
      
      if (edge.type === "ticket_to_draft") {
        color = NEON_COLORS.draft.bg + "60";
        animated = true;
      } else if (edge.type === "draft_to_article") {
        color = NEON_COLORS.article.bg + "60";
        animated = true;
      } else if (edge.type === "version_chain") {
        color = NEON_COLORS.version.bg + "40";
      }
      
      return {
        id: `edge-${index}`,
        source: edge.from,
        target: edge.to,
        animated,
        style: {
          stroke: color,
          strokeWidth: edge.type === "version_chain" ? 1 : 2,
        },
        markerEnd: { 
          type: MarkerType.ArrowClosed,
          color: color.replace("60", "90").replace("40", "70"),
          width: 10,
          height: 10,
        },
      };
    });
    
    return { nodes, edges, stats };
  }, [data]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-purple-500" />
            Knowledge Galaxy
          </h1>
          <p className="text-muted-foreground">Loading live data...</p>
        </div>
        <Skeleton className="h-[700px] w-full" />
      </div>
    );
  }

  if (!data || data.nodes.length === 0) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-purple-500" />
            Knowledge Galaxy
          </h1>
          <p className="text-muted-foreground">
            No data available yet. Publish some articles to see them here!
          </p>
        </div>
        <Card className="p-8 text-center bg-slate-900 border-slate-700">
          <p className="text-slate-400">
            The galaxy populates automatically when you publish KB articles through the Support Console.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Sparkles className="h-6 w-6 text-purple-500" />
            Knowledge Galaxy
          </h1>
          <p className="text-muted-foreground text-sm">
            Live visualization of your knowledge ecosystem
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            disabled={isFetching}
            className="gap-2"
          >
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            Refresh
          </Button>
          <Badge variant="secondary" className="text-xs">
            {data.nodes.length} nodes • Live Data
          </Badge>
        </div>
      </div>

      {/* Legend - Dark background with readable text */}
      <div className="flex flex-wrap items-center gap-6 px-5 py-4 rounded-lg bg-slate-900 border border-slate-700">
        <span className="text-sm font-semibold text-white">LEGEND</span>
        <div className="flex items-center gap-2">
          <div 
            className="h-4 w-4 rounded-full" 
            style={{ background: NEON_COLORS.ticket.bg, boxShadow: `0 0 10px ${NEON_COLORS.ticket.bg}` }} 
          />
          <span className="text-sm font-medium text-white">Tickets</span>
          <Badge className="text-xs bg-orange-500/20 text-orange-300 border border-orange-500/30">{stats.tickets}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <div 
            className="h-4 w-4 rounded-full" 
            style={{ background: NEON_COLORS.draft.bg, boxShadow: `0 0 10px ${NEON_COLORS.draft.bg}` }} 
          />
          <span className="text-sm font-medium text-white">Drafts</span>
          <Badge className="text-xs bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">{stats.drafts}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <div 
            className="h-4 w-4 rounded-full" 
            style={{ background: NEON_COLORS.article.bg, boxShadow: `0 0 10px ${NEON_COLORS.article.bg}` }} 
          />
          <span className="text-sm font-medium text-white">Published</span>
          <Badge className="text-xs bg-green-500/20 text-green-300 border border-green-500/30">{stats.articles}</Badge>
        </div>
        <div className="flex items-center gap-2">
          <div 
            className="h-4 w-4 rounded-full" 
            style={{ background: NEON_COLORS.version.bg, boxShadow: `0 0 10px ${NEON_COLORS.version.bg}` }} 
          />
          <span className="text-sm font-medium text-white">Versions</span>
          <Badge className="text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30">{stats.versions}</Badge>
        </div>
      </div>

      {/* Graph - Dark themed with neon */}
      <Card className="overflow-hidden border-slate-800 bg-slate-950">
        <CardContent className="p-0">
          <div className="h-[650px] w-full relative" style={{ background: "radial-gradient(ellipse at center, #1a1a2e 0%, #0f0f1a 70%, #0a0a0f 100%)" }}>
            {/* Neon ring circles */}
            <svg 
              className="absolute inset-0 w-full h-full pointer-events-none" 
              viewBox="0 0 1200 700"
              preserveAspectRatio="xMidYMid meet"
            >
              {/* Center glow */}
              <defs>
                <radialGradient id="neon-glow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="rgba(138, 43, 226, 0.3)" />
                  <stop offset="100%" stopColor="rgba(138, 43, 226, 0)" />
                </radialGradient>
              </defs>
              <circle cx="600" cy="350" r="100" fill="url(#neon-glow)" />
              
              {/* Ticket ring */}
              <circle 
                cx="600" cy="350" r="100" 
                fill="none" 
                stroke={NEON_COLORS.ticket.bg}
                strokeWidth="1"
                strokeDasharray="8 6"
                opacity="0.4"
              />
              {/* Draft ring */}
              <circle 
                cx="600" cy="350" r="180" 
                fill="none" 
                stroke={NEON_COLORS.draft.bg}
                strokeWidth="1"
                strokeDasharray="8 6"
                opacity="0.35"
              />
              {/* Article ring */}
              <circle 
                cx="600" cy="350" r="260" 
                fill="none" 
                stroke={NEON_COLORS.article.bg}
                strokeWidth="1"
                strokeDasharray="8 6"
                opacity="0.35"
              />
              {/* Version ring */}
              <circle 
                cx="600" cy="350" r="320" 
                fill="none" 
                stroke={NEON_COLORS.version.bg}
                strokeWidth="1"
                strokeDasharray="8 6"
                opacity="0.3"
              />
            </svg>
            
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.15 }}
              nodesDraggable={true}
              nodesConnectable={false}
              elementsSelectable={true}
              panOnScroll
              zoomOnScroll
              minZoom={0.3}
              maxZoom={2.5}
            >
              <Background gap={30} size={1} color="rgba(255,255,255,0.03)" />
              <Controls 
                showInteractive={false} 
                className="bg-slate-800 border-slate-700 rounded-lg"
              />
            </ReactFlow>
            
            {/* Interaction hint */}
            <div className="absolute bottom-4 left-4 text-xs text-slate-500 bg-slate-900/80 px-3 py-1.5 rounded-full">
              💡 Hover nodes for details • Scroll to zoom • Drag to pan
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
