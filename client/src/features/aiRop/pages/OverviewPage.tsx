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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
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

  const toggleMutation = useMutation({
    mutationFn: (enabled: boolean) => saveSettings({ enabled }),
    onSuccess: (_data, enabled) => {
      queryClient.invalidateQueries({ queryKey: AI_ROP_KEYS.settings });
      queryClient.invalidateQueries({ queryKey: ["/api/ai/status"] });
      toast({ title: enabled ? "AI-бот включён" : "AI-бот выключен" });
    },
  });

  return (
    <div data-testid="page-overview" className="space-y-4">
      <div className="flex items-center justify-between">
        <SectionHeader
          title="Обзор"
          subtitle="Центр управления AI-продавцом"
        />
        {settings && (
          <div className="flex items-center gap-3">
            <Badge
              data-testid="badge-ai-status"
              variant={settings.enabled ? "default" : "secondary"}
              className={settings.enabled ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" : ""}
            >
              {settings.enabled ? "AI включён" : "AI выключен"}
            </Badge>
            <Switch
              data-testid="switch-ai-toggle"
              checked={settings.enabled}
              onCheckedChange={(checked) => toggleMutation.mutate(checked)}
              disabled={toggleMutation.isPending}
            />
          </div>
        )}
      </div>

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
