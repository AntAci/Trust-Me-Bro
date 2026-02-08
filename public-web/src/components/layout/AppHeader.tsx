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
          <Badge className="gap-1.5 bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400">
            <Database className="h-3 w-3" />
            <span>Sample Dataset</span>
          </Badge>
        )}
        <div className="flex items-center gap-2">
          <Switch
            id="demo-mode"
            checked={isDemoMode}
            onCheckedChange={setIsDemoMode}
          />
          <Label htmlFor="demo-mode" className="text-sm cursor-pointer text-muted-foreground">
            Sandbox
          </Label>
        </div>
      </div>
    </header>
  );
}
