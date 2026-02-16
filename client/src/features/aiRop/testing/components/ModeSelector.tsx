import { MessageSquare, Users, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { TestMode } from "../types/testingTypes";

interface ModeSelectorProps {
  value: TestMode;
  onChange: (mode: TestMode) => void;
}

const MODES: Array<{ key: TestMode; label: string; icon: typeof MessageSquare }> = [
  { key: "FREE_CHAT", label: "Свободный чат", icon: MessageSquare },
  { key: "SIMULATION", label: "Симуляция клиента", icon: Users },
  { key: "STRESS_TEST", label: "Стресс-тест", icon: Zap },
];

export function ModeSelector({ value, onChange }: ModeSelectorProps) {
  return (
    <div className="inline-flex items-center gap-1 rounded-md bg-muted p-1" data-testid="mode-selector">
      {MODES.map((mode) => {
        const Icon = mode.icon;
        const isActive = value === mode.key;
        return (
          <Button
            key={mode.key}
            variant="ghost"
            size="sm"
            className={`toggle-elevate ${isActive ? "toggle-elevated" : ""}`}
            onClick={() => onChange(mode.key)}
            data-testid={`button-mode-${mode.key.toLowerCase()}`}
          >
            <Icon />
            {mode.label}
          </Button>
        );
      })}
    </div>
  );
}
