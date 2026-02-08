import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArticleVersion } from "@/lib/api";
import { ImmutabilityModal } from "@/components/plugin/ImmutabilityModal";

interface PublishSectionProps {
  draftStatus: "idle" | "generating" | "ready" | "approved" | "rejected";
  kbArticleId: string | null;
  currentVersion: number;
  versions: ArticleVersion[];
  canPublishV1: boolean;
  canPublishV2: boolean;
  onPublishV1: () => void;
  onPublishV2: () => void;
}

export function PublishSection({
  draftStatus,
  kbArticleId,
  currentVersion,
  versions,
  canPublishV1,
  canPublishV2,
  onPublishV1,
  onPublishV2,
}: PublishSectionProps) {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Publish (Append-Only)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          onClick={onPublishV1}
          className="w-full"
          disabled={!canPublishV1}
        >
          Publish v1
        </Button>
        {kbArticleId && (
          <div className="rounded-md border bg-muted/40 p-3 text-xs space-y-1">
            <div>
              KB Article ID: <code>{kbArticleId}</code>
            </div>
            <div>
              Current Version: <Badge variant="secondary">v{currentVersion}</Badge>
            </div>
          </div>
        )}
        <Button
          variant="outline"
          onClick={onPublishV2}
          className="w-full"
          disabled={!canPublishV2}
        >
          Publish Update (v2)
        </Button>
        <Button
          variant="ghost"
          className="w-full"
          onClick={() => setModalOpen(true)}
          disabled={currentVersion < 1}
        >
          Try to edit published v1
        </Button>

        <div className="rounded-lg border bg-background p-3">
          <div className="text-xs font-medium text-muted-foreground mb-2">
            Version Timeline
          </div>
          <div className="space-y-2">
            {versions.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                Versions will appear after publishing.
              </div>
            ) : (
              versions.map((version) => (
                <div key={version.version_id} className="flex items-center justify-between">
                  <div className="text-xs">
                    <Badge variant="outline" className="text-[10px] mr-2">
                      v{version.version}
                    </Badge>
                    {version.change_note || "Published"}
                  </div>
                  <div className="text-[10px] text-muted-foreground">
                    {new Date(version.created_at).toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </CardContent>
      <ImmutabilityModal open={modalOpen} onOpenChange={setModalOpen} />
    </Card>
  );
}
