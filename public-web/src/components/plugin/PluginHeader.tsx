import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface PluginHeaderProps {
  onLoadDemoScenario: () => void;
  onGenerateScenario: (mode: "new" | "v2_update") => void;
  isGeneratingScenario?: boolean;
}

export function PluginHeader({
  onLoadDemoScenario,
  onGenerateScenario,
  isGeneratingScenario,
}: PluginHeaderProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-sm font-semibold">Trust-Me-Bro Plugin</div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span className="h-2 w-2 rounded-full bg-emerald-500" />
            Connected to KB Engine
          </div>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button size="sm" variant="secondary" className="gap-2" disabled={isGeneratingScenario}>
              <Sparkles className="h-4 w-4" />
              {isGeneratingScenario ? "Generating..." : "Load Scenario"}
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={onLoadDemoScenario}>
              Load Demo Scenario
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onGenerateScenario("new")}>
              Generate New Ticket (AI)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => onGenerateScenario("v2_update")}>
              Generate V2 Update (AI)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

    </div>
  );
}
