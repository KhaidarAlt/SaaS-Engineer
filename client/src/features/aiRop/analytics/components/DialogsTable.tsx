import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, MessageSquare, GraduationCap } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { STAGE_LABELS, OBJECTION_LABELS, OUTCOME_LABELS } from "../types/analyticsTypes";
import type { DialogListItem } from "../types/analyticsTypes";

interface DialogsTableProps {
  dialogs: DialogListItem[];
  total: number;
  isLoading: boolean;
  onLoadMore?: () => void;
  onViewDetail: (id: string) => void;
}

function OutcomeBadge({ outcome }: { outcome: string }) {
  const variants: Record<string, "default" | "destructive" | "outline" | "secondary"> = {
    SUCCESS: "default",
    FAILED: "destructive",
    HANDOVER: "secondary",
    ABANDONED: "outline",
    UNKNOWN: "outline",
  };
  return (
    <Badge variant={variants[outcome] || "outline"} className="text-xs">
      {OUTCOME_LABELS[outcome] || outcome}
    </Badge>
  );
}

export function DialogsTable({ dialogs, total, isLoading, onLoadMore, onViewDetail }: DialogsTableProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [, navigate] = useLocation();

  function handleTrainFromDialog(d: DialogListItem) {
    navigate("/dashboard/ai/rop/training");
  }

  return (
    <Card className="p-4" data-testid="card-dialogs-table">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <h3 className="text-sm font-semibold">Диалоги ({total})</h3>
      </div>
      {dialogs.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Нет диалогов за выбранный период</p>
      ) : (
        <div className="space-y-1">
          <div className="hidden md:grid grid-cols-[1fr_80px_80px_100px_80px_60px] gap-2 px-2 pb-1 border-b text-xs text-muted-foreground font-medium">
            <span>Дата / Источник</span>
            <span>Результат</span>
            <span>Этап</span>
            <span>Возражения</span>
            <span>Передача</span>
            <span>Сообщ.</span>
          </div>
          {dialogs.map((d) => (
            <div key={d.id}>
              <div
                className="grid grid-cols-1 md:grid-cols-[1fr_80px_80px_100px_80px_60px] gap-2 items-center px-2 py-2 rounded-md hover-elevate cursor-pointer"
                onClick={() => setExpandedId(expandedId === d.id ? null : d.id)}
                data-testid={`dialog-row-${d.id}`}
              >
                <div className="flex items-center gap-2">
                  {expandedId === d.id ? <ChevronDown className="h-3 w-3 shrink-0" /> : <ChevronRight className="h-3 w-3 shrink-0" />}
                  <div>
                    <span className="text-sm">{new Date(d.startedAt).toLocaleDateString("ru-RU", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                    <span className="text-xs text-muted-foreground ml-2">{d.source === "TESTING" ? "Тест" : d.channel}</span>
                  </div>
                </div>
                <div><OutcomeBadge outcome={d.outcome} /></div>
                <div><span className="text-xs">{STAGE_LABELS[d.stageReached] || d.stageReached}</span></div>
                <div className="flex gap-1 flex-wrap">
                  {d.objections.slice(0, 2).map((o) => (
                    <Badge key={o} variant="outline" className="text-xs">{OBJECTION_LABELS[o] || o}</Badge>
                  ))}
                </div>
                <div><span className="text-xs">{d.hasHandover ? "Да" : "—"}</span></div>
                <div><span className="text-xs">{d.messageCount}</span></div>
              </div>
              <AnimatePresence>
                {expandedId === d.id && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="overflow-hidden"
                  >
                    <div className="ml-6 px-3 py-2 rounded-md border mb-1 space-y-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs text-muted-foreground">Цель: {d.goal}</span>
                        <span className="text-xs text-muted-foreground">Длит.: {d.durationMins} мин</span>
                        {d.dropoffReason && <Badge variant="destructive" className="text-xs">Причина: {d.dropoffReason}</Badge>}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button size="sm" variant="outline" onClick={() => onViewDetail(d.id)} data-testid={`button-view-dialog-${d.id}`}>
                          <MessageSquare className="h-3 w-3 mr-1" />
                          Открыть диалог
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleTrainFromDialog(d)} data-testid={`button-train-from-${d.id}`}>
                          <GraduationCap className="h-3 w-3 mr-1" />
                          Обучить на этом
                        </Button>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
          {dialogs.length < total && onLoadMore && (
            <div className="text-center pt-2">
              <Button variant="outline" size="sm" onClick={onLoadMore} data-testid="button-load-more-dialogs">
                Загрузить ещё
              </Button>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
