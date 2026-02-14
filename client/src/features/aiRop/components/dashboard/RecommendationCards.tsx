import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Lightbulb, Check, X, TrendingUp } from "lucide-react";
import type { Recommendation } from "../../types/aiRopTypes";

interface Props {
  recommendations: Recommendation[];
  onApply: (rec: Recommendation) => void;
  onIgnore: (rec: Recommendation) => void;
  isApplying: boolean;
}

export function RecommendationCards({ recommendations, onApply, onIgnore, isApplying }: Props) {
  if (!recommendations || recommendations.length === 0) return null;

  return (
    <div className="space-y-3" data-testid="recommendation-cards">
      <h3 className="text-sm font-medium flex items-center gap-2">
        <Lightbulb className="h-4 w-4 text-amber-500" />
        Рекомендации
      </h3>
      {recommendations.slice(0, 5).map((rec, i) => (
        <Card key={i} data-testid={`recommendation-${i}`}>
          <CardContent className="py-3 px-4">
            <p className="text-sm font-medium mb-1">{rec.problem}</p>
            <p className="text-xs text-muted-foreground mb-2">{rec.suggestion}</p>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
                <TrendingUp className="h-3 w-3" />
                <span>{rec.estimatedImpact}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button size="sm" variant="outline" onClick={() => onApply(rec)} disabled={isApplying} data-testid={`apply-rec-${i}`}>
                  <Check className="h-3 w-3 mr-1" />
                  Применить
                </Button>
                <Button size="sm" variant="ghost" onClick={() => onIgnore(rec)} data-testid={`ignore-rec-${i}`}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
