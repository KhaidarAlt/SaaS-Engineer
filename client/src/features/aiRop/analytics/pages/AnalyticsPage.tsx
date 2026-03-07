import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { MessageSquare, Zap } from "lucide-react";
import { SectionHeader } from "../../components/SectionHeader";
import { PeriodSelector } from "../components/PeriodSelector";
import { SourceFilterSelect } from "../components/SourceFilterSelect";
import { KpiCards } from "../components/KpiCards";
import { FunnelChart } from "../components/FunnelChart";
import { BottleneckCard } from "../components/BottleneckCard";
import { ObjectionsTable } from "../components/ObjectionsTable";
import { HandoverPanel } from "../components/HandoverPanel";
import { TriggerEffectiveness } from "../components/TriggerEffectiveness";
import { DialogsTable } from "../components/DialogsTable";
import { DialogDetailModal } from "../components/DialogDetailModal";
import { AuditPanel } from "../components/AuditPanel";
import { fetchSummary, fetchDialogs, ANALYTICS_KEYS } from "../api/analyticsApi";
import type { PeriodKey, SourceFilter as SourceFilterType } from "../types/analyticsTypes";

export default function AnalyticsPage() {
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [source, setSource] = useState<SourceFilterType>("ALL");
  const [dialogOffset, setDialogOffset] = useState(0);
  const [selectedDialogId, setSelectedDialogId] = useState<string | null>(null);
  const [dialogModalOpen, setDialogModalOpen] = useState(false);
  const [, navigate] = useLocation();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const dialogParam = params.get("dialog");
    if (dialogParam) {
      setSelectedDialogId(dialogParam);
      setDialogModalOpen(true);
      const url = new URL(window.location.href);
      url.searchParams.delete("dialog");
      window.history.replaceState({}, "", url.pathname + url.search);
    }
  }, []);

  function handlePeriodChange(p: PeriodKey) {
    setPeriod(p);
    setDialogOffset(0);
    setSelectedDialogId(null);
    setDialogModalOpen(false);
  }

  function handleSourceChange(s: SourceFilterType) {
    setSource(s);
    setDialogOffset(0);
    setSelectedDialogId(null);
    setDialogModalOpen(false);
  }

  const { data: summary, isLoading: summaryLoading } = useQuery({
    queryKey: ANALYTICS_KEYS.summary(period, source),
    queryFn: () => fetchSummary(period, source),
  });

  const { data: dialogsData, isLoading: dialogsLoading } = useQuery({
    queryKey: ANALYTICS_KEYS.dialogs(period, source, `offset=${dialogOffset}`),
    queryFn: () => fetchDialogs(period, source, { limit: 20, offset: dialogOffset }),
  });

  function handleViewDialog(id: string) {
    setSelectedDialogId(id);
    setDialogModalOpen(true);
  }

  const hasData = summary && summary.kpis.totalDialogs >= 5;

  return (
    <div data-testid="page-analytics" className="space-y-4">
      <SectionHeader
        title="Аналитика"
        subtitle="Показатели эффективности AI-продавца"
      />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <PeriodSelector value={period} onChange={handlePeriodChange} />
        <SourceFilterSelect value={source} onChange={handleSourceChange} />
      </div>

      {summaryLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24 rounded-lg" />)}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Skeleton className="h-72 rounded-lg" />
            <Skeleton className="h-72 rounded-lg" />
          </div>
        </div>
      ) : summary ? (
        <div className="space-y-4">
          <KpiCards data={summary.kpis} />

          {!hasData && (
            <div className="rounded-md border p-6 text-center space-y-3" data-testid="empty-state-guidance">
              <p className="text-sm text-muted-foreground">
                Недостаточно данных для полного анализа. Запустите тестирование или стресс-тест для получения аналитики.
              </p>
              <div className="flex items-center justify-center gap-2 flex-wrap">
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => navigate("/dashboard/ai/rop/testing")}
                  data-testid="button-go-testing"
                >
                  <MessageSquare className="h-4 w-4 mr-1" />
                  Перейти в Тестирование
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => navigate("/dashboard/ai/rop/testing")}
                  data-testid="button-go-stress-test"
                >
                  <Zap className="h-4 w-4 mr-1" />
                  Запустить стресс-тест
                </Button>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <FunnelChart stages={summary.funnel.stages} />
            <BottleneckCard bottlenecks={summary.bottlenecks} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <ObjectionsTable data={summary.objections} />
            <HandoverPanel data={summary.handover} />
          </div>

          <TriggerEffectiveness
            triggers={summary.triggers}
            training={summary.trainingImpact}
          />

          <DialogsTable
            dialogs={dialogsData?.dialogs || []}
            total={dialogsData?.total || 0}
            isLoading={dialogsLoading}
            onLoadMore={() => setDialogOffset((prev) => prev + 20)}
            onViewDetail={handleViewDialog}
          />

          <AuditPanel
            period={period}
            source={source}
            lastAudit={summary.lastAudit}
          />
        </div>
      ) : null}

      <DialogDetailModal
        dialogId={selectedDialogId}
        open={dialogModalOpen}
        onOpenChange={setDialogModalOpen}
      />
    </div>
  );
}
