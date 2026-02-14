import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDown } from "lucide-react";
import type { FunnelStage } from "../../types/aiRopTypes";
import { getStageName } from "../../utils/stageUtils";

interface Props {
  funnel: FunnelStage[] | null;
  isLoading: boolean;
}

export function FunnelCard({ funnel, isLoading }: Props) {
  if (!funnel || funnel.length === 0) return null;

  const maxCount = Math.max(...funnel.map(f => f.count), 1);

  return (
    <Card data-testid="funnel-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium">Воронка продаж</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {funnel.map((stage, i) => (
          <div key={stage.stage} data-testid={`funnel-stage-${stage.stage}`}>
            <div className="flex items-center justify-between gap-2 text-xs mb-1">
              <span className="text-muted-foreground">{getStageName(stage.stage)}</span>
              <span className="font-medium">{stage.count}</span>
            </div>
            <div className="h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary/70 rounded-full transition-all duration-500"
                style={{ width: `${Math.max((stage.count / maxCount) * 100, 2)}%` }}
              />
            </div>
            {stage.dropOffRate > 0 && i < funnel.length - 1 && (
              <div className="flex items-center gap-1 mt-0.5">
                <ArrowDown className="h-3 w-3 text-red-400" />
                <span className="text-[10px] text-red-400">-{stage.dropOffRate}%</span>
              </div>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
