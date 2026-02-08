import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Node,
  Edge,
  MarkerType,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Network, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FlowState } from "@/pages/GuidedFlow";
import { cn } from "@/lib/utils";

interface ProvenancePreviewProps {
  flowState: FlowState;
  onOpenFullView: () => void;
  animateNodes?: boolean;
}

// Minimal custom nodes for preview
const SimpleNode = ({ data }: { data: { label: string; color: string; animate?: boolean } }) => (
  <div 
    className={cn(
      "px-3 py-2 rounded-lg border-2 text-xs font-medium shadow-sm",
      data.animate && "animate-reveal"
    )}
    style={{ 
      borderColor: data.color, 
      backgroundColor: `${data.color}15` 
    }}
  >
    {data.label}
  </div>
);

const nodeTypes = { simple: SimpleNode };

export function ProvenancePreview({ 
  flowState, 
  onOpenFullView,
  animateNodes = true 
}: ProvenancePreviewProps) {
  const { nodes, edges, edgeCount } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    let count = 0;

    const ticketColor = "hsl(38, 92%, 50%)";
    const draftColor = "hsl(221, 83%, 53%)";
    const publishedColor = "hsl(142, 76%, 36%)";

    // Ticket node (always visible if ticket selected)
    if (flowState.ticketId) {
      nodes.push({
        id: "ticket",
        type: "simple",
        position: { x: 150, y: 20 },
        data: { 
          label: `📋 ${flowState.ticketNumber || "Ticket"}`, 
          color: ticketColor,
          animate: animateNodes
        },
      });
      count += 1;
    }

    // Draft node (visible if draft exists)
    if (flowState.draftId) {
      nodes.push({
        id: "draft",
        type: "simple",
        position: { x: 150, y: 80 },
        data: { 
          label: `📝 Draft`, 
          color: draftColor,
          animate: animateNodes
        },
      });
      edges.push({
        id: "e-ticket-draft",
        source: "ticket",
        target: "draft",
        animated: true,
        style: { stroke: publishedColor },
        markerEnd: { type: MarkerType.ArrowClosed },
        className: animateNodes ? "edge-animate" : "",
      });
      count += 8;
    }

    // Published node (visible if published)
    if (flowState.kbArticleId) {
      nodes.push({
        id: "published",
        type: "simple",
        position: { x: 150, y: 140 },
        data: { 
          label: `📚 KB v${flowState.currentVersion}`, 
          color: publishedColor,
          animate: animateNodes
        },
      });
      edges.push({
        id: "e-draft-published",
        source: "draft",
        target: "published",
        animated: true,
        style: { stroke: publishedColor },
        markerEnd: { type: MarkerType.ArrowClosed },
        className: animateNodes ? "edge-animate" : "",
      });
      count += 6;

      // Show v2 node if version > 1
      if (flowState.currentVersion && flowState.currentVersion > 1) {
        nodes.push({
          id: "published-v2",
          type: "simple",
          position: { x: 150, y: 200 },
          data: { 
            label: `📚 KB v${flowState.currentVersion}`, 
            color: publishedColor,
            animate: animateNodes
          },
        });
        // Update v1 label
        const v1Node = nodes.find(n => n.id === "published");
        if (v1Node) {
          v1Node.data.label = `📚 KB v1`;
        }
        edges.push({
          id: "e-v1-v2",
          source: "published",
          target: "published-v2",
          animated: true,
          style: { stroke: publishedColor },
          markerEnd: { type: MarkerType.ArrowClosed },
          className: animateNodes ? "edge-animate" : "",
        });
        count += 4;
      }
    }

    return { nodes, edges, edgeCount: count };
  }, [flowState, animateNodes]);

  const hasContent = nodes.length > 0;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="py-3 px-4">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <Network className="h-4 w-4 text-primary" />
            Provenance Preview
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs counter-glow">
              {edgeCount} edges
            </Badge>
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={onOpenFullView}
              className="h-7 text-xs gap-1"
            >
              <ExternalLink className="h-3 w-3" />
              Full View
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <div className="h-[180px] w-full bg-muted/30">
          {hasContent ? (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              fitView
              nodesDraggable={false}
              nodesConnectable={false}
              elementsSelectable={false}
              panOnDrag={false}
              zoomOnScroll={false}
              zoomOnPinch={false}
              zoomOnDoubleClick={false}
              preventScrolling={false}
              proOptions={{ hideAttribution: true }}
            >
              <Background gap={16} size={1} />
            </ReactFlow>
          ) : (
            <div className="h-full flex items-center justify-center text-sm text-muted-foreground">
              <p>Provenance builds as you progress</p>
            </div>
          )}
        </div>
        <div className="px-4 py-2 border-t bg-muted/20">
          <p className="text-[10px] text-muted-foreground">
            Every claim is linked to evidence. Click Full View to audit.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
