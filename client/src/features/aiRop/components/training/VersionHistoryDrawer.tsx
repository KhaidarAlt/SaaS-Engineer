import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, History, RotateCcw } from "lucide-react";
import { fetchVersionHistory, rollbackToVersion, AI_ROP_KEYS } from "../../api/aiRopApi";
import type { VersionHistoryEntry } from "../../types/aiRopTypes";
import { motion, AnimatePresence } from "framer-motion";
import { useToast } from "@/hooks/use-toast";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function VersionHistoryDrawer({ open, onClose }: Props) {
  const { toast } = useToast();

  const { data: versions = [], isLoading } = useQuery<VersionHistoryEntry[]>({
    queryKey: AI_ROP_KEYS.settingsHistory,
    queryFn: fetchVersionHistory,
    enabled: open,
  });

  const rollbackMutation = useMutation({
    mutationFn: (id: string) => rollbackToVersion(id),
    onSuccess: () => {
      toast({ title: "Версия восстановлена", description: "Настройки откачены к выбранной версии." });
      onClose();
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось откатить версию.", variant: "destructive" });
    },
  });

  const handleRollback = (entry: VersionHistoryEntry) => {
    const confirmed = window.confirm(
      `Откатить настройки к версии v${entry.versionNumber}? Текущие настройки будут заменены.`
    );
    if (confirmed) {
      rollbackMutation.mutate(entry.id);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            data-testid="version-history-backdrop"
            className="fixed inset-0 z-50 bg-black/50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            data-testid="version-history-drawer"
            className="fixed right-0 top-0 z-50 h-full w-full max-w-[400px] bg-background border-l flex flex-col"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
          >
            <div className="flex items-center justify-between gap-2 p-4 border-b">
              <div className="flex items-center gap-2">
                <History className="h-5 w-5 text-muted-foreground" />
                <h2 className="text-lg font-semibold">История версий</h2>
              </div>
              <Button
                size="icon"
                variant="ghost"
                onClick={onClose}
                data-testid="button-close-version-history"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {isLoading && (
                <div className="flex items-center justify-center py-12" data-testid="version-history-loading">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-foreground" />
                </div>
              )}

              {!isLoading && versions.length === 0 && (
                <div className="text-center text-muted-foreground py-12" data-testid="version-history-empty">
                  Нет версий
                </div>
              )}

              {!isLoading &&
                versions.map((entry) => (
                  <Card key={entry.id} data-testid={`card-version-${entry.id}`}>
                    <CardContent className="p-3 space-y-2">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <Badge variant="secondary" data-testid={`badge-version-${entry.id}`}>
                          v{entry.versionNumber}
                        </Badge>
                        <span className="text-xs text-muted-foreground" data-testid={`text-date-${entry.id}`}>
                          {new Date(entry.createdAt).toLocaleDateString("ru-RU", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>

                      {entry.changeReason && (
                        <p className="text-sm text-muted-foreground" data-testid={`text-reason-${entry.id}`}>
                          {entry.changeReason}
                        </p>
                      )}

                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full"
                        onClick={() => handleRollback(entry)}
                        disabled={rollbackMutation.isPending}
                        data-testid={`button-rollback-${entry.id}`}
                      >
                        <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
                        Откатить
                      </Button>
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
