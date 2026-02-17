import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MessageSquare, Smartphone, TestTube } from "lucide-react";
import { fetchDialogs, ANALYTICS_KEYS } from "../analytics/api/analyticsApi";
import { DialogDetailModal } from "../analytics/components/DialogDetailModal";
import { OUTCOME_LABELS, STAGE_LABELS, OBJECTION_LABELS } from "../analytics/types/analyticsTypes";

export function RecentDialogs() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ANALYTICS_KEYS.dialogs("30d", "ALL", "overview-recent"),
    queryFn: () => fetchDialogs("30d", "ALL", { limit: 8 }),
  });

  function handleOpen(id: string) {
    setSelectedId(id);
    setModalOpen(true);
  }

  const OUTCOME_VARIANT: Record<string, "default" | "destructive" | "outline" | "secondary"> = {
    SUCCESS: "default",
    FAILED: "destructive",
    HANDOVER: "secondary",
    ABANDONED: "outline",
    UNKNOWN: "outline",
  };

  return (
    <>
      <Card className="p-5" data-testid="card-recent-dialogs">
        <div className="flex items-center gap-2 mb-3">
          <MessageSquare className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Последние диалоги</h3>
        </div>
        {isLoading ? (
          <div className="space-y-2">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-10 w-full rounded-md" />)}
          </div>
        ) : !data || data.dialogs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">Нет диалогов</p>
        ) : (
          <div className="space-y-1">
            {data.dialogs.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-2 px-2 py-2 rounded-md hover-elevate cursor-pointer flex-wrap"
                onClick={() => handleOpen(d.id)}
                data-testid={`recent-dialog-${d.id}`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {d.source === "TESTING" ? (
                    <TestTube className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  ) : (
                    <Smartphone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-sm truncate">
                        {new Date(d.startedAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                      <span className="text-xs text-muted-foreground">{d.messageCount} сообщ.</span>
                    </div>
                    <p className="text-xs text-muted-foreground truncate mt-0.5" data-testid={`dialog-preview-${d.id}`}>
                      {STAGE_LABELS[d.stageReached] || d.stageReached}
                      {d.objections.length > 0 && ` \u00B7 ${d.objections.map(o => OBJECTION_LABELS[o] || o).join(", ")}`}
                    </p>
                  </div>
                </div>
                <Badge variant={OUTCOME_VARIANT[d.outcome] || "outline"} className="text-xs shrink-0">
                  {OUTCOME_LABELS[d.outcome] || d.outcome}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </Card>
      <DialogDetailModal dialogId={selectedId} open={modalOpen} onOpenChange={setModalOpen} />
    </>
  );
}
