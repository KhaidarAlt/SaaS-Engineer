import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "@tanstack/react-query";
import { Target, Users, Search, ShoppingCart, Plus, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { fetchReadiness } from "../../api/aiRopApi";
import type {
  GoalType,
  TonePreset,
  OnboardingData,
  AiRopSettings,
  ReadinessResult,
} from "../../types/aiRopTypes";
import {
  GOAL_LABELS,
  TONE_LABELS,
  DEFAULT_OBJECTIONS,
  HANDOVER_RULE_TYPES,
} from "../../types/aiRopTypes";

interface Props {
  onComplete: (data: OnboardingData) => void;
  initialSettings: AiRopSettings | null;
}

const GOAL_ICONS: Record<GoalType, typeof Target> = {
  CLOSE_DEAL: Target,
  QUALIFY_HANDOVER: Users,
  CONSULT_MATCH: Search,
  ORDER_NO_PAYMENT: ShoppingCart,
};

const TOTAL_STEPS = 6;

const slideVariants = {
  enter: { opacity: 0, x: 30 },
  center: { opacity: 1, x: 0 },
  exit: { opacity: 0, x: -30 },
};

function WizardProgress({ step }: { step: number }) {
  const pct = ((step + 1) / TOTAL_STEPS) * 100;
  return (
    <div className="mb-6" data-testid="wizard-progress">
      <div className="flex items-center justify-between gap-2 mb-2">
        <span className="text-xs text-muted-foreground">
          Шаг {step + 1} из {TOTAL_STEPS}
        </span>
        <span className="text-xs text-muted-foreground">{Math.round(pct)}%</span>
      </div>
      <div className="h-2 w-full rounded-full bg-muted">
        <div
          className="h-2 rounded-full bg-primary transition-all duration-300"
          style={{ width: `${pct}%` }}
          data-testid="progress-bar-fill"
        />
      </div>
    </div>
  );
}

function ReadinessBadge({ status }: { status: string }) {
  const colorMap: Record<string, string> = {
    READY: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    WARNING: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
    BLOCKED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
  const labelMap: Record<string, string> = {
    READY: "Готов",
    WARNING: "Внимание",
    BLOCKED: "Заблокирован",
  };
  return (
    <span
      className={`inline-flex items-center rounded-md px-2 py-1 text-xs font-medium ${colorMap[status] || ""}`}
      data-testid={`badge-readiness-${status.toLowerCase()}`}
    >
      {labelMap[status] || status}
    </span>
  );
}

export function InterviewWizard({ onComplete, initialSettings }: Props) {
  const [step, setStep] = useState(0);
  const [selectedGoal, setSelectedGoal] = useState<GoalType>(
    initialSettings?.goal || "CLOSE_DEAL"
  );
  const [selectedTone, setSelectedTone] = useState<TonePreset>(
    (initialSettings?.tone as TonePreset) || "friendly"
  );
  const [customToneText, setCustomToneText] = useState("");
  const [selectedObjections, setSelectedObjections] = useState<string[]>([
    ...DEFAULT_OBJECTIONS,
  ]);
  const [customObjection, setCustomObjection] = useState("");
  const [selectedHandoverRules, setSelectedHandoverRules] = useState<string[]>([
    "explicit_request",
    "negative_sentiment",
  ]);
  const [thresholdValue, setThresholdValue] = useState("");

  const {
    data: readiness,
    isLoading: readinessLoading,
  } = useQuery<ReadinessResult>({
    queryKey: ["/api/ai-rop/goal-readiness", selectedGoal],
    queryFn: () => fetchReadiness(selectedGoal),
    enabled: step === 1,
  });

  function handleNext() {
    if (step < TOTAL_STEPS - 1) {
      setStep((s) => s + 1);
    } else {
      const handoverRules = selectedHandoverRules.map((ruleType) => ({
        ruleType,
        ...(ruleType === "amount_threshold" && thresholdValue
          ? { thresholdValue }
          : {}),
      }));
      onComplete({
        goal: selectedGoal,
        tone: selectedTone,
        objections: selectedObjections,
        handoverRules,
        ...(selectedTone === "custom" && customToneText
          ? { customToneText }
          : {}),
      });
    }
  }

  function handleBack() {
    if (step > 0) setStep((s) => s - 1);
  }

  function toggleObjection(obj: string) {
    setSelectedObjections((prev) =>
      prev.includes(obj) ? prev.filter((o) => o !== obj) : [...prev, obj]
    );
  }

  function addCustomObjection() {
    const trimmed = customObjection.trim();
    if (trimmed && !selectedObjections.includes(trimmed)) {
      setSelectedObjections((prev) => [...prev, trimmed]);
      setCustomObjection("");
    }
  }

  function toggleHandoverRule(value: string) {
    if (value === "never") {
      setSelectedHandoverRules(["never"]);
      return;
    }
    setSelectedHandoverRules((prev) => {
      const filtered = prev.filter((r) => r !== "never");
      if (filtered.includes(value)) {
        return filtered.filter((r) => r !== value);
      }
      return [...filtered, value];
    });
  }

  return (
    <div className="w-full max-w-2xl mx-auto" data-testid="interview-wizard">
      <WizardProgress step={step} />

      <AnimatePresence mode="wait">
        <motion.div
          key={step}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.25 }}
        >
          {step === 0 && (
            <div data-testid="step-goal">
              <h3 className="text-xl font-semibold mb-2">Какая у вас цель?</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Выберите основной сценарий работы AI-РОПа
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(Object.keys(GOAL_LABELS) as GoalType[]).map((goalKey) => {
                  const goal = GOAL_LABELS[goalKey];
                  const Icon = GOAL_ICONS[goalKey];
                  const isSelected = selectedGoal === goalKey;
                  return (
                    <Card
                      key={goalKey}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? "ring-2 ring-primary"
                          : "hover-elevate"
                      }`}
                      onClick={() => setSelectedGoal(goalKey)}
                      data-testid={`card-goal-${goalKey}`}
                    >
                      <CardContent className="pt-6 flex flex-col items-center text-center gap-2">
                        <Icon className="h-8 w-8 text-primary" />
                        <p className="font-medium">{goal.title}</p>
                        <p className="text-xs text-muted-foreground">
                          {goal.description}
                        </p>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}

          {step === 1 && (
            <div data-testid="step-readiness">
              <h3 className="text-xl font-semibold mb-2">Проверка готовности</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Проверяю, всё ли настроено для выбранной цели
              </p>
              {readinessLoading ? (
                <div className="flex items-center justify-center py-8 gap-2" data-testid="loading-readiness">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  <span className="text-sm text-muted-foreground">Проверяю…</span>
                </div>
              ) : readiness ? (
                <Card data-testid="card-readiness-result">
                  <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
                    <CardTitle className="text-base">Результат</CardTitle>
                    <ReadinessBadge status={readiness.status} />
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm text-muted-foreground">{readiness.message}</p>
                    <div className="space-y-2">
                      {readiness.checks.map((check, idx) => (
                        <div
                          key={idx}
                          className="flex items-center gap-2 text-sm"
                          data-testid={`readiness-check-${idx}`}
                        >
                          <span
                            className={`h-2 w-2 rounded-full ${
                              check.passed
                                ? "bg-green-500"
                                : "bg-red-500"
                            }`}
                          />
                          <span>{check.label}</span>
                          {check.detail && (
                            <span className="text-xs text-muted-foreground">
                              — {check.detail}
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          )}

          {step === 2 && (
            <div data-testid="step-tone">
              <h3 className="text-xl font-semibold mb-2">Стиль общения</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Как AI-РОП будет общаться с клиентами?
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {(Object.keys(TONE_LABELS) as TonePreset[]).map((toneKey) => {
                  const tone = TONE_LABELS[toneKey];
                  const isSelected = selectedTone === toneKey;
                  return (
                    <Card
                      key={toneKey}
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? "ring-2 ring-primary"
                          : "hover-elevate"
                      }`}
                      onClick={() => setSelectedTone(toneKey)}
                      data-testid={`card-tone-${toneKey}`}
                    >
                      <CardContent className="pt-6">
                        <p className="font-medium mb-1">{tone.title}</p>
                        {tone.example && (
                          <p className="text-xs text-muted-foreground italic">
                            «{tone.example}»
                          </p>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
              {selectedTone === "custom" && (
                <div className="mt-4">
                  <Input
                    placeholder="Опишите свой стиль общения…"
                    value={customToneText}
                    onChange={(e) => setCustomToneText(e.target.value)}
                    data-testid="input-custom-tone"
                  />
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div data-testid="step-objections">
              <h3 className="text-xl font-semibold mb-2">Возражения клиентов</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Выберите типичные возражения, на которые AI-РОП должен уметь отвечать
              </p>
              <div className="flex flex-wrap gap-2 mb-4">
                {Array.from(new Set([...DEFAULT_OBJECTIONS, ...selectedObjections])).map(
                  (obj) => {
                    const isSelected = selectedObjections.includes(obj);
                    return (
                      <Badge
                        key={obj}
                        variant={isSelected ? "default" : "outline"}
                        className="cursor-pointer"
                        onClick={() => toggleObjection(obj)}
                        data-testid={`chip-objection-${obj}`}
                      >
                        {obj}
                      </Badge>
                    );
                  }
                )}
              </div>
              <div className="flex items-center gap-2">
                <Input
                  placeholder="Добавить своё…"
                  value={customObjection}
                  onChange={(e) => setCustomObjection(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addCustomObjection();
                    }
                  }}
                  data-testid="input-custom-objection"
                />
                <Button
                  size="icon"
                  variant="outline"
                  onClick={addCustomObjection}
                  data-testid="button-add-objection"
                >
                  <Plus />
                </Button>
              </div>
            </div>
          )}

          {step === 4 && (
            <div data-testid="step-handover">
              <h3 className="text-xl font-semibold mb-2">Передача менеджеру</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Когда AI-РОП должен передать диалог живому менеджеру?
              </p>
              <div className="space-y-3">
                {HANDOVER_RULE_TYPES.map((rule) => {
                  const isSelected = selectedHandoverRules.includes(rule.value);
                  return (
                    <div key={rule.value}>
                      <label
                        className="flex items-center gap-3 cursor-pointer"
                        data-testid={`label-handover-${rule.value}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleHandoverRule(rule.value)}
                          className="h-4 w-4 rounded border-muted-foreground"
                          data-testid={`checkbox-handover-${rule.value}`}
                        />
                        <span className="text-sm">{rule.label}</span>
                      </label>
                      {rule.value === "amount_threshold" && isSelected && (
                        <div className="ml-7 mt-2">
                          <Input
                            type="number"
                            placeholder="Сумма порога (₸)"
                            value={thresholdValue}
                            onChange={(e) => setThresholdValue(e.target.value)}
                            data-testid="input-threshold"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {step === 5 && (
            <div data-testid="step-summary">
              <h3 className="text-xl font-semibold mb-2">Подтверждение</h3>
              <p className="text-sm text-muted-foreground mb-6">
                Проверьте настройки перед запуском
              </p>
              <Card data-testid="card-wizard-summary">
                <CardContent className="pt-6 space-y-4">
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Цель</p>
                    <p className="text-sm font-medium" data-testid="text-summary-goal">
                      {GOAL_LABELS[selectedGoal].title}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Стиль общения</p>
                    <p className="text-sm font-medium" data-testid="text-summary-tone">
                      {TONE_LABELS[selectedTone].title}
                      {selectedTone === "custom" && customToneText
                        ? ` — ${customToneText}`
                        : ""}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Возражения</p>
                    <div className="flex flex-wrap gap-1" data-testid="summary-objections">
                      {selectedObjections.map((obj) => (
                        <Badge key={obj} variant="secondary" className="text-xs">
                          {obj}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Передача менеджеру</p>
                    <div className="flex flex-wrap gap-1" data-testid="summary-handover">
                      {selectedHandoverRules.map((ruleValue) => {
                        const rule = HANDOVER_RULE_TYPES.find(
                          (r) => r.value === ruleValue
                        );
                        return (
                          <Badge key={ruleValue} variant="secondary" className="text-xs">
                            {rule?.label || ruleValue}
                            {ruleValue === "amount_threshold" && thresholdValue
                              ? ` (${Number(thresholdValue).toLocaleString()} ₸)`
                              : ""}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </motion.div>
      </AnimatePresence>

      <div className="mt-8 flex items-center justify-between gap-4">
        {step > 0 ? (
          <Button
            variant="outline"
            onClick={handleBack}
            data-testid="button-back"
          >
            Назад
          </Button>
        ) : (
          <div />
        )}
        <Button onClick={handleNext} data-testid="button-next">
          {step === TOTAL_STEPS - 1 ? "Запустить AI-РОПа" : "Далее"}
        </Button>
      </div>
    </div>
  );
}
