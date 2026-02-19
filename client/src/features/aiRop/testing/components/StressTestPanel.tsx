import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, RotateCcw, ChevronDown, ChevronUp, AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface StressTestResult {
  scenarioKey: string;
  label: string;
  userText: string;
  assistantText: string;
  pass: boolean;
  issues: string[];
  suggestions: string[];
  failureReason?: string | null;
  expectedBehavior?: string;
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
        <span className="font-medium flex-1 min-w-0 truncate">{result.label || result.scenarioKey}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Badge
            variant={result.pass ? "default" : "destructive"}
            className="text-xs"
          >
            {result.pass ? "Успешно" : "Провал"}
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
            <div className="space-y-3 border-t p-3 text-xs">
              <div>
                <span className="text-muted-foreground font-medium">Клиент: </span>
                <span>{result.userText}</span>
              </div>
              {result.assistantText && (
                <div>
                  <span className="text-muted-foreground font-medium">AI: </span>
                  <span className="whitespace-pre-wrap">{result.assistantText.length > 300 ? result.assistantText.slice(0, 300) + "..." : result.assistantText}</span>
                </div>
              )}
              {!result.pass && result.failureReason && (
                <div className="p-2 rounded-md bg-destructive/10 border border-destructive/20">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="h-3.5 w-3.5 text-destructive mt-0.5 flex-shrink-0" />
                    <div>
                      <span className="font-medium text-destructive">Почему провалено: </span>
                      <span>{result.failureReason}</span>
                    </div>
                  </div>
                </div>
              )}
              {result.issues.length > 0 && !result.failureReason && (
                <div className="p-2 rounded-md bg-destructive/10 border border-destructive/20">
                  <span className="text-muted-foreground font-medium">Проблемы: </span>
                  <span>{result.issues.join("; ")}</span>
                </div>
              )}
              {result.suggestions.length > 0 && (
                <div className="p-2 rounded-md bg-blue-500/10 border border-blue-500/20">
                  <span className="font-medium">Что исправить:</span>
                  <ul className="list-disc list-inside mt-1 space-y-0.5">
                    {result.suggestions.map((s, i) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              {result.expectedBehavior && (
                <div className="text-muted-foreground">
                  <span className="font-medium">Ожидаемое поведение: </span>
                  <span>{result.expectedBehavior}</span>
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
  const passedCount = results.filter(r => r.pass).length;
  const failedCount = results.filter(r => !r.pass).length;
  const totalCount = results.length;

  return (
    <Card data-testid="card-stress-test">
      <CardHeader>
        <div className="flex items-center gap-2 flex-wrap">
          <CardTitle className="text-lg">Стресс-тест</CardTitle>
          <Tooltip>
            <TooltipTrigger>
              <Info className="h-4 w-4 text-muted-foreground" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-xs">
              <p className="text-xs">Сценарий считается успешным, если AI соблюдает правила и достигает цели в ответе.</p>
            </TooltipContent>
          </Tooltip>
        </div>
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
            <span className="text-sm text-muted-foreground">Прошло успешно</span>
            {totalCount > 0 && (
              <span className="text-xs text-muted-foreground" data-testid="text-completion">
                Выполнено: {totalCount}/{totalCount}
              </span>
            )}
          </motion.div>
        )}

        {!isRunning && hasResults && (
          <div className="space-y-2" data-testid="list-results">
            {results.map((r) => (
              <ResultRow key={r.scenarioKey} result={r} />
            ))}
          </div>
        )}

        {!isRunning && hasResults && (
          <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground flex-wrap" data-testid="text-summary-line">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-green-500" />
              Пройдено: {passedCount}/{totalCount}
            </span>
            <span className="flex items-center gap-1">
              <AlertTriangle className="h-3 w-3 text-red-500" />
              Провалено: {failedCount}/{totalCount}
            </span>
          </div>
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
