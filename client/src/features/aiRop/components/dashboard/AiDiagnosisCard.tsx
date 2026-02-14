import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Brain, Loader2 } from "lucide-react";
import type { AuditReport, AnalyticsSummary } from "../../types/aiRopTypes";

interface Props {
  latestAudit: AuditReport | null;
  analytics: AnalyticsSummary | null;
  isLoading: boolean;
}

export function AiDiagnosisCard({ latestAudit, analytics, isLoading }: Props) {
  const hasData = analytics && analytics.totalDialogs > 0;

  let diagnosisText = "После первых 5 диалогов появится аналитика. Пока можете протестировать AI в чате справа.";

  if (hasData && latestAudit) {
    const summary = latestAudit.summaryJson;
    const successRate = summary.totalDialogs > 0 
      ? Math.round((summary.successful / summary.totalDialogs) * 100) 
      : 0;

    if (successRate >= 70) {
      diagnosisText = `AI работает хорошо: ${successRate}% диалогов завершаются успешно. ${summary.blockers > 0 ? `Обнаружено ${summary.blockers} блокировок — стоит разобраться.` : "Серьёзных проблем не обнаружено."}`;
    } else if (successRate >= 40) {
      diagnosisText = `Есть возможности для роста: ${successRate}% успешных диалогов. Рекомендую обновить базу знаний и обработку возражений.`;
    } else {
      diagnosisText = `Требуется внимание: только ${successRate}% диалогов успешны. Проверьте настройки, базу знаний и правила передачи.`;
    }
  } else if (hasData) {
    diagnosisText = `Собрано ${analytics!.totalDialogs} диалогов. Запустите аудит для детального анализа.`;
  }

  return (
    <Card data-testid="diagnosis-card">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium flex items-center gap-2">
          <Brain className="h-4 w-4 text-purple-500" />
          Диагностика AI
        </CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Анализирую…
          </div>
        ) : (
          <p className="text-sm leading-relaxed">{diagnosisText}</p>
        )}
      </CardContent>
    </Card>
  );
}
