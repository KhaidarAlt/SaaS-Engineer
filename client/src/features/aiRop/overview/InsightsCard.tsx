import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lightbulb, ExternalLink } from "lucide-react";
import type { AnalyticsSummary } from "../analytics/types/analyticsTypes";

interface Insight {
  id: string;
  title: string;
  priority: "high" | "medium" | "low";
  link: string;
}

function generateInsights(summary: AnalyticsSummary): Insight[] {
  const insights: Insight[] = [];

  const priceObj = summary.objections.find((o) => o.type === "PRICE");
  if (priceObj && priceObj.count >= 3 && priceObj.successRate < 40) {
    insights.push({
      id: "price-dropoff",
      title: "Высокий отвал на возражении «дорого»",
      priority: "high",
      link: "/dashboard/ai/rop/training",
    });
  }

  if (summary.handover.tooEarlyRate > 20) {
    insights.push({
      id: "handover-early",
      title: "Слишком много ранних передач менеджеру",
      priority: "high",
      link: "/dashboard/ai/rop/strategy",
    });
  }

  if (summary.kpis.totalDialogs > 0 && summary.kpis.successRate < 20) {
    insights.push({
      id: "low-success",
      title: "Низкая конверсия — менее 20%",
      priority: "high",
      link: "/dashboard/ai/rop/analytics",
    });
  }

  const premiumObj = summary.objections.find((o) => o.type === "COMPARE");
  if (premiumObj && premiumObj.successRate < 30) {
    insights.push({
      id: "compare-weak",
      title: "Слабая обработка сравнений с конкурентами",
      priority: "medium",
      link: "/dashboard/ai/rop/training",
    });
  }

  if (summary.triggers.totals.fired === 0 && summary.kpis.totalDialogs >= 5) {
    insights.push({
      id: "no-triggers",
      title: "Ни один триггер не сработал",
      priority: "medium",
      link: "/dashboard/ai/rop/training",
    });
  }

  if (summary.trainingImpact.kbAdded < 3 && summary.kpis.totalDialogs >= 3) {
    insights.push({
      id: "kb-sparse",
      title: "База знаний почти пуста — AI отвечает неточно",
      priority: "medium",
      link: "/dashboard/ai/rop/training",
    });
  }

  const deliveryObj = summary.objections.find((o) => o.type === "DELIVERY");
  if (deliveryObj && deliveryObj.count >= 2 && deliveryObj.successRate < 40) {
    insights.push({
      id: "delivery-weak",
      title: "Слабая обработка вопросов о доставке",
      priority: "medium",
      link: "/dashboard/ai/rop/training",
    });
  }

  return insights.slice(0, 5);
}

const PRIORITY_CONFIG: Record<string, "destructive" | "outline" | "secondary"> = {
  high: "destructive",
  medium: "outline",
  low: "secondary",
};

export function InsightsCard({ summary }: { summary: AnalyticsSummary | null }) {
  const [, navigate] = useLocation();

  const insights = summary ? generateInsights(summary) : [];

  return (
    <Card className="p-5" data-testid="card-insights">
      <div className="flex items-center gap-2 mb-3">
        <Lightbulb className="h-4 w-4 text-yellow-500" />
        <h3 className="text-sm font-semibold">Инсайты</h3>
      </div>
      {insights.length === 0 ? (
        <p className="text-sm text-muted-foreground">Недостаточно данных для генерации инсайтов</p>
      ) : (
        <div className="space-y-2">
          {insights.map((insight) => (
            <div
              key={insight.id}
              className="flex items-center justify-between gap-2 rounded-md border p-2 hover-elevate cursor-pointer"
              onClick={() => navigate(insight.link)}
              data-testid={`insight-${insight.id}`}
            >
              <div className="flex items-center gap-2 min-w-0">
                <Badge variant={PRIORITY_CONFIG[insight.priority]} className="text-xs shrink-0">
                  {insight.priority === "high" ? "!" : insight.priority === "medium" ? "i" : "..."}
                </Badge>
                <span className="text-sm truncate">{insight.title}</span>
              </div>
              <ExternalLink className="h-3 w-3 shrink-0 text-muted-foreground" />
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
