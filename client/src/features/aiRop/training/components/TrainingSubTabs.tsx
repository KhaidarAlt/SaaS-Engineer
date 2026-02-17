import { Button } from "@/components/ui/button";
import { Zap, Settings2, BookOpen, ShieldOff, History } from "lucide-react";
import type { TrainingSubTab } from "../types/trainingTypes";

const TABS: { key: TrainingSubTab; label: string; icon: typeof Zap }[] = [
  { key: "quick-train", label: "Быстрое обучение", icon: Zap },
  { key: "triggers", label: "Триггеры", icon: Settings2 },
  { key: "knowledge", label: "База знаний", icon: BookOpen },
  { key: "anti-patterns", label: "Анти-паттерны", icon: ShieldOff },
  { key: "history", label: "История", icon: History },
];

interface TrainingSubTabsProps {
  active: TrainingSubTab;
  onChange: (tab: TrainingSubTab) => void;
}

export function TrainingSubTabs({ active, onChange }: TrainingSubTabsProps) {
  return (
    <div className="flex items-center gap-1 flex-wrap" data-testid="training-sub-tabs">
      {TABS.map((t) => {
        const Icon = t.icon;
        const isActive = active === t.key;
        return (
          <Button
            key={t.key}
            variant={isActive ? "default" : "ghost"}
            size="sm"
            onClick={() => onChange(t.key)}
            data-testid={`tab-${t.key}`}
            className="gap-1.5"
          >
            <Icon className="w-4 h-4" />
            <span className="hidden sm:inline">{t.label}</span>
          </Button>
        );
      })}
    </div>
  );
}
