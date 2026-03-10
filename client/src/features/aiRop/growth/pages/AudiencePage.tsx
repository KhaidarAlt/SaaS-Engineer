import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { queryClient } from "@/lib/queryClient";
import {
  GROWTH_KEYS, fetchAudience, fetchLatestSync, fetchSegments,
  triggerSync, createSegment, deleteSegment, fetchProviderInfo,
} from "../api/growthApi";
import { GrowthSubNav } from "../components/GrowthSubNav";
import type { GrowthContact, GrowthSyncRun, GrowthSegment, ProviderInfo, AudienceResult } from "../types/growthTypes";
import {
  RefreshCw, Users, Filter, Plus, Trash2, Clock, CheckCircle2,
  AlertCircle, Loader2, Phone, MessageSquare, ArrowDownUp, Save,
  ShoppingCart, TrendingUp, XCircle, HelpCircle, User,
} from "lucide-react";

type FilterPreset = "all" | "successful" | "in_progress" | "failed" | "abandoned" | "inactive" | "active";

const FILTER_LABELS: Record<FilterPreset, string> = {
  all: "Все контакты",
  successful: "Успешные сделки",
  in_progress: "В процессе",
  failed: "Неудачные",
  abandoned: "Брошенные",
  inactive: "Неактивные (30+ дн)",
  active: "Активные (7 дн)",
};

export function AudiencePage() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<FilterPreset>("all");
  const [showSaveSegment, setShowSaveSegment] = useState(false);
  const [segmentName, setSegmentName] = useState("");

  const filterParams = (): Record<string, string> => {
    switch (filter) {
      case "successful": return { dealStatus: "successful" };
      case "in_progress": return { dealStatus: "in_progress" };
      case "failed": return { dealStatus: "failed" };
      case "abandoned": return { abandoned: "true" };
      case "inactive": return { inactiveDays: "30" };
      case "active": return { active: "true" };
      default: return {};
    }
  };

  const { data: providerInfo } = useQuery<ProviderInfo>({
    queryKey: GROWTH_KEYS.providerInfo,
    queryFn: () => fetchProviderInfo(),
  });

  const { data: latestSync, isLoading: syncLoading } = useQuery<GrowthSyncRun | null>({
    queryKey: GROWTH_KEYS.syncLatest,
    queryFn: fetchLatestSync,
    refetchInterval: 5000,
  });

  const { data: audienceData, isLoading: audienceLoading } = useQuery<AudienceResult>({
    queryKey: [...GROWTH_KEYS.audience, filter],
    queryFn: () => fetchAudience(filterParams()),
  });

  const prevSyncStatus = useRef<string | null>(null);
  useEffect(() => {
    if (latestSync?.status === "SUCCESS" && prevSyncStatus.current && prevSyncStatus.current !== "SUCCESS") {
      queryClient.invalidateQueries({ queryKey: GROWTH_KEYS.audience });
    }
    prevSyncStatus.current = latestSync?.status ?? null;
  }, [latestSync?.status]);

  const { data: segments } = useQuery<GrowthSegment[]>({
    queryKey: GROWTH_KEYS.segments,
    queryFn: fetchSegments,
  });

  const syncMutation = useMutation({
    mutationFn: triggerSync,
    onSuccess: () => {
      toast({ title: "Синхронизация запущена" });
      queryClient.invalidateQueries({ queryKey: GROWTH_KEYS.syncLatest });
      queryClient.invalidateQueries({ queryKey: GROWTH_KEYS.syncRuns });
      queryClient.invalidateQueries({ queryKey: GROWTH_KEYS.audience });
    },
    onError: (err: any) => {
      const msg = err?.message?.includes("409") ? "Синхронизация уже запущена" : "Ошибка запуска";
      toast({ title: msg, variant: "destructive" });
    },
  });

  const saveSegmentMutation = useMutation({
    mutationFn: () => createSegment(segmentName, filterParams()),
    onSuccess: () => {
      toast({ title: "Сегмент сохранён" });
      setShowSaveSegment(false);
      setSegmentName("");
      queryClient.invalidateQueries({ queryKey: GROWTH_KEYS.segments });
    },
    onError: () => toast({ title: "Ошибка сохранения", variant: "destructive" }),
  });

  const deleteSegmentMutation = useMutation({
    mutationFn: deleteSegment,
    onSuccess: () => {
      toast({ title: "Сегмент удалён" });
      queryClient.invalidateQueries({ queryKey: GROWTH_KEYS.segments });
    },
  });

  const isSyncing = latestSync?.status === "PENDING" || latestSync?.status === "RUNNING";
  const contacts = audienceData?.contacts ?? [];
  const total = audienceData?.total ?? 0;

  return (
    <div className="space-y-6" data-testid="audience-page">
      <GrowthSubNav />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h2 className="text-base font-semibold" data-testid="text-audience-title">Аудитория</h2>
          <p className="text-xs text-muted-foreground">
            {total} контактов {filter !== "all" && `(фильтр: ${FILTER_LABELS[filter]})`}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            onClick={() => syncMutation.mutate()}
            disabled={isSyncing || syncMutation.isPending}
            data-testid="button-sync-audience"
          >
            {isSyncing ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-1" />}
            {providerInfo?.syncLabel ?? "Синхронизировать"}
          </Button>
        </div>
      </div>

      {latestSync && (
        <SyncStatusBanner sync={latestSync} />
      )}

      <div className="flex items-center gap-2 flex-wrap">
        <Select value={filter} onValueChange={(v) => setFilter(v as FilterPreset)}>
          <SelectTrigger className="w-[220px]" data-testid="select-audience-filter">
            <Filter className="h-3.5 w-3.5 mr-1.5 text-muted-foreground" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.entries(FILTER_LABELS) as [FilterPreset, string][]).map(([key, label]) => (
              <SelectItem key={key} value={key} data-testid={`filter-option-${key}`}>{label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        {filter !== "all" && (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowSaveSegment(true)}
            data-testid="button-save-segment"
          >
            <Save className="h-3.5 w-3.5 mr-1" />
            Сохранить сегмент
          </Button>
        )}
      </div>

      {(segments?.length ?? 0) > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-medium text-muted-foreground">Сохранённые сегменты</h3>
          <div className="flex items-center gap-2 flex-wrap">
            {segments!.map((seg) => (
              <Badge
                key={seg.id}
                variant="secondary"
                className="gap-1.5"
                data-testid={`segment-badge-${seg.id}`}
              >
                {seg.name}
                <span className="text-[10px] text-muted-foreground">~{seg.estimatedSize}</span>
                <button
                  onClick={() => deleteSegmentMutation.mutate(seg.id)}
                  className="ml-0.5 opacity-60 hover:opacity-100"
                  data-testid={`button-delete-segment-${seg.id}`}
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </Badge>
            ))}
          </div>
        </div>
      )}

      {audienceLoading ? (
        <div className="space-y-2" data-testid="audience-loading">
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-16" />)}
        </div>
      ) : contacts.length === 0 ? (
        <Card data-testid="audience-empty">
          <CardContent className="p-8 text-center space-y-3">
            <div className="mx-auto w-12 h-12 rounded-full bg-muted flex items-center justify-center">
              <Users className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="font-semibold">Нет контактов</h3>
            <p className="text-sm text-muted-foreground max-w-md mx-auto">
              Нажмите «Синхронизировать» чтобы загрузить контакты из WhatsApp и проанализировать переписки.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-1" data-testid="audience-list">
          {contacts.map((c) => (
            <ContactRow key={c.id} contact={c} />
          ))}
        </div>
      )}

      <Dialog open={showSaveSegment} onOpenChange={setShowSaveSegment}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Сохранить сегмент</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              Фильтр: {FILTER_LABELS[filter]} ({total} контактов)
            </p>
            <Input
              placeholder="Название сегмента"
              value={segmentName}
              onChange={(e) => setSegmentName(e.target.value)}
              data-testid="input-segment-name"
            />
          </div>
          <DialogFooter>
            <Button
              onClick={() => saveSegmentMutation.mutate()}
              disabled={!segmentName.trim() || saveSegmentMutation.isPending}
              data-testid="button-confirm-save-segment"
            >
              {saveSegmentMutation.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
              Сохранить
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function SyncStatusBanner({ sync }: { sync: GrowthSyncRun }) {
  const stats = sync.statsJson as Record<string, any> | null;
  const iconMap = {
    PENDING: <Loader2 className="h-4 w-4 animate-spin text-blue-500" />,
    RUNNING: <Loader2 className="h-4 w-4 animate-spin text-blue-500" />,
    SUCCESS: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    FAILED: <AlertCircle className="h-4 w-4 text-red-500" />,
  };

  const getSuccessLabel = () => {
    const parts: string[] = [];
    parts.push(`${stats?.contactsUpserted || sync.contactsCreated || 0} контактов`);
    if (stats?.analyzed) parts.push(`${stats.analyzed} проанализировано`);
    if (stats?.cleaned) parts.push(`${stats.cleaned} удалено`);
    return parts.join(", ");
  };

  const labelMap = {
    PENDING: "Ожидание синхронизации...",
    RUNNING: "Синхронизация и анализ...",
    SUCCESS: getSuccessLabel(),
    FAILED: `Ошибка: ${sync.error ?? "неизвестно"}`,
  };

  return (
    <Card data-testid="sync-status-banner">
      <CardContent className="px-4 py-3 flex items-center gap-3">
        {iconMap[sync.status]}
        <span className="text-sm">{labelMap[sync.status]}</span>
        {sync.finishedAt && (
          <span className="ml-auto text-xs text-muted-foreground">
            <Clock className="h-3 w-3 inline mr-0.5" />
            {new Date(sync.finishedAt).toLocaleString("ru")}
          </span>
        )}
      </CardContent>
    </Card>
  );
}

const DEAL_STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CheckCircle2 }> = {
  successful: { label: "Успешная сделка", color: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400", icon: CheckCircle2 },
  in_progress: { label: "В процессе", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400", icon: TrendingUp },
  failed: { label: "Не закрыта", color: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400", icon: XCircle },
  abandoned: { label: "Брошено", color: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400", icon: ShoppingCart },
  no_deal: { label: "Без сделки", color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400", icon: HelpCircle },
  personal: { label: "Личное", color: "bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500", icon: User },
};

function ContactRow({ contact }: { contact: GrowthContact }) {
  const meta = (contact.meta || {}) as Record<string, any>;
  const analysis = meta.analysis as Record<string, any> | undefined;
  const dealStatus = analysis?.dealStatus as string | undefined;
  const dealSummary = analysis?.dealSummary as string | undefined;
  const dealConfig = dealStatus ? DEAL_STATUS_CONFIG[dealStatus] : null;
  const DealIcon = dealConfig?.icon;

  return (
    <Card className="hover-elevate" data-testid={`contact-row-${contact.id}`}>
      <CardContent className="px-4 py-3 flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[140px]">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate" data-testid={`text-contact-name-${contact.id}`}>
              {contact.name || contact.phone || "Без имени"}
            </p>
          </div>
          {contact.phone && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {contact.phone}
            </p>
          )}
          {dealSummary && (
            <p className="text-xs text-muted-foreground mt-0.5 truncate max-w-[300px]" title={dealSummary} data-testid={`text-summary-${contact.id}`}>
              {dealSummary}
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground flex-wrap">
          {dealConfig && DealIcon && (
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${dealConfig.color}`} data-testid={`badge-deal-${contact.id}`}>
              <DealIcon className="h-3 w-3" />
              {dealConfig.label}
            </span>
          )}
          {!dealConfig && analysis === undefined && (
            <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground">
              Не анализирован
            </span>
          )}
          <span className="flex items-center gap-0.5" title="Входящие / Исходящие">
            <ArrowDownUp className="h-3 w-3" />
            {contact.inboundCount ?? 0}/{contact.outboundCount ?? 0}
          </span>
          {contact.lastInboundAt && (
            <span className="flex items-center gap-0.5" title="Последнее сообщение">
              <MessageSquare className="h-3 w-3" />
              {new Date(contact.lastInboundAt).toLocaleDateString("ru")}
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
