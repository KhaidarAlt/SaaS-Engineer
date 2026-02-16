import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HandCoins, HelpCircle, Scale, Banknote, Flame, Crown, Play, SkipForward, RotateCcw, CheckCircle2 } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PERSONAS, type PersonaConfig } from "../types/testingTypes";
import type { LucideIcon } from "lucide-react";

interface SimulationPanelProps {
  onStartSimulation: (personaKey: string) => void;
  onNextMessage: () => void;
  isRunning: boolean;
  sessionComplete?: boolean;
  sessionSummary?: Record<string, unknown>;
}

const ICON_MAP: Record<string, LucideIcon> = {
  HandCoins,
  HelpCircle,
  Scale,
  PiggyBank: Banknote,
  Flame,
  Crown,
};

export default function SimulationPanel({
  onStartSimulation,
  onNextMessage,
  isRunning,
  sessionComplete,
  sessionSummary,
}: SimulationPanelProps) {
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null);

  const selected = PERSONAS.find((p) => p.key === selectedPersona);

  function handleStart() {
    if (selectedPersona) {
      onStartSimulation(selectedPersona);
    }
  }

  function handleNewSimulation() {
    setSelectedPersona(null);
  }

  if (sessionComplete) {
    return (
      <Card data-testid="card-simulation-complete">
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <CheckCircle2 className="text-green-500" />
            Симуляция завершена
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {sessionSummary && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-2"
            >
              {Object.entries(sessionSummary).map(([key, value]) => (
                <div key={key} className="flex items-center justify-between gap-2 text-sm">
                  <span className="text-muted-foreground">{key}</span>
                  <span className="font-medium">{String(value)}</span>
                </div>
              ))}
            </motion.div>
          )}
          <Button
            className="w-full"
            onClick={handleNewSimulation}
            data-testid="button-new-simulation"
          >
            <RotateCcw />
            Новая симуляция
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (isRunning && selected) {
    const IconComp = ICON_MAP[selected.icon] || HelpCircle;
    return (
      <Card data-testid="card-simulation-running">
        <CardHeader>
          <CardTitle className="text-lg">Симуляция клиента</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-3 rounded-md border p-3"
          >
            <div className="flex items-center justify-center rounded-md bg-primary/10 p-2">
              <IconComp className="text-primary" />
            </div>
            <div>
              <p className="font-medium text-sm">{selected.name}</p>
              <p className="text-xs text-muted-foreground">{selected.description}</p>
            </div>
            <Badge variant="default" className="ml-auto">Активна</Badge>
          </motion.div>
          <Button
            className="w-full"
            onClick={onNextMessage}
            data-testid="button-next-message"
          >
            <SkipForward />
            Следующая реплика клиента
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card data-testid="card-simulation-panel">
      <CardHeader>
        <CardTitle className="text-lg">Симуляция клиента</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-2">
          <AnimatePresence>
            {PERSONAS.map((persona) => {
              const IconComp = ICON_MAP[persona.icon] || HelpCircle;
              const isSelected = selectedPersona === persona.key;
              return (
                <motion.button
                  key={persona.key}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setSelectedPersona(persona.key)}
                  data-testid={`button-persona-${persona.key}`}
                  className={
                    "hover-elevate flex flex-col items-start gap-1 rounded-md border p-3 text-left transition-colors" +
                    (isSelected
                      ? " border-primary bg-primary/5"
                      : " border-border")
                  }
                >
                  <div className="flex items-center gap-2">
                    <IconComp className={isSelected ? "text-primary" : "text-muted-foreground"} />
                    <span className="text-sm font-medium">{persona.name}</span>
                  </div>
                  <span className="text-xs text-muted-foreground leading-tight">
                    {persona.description}
                  </span>
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
        <Button
          className="w-full"
          disabled={!selectedPersona}
          onClick={handleStart}
          data-testid="button-start-simulation"
        >
          <Play />
          Запустить симуляцию
        </Button>
      </CardContent>
    </Card>
  );
}
