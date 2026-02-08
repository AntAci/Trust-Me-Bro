import { SidebarTrigger } from "@/components/ui/sidebar";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { Sparkles, Database } from "lucide-react";

export function AppHeader() {
  const { isDemoMode, setIsDemoMode } = useDemoMode();

  return (
    <header className="flex h-14 items-center justify-between border-b bg-card px-4">
      <div className="flex items-center gap-4">
        <SidebarTrigger />
        <div className="hidden items-center gap-2 md:flex">
          <h1 className="text-lg font-semibold">TMB | Trust Me Bro</h1>
          <Badge variant="secondary" className="text-xs">
            Self-Learning Support Intelligence
          </Badge>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {isDemoMode && (
          <Badge className="gap-1.5 bg-primary/10 text-primary hover:bg-primary/20 animate-pulse-once">
            <Sparkles className="h-3 w-3" />
            <span>DEMO MODE</span>
            <span className="text-primary/60">•</span>
            <span className="text-primary/80 flex items-center gap-1">
              <Database className="h-2.5 w-2.5" />
              Demo flow
            </span>
          </Badge>
        )}
        <div className="flex items-center gap-2">
          <Switch
            id="demo-mode"
            checked={isDemoMode}
            onCheckedChange={setIsDemoMode}
          />
          <Label htmlFor="demo-mode" className="text-sm cursor-pointer">
            Demo
          </Label>
        </div>
      </div>
    </header>
  );
}
