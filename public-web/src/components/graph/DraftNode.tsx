import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface DraftNodeData {
  draftId: string;
  status: string;
}

export const DraftNode = memo(({ data }: { data: DraftNodeData }) => {
  return (
    <div className="rounded-lg border-2 border-primary bg-card p-3 shadow-md min-w-[150px]">
      <Handle type="target" position={Position.Top} className="!bg-primary" />
      <Handle type="source" position={Position.Bottom} className="!bg-primary" />
      <div className="flex items-center gap-2">
        <div className="rounded-md bg-primary/10 p-1.5">
          <FileText className="h-4 w-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[10px] text-muted-foreground">Draft</p>
          <p className="font-mono text-xs truncate">{data.draftId}</p>
        </div>
        <Badge variant="secondary" className="text-[10px] capitalize">
          {data.status}
        </Badge>
      </div>
    </div>
  );
});

DraftNode.displayName = "DraftNode";
