import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { OBJECTION_LABELS } from "../types/analyticsTypes";
import type { ObjectionData } from "../types/analyticsTypes";

interface ObjectionsTableProps {
  data: ObjectionData[];
}

export function ObjectionsTable({ data }: ObjectionsTableProps) {
  const chartData = data.map((d) => ({
    ...d,
    label: OBJECTION_LABELS[d.type] || d.type,
  }));

  return (
    <Card className="p-4" data-testid="card-objections">
      <h3 className="text-sm font-semibold mb-3">Возражения клиентов</h3>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground py-4 text-center">Нет данных о возражениях</p>
      ) : (
        <div className="space-y-4">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ left: 60, right: 20, top: 10, bottom: 10 }}>
              <XAxis dataKey="label" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ borderRadius: 8, fontSize: 12 }} />
              <Bar dataKey="successRate" name="Успех %" fill="hsl(142 71% 45%)" radius={[4, 4, 0, 0]} animationDuration={500} />
            </BarChart>
          </ResponsiveContainer>
          <div className="space-y-2">
            {data.map((obj) => (
              <div key={obj.type} className="flex items-center justify-between gap-2 rounded-md border p-2 flex-wrap" data-testid={`objection-row-${obj.type}`}>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">{OBJECTION_LABELS[obj.type] || obj.type}</span>
                  <Badge variant="outline" className="text-xs">{obj.count} раз</Badge>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={obj.successRate >= 50 ? "default" : "destructive"} className="text-xs">
                    Успех: {obj.successRate}%
                  </Badge>
                  <Badge variant="outline" className="text-xs">
                    Передача: {obj.handoverRate}%
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
