import { useQuery } from "@tanstack/react-query";
import { useRoute } from "wouter";
import { fetchOnboardingStatus, AI_ROP_KEYS } from "../api/aiRopApi";
import { AiRopOnboardingPage } from "./AiRopOnboardingPage";
import { AiRopLayout } from "../components/layout/AiRopLayout";
import { Skeleton } from "@/components/ui/skeleton";
import OverviewPage from "./OverviewPage";
import TrainingPage from "./TrainingPage";
import TestingPage from "./TestingPage";
import ConnectionsPage from "./ConnectionsPage";
import AnalyticsPage from "./AnalyticsPage";
import StrategyPage from "./StrategyPage";

const TAB_COMPONENTS: Record<string, () => JSX.Element> = {
  overview: OverviewPage,
  training: TrainingPage,
  testing: TestingPage,
  connections: ConnectionsPage,
  analytics: AnalyticsPage,
  strategy: StrategyPage,
};

export default function AiRopEntryPage() {
  const { data: status, isLoading } = useQuery({
    queryKey: AI_ROP_KEYS.onboardingStatus,
    queryFn: fetchOnboardingStatus,
  });

  const [, params] = useRoute("/dashboard/ai/rop/:tab");
  const tab = params?.tab ?? "overview";
  const TabComponent = TAB_COMPONENTS[tab] ?? OverviewPage;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="space-y-4 w-full max-w-md">
          <Skeleton className="h-8 w-3/4 mx-auto" />
          <Skeleton className="h-4 w-1/2 mx-auto" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    );
  }

  if (!status?.completed) {
    return <AiRopOnboardingPage />;
  }

  return (
    <AiRopLayout>
      <TabComponent />
    </AiRopLayout>
  );
}
