import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, Zap, GraduationCap } from "lucide-react";
import type { TriggerStatsData, TrainingImpactData } from "../types/analyticsTypes";

interface TriggerEffectivenessProps {
  triggers: TriggerStatsData;
  training: TrainingImpactData;
}

export function TriggerEffectiveness({ triggers, training }: TriggerEffectivenessProps) {
  const successDelta = training.prevPeriodSuccessRate !== null
    ? training.periodSuccessRate - training.prevPeriodSuccessRate
    : null;

  return (
    <Card className="p-4" data-testid="card-trigger-effectiveness">
      <h3 className="text-sm font-semibold mb-3">Эффективность обучения</h3>
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded-md border p-2 text-center">
          <Zap className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
          <span className="text-lg font-bold">{triggers.totals.fired}</span>
          <p className="text-xs text-muted-foreground">Триггеров</p>
        </div>
        <div className="rounded-md border p-2 text-center">
          <GraduationCap className="h-4 w-4 mx-auto text-muted-foreground mb-1" />
          <span className="text-lg font-bold">{training.trainActions}</span>
          <p className="text-xs text-muted-foreground">Обучений</p>
        </div>
        <div className="rounded-md border p-2 text-center">
          {successDelta !== null ? (
            successDelta >= 0
              ? <TrendingUp className="h-4 w-4 mx-auto text-green-500 mb-1" />
              : <TrendingDown className="h-4 w-4 mx-auto text-red-500 mb-1" />
          ) : <TrendingUp className="h-4 w-4 mx-auto text-muted-foreground mb-1" />}
          <span className="text-lg font-bold">
            {successDelta !== null ? `${successDelta >= 0 ? "+" : ""}${successDelta}%` : "—"}
          </span>
          <p className="text-xs text-muted-foreground">Динамика</p>
        </div>
      </div>
      {triggers.topHelpful.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-muted-foreground font-medium mb-1">Помогают:</p>
          <div className="space-y-1">
            {triggers.topHelpful.slice(0, 3).map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm truncate max-w-[200px]">{t.name}</span>
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="text-xs">{t.fired}x</Badge>
                  <Badge className="text-xs">{t.successRate}%</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      {triggers.topNoisy.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground font-medium mb-1">Не помогают:</p>
          <div className="space-y-1">
            {triggers.topNoisy.slice(0, 3).map((t) => (
              <div key={t.id} className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-sm truncate max-w-[200px]">{t.name}</span>
                <div className="flex items-center gap-1">
                  <Badge variant="outline" className="text-xs">{t.fired}x</Badge>
                  <Badge variant="destructive" className="text-xs">{t.successRate}%</Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
