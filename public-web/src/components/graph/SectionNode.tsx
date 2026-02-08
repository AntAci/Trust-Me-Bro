import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import { Layers } from "lucide-react";

interface SectionNodeData {
  label: string;
}

export const SectionNode = memo(({ data }: { data: SectionNodeData }) => {
  const formatLabel = (label: string) => {
    return label
      .split("_")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  return (
    <div className="rounded-lg border-2 border-node-section bg-card p-2 shadow-md min-w-[120px]">
      <Handle type="target" position={Position.Top} className="!bg-node-section" />
      <Handle type="source" position={Position.Bottom} className="!bg-node-section" />
      <div className="flex items-center gap-2">
        <Layers className="h-3.5 w-3.5 text-node-section" />
        <p className="text-xs font-medium">{formatLabel(data.label)}</p>
      </div>
    </div>
  );
});

SectionNode.displayName = "SectionNode";
