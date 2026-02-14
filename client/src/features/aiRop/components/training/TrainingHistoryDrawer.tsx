import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, GraduationCap } from "lucide-react";
import { AI_ROP_KEYS } from "../../api/aiRopApi";
import type { TrainingItem } from "../../types/aiRopTypes";
import { getStageName } from "../../utils/stageUtils";
import { motion, AnimatePresence } from "framer-motion";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function TrainingHistoryDrawer({ open, onClose }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: AI_ROP_KEYS.trainingItems,
    queryFn: async () => {
      const res = await fetch("/api/ai-rop/training-items", { credentials: "include" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    enabled: open,
  });
  const items: TrainingItem[] = data?.items || [];

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            data-testid="training-history-backdrop"
            className="fixed inset-0 z-50 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            data-testid="training-history-drawer"
            className="fixed right-0 top-0 z-50 h-full w-full max-w-[400px] bg-background border-l flex flex-col"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <div className="flex items-center justify-between gap-2 p-4 border-b">
              <div className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">История обучения</h2>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={onClose}
                data-testid="button-close-training-history"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {isLoading && (
                <div className="flex items-center justify-center py-12" data-testid="training-history-loading">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-foreground" />
                </div>
              )}

              {!isLoading && items.length === 0 && (
                <div className="text-center text-muted-foreground py-12" data-testid="training-history-empty">
                  Нет записей обучения
                </div>
              )}

              {!isLoading &&
                items.map((item) => (
                  <Card key={item.id} data-testid={`card-training-item-${item.id}`}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        {item.stage && (
                          <Badge variant="secondary" data-testid={`badge-stage-${item.id}`}>
                            {getStageName(item.stage)}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground" data-testid={`text-date-${item.id}`}>
                          {new Date(item.createdAt).toLocaleDateString("ru-RU", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      <div className="space-y-1.5 text-sm">
                        <div>
                          <span className="font-medium text-muted-foreground">Клиент: </span>
                          <span data-testid={`text-user-message-${item.id}`}>{item.userMessage}</span>
                        </div>
                        <div>
                          <span className="font-medium text-muted-foreground">AI ответил: </span>
                          <span className="line-through opacity-60" data-testid={`text-ai-original-${item.id}`}>
                            {item.aiOriginal}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium text-muted-foreground">Исправлено на: </span>
                          <span className="text-green-600 dark:text-green-400" data-testid={`text-ai-corrected-${item.id}`}>
                            {item.aiCorrected}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
