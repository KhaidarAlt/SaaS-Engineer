import { Card, CardContent } from "@/components/ui/card";
import { MessageSquare, TrendingUp, Percent, MessagesSquare } from "lucide-react";
import type { AnalyticsSummary } from "../../types/aiRopTypes";
import { formatConversionRate, formatNumber } from "../../utils/stageUtils";

interface Props {
  analytics: AnalyticsSummary | null;
  isLoading: boolean;
}

export function KpiCards({ analytics, isLoading }: Props) {
  const cards = [
    { label: "Диалоги", value: analytics ? formatNumber(analytics.totalDialogs) : "—", icon: MessageSquare, color: "text-blue-500" },
    { label: "Успешные", value: analytics ? formatNumber(analytics.successfulDialogs) : "—", icon: TrendingUp, color: "text-green-500" },
    { label: "Конверсия", value: analytics ? formatConversionRate(analytics.conversionRate) : "—", icon: Percent, color: "text-purple-500" },
    { label: "Ср. сообщений", value: analytics ? (analytics.avgMessagesPerDialog || 0).toFixed(1) : "—", icon: MessagesSquare, color: "text-amber-500" },
  ];

  return (
    <div className="grid grid-cols-2 gap-3" data-testid="kpi-cards">
      {cards.map((c, i) => (
        <Card key={i} data-testid={`kpi-card-${i}`}>
          <CardContent className="py-3 px-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs text-muted-foreground">{c.label}</p>
                <p className="text-xl font-semibold mt-0.5">{isLoading ? "…" : c.value}</p>
              </div>
              <c.icon className={`h-5 w-5 ${c.color} opacity-60`} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
