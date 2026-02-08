import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { FileText, MessageSquare, Code, BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface EvidenceGroupNodeData {
  sectionLabel: string;
  sourceType: string;
  count: number;
  onClick: () => void;
}

const sourceTypeIcons: Record<string, React.ElementType> = {
  TICKET: FileText,
  CONVERSATION: MessageSquare,
  SCRIPT: Code,
  PLACEHOLDER: BookOpen,
};

const sourceTypeColors: Record<string, string> = {
  TICKET: "border-warning bg-warning/5 hover:bg-warning/10",
  CONVERSATION: "border-primary bg-primary/5 hover:bg-primary/10",
  SCRIPT: "border-success bg-success/5 hover:bg-success/10",
  PLACEHOLDER: "border-muted-foreground bg-muted hover:bg-muted/80",
};

export const EvidenceGroupNode = memo(({ data }: { data: EvidenceGroupNodeData }) => {
  const Icon = sourceTypeIcons[data.sourceType] || FileText;
  const colorClass = sourceTypeColors[data.sourceType] || "border-muted bg-muted";

  return (
    <button
      onClick={data.onClick}
      className={`rounded-lg border-2 p-2 shadow-sm transition-colors cursor-pointer ${colorClass}`}
    >
      <Handle type="target" position={Position.Top} className="!bg-muted-foreground" />
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] font-medium">{data.sourceType}</span>
        <Badge variant="secondary" className="text-[10px] px-1.5">
          {data.count}
        </Badge>
      </div>
    </button>
  );
});

EvidenceGroupNode.displayName = "EvidenceGroupNode";
