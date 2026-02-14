import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle } from "lucide-react";
import type { DropoffReason } from "../../types/aiRopTypes";
import { getStageName } from "../../utils/stageUtils";

interface Props {
  dropoffs: DropoffReason[] | null;
  isLoading: boolean;
}

export function DropoffReasonsCard({ dropoffs, isLoading }: Props) {
  if (!dropoffs || dropoffs.length === 0) return null;

  return (
    <Card data-testid="dropoff-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-500" />
          Причины оттока
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {dropoffs.slice(0, 5).map((d, i) => (
          <div key={d.stage} className="flex items-center justify-between gap-2" data-testid={`dropoff-${i}`}>
            <span className="text-sm text-muted-foreground truncate">{getStageName(d.stage)}</span>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm font-medium">{d.count}</span>
              <span className="text-xs text-muted-foreground">({d.percentage}%)</span>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
