import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import { STAGE_LABELS, DROPOFF_REASON_LABELS } from "../types/analyticsTypes";
import type { BottleneckData } from "../types/analyticsTypes";

interface BottleneckCardProps {
  bottlenecks: BottleneckData[];
}

export function BottleneckCard({ bottlenecks }: BottleneckCardProps) {
  if (bottlenecks.length === 0) {
    return (
      <Card className="p-4" data-testid="card-bottlenecks">
        <h3 className="text-sm font-semibold mb-2">Узкие места</h3>
        <p className="text-sm text-muted-foreground py-4 text-center">Недостаточно данных для анализа</p>
      </Card>
    );
  }

  return (
    <Card className="p-4" data-testid="card-bottlenecks">
      <h3 className="text-sm font-semibold mb-3">Узкие места</h3>
      <div className="space-y-3">
        {bottlenecks.map((b, i) => (
          <motion.div
            key={b.stage}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="rounded-md border p-3 hover-elevate"
            data-testid={`bottleneck-${b.stage}`}
          >
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-orange-500 shrink-0" />
                <span className="text-sm font-medium">{STAGE_LABELS[b.stage] || b.stage}</span>
              </div>
              <Badge variant="destructive">{b.rate}% отвал</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{b.count} диалогов потеряно на этом этапе</p>
            {b.topReasons.length > 0 && (
              <div className="flex items-center gap-1 mt-2 flex-wrap">
                {b.topReasons.map((r) => (
                  <Badge key={r.reason} variant="outline" className="text-xs">
                    {DROPOFF_REASON_LABELS[r.reason] || r.reason}: {r.count}
                  </Badge>
                ))}
              </div>
            )}
          </motion.div>
        ))}
      </div>
    </Card>
  );
}
