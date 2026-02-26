import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Bot, Play, Check, X, Pencil, TrendingUp, Loader2, Sparkles, AlertCircle } from "lucide-react";
import {
  fetchCoachSuggestions,
  runCoachAnalysis,
  approveCoachSuggestion,
  rejectCoachSuggestion,
  updateCoachSuggestion,
  TRAINING_KEYS,
} from "../api/trainingApi";
import type { AiLearningSuggestion } from "../types/trainingTypes";

function formatRevenue(amount: number | null): string {
  if (!amount || amount <= 0) return "";
  if (amount >= 1000) return `+${Math.round(amount / 1000)}K ₸`;
  return `+${amount} ₸`;
}

export function AiCoachPanel() {
  const { toast } = useToast();
  const [editItem, setEditItem] = useState<AiLearningSuggestion | null>(null);
  const [editTopic, setEditTopic] = useState("");
  const [editContent, setEditContent] = useState("");

  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: TRAINING_KEYS.coachSuggestions,
    queryFn: () => fetchCoachSuggestions(),
  });

  const analyzeMut = useMutation({
    mutationFn: runCoachAnalysis,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: TRAINING_KEYS.coachSuggestions });
      toast({ title: "Анализ завершён", description: result.message });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось выполнить анализ", variant: "destructive" });
    },
  });

  const approveMut = useMutation({
    mutationFn: approveCoachSuggestion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRAINING_KEYS.coachSuggestions });
      queryClient.invalidateQueries({ queryKey: TRAINING_KEYS.knowledge });
      toast({ title: "Знания обновлены!", description: "AI Score +5%" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось одобрить", variant: "destructive" });
    },
  });

  const rejectMut = useMutation({
    mutationFn: rejectCoachSuggestion,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRAINING_KEYS.coachSuggestions });
      toast({ title: "Рекомендация отклонена" });
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: { topic?: string; suggestedContent?: string } }) =>
      updateCoachSuggestion(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRAINING_KEYS.coachSuggestions });
      setEditItem(null);
      toast({ title: "Текст обновлён" });
    },
  });

  const openEdit = (item: AiLearningSuggestion) => {
    setEditItem(item);
    setEditTopic(item.topic);
    setEditContent(item.suggestedContent);
  };

  const handleSaveAndApprove = async () => {
    if (!editItem) return;
    await updateMut.mutateAsync({ id: editItem.id, data: { topic: editTopic, suggestedContent: editContent } });
    approveMut.mutate(editItem.id);
  };

  const pendingSuggestions = suggestions.filter((s) => s.status === "pending");
  const processedSuggestions = suggestions.filter((s) => s.status !== "pending");

  return (
    <div className="space-y-4" data-testid="ai-coach-panel">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5 text-violet-500" />
          <h3 className="text-base font-semibold">AI Coach — рекомендации</h3>
          {pendingSuggestions.length > 0 && (
            <Badge variant="secondary" className="text-xs">{pendingSuggestions.length}</Badge>
          )}
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() => analyzeMut.mutate()}
          disabled={analyzeMut.isPending}
          data-testid="button-run-analysis"
          className="gap-1.5"
        >
          {analyzeMut.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Play className="w-4 h-4" />
          )}
          Запустить анализ
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!isLoading && pendingSuggestions.length === 0 && processedSuggestions.length === 0 && (
        <Card className="p-6 text-center border-dashed border-violet-300 dark:border-violet-700" data-testid="coach-empty-state">
          <Sparkles className="w-8 h-8 mx-auto mb-2 text-violet-400" />
          <p className="text-sm font-medium mb-1">Нет рекомендаций</p>
          <p className="text-xs text-muted-foreground mb-3">
            Нажмите «Запустить анализ» чтобы AI проанализировал диалоги и нашёл пробелы в базе знаний
          </p>
        </Card>
      )}

      {pendingSuggestions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {pendingSuggestions.map((item) => (
            <Card
              key={item.id}
              className="p-4 border-violet-200 dark:border-violet-800 bg-violet-50/30 dark:bg-violet-950/20 space-y-3"
              data-testid={`coach-card-${item.id}`}
            >
              <div className="flex items-start gap-2">
                <Bot className="w-4 h-4 mt-0.5 text-violet-500 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium">{item.topic}</span>
                    {item.potentialRevenueImpact && item.potentialRevenueImpact > 0 && (
                      <Badge variant="outline" className="text-xs gap-1 text-emerald-600 border-emerald-300">
                        <TrendingUp className="w-3 h-3" />
                        {formatRevenue(item.potentialRevenueImpact)}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">{item.problemSummary}</p>
                </div>
              </div>

              <div className="rounded-md bg-muted/50 p-2">
                <p className="text-xs text-muted-foreground line-clamp-4">{item.suggestedContent}</p>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="default"
                  onClick={() => approveMut.mutate(item.id)}
                  disabled={approveMut.isPending}
                  data-testid={`button-approve-${item.id}`}
                  className="gap-1 text-xs"
                >
                  <Check className="w-3 h-3" />
                  Одобрить
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openEdit(item)}
                  data-testid={`button-edit-${item.id}`}
                  className="gap-1 text-xs"
                >
                  <Pencil className="w-3 h-3" />
                  Править
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => rejectMut.mutate(item.id)}
                  disabled={rejectMut.isPending}
                  data-testid={`button-reject-${item.id}`}
                  className="gap-1 text-xs text-muted-foreground"
                >
                  <X className="w-3 h-3" />
                  Отклонить
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      {processedSuggestions.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Обработанные</h4>
          <div className="space-y-1">
            {processedSuggestions.slice(0, 10).map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 text-sm py-1.5 px-2 rounded-md bg-muted/30"
                data-testid={`coach-processed-${item.id}`}
              >
                {item.status === "approved" ? (
                  <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                ) : (
                  <X className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                )}
                <span className="truncate flex-1">{item.topic}</span>
                <Badge variant={item.status === "approved" ? "secondary" : "outline"} className="text-xs shrink-0">
                  {item.status === "approved" ? "Одобрено" : "Отклонено"}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      <Dialog open={!!editItem} onOpenChange={(open) => !open && setEditItem(null)}>
        <DialogContent className="max-w-lg" data-testid="dialog-edit-suggestion">
          <DialogHeader>
            <DialogTitle>Редактировать рекомендацию</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium mb-1 block">Тема</label>
              <Input
                value={editTopic}
                onChange={(e) => setEditTopic(e.target.value)}
                data-testid="input-edit-topic"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">Содержание статьи</label>
              <Textarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                rows={8}
                data-testid="input-edit-content"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setEditItem(null)} data-testid="button-cancel-edit">
              Отмена
            </Button>
            <Button
              onClick={handleSaveAndApprove}
              disabled={updateMut.isPending || approveMut.isPending}
              data-testid="button-save-approve"
              className="gap-1"
            >
              {(updateMut.isPending || approveMut.isPending) ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Check className="w-4 h-4" />
              )}
              Сохранить и одобрить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
