import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ArrowRight } from "lucide-react";
import type { HandoverData } from "../types/analyticsTypes";

interface HandoverPanelProps {
  data: HandoverData;
}

export function HandoverPanel({ data }: HandoverPanelProps) {
  return (
    <Card className="p-4" data-testid="card-handover">
      <h3 className="text-sm font-semibold mb-3">Передачи менеджеру</h3>
      <div className="grid grid-cols-2 gap-3 mb-3">
        <div className="rounded-md border p-3 text-center">
          <div className="flex items-center justify-center gap-1">
            <ArrowRight className="h-4 w-4 text-blue-500" />
            <span className="text-lg font-bold">{data.count}</span>
          </div>
          <p className="text-xs text-muted-foreground">{data.rate}% от всех</p>
        </div>
        <div className="rounded-md border p-3 text-center">
          <div className="flex items-center justify-center gap-1">
            {data.tooEarlyRate > 20 && <AlertTriangle className="h-4 w-4 text-orange-500" />}
            <span className="text-lg font-bold">{data.tooEarlyRate}%</span>
          </div>
          <p className="text-xs text-muted-foreground">Ранних передач</p>
        </div>
      </div>
      {data.tooEarlyRate > 20 && (
        <div className="rounded-md bg-orange-50 dark:bg-orange-950/30 p-2 mb-3">
          <p className="text-xs text-orange-700 dark:text-orange-300">
            Слишком много ранних передач. Настройте AI на более полное обслуживание клиентов перед передачей.
          </p>
        </div>
      )}
      {data.reasons.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs text-muted-foreground font-medium mb-1">Причины:</p>
          {data.reasons.map((r) => (
            <div key={r.reason} className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-sm">{r.reason === "UNKNOWN" ? "Не указана" : r.reason}</span>
              <Badge variant="outline" className="text-xs">{r.count}</Badge>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
