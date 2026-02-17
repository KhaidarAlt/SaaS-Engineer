import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowRight, Zap } from "lucide-react";
import { motion } from "framer-motion";
import { fetchScore, TESTING_KEYS } from "../testing/api/testingApi";
import type { ScoreBreakdown } from "../testing/types/testingTypes";

function getScoreColor(score: number) {
  if (score >= 80) return { ring: "stroke-green-500", text: "text-green-600 dark:text-green-400", label: "Готов к продажам", bg: "bg-green-500/10" };
  if (score >= 50) return { ring: "stroke-yellow-500", text: "text-yellow-600 dark:text-yellow-400", label: "Есть риски", bg: "bg-yellow-500/10" };
  return { ring: "stroke-red-500", text: "text-red-600 dark:text-red-400", label: "Нужно настроить", bg: "bg-red-500/10" };
}

function CircularProgress({ score }: { score: number }) {
  const size = 140;
  const strokeWidth = 10;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const colors = getScoreColor(score);

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="hsl(var(--muted))" strokeWidth={strokeWidth} />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          className={colors.ring}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className={`text-3xl font-bold ${colors.text}`}
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.5, duration: 0.4 }}
          data-testid="text-score-value"
        >
          {score}
        </motion.span>
        <span className="text-xs text-muted-foreground">из 100</span>
      </div>
    </div>
  );
}

function BreakdownBar({ label, score, max }: { label: string; score: number; max: number }) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{score}/{max}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-primary"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
    </div>
  );
}

function getWeakestCategory(breakdown: ScoreBreakdown): string {
  const categories = [
    { key: "completeness", ratio: breakdown.completeness.score / breakdown.completeness.max, tab: "strategy" },
    { key: "behavior", ratio: breakdown.behavior.score / breakdown.behavior.max, tab: "training" },
    { key: "operations", ratio: breakdown.operations.score / breakdown.operations.max, tab: "connections" },
    { key: "testing", ratio: breakdown.testing.score / breakdown.testing.max, tab: "testing" },
  ];
  categories.sort((a, b) => a.ratio - b.ratio);
  return categories[0].tab;
}

const BREAKDOWN_LABELS: Record<string, string> = {
  completeness: "Полнота",
  behavior: "Поведение",
  operations: "Операции",
  testing: "Тестирование",
};

export function ScoreHeroCard() {
  const [, navigate] = useLocation();
  const { data, isLoading } = useQuery({
    queryKey: TESTING_KEYS.score,
    queryFn: fetchScore,
  });

  if (isLoading) {
    return (
      <Card className="p-6" data-testid="card-score-hero">
        <div className="flex items-center gap-6 flex-wrap">
          <Skeleton className="h-36 w-36 rounded-full" />
          <div className="flex-1 space-y-3 min-w-[200px]">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-full" />
          </div>
        </div>
      </Card>
    );
  }

  if (!data) return null;

  const scoreTotal = data.scoreTotal;
  const colors = getScoreColor(scoreTotal);
  const weakTab = getWeakestCategory(data.breakdown);

  return (
    <Card className="p-6" data-testid="card-score-hero">
      <div className="flex items-center gap-6 flex-wrap">
        <div className="flex flex-col items-center gap-2">
          <CircularProgress score={scoreTotal} />
          <span className={`text-xs font-medium ${colors.text} px-2 py-0.5 rounded-full ${colors.bg}`} data-testid="text-score-label">
            {colors.label}
          </span>
        </div>
        <div className="flex-1 space-y-3 min-w-[200px]">
          <h3 className="text-sm font-semibold" data-testid="text-score-title">AI Score</h3>
          {Object.entries(data.breakdown).map(([key, cat]) => (
            <BreakdownBar key={key} label={BREAKDOWN_LABELS[key] || key} score={cat.score} max={cat.max} />
          ))}
          <div className="flex items-center gap-2 pt-1 flex-wrap">
            <Button
              size="sm"
              onClick={() => navigate(`/dashboard/ai/rop/${weakTab}`)}
              data-testid="button-improve-score"
            >
              <ArrowRight className="h-4 w-4 mr-1" />
              Улучшить
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => navigate("/dashboard/ai/rop/testing")}
              data-testid="button-go-stress-test"
            >
              <Zap className="h-4 w-4 mr-1" />
              Стресс-тест
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}
