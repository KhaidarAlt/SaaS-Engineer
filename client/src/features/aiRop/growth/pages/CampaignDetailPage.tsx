import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  fetchCampaign, fetchQueue, fetchCampaignAnalytics,
  launchCampaign, pauseCampaign, resumeCampaign,
  GROWTH_KEYS,
} from "../api/growthApi";
import { CampaignBuilder } from "../components/CampaignBuilder";
import {
  CAMPAIGN_TYPE_LABELS, CAMPAIGN_STATUS_LABELS,
  type GrowthCampaign, type QueueItem, type CampaignAnalytics as CampaignAnalyticsType,
} from "../types/growthTypes";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft, Play, Pause, RotateCcw, Send, CheckCircle, XCircle,
  Clock, BarChart3, List, Settings2, Loader2,
} from "lucide-react";

interface Props {
  campaignId: string;
}

function statusVariant(status: string): "default" | "secondary" | "destructive" | "outline" {
  switch (status) {
    case "RUNNING": return "default";
    case "COMPLETED": return "secondary";
    case "FAILED": return "destructive";
    default: return "outline";
  }
}

function queueStatusIcon(status: string) {
  switch (status) {
    case "SENT": return <CheckCircle className="h-3.5 w-3.5 text-green-600 dark:text-green-400" />;
    case "FAILED": return <XCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />;
    case "PENDING": return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
    case "SKIPPED": return <RotateCcw className="h-3.5 w-3.5 text-yellow-600 dark:text-yellow-400" />;
    default: return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

export function CampaignDetailPage({ campaignId }: Props) {
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: campaign, isLoading } = useQuery<GrowthCampaign>({
    queryKey: GROWTH_KEYS.campaign(campaignId),
    queryFn: () => fetchCampaign(campaignId),
  });

  const { data: queueData } = useQuery<{ items: QueueItem[]; total: number }>({
    queryKey: GROWTH_KEYS.queue(campaignId),
    queryFn: () => fetchQueue(campaignId),
    enabled: !!campaign && campaign.status !== "DRAFT",
  });

  const { data: analytics } = useQuery<CampaignAnalyticsType>({
    queryKey: GROWTH_KEYS.analytics(campaignId),
    queryFn: () => fetchCampaignAnalytics(campaignId),
    enabled: !!campaign && campaign.status !== "DRAFT",
  });

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: GROWTH_KEYS.campaign(campaignId) });
    queryClient.invalidateQueries({ queryKey: GROWTH_KEYS.queue(campaignId) });
    queryClient.invalidateQueries({ queryKey: GROWTH_KEYS.analytics(campaignId) });
    queryClient.invalidateQueries({ queryKey: GROWTH_KEYS.summary });
    queryClient.invalidateQueries({ queryKey: GROWTH_KEYS.campaigns });
  };

  const launchMut = useMutation({
    mutationFn: () => launchCampaign(campaignId),
    onSuccess: (data) => {
      invalidate();
      toast({ title: `Запущена! В очереди: ${data.queued}, пропущено: ${data.skipped}` });
    },
    onError: () => toast({ title: "Ошибка запуска", variant: "destructive" }),
  });

  const pauseMut = useMutation({
    mutationFn: () => pauseCampaign(campaignId),
    onSuccess: () => { invalidate(); toast({ title: "Кампания на паузе" }); },
  });

  const resumeMut = useMutation({
    mutationFn: () => resumeCampaign(campaignId),
    onSuccess: () => { invalidate(); toast({ title: "Кампания возобновлена" }); },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!campaign) {
    return <p className="text-muted-foreground text-center py-12">Кампания не найдена</p>;
  }

  const isDraft = campaign.status === "DRAFT";

  return (
    <div className="space-y-6" data-testid="campaign-detail-page">
      <div className="flex items-center gap-3 flex-wrap">
        <Button
          variant="ghost" size="icon"
          onClick={() => navigate("/dashboard/ai/rop/growth")}
          data-testid="button-back-growth"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-[120px]">
          <h2 className="text-lg font-semibold">{campaign.name}</h2>
          <p className="text-xs text-muted-foreground">
            {CAMPAIGN_TYPE_LABELS[campaign.type as keyof typeof CAMPAIGN_TYPE_LABELS] || campaign.type}
          </p>
        </div>
        <Badge variant={statusVariant(campaign.status)}>
          {CAMPAIGN_STATUS_LABELS[campaign.status as keyof typeof CAMPAIGN_STATUS_LABELS] || campaign.status}
        </Badge>

        {isDraft && (
          <Button
            onClick={() => launchMut.mutate()}
            disabled={launchMut.isPending}
            data-testid="button-launch-campaign"
          >
            {launchMut.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Play className="h-4 w-4 mr-1" />}
            Запустить
          </Button>
        )}
        {campaign.status === "RUNNING" && (
          <Button variant="outline" onClick={() => pauseMut.mutate()} disabled={pauseMut.isPending} data-testid="button-pause-campaign">
            <Pause className="h-4 w-4 mr-1" />
            Пауза
          </Button>
        )}
        {campaign.status === "PAUSED" && (
          <Button onClick={() => resumeMut.mutate()} disabled={resumeMut.isPending} data-testid="button-resume-campaign">
            <Play className="h-4 w-4 mr-1" />
            Возобновить
          </Button>
        )}
      </div>

      {isDraft ? (
        <CampaignBuilder campaign={campaign} onUpdate={invalidate} />
      ) : (
        <Tabs defaultValue="queue">
          <TabsList>
            <TabsTrigger value="queue" data-testid="tab-queue"><List className="h-3.5 w-3.5 mr-1" />Очередь</TabsTrigger>
            <TabsTrigger value="analytics" data-testid="tab-analytics"><BarChart3 className="h-3.5 w-3.5 mr-1" />Аналитика</TabsTrigger>
            <TabsTrigger value="settings" data-testid="tab-settings"><Settings2 className="h-3.5 w-3.5 mr-1" />Настройки</TabsTrigger>
          </TabsList>

          <TabsContent value="queue" className="mt-4">
            <div className="grid gap-3 grid-cols-2 md:grid-cols-5 mb-4">
              {[
                { label: "В очереди", value: campaign.totalQueued },
                { label: "Отправлено", value: campaign.totalSent },
                { label: "Ответили", value: campaign.totalReplied },
                { label: "Ошибки", value: campaign.totalFailed },
                { label: "Пропущено", value: campaign.totalSkipped },
              ].map((k) => (
                <Card key={k.label}>
                  <CardContent className="p-3 text-center">
                    <p className="text-xs text-muted-foreground">{k.label}</p>
                    <p className="text-lg font-semibold">{k.value}</p>
                  </CardContent>
                </Card>
              ))}
            </div>

            {(queueData?.items?.length ?? 0) > 0 ? (
              <div className="rounded-md border overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Контакт</TableHead>
                      <TableHead>Канал</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Время</TableHead>
                      <TableHead>Ошибка</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {queueData!.items.map((item) => (
                      <TableRow key={item.id}>
                        <TableCell className="text-sm">{item.contactName || item.contactPhone || item.contactId.slice(0, 8)}</TableCell>
                        <TableCell><Badge variant="outline" className="text-[10px]">{item.resolvedChannel || "—"}</Badge></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1">
                            {queueStatusIcon(item.status)}
                            <span className="text-xs">{item.status}</span>
                          </div>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {item.sentAt ? new Date(item.sentAt).toLocaleString("ru") : "—"}
                        </TableCell>
                        <TableCell className="text-xs text-red-600 dark:text-red-400 max-w-[200px] truncate">{item.error || ""}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">Очередь пуста</p>
            )}
          </TabsContent>

          <TabsContent value="analytics" className="mt-4">
            {analytics ? (
              <div className="space-y-4">
                <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                  {Object.entries(analytics.eventCounts).map(([type, cnt]) => (
                    <Card key={type}>
                      <CardContent className="p-3 text-center">
                        <p className="text-xs text-muted-foreground">{type}</p>
                        <p className="text-lg font-semibold">{cnt}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>

                {analytics.recentEvents.length > 0 && (
                  <div className="space-y-1">
                    <h4 className="text-xs font-medium text-muted-foreground">Последние события</h4>
                    {analytics.recentEvents.map((e) => (
                      <div key={e.id} className="flex items-center gap-2 text-xs text-muted-foreground py-0.5">
                        <Badge variant="secondary" className="text-[10px]">{e.eventType}</Badge>
                        <span>{e.contactId?.slice(0, 8) || "—"}</span>
                        <span className="ml-auto">{new Date(e.createdAt).toLocaleString("ru")}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-6">Нет данных аналитики</p>
            )}
          </TabsContent>

          <TabsContent value="settings" className="mt-4">
            <CampaignBuilder campaign={campaign} onUpdate={invalidate} readOnly />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
