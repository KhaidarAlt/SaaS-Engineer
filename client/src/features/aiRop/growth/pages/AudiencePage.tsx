import { useState } from "react";
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
} from "lucide-react";

type FilterPreset = "all" | "inactive" | "abandoned" | "active" | "hasInbound";

const FILTER_LABELS: Record<FilterPreset, string> = {
  all: "Все контакты",
  inactive: "Неактивные (30+ дн)",
  abandoned: "Брошенные диалоги",
  active: "Активные (7 дн)",
  hasInbound: "С входящими",
};

export function AudiencePage() {
  const { toast } = useToast();
  const [filter, setFilter] = useState<FilterPreset>("all");
  const [showSaveSegment, setShowSaveSegment] = useState(false);
  const [segmentName, setSegmentName] = useState("");

  const filterParams = (): Record<string, string> => {
    switch (filter) {
      case "inactive": return { inactiveDays: "30" };
      case "abandoned": return { abandoned: "true" };
      case "active": return { active: "true" };
      case "hasInbound": return { hasInbound: "true" };
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
          <SelectTrigger className="w-[200px]" data-testid="select-audience-filter">
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
              Нажмите «Синхронизировать» чтобы загрузить контакты из WhatsApp, или они появятся автоматически при входящих диалогах.
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
  const iconMap = {
    PENDING: <Loader2 className="h-4 w-4 animate-spin text-blue-500" />,
    RUNNING: <Loader2 className="h-4 w-4 animate-spin text-blue-500" />,
    SUCCESS: <CheckCircle2 className="h-4 w-4 text-green-500" />,
    FAILED: <AlertCircle className="h-4 w-4 text-red-500" />,
  };
  const labelMap = {
    PENDING: "Ожидание синхронизации...",
    RUNNING: "Синхронизация...",
    SUCCESS: `Синхронизировано: ${sync.contactsFound} найдено, ${sync.contactsCreated} новых, ${sync.contactsUpdated} обновлено`,
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

function ContactRow({ contact }: { contact: GrowthContact }) {
  const sourceLabels: Record<string, string> = {
    waha_sync: "WAHA",
    meta_warm: "Meta",
    csv_import: "CSV",
    crm_import: "CRM",
    organic: "Органик",
  };

  return (
    <Card className="hover-elevate" data-testid={`contact-row-${contact.id}`}>
      <CardContent className="px-4 py-3 flex items-center gap-3 flex-wrap">
        <div className="flex-1 min-w-[140px]">
          <p className="text-sm font-medium truncate" data-testid={`text-contact-name-${contact.id}`}>
            {contact.name || contact.phone || "Без имени"}
          </p>
          {contact.phone && (
            <p className="text-xs text-muted-foreground flex items-center gap-1">
              <Phone className="h-3 w-3" />
              {contact.phone}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {contact.source && (
            <Badge variant="secondary" className="text-[10px]" data-testid={`badge-source-${contact.id}`}>
              {sourceLabels[contact.source] ?? contact.source}
            </Badge>
          )}
          {contact.lastChannelProvider && (
            <Badge variant="outline" className="text-[10px]">
              {contact.lastChannelProvider}
            </Badge>
          )}
          <span className="flex items-center gap-0.5" title="Входящие">
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

        {contact.lastMessagePreview && (
          <p className="w-full text-xs text-muted-foreground truncate mt-1" data-testid={`text-preview-${contact.id}`}>
            {contact.lastMessagePreview}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
