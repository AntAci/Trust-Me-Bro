import { CheckCircle2, FileText, ShieldCheck, UploadCloud, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export type TrustLedgerEventType =
  | "evidence_extracted"
  | "draft_created"
  | "approved"
  | "rejected"
  | "published_v1"
  | "published_v2";

export interface TrustLedgerEvent {
  id: string;
  type: TrustLedgerEventType;
  label: string;
  timestamp: string;
}

const eventStyles: Record<TrustLedgerEventType, { icon: typeof FileText; color: string }> = {
  evidence_extracted: { icon: FileText, color: "text-amber-500" },
  draft_created: { icon: FileText, color: "text-blue-500" },
  approved: { icon: ShieldCheck, color: "text-green-600" },
  rejected: { icon: XCircle, color: "text-red-500" },
  published_v1: { icon: UploadCloud, color: "text-emerald-600" },
  published_v2: { icon: CheckCircle2, color: "text-emerald-700" },
};

interface TrustLedgerProps {
  events: TrustLedgerEvent[];
}

export function TrustLedger({ events }: TrustLedgerProps) {
  return (
    <div className="rounded-lg border bg-muted/30 p-3">
      <div className="text-xs font-semibold text-muted-foreground">Trust Ledger</div>
      <div className="mt-3 space-y-3">
        {events.length === 0 ? (
          <div className="text-xs text-muted-foreground">
            Events will appear as the workflow progresses.
          </div>
        ) : (
          events.map((event) => {
            const Icon = eventStyles[event.type].icon;
            return (
              <div key={event.id} className="flex items-start gap-3 animate-slide-in-up">
                <div className={cn("mt-0.5 rounded-full bg-background p-1", eventStyles[event.type].color)}>
                  <Icon className="h-3 w-3" />
                </div>
                <div>
                  <div className="text-xs font-medium">{event.label}</div>
                  <div className="text-[10px] text-muted-foreground">{event.timestamp}</div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
