import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Ticket, FileText, BookCheck, Layers, ArrowRight, Sparkles } from 'lucide-react';

export function LivingKnowledgeMap() {
  return (
    <Card className="overflow-hidden border-primary/10 bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-900 dark:via-slate-900 dark:to-slate-800">
      <CardHeader className="pb-2">
        <CardTitle className="text-lg font-semibold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-primary" />
          Living Knowledge Map
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Watch tickets become governed, versioned knowledge — with full traceability.
        </p>
      </CardHeader>
      <CardContent className="py-8">
        {/* Simple Linear Flow */}
        <div className="flex items-center justify-center gap-2 md:gap-4">
          {/* Stage 1: Tickets */}
          <div className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-amber-100 dark:bg-amber-900/30 border-2 border-amber-400 flex items-center justify-center shadow-lg shadow-amber-200/50 dark:shadow-amber-900/30">
              <Ticket className="h-7 w-7 md:h-8 md:w-8 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold text-amber-700 dark:text-amber-400">Tickets</p>
              <p className="text-[10px] text-muted-foreground">Support cases</p>
            </div>
          </div>

          {/* Arrow 1 */}
          <div className="flex flex-col items-center">
            <ArrowRight className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground/50" />
            <span className="text-[9px] text-muted-foreground mt-1">Gap detected</span>
          </div>

          {/* Stage 2: Drafts */}
          <div className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-blue-100 dark:bg-blue-900/30 border-2 border-blue-400 flex items-center justify-center shadow-lg shadow-blue-200/50 dark:shadow-blue-900/30">
              <FileText className="h-7 w-7 md:h-8 md:w-8 text-blue-600 dark:text-blue-400" />
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400">AI Draft</p>
              <p className="text-[10px] text-muted-foreground">RLM generated</p>
            </div>
          </div>

          {/* Arrow 2 */}
          <div className="flex flex-col items-center">
            <ArrowRight className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground/50" />
            <span className="text-[9px] text-muted-foreground mt-1">Human review</span>
          </div>

          {/* Stage 3: Published */}
          <div className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-green-100 dark:bg-green-900/30 border-2 border-green-500 flex items-center justify-center shadow-lg shadow-green-200/50 dark:shadow-green-900/30 ring-4 ring-green-200/50 dark:ring-green-800/30">
              <BookCheck className="h-7 w-7 md:h-8 md:w-8 text-green-600 dark:text-green-400" />
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold text-green-700 dark:text-green-400">Published</p>
              <p className="text-[10px] text-muted-foreground">Approved KB</p>
            </div>
          </div>

          {/* Arrow 3 */}
          <div className="flex flex-col items-center">
            <ArrowRight className="h-5 w-5 md:h-6 md:w-6 text-muted-foreground/50" />
            <span className="text-[9px] text-muted-foreground mt-1">New cases</span>
          </div>

          {/* Stage 4: Versions */}
          <div className="flex flex-col items-center gap-2">
            <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-slate-400 flex items-center justify-center shadow-lg shadow-slate-200/50 dark:shadow-slate-900/30">
              <Layers className="h-7 w-7 md:h-8 md:w-8 text-slate-600 dark:text-slate-400" />
            </div>
            <div className="text-center">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-400">Versions</p>
              <p className="text-[10px] text-muted-foreground">Audit trail</p>
            </div>
          </div>
        </div>

        {/* Flow description */}
        <div className="mt-6 flex justify-center">
          <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/5 border border-primary/20">
            <span className="text-[11px] text-muted-foreground">
              <span className="font-medium text-foreground">Self-learning loop:</span>
              {" "}Each resolved ticket improves the knowledge base automatically
            </span>
          </div>
        </div>
      </CardContent>
      
      {/* Tagline */}
      <div className="px-6 py-3 border-t bg-muted/30">
        <p className="text-xs text-center text-muted-foreground italic">
          "We don't just generate articles — we govern them, version them, and prove every claim with traceability."
        </p>
      </div>
    </Card>
  );
}
