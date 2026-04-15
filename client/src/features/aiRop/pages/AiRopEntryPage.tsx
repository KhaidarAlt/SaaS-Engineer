import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Lock, Bot } from "lucide-react";
import { fetchOnboardingStatus, AI_ROP_KEYS } from "../api/aiRopApi";
import { AiRopOnboardingPage } from "./AiRopOnboardingPage";
import { AiRopLayout } from "../components/layout/AiRopLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/AuthContext";
import OverviewPage from "./OverviewPage";
import TrainingPage from "../training/pages/TrainingPage";
import TestingPage from "../testing/pages/TestingPage";
import ConnectionsPage from "./ConnectionsPage";
import AnalyticsPage from "../analytics/pages/AnalyticsPage";
import StrategyPage from "./StrategyPage";
import { GrowthRouter } from "../growth/pages/GrowthRouter";
import BankProductsPage from "./BankProductsPage";

const TAB_COMPONENTS: Record<string, () => JSX.Element> = {
  overview: OverviewPage,
  training: TrainingPage,
  testing: TestingPage,
  connections: ConnectionsPage,
  analytics: AnalyticsPage,
  strategy: StrategyPage,
  growth: GrowthRouter,
  "bank-products": BankProductsPage,
};

export default function AiRopEntryPage() {
  const { user } = useAuth();
  const tenant = user?.tenant;

  const { data: status, isLoading } = useQuery({
    queryKey: AI_ROP_KEYS.onboardingStatus,
    queryFn: fetchOnboardingStatus,
    enabled: tenant?.aiRopEnabled !== false,
  });

  const [location] = useLocation();
  const segments = location.replace("/dashboard/ai/rop/", "").split("/");
  const tab = segments[0] || "overview";
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

  if (tenant?.aiRopEnabled === false) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]" data-testid="airop-lock-screen">
        <div className="text-center space-y-4 max-w-sm px-4">
          <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mx-auto relative">
            <Bot className="h-10 w-10 text-muted-foreground" />
            <div className="absolute -bottom-1 -right-1 w-7 h-7 rounded-full bg-background border-2 border-muted flex items-center justify-center">
              <Lock className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
          </div>
          <h2 className="text-xl font-bold">AI-РОП не активирован</h2>
          <p className="text-muted-foreground text-sm">
            Обратитесь к администратору для подключения функции AI-РОП.
          </p>
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
