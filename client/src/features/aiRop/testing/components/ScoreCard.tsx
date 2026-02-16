import { useEffect, useState, useRef } from "react";
import { motion } from "framer-motion";
import { RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface ScoreCardProps {
  score: number;
  breakdown: {
    completeness: { score: number; max: number };
    behavior: { score: number; max: number };
    operations: { score: number; max: number };
    testing: { score: number; max: number };
  };
  isLoading?: boolean;
  onRecompute?: () => void;
  isRecomputing?: boolean;
}

const CATEGORIES = [
  { key: "completeness" as const, label: "Настройки" },
  { key: "behavior" as const, label: "Продажи" },
  { key: "operations" as const, label: "Интеграции" },
  { key: "testing" as const, label: "Тесты" },
];

function getScoreColor(score: number) {
  if (score >= 80) return { text: "text-green-500", stroke: "stroke-green-500", bg: "bg-green-500" };
  if (score >= 50) return { text: "text-yellow-500", stroke: "stroke-yellow-500", bg: "bg-yellow-500" };
  return { text: "text-red-500", stroke: "stroke-red-500", bg: "bg-red-500" };
}

function useCountUp(target: number, duration: number = 1500) {
  const [value, setValue] = useState(0);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const startTime = performance.now();
    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.round(eased * target));
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return value;
}

export function ScoreCard({ score, breakdown, isLoading, onRecompute, isRecomputing }: ScoreCardProps) {
  const displayScore = useCountUp(isLoading ? 0 : score);
  const colors = getScoreColor(score);

  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const targetOffset = circumference - (score / 100) * circumference;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Готовность AI-РОПа</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-center gap-4">
          <Skeleton className="h-[120px] w-[120px] rounded-full" />
          <Skeleton className="h-4 w-20" />
          <div className="w-full space-y-3">
            {CATEGORIES.map((c) => (
              <div key={c.key} className="space-y-1">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </div>
          <Skeleton className="h-8 w-28" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Готовность AI-РОПа</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center gap-4">
        <div className="relative flex items-center justify-center" style={{ width: 120, height: 120 }}>
          <svg width="120" height="120" viewBox="0 0 120 120" className="-rotate-90">
            <circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              className="stroke-muted"
              strokeWidth="8"
            />
            <motion.circle
              cx="60"
              cy="60"
              r={radius}
              fill="none"
              className={colors.stroke}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: targetOffset }}
              transition={{ duration: 1.5, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-3xl font-bold ${colors.text}`} data-testid="text-score-value">
              {displayScore}
            </span>
          </div>
        </div>

        <span className="text-sm text-muted-foreground">/100</span>

        <div className="w-full space-y-3">
          {CATEGORIES.map((cat) => {
            const item = breakdown[cat.key];
            const pct = item.max > 0 ? (item.score / item.max) * 100 : 0;
            const barColor = getScoreColor(pct);
            return (
              <div key={cat.key} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="text-muted-foreground">{cat.label}</span>
                  <span className="font-medium">{item.score}/{item.max}</span>
                </div>
                <div className="h-1.5 w-full rounded-full bg-muted">
                  <motion.div
                    className={`h-full rounded-full ${barColor.bg}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {onRecompute && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onRecompute}
            disabled={isRecomputing}
            data-testid="button-recompute-score"
          >
            <RefreshCw className={isRecomputing ? "animate-spin" : ""} />
            Пересчитать
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
