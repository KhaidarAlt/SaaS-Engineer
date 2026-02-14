import { useState, useCallback } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { AiRopShell } from "../components/layout/AiRopShell";
import { AiRopHeader } from "../components/layout/AiRopHeader";
import { KpiCards } from "../components/dashboard/KpiCards";
import { FunnelCard } from "../components/dashboard/FunnelCard";
import { DropoffReasonsCard } from "../components/dashboard/DropoffReasonsCard";
import { AiDiagnosisCard } from "../components/dashboard/AiDiagnosisCard";
import { RecommendationCards } from "../components/dashboard/RecommendationCards";
import { TestChatPanel } from "../components/chat/TestChatPanel";
import { StrategyPanel } from "../components/strategy/StrategyPanel";
import { TrainingHistoryDrawer } from "../components/training/TrainingHistoryDrawer";
import { VersionHistoryDrawer } from "../components/training/VersionHistoryDrawer";
import {
  fetchSettings, fetchReadiness, fetchAnalyticsSummary,
  fetchFunnel, fetchDropoffs, runAudit, applyRecommendation,
  ignoreRecommendation, AI_ROP_KEYS,
} from "../api/aiRopApi";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Recommendation, AuditReport } from "../types/aiRopTypes";
import { ChevronDown, ChevronUp, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export default function AiRopDashboardPage() {
  const { toast } = useToast();
  const [period, setPeriod] = useState("7d");
  const [showStrategy, setShowStrategy] = useState(false);
  const [trainingOpen, setTrainingOpen] = useState(false);
  const [versionsOpen, setVersionsOpen] = useState(false);

  const settingsQuery = useQuery({
    queryKey: AI_ROP_KEYS.settings,
    queryFn: fetchSettings,
  });

  const readinessQuery = useQuery({
    queryKey: AI_ROP_KEYS.readiness(settingsQuery.data?.goal),
    queryFn: () => fetchReadiness(settingsQuery.data?.goal),
    enabled: !!settingsQuery.data,
  });

  const analyticsQuery = useQuery({
    queryKey: AI_ROP_KEYS.analytics(period),
    queryFn: () => fetchAnalyticsSummary(period),
  });

  const funnelQuery = useQuery({
    queryKey: AI_ROP_KEYS.funnel(period),
    queryFn: () => fetchFunnel(period),
  });

  const dropoffsQuery = useQuery({
    queryKey: AI_ROP_KEYS.dropoffs(period),
    queryFn: () => fetchDropoffs(period),
  });

  const auditQuery = useQuery<AuditReport[]>({
    queryKey: AI_ROP_KEYS.auditLatest,
    queryFn: async () => {
      const res = await fetch("/api/ai-rop/audit/reports", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch audits");
      return res.json();
    },
  });

  const latestAudit = auditQuery.data?.[0] ?? null;

  const auditMutation = useMutation({
    mutationFn: () => runAudit(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AI_ROP_KEYS.auditLatest });
      toast({ title: "Аудит завершён", description: "Результаты обновлены" });
    },
    onError: () => {
      toast({ title: "Ошибка аудита", description: "Попробуйте позже", variant: "destructive" });
    },
  });

  const applyMutation = useMutation({
    mutationFn: (rec: Recommendation) => applyRecommendation(rec),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AI_ROP_KEYS.auditLatest });
      queryClient.invalidateQueries({ queryKey: AI_ROP_KEYS.settings });
      toast({ title: "Рекомендация применена" });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось применить", variant: "destructive" });
    },
  });

  const ignoreMutation = useMutation({
    mutationFn: (rec: Recommendation) => ignoreRecommendation(rec),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: AI_ROP_KEYS.auditLatest });
      toast({ title: "Рекомендация скрыта" });
    },
  });

  const handleRunAudit = useCallback(() => {
    auditMutation.mutate();
  }, [auditMutation]);

  const handleApply = useCallback((rec: Recommendation) => {
    applyMutation.mutate(rec);
  }, [applyMutation]);

  const handleIgnore = useCallback((rec: Recommendation) => {
    ignoreMutation.mutate(rec);
  }, [ignoreMutation]);

  const analytics = analyticsQuery.data ?? null;
  const hasEnoughData = analytics && analytics.totalDialogs >= 5;
  const isLoadingAnalytics = analyticsQuery.isLoading;

  return (
    <AiRopShell>
      <AiRopHeader
        readiness={readinessQuery.data ?? null}
        analytics={analytics}
        period={period}
        onPeriodChange={setPeriod}
        onRunAudit={handleRunAudit}
        onOpenTraining={() => setTrainingOpen(true)}
        onOpenVersions={() => setVersionsOpen(true)}
        isAuditing={auditMutation.isPending}
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mt-4" data-testid="dashboard-grid">
        <div className="space-y-4">
          {hasEnoughData ? (
            <>
              <KpiCards analytics={analytics} isLoading={isLoadingAnalytics} />
              <FunnelCard funnel={funnelQuery.data ?? null} isLoading={funnelQuery.isLoading} />
              <DropoffReasonsCard dropoffs={dropoffsQuery.data ?? null} isLoading={dropoffsQuery.isLoading} />
            </>
          ) : (
            <Card data-testid="placeholder-left">
              <CardContent className="py-8">
                {isLoadingAnalytics ? (
                  <div className="space-y-3">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <Skeleton className="h-4 w-2/3" />
                  </div>
                ) : (
                  <div className="text-center space-y-2">
                    <p className="text-sm text-muted-foreground">
                      После первых 5 диалогов появится аналитика.
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Попробуйте тестовый чат справа
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <AiDiagnosisCard
            latestAudit={latestAudit}
            analytics={analytics}
            isLoading={isLoadingAnalytics || auditQuery.isLoading}
          />
          {hasEnoughData && latestAudit && (
            <RecommendationCards
              recommendations={latestAudit.recommendationsJson ?? []}
              onApply={handleApply}
              onIgnore={handleIgnore}
              isApplying={applyMutation.isPending}
            />
          )}
          {!hasEnoughData && !isLoadingAnalytics && (
            <Card data-testid="placeholder-center">
              <CardContent className="py-8">
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">
                    Рекомендации появятся после первого аудита.
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <TestChatPanel />
        </div>
      </div>

      <div className="mt-6" data-testid="strategy-section">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setShowStrategy(!showStrategy)}
          className="w-full flex items-center justify-center gap-2"
          data-testid="button-toggle-strategy"
        >
          <Settings2 className="h-4 w-4" />
          {showStrategy ? "Скрыть настройки стратегии" : "Показать настройки стратегии"}
          {showStrategy ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </Button>
        {showStrategy && (
          <div className="mt-4">
            <StrategyPanel
              settings={settingsQuery.data ?? null}
              onSettingsSaved={() => {
                queryClient.invalidateQueries({ queryKey: AI_ROP_KEYS.settings });
              }}
            />
          </div>
        )}
      </div>

      <TrainingHistoryDrawer open={trainingOpen} onClose={() => setTrainingOpen(false)} />
      <VersionHistoryDrawer open={versionsOpen} onClose={() => setVersionsOpen(false)} />
    </AiRopShell>
  );
}
