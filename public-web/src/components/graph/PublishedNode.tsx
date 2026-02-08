import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { BookCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface PublishedNodeData {
  kbArticleId: string;
  version: number;
}

export const PublishedNode = memo(({ data }: { data: PublishedNodeData }) => {
  return (
    <div className="rounded-lg border-2 border-success bg-card p-3 shadow-md min-w-[150px]">
      <Handle type="target" position={Position.Top} className="!bg-success" />
      <Handle type="source" position={Position.Bottom} className="!bg-success" />
      <div className="flex items-center gap-2">
        <div className="rounded-md bg-success/10 p-1.5">
          <BookCheck className="h-4 w-4 text-success" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-muted-foreground">Published KB</p>
          <p className="font-mono text-xs truncate">{data.kbArticleId}</p>
        </div>
        <Badge className="bg-success/10 text-success text-[10px]">
          v{data.version}
        </Badge>
      </div>
    </div>
  );
});

PublishedNode.displayName = "PublishedNode";
