import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GROWTH_KEYS, fetchSummary } from "../api/growthApi";
import { GrowthSubNav } from "../components/GrowthSubNav";
import { CampaignList } from "../components/CampaignList";
import { NewCampaignModal } from "../components/NewCampaignModal";
import {
  CAMPAIGN_TYPE_LABELS, CAMPAIGN_STATUS_LABELS,
  type GrowthSummary,
} from "../types/growthTypes";
import {
  TrendingUp, Users, Send, MessageCircle, Sparkles, ArrowRight, Zap,
} from "lucide-react";

export function GrowthOverviewPage() {
  const [, navigate] = useLocation();
  const [showNewModal, setShowNewModal] = useState(false);

  const { data: summary, isLoading } = useQuery<GrowthSummary>({
    queryKey: GROWTH_KEYS.summary,
    queryFn: fetchSummary,
  });

  if (isLoading) {
    return (
      <div className="space-y-4" data-testid="growth-overview-loading">
        <GrowthSubNav />
        <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
        </div>
        <Skeleton className="h-48" />
      </div>
    );
  }

  const kpis = [
    { label: "Контакты", value: summary?.totalContacts ?? 0, icon: Users },
    { label: "Отправлено", value: summary?.totalSent ?? 0, icon: Send },
    { label: "Ответили", value: summary?.totalReplied ?? 0, icon: MessageCircle },
    { label: "Отклик", value: `${summary?.replyRate ?? 0}%`, icon: TrendingUp },
  ];

  const candidates = summary?.reactivationCandidates ?? 0;

  return (
    <div className="space-y-6" data-testid="growth-overview-page">
      <GrowthSubNav />

      <div className="grid gap-3 grid-cols-2 md:grid-cols-4" data-testid="growth-kpi-row">
        {kpis.map((k) => (
          <Card key={k.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="rounded-md bg-primary/10 p-2">
                <k.icon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{k.label}</p>
                <p className="text-lg font-semibold">{k.value}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {candidates > 0 && (
        <Card className="border-primary/20 bg-primary/5" data-testid="hidden-money-hero">
          <CardContent className="p-5 flex items-center gap-4 flex-wrap">
            <div className="rounded-full bg-primary/10 p-3">
              <Sparkles className="h-6 w-6 text-primary" />
            </div>
            <div className="flex-1 min-w-[200px]">
              <h3 className="font-semibold">Скрытые возможности</h3>
              <p className="text-sm text-muted-foreground">
                Мы нашли <span className="font-medium text-foreground">{candidates}</span> клиентов, которых можно вернуть в диалог
              </p>
            </div>
            <Button
              onClick={() => navigate("/dashboard/ai/rop/growth/reactivation")}
              data-testid="button-hidden-money-action"
            >
              <Zap className="h-4 w-4 mr-1" />
              Реактивировать
            </Button>
          </CardContent>
        </Card>
      )}

      {candidates === 0 && (summary?.totalContacts ?? 0) === 0 && (
        <Card data-testid="growth-empty-state">
          <CardContent className="p-8 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <TrendingUp className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-semibold">Нет контактов</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Контакты появляются автоматически при входящих диалогах, или вы можете запустить кампанию вручную.
            </p>
            <Button onClick={() => setShowNewModal(true)} data-testid="button-create-first-campaign">
              Создать кампанию
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-base font-semibold">Кампании</h2>
        <Button size="sm" onClick={() => setShowNewModal(true)} data-testid="button-new-campaign">
          Запустить кампанию
        </Button>
      </div>

      <CampaignList campaigns={summary?.recentCampaigns ?? []} />

      {(summary?.recentEvents?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium text-muted-foreground">Последние события</h3>
          <div className="space-y-1">
            {summary!.recentEvents.slice(0, 8).map((e) => (
              <div key={e.id} className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                <Badge variant="secondary" className="text-[10px]">{e.eventType}</Badge>
                <span className="truncate">{e.contactId?.slice(0, 8) ?? "—"}</span>
                <span className="ml-auto">{new Date(e.createdAt).toLocaleTimeString("ru")}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <NewCampaignModal open={showNewModal} onOpenChange={setShowNewModal} />
    </div>
  );
}
