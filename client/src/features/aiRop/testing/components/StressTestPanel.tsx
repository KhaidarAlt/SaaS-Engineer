import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, RotateCcw, ChevronDown, ChevronUp } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface StressTestResult {
  scenarioKey: string;
  label: string;
  userText: string;
  assistantText: string;
  pass: boolean;
  issues: string[];
  suggestions: string[];
}

interface StressTestPanelProps {
  onRunStressTest: () => void;
  isRunning: boolean;
  progress: number;
  results: StressTestResult[];
  overallScore: number | null;
  summary: string | null;
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-green-500";
  if (score >= 50) return "text-yellow-500";
  return "text-red-500";
}

function ResultRow({ result }: { result: StressTestResult }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border rounded-md" data-testid={`row-scenario-${result.scenarioKey}`}>
      <button
        className="hover-elevate flex w-full items-center justify-between gap-2 p-3 text-left text-sm"
        onClick={() => setExpanded((v) => !v)}
        data-testid={`button-expand-${result.scenarioKey}`}
      >
        <span className="font-medium">{result.label}</span>
        <div className="flex items-center gap-2">
          <Badge
            variant={result.pass ? "default" : "destructive"}
            className="text-xs"
          >
            {result.pass ? "Пройден" : "Провал"}
          </Badge>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 border-t p-3 text-xs">
              <div>
                <span className="text-muted-foreground">Клиент: </span>
                <span>{result.userText}</span>
              </div>
              <div>
                <span className="text-muted-foreground">AI: </span>
                <span>{result.assistantText}</span>
              </div>
              {result.issues.length > 0 && (
                <div>
                  <span className="text-muted-foreground">Проблемы: </span>
                  <span>{result.issues.join("; ")}</span>
                </div>
              )}
              {result.suggestions.length > 0 && (
                <div>
                  <span className="text-muted-foreground">Рекомендации: </span>
                  <span>{result.suggestions.join("; ")}</span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function StressTestPanel({
  onRunStressTest,
  isRunning,
  progress,
  results,
  overallScore,
  summary,
}: StressTestPanelProps) {
  const hasResults = results.length > 0;

  return (
    <Card data-testid="card-stress-test">
      <CardHeader>
        <CardTitle className="text-lg">Стресс-тест</CardTitle>
        <CardDescription>
          Запуск 10 сценариев для проверки AI-продавца
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isRunning && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-2"
          >
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4, ease: "easeOut" }}
              />
            </div>
            <p className="text-sm text-muted-foreground text-center" data-testid="text-progress">
              Выполнение... {Math.round(progress)}%
            </p>
          </motion.div>
        )}

        {!isRunning && overallScore !== null && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center gap-1 py-2"
          >
            <span className={`text-4xl font-bold ${scoreColor(overallScore)}`} data-testid="text-overall-score">
              {overallScore}%
            </span>
            <span className="text-sm text-muted-foreground">Общий результат</span>
          </motion.div>
        )}

        {!isRunning && hasResults && (
          <div className="space-y-2" data-testid="list-results">
            {results.map((r) => (
              <ResultRow key={r.scenarioKey} result={r} />
            ))}
          </div>
        )}

        {!isRunning && summary && (
          <p className="text-sm text-muted-foreground" data-testid="text-summary">
            {summary}
          </p>
        )}

        <Button
          className="w-full"
          onClick={onRunStressTest}
          disabled={isRunning}
          data-testid="button-run-stress-test"
        >
          {hasResults ? <RotateCcw /> : <Play />}
          {hasResults ? "Повторить тест" : "Запустить тест"}
        </Button>
      </CardContent>
    </Card>
  );
}
