import { Card } from "@/components/ui/card";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from "recharts";
import { STAGE_LABELS } from "../types/analyticsTypes";
import type { FunnelStageData } from "../types/analyticsTypes";

interface FunnelChartProps {
  stages: FunnelStageData[];
}

const COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--primary) / 0.85)",
  "hsl(var(--primary) / 0.7)",
  "hsl(var(--primary) / 0.55)",
  "hsl(var(--primary) / 0.4)",
  "hsl(142 71% 45%)",
  "hsl(217 91% 60%)",
  "hsl(0 84% 60%)",
];

export function FunnelChart({ stages }: FunnelChartProps) {
  const data = stages.map((s) => ({
    ...s,
    label: STAGE_LABELS[s.stage] || s.stage,
  }));

  return (
    <Card className="p-4" data-testid="card-funnel">
      <h3 className="text-sm font-semibold mb-3">Воронка продаж</h3>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground py-8 text-center">Нет данных</p>
      ) : (
        <ResponsiveContainer width="100%" height={280}>
          <BarChart data={data} layout="vertical" margin={{ left: 80, right: 40, top: 10, bottom: 10 }}>
            <XAxis type="number" hide />
            <YAxis type="category" dataKey="label" width={75} tick={{ fontSize: 12 }} />
            <Tooltip
              formatter={(value: number, name: string, entry: any) => [`${value} (${entry.payload.conversionFromPrev}%)`, "Диалоги"]}
              contentStyle={{ borderRadius: 8, fontSize: 12 }}
            />
            <Bar dataKey="count" radius={[0, 4, 4, 0]} animationDuration={600}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
              <LabelList dataKey="count" position="right" style={{ fontSize: 11, fill: "var(--foreground)" }} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
