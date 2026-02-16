import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { BarChart3, History, Layers, AlertTriangle, CheckCircle2, XCircle } from "lucide-react";
import type { ReadinessResult, AnalyticsSummary } from "../../types/aiRopTypes";
import { formatConversionRate } from "../../utils/stageUtils";

interface Props {
  readiness: ReadinessResult | null;
  analytics: AnalyticsSummary | null;
  period: string;
  onPeriodChange: (p: string) => void;
  onRunAudit: () => void;
  onOpenTraining: () => void;
  onOpenVersions: () => void;
  isAuditing?: boolean;
}

export function AiRopHeader({ readiness, analytics, period, onPeriodChange, onRunAudit, onOpenTraining, onOpenVersions, isAuditing }: Props) {
  const periods = [
    { value: "today", label: "Сегодня" },
    { value: "7d", label: "7 дней" },
    { value: "30d", label: "30 дней" },
    { value: "90d", label: "90 дней" },
  ];

  const readinessColor = readiness?.status === "READY" 
    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
    : readiness?.status === "WARNING"
    ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" 
    : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400";

  const ReadinessIcon = readiness?.status === "READY" ? CheckCircle2 : readiness?.status === "WARNING" ? AlertTriangle : XCircle;

  return (
    <div className="rounded-md border bg-muted/30" data-testid="ai-rop-header">
      <div className="flex items-center justify-between gap-4 flex-wrap px-4 py-3">
        
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 bg-muted rounded-md p-0.5" data-testid="period-picker">
            {periods.map(p => (
              <Button
                key={p.value}
                variant={period === p.value ? "default" : "ghost"}
                size="sm"
                onClick={() => onPeriodChange(p.value)}
                data-testid={`period-${p.value}`}
              >
                {p.label}
              </Button>
            ))}
          </div>
          
          {analytics && (
            <div className="hidden md:flex items-center gap-3 text-xs text-muted-foreground">
              <span>{analytics.totalDialogs} диалогов</span>
              <span className="text-green-600 dark:text-green-400">{formatConversionRate(analytics.conversionRate)}</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {readiness && (
            <Badge variant="outline" className={readinessColor} data-testid="readiness-badge">
              <ReadinessIcon className="h-3 w-3 mr-1" />
              {readiness.status === "READY" ? "Готов" : readiness.status === "WARNING" ? "Внимание" : "Блокировка"}
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={onRunAudit} disabled={isAuditing} data-testid="button-run-audit">
            <BarChart3 className="h-4 w-4 mr-1" />
            Аудит
          </Button>
          <Button variant="ghost" size="sm" onClick={onOpenTraining} data-testid="button-open-training">
            <Layers className="h-4 w-4 mr-1" />
            Обучение
          </Button>
          <Button variant="ghost" size="sm" onClick={onOpenVersions} data-testid="button-open-versions">
            <History className="h-4 w-4 mr-1" />
            Версии
          </Button>
        </div>
      </div>
    </div>
  );
}
