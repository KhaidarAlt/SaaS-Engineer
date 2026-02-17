import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { History, FileEdit, Brain, BookPlus, Settings2, ShieldOff, XCircle } from "lucide-react";
import type { AiTrainingEvent } from "../types/trainingTypes";
import { EVENT_TYPE_LABELS } from "../types/trainingTypes";

const EVENT_ICONS: Record<string, typeof History> = {
  EDIT_REPLY: FileEdit,
  TRAIN_APPROVED: Brain,
  KB_ADDED: BookPlus,
  TRIGGER_CREATED: Settings2,
  TRIGGER_UPDATED: Settings2,
  ANTI_PATTERN_ADDED: ShieldOff,
  IGNORE_SUGGESTION: XCircle,
};

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildSummary(event: AiTrainingEvent): string {
  const ctx = event.context || {};
  const userText = (ctx.userText as string) || "";
  const preview = userText.length > 40 ? userText.substring(0, 40) + "..." : userText;

  switch (event.eventType) {
    case "EDIT_REPLY":
      return preview ? `Исправлен ответ на "${preview}"` : "Ответ исправлен";
    case "TRAIN_APPROVED":
      return preview ? `Обучение: создан триггер для "${preview}"` : "Обучение одобрено";
    case "KB_ADDED":
      return preview ? `В базу знаний: "${preview}"` : "Добавлено в базу знаний";
    case "TRIGGER_CREATED":
      return "Создан новый триггер";
    case "TRIGGER_UPDATED":
      return "Триггер обновлён";
    case "ANTI_PATTERN_ADDED":
      return preview ? `Запрещено: "${preview}"` : "Добавлен анти-паттерн";
    case "IGNORE_SUGGESTION":
      return "Предложение отклонено";
    default:
      return "Событие обучения";
  }
}

interface TrainingHistoryPanelProps {
  events: AiTrainingEvent[];
  isLoading: boolean;
}

export function TrainingHistoryPanel({ events, isLoading }: TrainingHistoryPanelProps) {
  if (isLoading) {
    return (
      <Card className="p-6" data-testid="history-loading">
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-muted/50 rounded-md animate-pulse" />
          ))}
        </div>
      </Card>
    );
  }

  if (!events.length) {
    return (
      <Card className="p-8 text-center" data-testid="history-empty">
        <History className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
        <p className="text-sm text-muted-foreground">
          История обучения пуста. Обучайте AI через быстрое обучение, триггеры и базу знаний.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-4" data-testid="history-panel">
      <ScrollArea className="max-h-[500px]">
        <div className="space-y-2">
          {events.map((event) => {
            const Icon = EVENT_ICONS[event.eventType] || History;
            const ctx = event.context || {};
            const oldReply = ctx.oldReply as string | undefined;
            const newReply = ctx.newReply as string | undefined;
            const showDiff = oldReply && newReply && event.eventType === "EDIT_REPLY";
            return (
              <div
                key={event.id}
                className="flex items-start gap-3 p-3 rounded-md hover-elevate"
                data-testid={`history-row-${event.id}`}
              >
                <div className="mt-0.5">
                  <Icon className="w-4 h-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="secondary" className="text-xs">
                      {EVENT_TYPE_LABELS[event.eventType] || event.eventType}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(event.createdAt)}
                    </span>
                  </div>
                  <p className="text-sm mt-1 text-foreground/80">
                    {buildSummary(event)}
                  </p>
                  {showDiff && (
                    <div className="mt-2 text-xs space-y-1">
                      <div className="p-2 rounded bg-destructive/10 line-through text-muted-foreground">
                        {(oldReply as string).substring(0, 100)}...
                      </div>
                      <div className="p-2 rounded bg-green-500/10 text-foreground/80">
                        {(newReply as string).substring(0, 100)}...
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </Card>
  );
}
