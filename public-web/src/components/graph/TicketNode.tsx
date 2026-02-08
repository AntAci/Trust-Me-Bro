import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { Ticket } from "lucide-react";

interface TicketNodeData {
  ticketNumber: string;
}

export const TicketNode = memo(({ data }: { data: TicketNodeData }) => {
  return (
    <div className="rounded-lg border-2 border-warning bg-card p-3 shadow-md min-w-[150px]">
      <Handle type="source" position={Position.Bottom} className="!bg-warning" />
      <div className="flex items-center gap-2">
        <div className="rounded-md bg-warning/10 p-1.5">
          <Ticket className="h-4 w-4 text-warning" />
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground">Ticket</p>
          <p className="font-mono text-sm font-medium">{data.ticketNumber}</p>
        </div>
      </div>
    </div>
  );
});

TicketNode.displayName = "TicketNode";
