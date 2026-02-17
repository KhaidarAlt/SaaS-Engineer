import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { SectionHeader } from "../../components/SectionHeader";
import { TrainingSubTabs } from "../components/TrainingSubTabs";
import { QuickTrainPanel } from "../components/QuickTrainPanel";
import { TriggerList } from "../components/TriggerList";
import { TriggerEditorModal } from "../components/TriggerEditorModal";
import { KnowledgePanel } from "../components/KnowledgePanel";
import { KnowledgeEditorModal } from "../components/KnowledgeEditorModal";
import { AntiPatternPanel } from "../components/AntiPatternPanel";
import { TrainingHistoryPanel } from "../components/TrainingHistoryPanel";
import {
  fetchTriggers,
  createTrigger,
  updateTrigger,
  deleteTrigger,
  toggleTrigger,
  fetchKnowledge,
  createKnowledge,
  updateKnowledge,
  deleteKnowledge,
  importFromCatalog,
  fetchAntiPatterns,
  createAntiPattern,
  deleteAntiPattern,
  toggleAntiPattern,
  quickTrain,
  fetchHistory,
  fetchRecentMessages,
  TRAINING_KEYS,
} from "../api/trainingApi";
import type {
  TrainingSubTab,
  AiTrigger,
  KnowledgeItem,
  QuickTrainRequest,
  PatternType,
} from "../types/trainingTypes";

export default function TrainingPage() {
  const [activeTab, setActiveTab] = useState<TrainingSubTab>("quick-train");
  const [editingTrigger, setEditingTrigger] = useState<AiTrigger | null>(null);
  const [triggerModalOpen, setTriggerModalOpen] = useState(false);
  const [editingKb, setEditingKb] = useState<KnowledgeItem | null>(null);
  const [kbModalOpen, setKbModalOpen] = useState(false);
  const { toast } = useToast();

  const { data: triggers = [], isLoading: triggersLoading } = useQuery({
    queryKey: TRAINING_KEYS.triggers,
    queryFn: fetchTriggers,
    enabled: activeTab === "triggers" || activeTab === "quick-train",
  });

  const { data: knowledge = [], isLoading: kbLoading } = useQuery({
    queryKey: TRAINING_KEYS.knowledge,
    queryFn: () => fetchKnowledge(),
    enabled: activeTab === "knowledge",
  });

  const { data: antiPatterns = [], isLoading: apLoading } = useQuery({
    queryKey: TRAINING_KEYS.antiPatterns,
    queryFn: fetchAntiPatterns,
    enabled: activeTab === "anti-patterns",
  });

  const { data: history = [], isLoading: historyLoading } = useQuery({
    queryKey: TRAINING_KEYS.history,
    queryFn: () => fetchHistory(),
    enabled: activeTab === "history",
  });

  const { data: recentMessages = [] } = useQuery({
    queryKey: TRAINING_KEYS.recentMessages,
    queryFn: () => fetchRecentMessages(),
    enabled: activeTab === "quick-train",
  });

  const quickTrainMut = useMutation({
    mutationFn: quickTrain,
    onSuccess: (result) => {
      const msgs: string[] = [];
      if (result.createdTriggerId) msgs.push("Триггер создан");
      if (result.createdKnowledgeId) msgs.push("Добавлено в базу знаний");
      if (result.createdAntiPatternId) msgs.push("Анти-паттерн создан");
      if (!msgs.length) msgs.push("Правка сохранена");
      toast({ title: "Обучение", description: msgs.join(". ") });
      queryClient.invalidateQueries({ queryKey: TRAINING_KEYS.history });
      queryClient.invalidateQueries({ queryKey: TRAINING_KEYS.triggers });
      queryClient.invalidateQueries({ queryKey: TRAINING_KEYS.knowledge });
      queryClient.invalidateQueries({ queryKey: TRAINING_KEYS.antiPatterns });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось выполнить обучение", variant: "destructive" });
    },
  });

  const createTriggerMut = useMutation({
    mutationFn: (data: Partial<AiTrigger>) => createTrigger(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRAINING_KEYS.triggers });
      queryClient.invalidateQueries({ queryKey: TRAINING_KEYS.history });
      setTriggerModalOpen(false);
      setEditingTrigger(null);
      toast({ title: "Триггер создан" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось создать триггер", variant: "destructive" });
    },
  });

  const updateTriggerMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<AiTrigger> }) => updateTrigger(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRAINING_KEYS.triggers });
      queryClient.invalidateQueries({ queryKey: TRAINING_KEYS.history });
      setTriggerModalOpen(false);
      setEditingTrigger(null);
      toast({ title: "Триггер обновлён" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось обновить триггер", variant: "destructive" });
    },
  });

  const deleteTriggerMut = useMutation({
    mutationFn: deleteTrigger,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRAINING_KEYS.triggers });
      toast({ title: "Триггер удалён" });
    },
  });

  const toggleTriggerMut = useMutation({
    mutationFn: toggleTrigger,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRAINING_KEYS.triggers });
    },
  });

  const createKbMut = useMutation({
    mutationFn: (data: Partial<KnowledgeItem>) => createKnowledge(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRAINING_KEYS.knowledge });
      queryClient.invalidateQueries({ queryKey: TRAINING_KEYS.history });
      setKbModalOpen(false);
      setEditingKb(null);
      toast({ title: "Знание добавлено" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось создать запись", variant: "destructive" });
    },
  });

  const updateKbMut = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<KnowledgeItem> }) => updateKnowledge(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRAINING_KEYS.knowledge });
      setKbModalOpen(false);
      setEditingKb(null);
      toast({ title: "Знание обновлено" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось обновить запись", variant: "destructive" });
    },
  });

  const deleteKbMut = useMutation({
    mutationFn: deleteKnowledge,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRAINING_KEYS.knowledge });
      toast({ title: "Запись удалена" });
    },
  });

  const importMut = useMutation({
    mutationFn: importFromCatalog,
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: TRAINING_KEYS.knowledge });
      toast({ title: "Импорт завершён", description: `Импортировано: ${result.imported} записей` });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось импортировать", variant: "destructive" });
    },
  });

  const createApMut = useMutation({
    mutationFn: (data: { patternType: PatternType; patternValue: string; note?: string }) =>
      createAntiPattern(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRAINING_KEYS.antiPatterns });
      queryClient.invalidateQueries({ queryKey: TRAINING_KEYS.history });
      toast({ title: "Анти-паттерн добавлен" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось создать анти-паттерн", variant: "destructive" });
    },
  });

  const deleteApMut = useMutation({
    mutationFn: deleteAntiPattern,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRAINING_KEYS.antiPatterns });
      toast({ title: "Анти-паттерн удалён" });
    },
  });

  const toggleApMut = useMutation({
    mutationFn: toggleAntiPattern,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: TRAINING_KEYS.antiPatterns });
    },
  });

  const handleQuickTrain = (data: QuickTrainRequest) => {
    quickTrainMut.mutate(data);
  };

  const handleTriggerSave = (data: Partial<AiTrigger>) => {
    if (editingTrigger) {
      updateTriggerMut.mutate({ id: editingTrigger.id, data });
    } else {
      createTriggerMut.mutate(data);
    }
  };

  const handleKbSave = (data: Partial<KnowledgeItem>) => {
    if (editingKb) {
      updateKbMut.mutate({ id: editingKb.id, data });
    } else {
      createKbMut.mutate(data);
    }
  };

  return (
    <div data-testid="page-training" className="space-y-4">
      <SectionHeader
        title="Обучение"
        subtitle="Обучайте AI-продавца: правки ответов, триггеры, база знаний"
      />

      <TrainingSubTabs active={activeTab} onChange={setActiveTab} />

      {activeTab === "quick-train" && (
        <QuickTrainPanel
          onQuickTrain={handleQuickTrain}
          isPending={quickTrainMut.isPending}
          recentMessages={recentMessages}
        />
      )}

      {activeTab === "triggers" && (
        <>
          <TriggerList
            triggers={triggers}
            isLoading={triggersLoading}
            onToggle={(id) => toggleTriggerMut.mutate(id)}
            onDelete={(id) => deleteTriggerMut.mutate(id)}
            onEdit={(trigger) => {
              setEditingTrigger(trigger);
              setTriggerModalOpen(true);
            }}
            onCreate={() => {
              setEditingTrigger(null);
              setTriggerModalOpen(true);
            }}
          />
          <TriggerEditorModal
            open={triggerModalOpen}
            onOpenChange={setTriggerModalOpen}
            trigger={editingTrigger}
            onSave={handleTriggerSave}
            isPending={createTriggerMut.isPending || updateTriggerMut.isPending}
          />
        </>
      )}

      {activeTab === "knowledge" && (
        <>
          <KnowledgePanel
            items={knowledge}
            isLoading={kbLoading}
            onEdit={(item) => {
              setEditingKb(item);
              setKbModalOpen(true);
            }}
            onDelete={(id) => deleteKbMut.mutate(id)}
            onImport={() => importMut.mutate()}
            isImporting={importMut.isPending}
            onCreate={() => {
              setEditingKb(null);
              setKbModalOpen(true);
            }}
          />
          <KnowledgeEditorModal
            open={kbModalOpen}
            onOpenChange={setKbModalOpen}
            item={editingKb}
            onSave={handleKbSave}
            isPending={createKbMut.isPending || updateKbMut.isPending}
          />
        </>
      )}

      {activeTab === "anti-patterns" && (
        <AntiPatternPanel
          patterns={antiPatterns}
          isLoading={apLoading}
          onCreate={(data) => createApMut.mutate(data)}
          onDelete={(id) => deleteApMut.mutate(id)}
          onToggle={(id) => toggleApMut.mutate(id)}
        />
      )}

      {activeTab === "history" && (
        <TrainingHistoryPanel events={history} isLoading={historyLoading} />
      )}
    </div>
  );
}
