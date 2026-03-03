import { useQuery, useMutation } from "@tanstack/react-query";
import { SectionHeader } from "../components/SectionHeader";
import { ScoreHeroCard } from "../overview/ScoreHeroCard";
import { ReadinessCard } from "../overview/ReadinessCard";
import { KpiStrip } from "../overview/KpiStrip";
import { BottleneckSummaryCard } from "../overview/BottleneckSummaryCard";
import { InsightsCard } from "../overview/InsightsCard";
import { ActionCenter } from "../overview/ActionCenter";
import { RecentDialogs } from "../overview/RecentDialogs";
import { QuickTestChatMini } from "../overview/QuickTestChatMini";
import { fetchSummary, ANALYTICS_KEYS } from "../analytics/api/analyticsApi";
import { fetchScore, TESTING_KEYS } from "../testing/api/testingApi";
import { fetchSettings, saveSettings, AI_ROP_KEYS } from "../api/aiRopApi";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Power } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";

export default function OverviewPage() {
  const { toast } = useToast();

  const { data: settings } = useQuery({
    queryKey: AI_ROP_KEYS.settings,
    queryFn: fetchSettings,
  });

  const { data: summary } = useQuery({
    queryKey: ANALYTICS_KEYS.summary("30d", "ALL"),
    queryFn: () => fetchSummary("30d", "ALL"),
  });

  const { data: score } = useQuery({
    queryKey: TESTING_KEYS.score,
    queryFn: fetchScore,
  });

  const activateMutation = useMutation({
    mutationFn: () => saveSettings({ enabled: true }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AI_ROP_KEYS.settings });
      queryClient.invalidateQueries({ queryKey: ["/api/ai/status"] });
      toast({ title: "AI-бот активирован" });
    },
  });

  return (
    <div data-testid="page-overview" className="space-y-4">
      <SectionHeader
        title="Обзор"
        subtitle="Центр управления AI-продавцом"
      />

      {settings && !settings.enabled && (
        <Card data-testid="bot-activation-banner" className="border-amber-300 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-700">
          <CardContent className="px-5 py-4 flex items-center gap-4">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
            <div className="flex-1">
              <p className="font-medium text-amber-900 dark:text-amber-200">AI-бот выключен</p>
              <p className="text-sm text-amber-700 dark:text-amber-400">Бот не отвечает на сообщения клиентов. Нажмите «Активировать», чтобы включить.</p>
            </div>
            <Button
              data-testid="button-activate-bot"
              onClick={() => activateMutation.mutate()}
              disabled={activateMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700 text-white shrink-0"
            >
              <Power className="h-4 w-4 mr-2" />
              {activateMutation.isPending ? "Включаю..." : "Активировать"}
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-[3fr_2fr] gap-4">
        <ScoreHeroCard />
        <ReadinessCard />
      </div>

      <KpiStrip period="30d" />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <BottleneckSummaryCard bottlenecks={summary?.bottlenecks || []} />
        <InsightsCard summary={summary || null} />
      </div>

      <ActionCenter summary={summary || null} score={score || null} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <RecentDialogs />
        <QuickTestChatMini />
      </div>
    </div>
  );
}
