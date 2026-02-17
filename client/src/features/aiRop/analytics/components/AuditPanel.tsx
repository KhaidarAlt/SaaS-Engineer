import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, ExternalLink, CheckCircle, AlertTriangle, Info } from "lucide-react";
import { useLocation } from "wouter";
import { useToast } from "@/hooks/use-toast";
import { startAudit, fetchAuditRun, ANALYTICS_KEYS } from "../api/analyticsApi";
import { SEVERITY_LABELS } from "../types/analyticsTypes";
import type { AuditFinding, PeriodKey, SourceFilter } from "../types/analyticsTypes";

interface AuditPanelProps {
  period: PeriodKey;
  source: SourceFilter;
  lastAudit: { runId: string; finishedAt: string; dialogsAnalyzed: number; mainFinding: string | null } | null;
}

function SeverityIcon({ severity }: { severity: string }) {
  switch (severity) {
    case "HIGH": return <AlertTriangle className="h-4 w-4 text-red-500 shrink-0" />;
    case "MEDIUM": return <Info className="h-4 w-4 text-orange-500 shrink-0" />;
    default: return <CheckCircle className="h-4 w-4 text-blue-500 shrink-0" />;
  }
}

function FindingCard({ finding }: { finding: AuditFinding }) {
  const [, navigate] = useLocation();

  return (
    <div className="rounded-md border p-3 space-y-2" data-testid={`finding-${finding.id}`}>
      <div className="flex items-start gap-2">
        <SeverityIcon severity={finding.severity} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-sm font-medium">{finding.title}</span>
            <Badge variant={finding.severity === "HIGH" ? "destructive" : "outline"} className="text-xs shrink-0">
              {SEVERITY_LABELS[finding.severity] || finding.severity}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground mt-1">{finding.details}</p>
        </div>
      </div>
      {finding.evidence && finding.evidence.count !== undefined && (
        <p className="text-xs text-muted-foreground ml-6">Затронуто диалогов: {finding.evidence.count}</p>
      )}
      {finding.suggestedFix?.deepLink && (
        <Button
          size="sm"
          variant="outline"
          className="ml-6"
          onClick={() => navigate(finding.suggestedFix!.deepLink!.replace("/app/ai-rop", "/dashboard/ai/rop"))}
          data-testid={`button-fix-${finding.id}`}
        >
          <ExternalLink className="h-3 w-3 mr-1" />
          Исправить
        </Button>
      )}
    </div>
  );
}

export function AuditPanel({ period, source, lastAudit }: AuditPanelProps) {
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const { toast } = useToast();

  const auditMut = useMutation({
    mutationFn: () => startAudit(period, source),
    onSuccess: (result) => {
      setActiveRunId(result.runId);
      toast({ title: "Аудит запущен", description: "Анализ диалогов..." });
    },
    onError: () => {
      toast({ title: "Ошибка", description: "Не удалось запустить аудит", variant: "destructive" });
    },
  });

  const { data: runData } = useQuery({
    queryKey: ANALYTICS_KEYS.auditRun(activeRunId || lastAudit?.runId || ""),
    queryFn: () => fetchAuditRun(activeRunId || lastAudit?.runId || ""),
    enabled: !!(activeRunId || lastAudit?.runId),
    refetchInterval: activeRunId ? 2000 : false,
  });

  const isRunning = runData?.status === "RUNNING";
  const findings = runData?.findings || [];

  useEffect(() => {
    if (activeRunId && runData?.status === "DONE") {
      setActiveRunId(null);
    }
  }, [activeRunId, runData?.status]);

  return (
    <Card className="p-4" data-testid="card-audit">
      <div className="flex items-center justify-between gap-2 mb-3 flex-wrap">
        <div>
          <h3 className="text-sm font-semibold">AI Аудит</h3>
          {lastAudit && !activeRunId && (
            <p className="text-xs text-muted-foreground">
              Последний: {new Date(lastAudit.finishedAt).toLocaleDateString("ru-RU")} ({lastAudit.dialogsAnalyzed} диалогов)
            </p>
          )}
        </div>
        <Button
          size="sm"
          onClick={() => auditMut.mutate()}
          disabled={auditMut.isPending || isRunning}
          data-testid="button-run-audit"
        >
          {isRunning ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Search className="h-4 w-4 mr-1" />}
          {isRunning ? "Анализирую..." : "Запустить аудит"}
        </Button>
      </div>
      {isRunning && (
        <div className="flex items-center gap-2 py-4 justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Анализируем диалоги...</span>
        </div>
      )}
      {!isRunning && findings.length > 0 && (
        <div className="space-y-2">
          {findings.map((f: AuditFinding) => (
            <FindingCard key={f.id} finding={f} />
          ))}
        </div>
      )}
      {!isRunning && findings.length === 0 && !lastAudit && (
        <p className="text-sm text-muted-foreground py-4 text-center">
          Запустите аудит для получения рекомендаций
        </p>
      )}
    </Card>
  );
}
