import { useQuery } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { STAGE_LABELS, OUTCOME_LABELS } from "../types/analyticsTypes";
import { fetchDialogDetail, ANALYTICS_KEYS } from "../api/analyticsApi";

interface DialogDetailModalProps {
  dialogId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DialogDetailModal({ dialogId, open, onOpenChange }: DialogDetailModalProps) {
  const { data, isLoading } = useQuery({
    queryKey: ANALYTICS_KEYS.dialogDetail(dialogId || ""),
    queryFn: () => fetchDialogDetail(dialogId!),
    enabled: !!dialogId && open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto" data-testid="dialog-detail-modal">
        <DialogHeader>
          <DialogTitle>Диалог</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="space-y-2 py-4">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        ) : data ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline">{data.dialog.source === "TESTING" ? "Тест" : data.dialog.channel}</Badge>
              <Badge>{OUTCOME_LABELS[data.dialog.outcome] || data.dialog.outcome}</Badge>
              <span className="text-xs text-muted-foreground">{data.dialog.messageCount} сообщ.</span>
            </div>
            {data.stageTimeline.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Этапы:</p>
                <div className="flex items-center gap-1 flex-wrap">
                  {data.stageTimeline.map((s, i) => (
                    <Badge key={i} variant="outline" className="text-xs">
                      {STAGE_LABELS[s.stage] || s.stage}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground">Сообщения:</p>
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {data.messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`rounded-lg px-3 py-2 text-sm max-w-[85%] ${
                      msg.role === "user"
                        ? "bg-primary/10 ml-auto"
                        : msg.role === "assistant"
                        ? "bg-muted mr-auto"
                        : "bg-muted/50 mx-auto text-xs italic"
                    }`}
                    data-testid={`message-${msg.id}`}
                  >
                    <p className="text-xs text-muted-foreground mb-0.5">
                      {msg.role === "user" ? "Клиент" : msg.role === "assistant" ? "AI" : "Система"}
                    </p>
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                    <p className="text-xs text-muted-foreground mt-0.5 text-right">
                      {new Date(msg.createdAt).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                ))}
                {data.messages.length === 0 && (
                  <p className="text-sm text-muted-foreground text-center py-4">Сообщения недоступны</p>
                )}
              </div>
            </div>
            {data.events.length > 0 && (
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Ключевые события:</p>
                {data.events.filter(e => e.eventType !== "STAGE_ENTERED").map((e) => (
                  <div key={e.id} className="flex items-center justify-between gap-2 text-xs flex-wrap">
                    <span>{e.eventType}{e.eventValue ? `: ${e.eventValue}` : ""}</span>
                    <span className="text-muted-foreground">{new Date(e.ts).toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" })}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground py-4">Диалог не найден</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
