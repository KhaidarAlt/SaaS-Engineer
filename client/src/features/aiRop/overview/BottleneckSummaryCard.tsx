import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle, BarChart3 } from "lucide-react";
import { STAGE_LABELS } from "../analytics/types/analyticsTypes";
import type { BottleneckData } from "../analytics/types/analyticsTypes";

interface BottleneckSummaryCardProps {
  bottlenecks: BottleneckData[];
}

export function BottleneckSummaryCard({ bottlenecks }: BottleneckSummaryCardProps) {
  const [, navigate] = useLocation();

  if (bottlenecks.length === 0) {
    return (
      <Card className="p-5" data-testid="card-bottleneck-summary">
        <div className="flex items-center gap-2 mb-2">
          <AlertTriangle className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold">Узкие места</h3>
        </div>
        <p className="text-sm text-muted-foreground">Недостаточно данных для определения узких мест</p>
      </Card>
    );
  }

  const main = bottlenecks[0];

  return (
    <Card className="p-5" data-testid="card-bottleneck-summary">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-orange-500" />
          <h3 className="text-sm font-semibold">Главное узкое место</h3>
        </div>
        <Badge variant="destructive" className="text-xs" data-testid="badge-bottleneck-rate">
          {main.rate}% отвал
        </Badge>
      </div>
      <div className="mb-3">
        <p className="text-base font-medium" data-testid="text-bottleneck-stage">
          {STAGE_LABELS[main.stage] || main.stage}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {main.count} диалогов потеряно на этом этапе
        </p>
        {main.topReasons.length > 0 && (
          <div className="flex items-center gap-1 mt-2 flex-wrap">
            {main.topReasons.map((r) => (
              <Badge key={r.reason} variant="outline" className="text-xs">{r.reason}: {r.count}</Badge>
            ))}
          </div>
        )}
      </div>
      <Button
        size="sm"
        variant="outline"
        onClick={() => navigate("/dashboard/ai/rop/analytics")}
        data-testid="button-open-analytics"
      >
        <BarChart3 className="h-4 w-4 mr-1" />
        Открыть аналитику
      </Button>
    </Card>
  );
}
