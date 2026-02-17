import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowRight, CreditCard, Zap, BookOpen, Target } from "lucide-react";
import type { AnalyticsSummary } from "../analytics/types/analyticsTypes";
import type { AiScore } from "../testing/types/testingTypes";

interface Recommendation {
  id: string;
  icon: typeof CreditCard;
  title: string;
  reason: string;
  impact: string;
  link: string;
}

function generateRecommendations(summary: AnalyticsSummary | null, score: AiScore | null): Recommendation[] {
  const recs: Recommendation[] = [];

  if (score && score.scoreTotal < 80) {
    const bd = score.breakdown;
    if (bd.behavior.score < bd.behavior.max * 0.5) {
      const hasPaymentItem = bd.behavior.items?.paymentFlow;
      if (hasPaymentItem && !hasPaymentItem.passed) {
        recs.push({
          id: "installment",
          icon: CreditCard,
          title: "Включить рассрочку",
          reason: "Оплата не настроена — клиенты уходят при попытке купить",
          impact: "Высокий",
          link: "/dashboard/payments",
        });
      }
    }
  }

  if (summary) {
    const priceObj = summary.objections.find((o) => o.type === "PRICE");
    if (priceObj && priceObj.count >= 2 && priceObj.successRate < 40) {
      recs.push({
        id: "price-trigger",
        icon: Target,
        title: "Создать триггер «дорого»",
        reason: `Возражение «цена» встречается ${priceObj.count} раз с конверсией ${priceObj.successRate}%`,
        impact: "Высокий",
        link: "/dashboard/ai/rop/training",
      });
    }
  }

  if (score) {
    const testingCat = score.breakdown.testing;
    const stressItem = testingCat.items?.stressTest;
    if (stressItem && !stressItem.passed) {
      recs.push({
        id: "stress-test",
        icon: Zap,
        title: "Пройти стресс-тест",
        reason: "Стресс-тест не пройден — есть неизвестные слабые места",
        impact: "Средний",
        link: "/dashboard/ai/rop/testing",
      });
    }
  }

  if (summary && summary.trainingImpact.kbAdded < 3) {
    recs.push({
      id: "kb-fill",
      icon: BookOpen,
      title: "Заполнить базу знаний",
      reason: `Только ${summary.trainingImpact.kbAdded} статей — AI не может отвечать точно`,
      impact: "Средний",
      link: "/dashboard/ai/rop/training",
    });
  }

  return recs.slice(0, 5);
}

export function ActionCenter({ summary, score }: { summary: AnalyticsSummary | null; score: AiScore | null }) {
  const [, navigate] = useLocation();
  const recs = generateRecommendations(summary, score);

  if (recs.length === 0) return null;

  return (
    <Card className="p-5" data-testid="card-action-center">
      <h3 className="text-sm font-semibold mb-3">Рекомендации</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {recs.map((rec) => {
          const Icon = rec.icon;
          return (
            <div key={rec.id} className="rounded-md border p-3 space-y-2" data-testid={`recommendation-${rec.id}`}>
              <div className="flex items-start gap-2">
                <Icon className="h-4 w-4 mt-0.5 text-primary shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium">{rec.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{rec.reason}</p>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <Badge variant="outline" className="text-xs">{rec.impact}</Badge>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => navigate(rec.link)}
                  data-testid={`button-action-${rec.id}`}
                >
                  <ArrowRight className="h-3 w-3 mr-1" />
                  Перейти
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
