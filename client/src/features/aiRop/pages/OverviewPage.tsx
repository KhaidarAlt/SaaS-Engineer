import { useQuery } from "@tanstack/react-query";
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

export default function OverviewPage() {
  const { data: summary } = useQuery({
    queryKey: ANALYTICS_KEYS.summary("30d", "ALL"),
    queryFn: () => fetchSummary("30d", "ALL"),
  });

  const { data: score } = useQuery({
    queryKey: TESTING_KEYS.score,
    queryFn: fetchScore,
  });

  return (
    <div data-testid="page-overview" className="space-y-4">
      <SectionHeader
        title="Обзор"
        subtitle="Центр управления AI-продавцом"
      />

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
