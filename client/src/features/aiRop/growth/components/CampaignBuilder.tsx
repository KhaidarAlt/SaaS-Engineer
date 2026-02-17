import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { updateCampaign, estimateCampaign, previewCampaign, GROWTH_KEYS } from "../api/growthApi";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { GrowthCampaign, EstimateResult, PreviewResult } from "../types/growthTypes";
import {
  ChevronRight, Users, MessageCircle, Shield, Eye,
  Sparkles, Loader2, AlertTriangle, CheckCircle,
} from "lucide-react";

interface Props {
  campaign: GrowthCampaign;
  onUpdate: () => void;
  readOnly?: boolean;
}

const STEPS = [
  { key: "goal", label: "Цель и сценарий", icon: Sparkles },
  { key: "audience", label: "Аудитория", icon: Users },
  { key: "message", label: "Сообщение", icon: MessageCircle },
  { key: "preview", label: "Предпросмотр", icon: Eye },
];

export function CampaignBuilder({ campaign, onUpdate, readOnly = false }: Props) {
  const { toast } = useToast();
  const [step, setStep] = useState(0);

  const audienceRules = (campaign.audienceRules || {}) as Record<string, any>;
  const messageRules = (campaign.messageRules || {}) as Record<string, any>;
  const safetyRules = (campaign.safetyRules || {}) as Record<string, any>;
  const scheduleRules = (campaign.scheduleRules || {}) as Record<string, any>;

  const [inactiveDays, setInactiveDays] = useState<string>(String(audienceRules.inactiveDays || "14"));
  const [requirePriorInbound, setRequirePriorInbound] = useState<boolean>(safetyRules.requirePriorInbound !== false);
  const [respectOptOut, setRespectOptOut] = useState<boolean>(safetyRules.respectOptOut !== false);
  const [messageText, setMessageText] = useState<string>(messageRules.text || "Здравствуйте, {name}!");
  const [channelPolicy, setChannelPolicy] = useState<string>(campaign.channelPolicy || "AUTO");
  const [dailyCap, setDailyCap] = useState<string>(String(scheduleRules.dailyCap || "100"));
  const [quietStart, setQuietStart] = useState<string>(String(scheduleRules.quietHoursStart ?? "22"));
  const [quietEnd, setQuietEnd] = useState<string>(String(scheduleRules.quietHoursEnd ?? "8"));

  const [estimate, setEstimate] = useState<EstimateResult | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);

  const saveMut = useMutation({
    mutationFn: () => updateCampaign(campaign.id, {
      channelPolicy: channelPolicy as any,
      audienceRules: { inactiveDays: parseInt(inactiveDays) || 14 },
      messageRules: { text: messageText },
      safetyRules: { requirePriorInbound, respectOptOut },
      scheduleRules: {
        dailyCap: parseInt(dailyCap) || 100,
        quietHoursStart: parseInt(quietStart) || 22,
        quietHoursEnd: parseInt(quietEnd) || 8,
        timezone: "Asia/Almaty",
      },
    }),
    onSuccess: () => {
      onUpdate();
      toast({ title: "Сохранено" });
    },
    onError: () => toast({ title: "Ошибка сохранения", variant: "destructive" }),
  });

  const estimateMut = useMutation({
    mutationFn: () => estimateCampaign(campaign.id),
    onSuccess: (data) => setEstimate(data),
    onError: () => toast({ title: "Ошибка оценки", variant: "destructive" }),
  });

  const previewMut = useMutation({
    mutationFn: () => previewCampaign(campaign.id),
    onSuccess: (data) => setPreview(data),
    onError: () => toast({ title: "Ошибка предпросмотра", variant: "destructive" }),
  });

  const handleSaveAndNext = async () => {
    if (!readOnly) {
      await saveMut.mutateAsync();
    }
    if (step < STEPS.length - 1) {
      const nextStep = step + 1;
      setStep(nextStep);
      if (nextStep === 1) {
        estimateMut.mutate();
      }
      if (nextStep === 3) {
        previewMut.mutate();
      }
    }
  };

  return (
    <div className="space-y-4" data-testid="campaign-builder">
      <div className="flex items-center gap-1 overflow-x-auto pb-2">
        {STEPS.map((s, i) => {
          const Icon = s.icon;
          const isActive = i === step;
          const isDone = i < step;
          return (
            <div key={s.key} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="h-3 w-3 text-muted-foreground" />}
              <button
                onClick={() => setStep(i)}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
                  isActive ? "bg-primary/10 text-primary"
                    : isDone ? "text-foreground"
                      : "text-muted-foreground"
                }`}
                data-testid={`step-${s.key}`}
              >
                <Icon className="h-3.5 w-3.5" />
                {s.label}
              </button>
            </div>
          );
        })}
      </div>

      {step === 0 && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <h3 className="text-sm font-semibold">Настройки канала</h3>
            <div className="space-y-2">
              <Label>Политика выбора канала</Label>
              <Select value={channelPolicy} onValueChange={setChannelPolicy} disabled={readOnly}>
                <SelectTrigger data-testid="select-channel-policy"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="AUTO">Авто (лучший доступный)</SelectItem>
                  <SelectItem value="PREFER_LAST">Предпочитать последний канал</SelectItem>
                  <SelectItem value="FORCE_WHATSAPP">Только WhatsApp</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 1 && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <h3 className="text-sm font-semibold">Аудитория</h3>

            <div className="space-y-2">
              <Label>Неактивны дней</Label>
              <Input
                type="number" min="1" value={inactiveDays}
                onChange={(e) => setInactiveDays(e.target.value)}
                disabled={readOnly}
                data-testid="input-inactive-days"
              />
            </div>

            {estimate && (
              <Card className="bg-muted/50">
                <CardContent className="p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">Оценка аудитории: {estimate.totalAudience}</span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><CheckCircle className="h-3 w-3 text-green-600 dark:text-green-400" /> Доступны: {estimate.eligible}</span>
                    <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3 text-yellow-600 dark:text-yellow-400" /> Заблокированы: {estimate.blocked}</span>
                  </div>
                  {Object.keys(estimate.blockReasons).length > 0 && (
                    <div className="space-y-1">
                      <p className="text-xs font-medium">Причины пропуска:</p>
                      {Object.entries(estimate.blockReasons).map(([reason, cnt]) => (
                        <p key={reason} className="text-xs text-muted-foreground">- {reason}: {cnt}</p>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {estimateMut.isPending && <Skeleton className="h-24" />}

            <Button
              variant="outline" size="sm"
              onClick={() => { saveMut.mutateAsync().then(() => estimateMut.mutate()); }}
              disabled={estimateMut.isPending || readOnly}
              data-testid="button-estimate"
            >
              {estimateMut.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
              Пересчитать аудиторию
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardContent className="p-5 space-y-4">
            <h3 className="text-sm font-semibold flex items-center gap-1.5">
              <MessageCircle className="h-4 w-4 text-primary" />
              Сообщение
            </h3>

            <Textarea
              rows={4}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              disabled={readOnly}
              data-testid="textarea-message"
            />

            <div className="flex flex-wrap gap-1.5">
              <p className="text-xs text-muted-foreground w-full">Переменные:</p>
              {["{name}", "{phone}", "{last_product}", "{category_interest}", "{discount}", "{installment}"].map((v) => (
                <Badge
                  key={v} variant="outline" className="text-[10px] cursor-pointer"
                  onClick={() => !readOnly && setMessageText((t) => t + " " + v)}
                >
                  {v}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {step === 3 && (
        <div className="space-y-4">
          <Card>
            <CardContent className="p-5 space-y-3">
              <h3 className="text-sm font-semibold flex items-center gap-1.5">
                <Shield className="h-4 w-4 text-primary" />
                Безопасность и расписание
              </h3>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="flex items-center gap-2">
                  <Switch checked={requirePriorInbound} onCheckedChange={setRequirePriorInbound} disabled={readOnly} />
                  <Label className="text-xs">Только с историей диалога</Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch checked={respectOptOut} onCheckedChange={setRespectOptOut} disabled={readOnly} />
                  <Label className="text-xs">Уважать отписки</Label>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs">Лимит в день</Label>
                  <Input type="number" value={dailyCap} onChange={(e) => setDailyCap(e.target.value)} disabled={readOnly} data-testid="input-daily-cap" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Тихие часы: начало</Label>
                  <Input type="number" min="0" max="23" value={quietStart} onChange={(e) => setQuietStart(e.target.value)} disabled={readOnly} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">Тихие часы: конец</Label>
                  <Input type="number" min="0" max="23" value={quietEnd} onChange={(e) => setQuietEnd(e.target.value)} disabled={readOnly} />
                </div>
              </div>
            </CardContent>
          </Card>

          {preview && (
            <Card>
              <CardContent className="p-5 space-y-3">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-primary" />
                  <span className="text-sm font-medium">Предпросмотр: {preview.totalAudience} получателей</span>
                </div>

                {preview.connectedChannels.length > 0 && (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs text-muted-foreground">Каналы:</span>
                    {preview.connectedChannels.map((ch) => (
                      <Badge key={ch} variant="outline" className="text-[10px]">{ch}</Badge>
                    ))}
                  </div>
                )}

                {preview.connectedChannels.includes("WHATSAPP_WAHA") && !preview.connectedChannels.includes("WHATSAPP_META") && (
                  <div className="flex items-start gap-2 text-xs text-yellow-700 dark:text-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 rounded-md p-3">
                    <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                    <span>WAHA: соблюдайте правила WhatsApp. Массовые рассылки без согласия могут привести к бану.</span>
                  </div>
                )}

                {preview.recipients.length > 0 && (
                  <div className="rounded-md border overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Контакт</TableHead>
                          <TableHead>Канал</TableHead>
                          <TableHead>Статус</TableHead>
                          <TableHead>Причина</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {preview.recipients.map((r, i) => (
                          <TableRow key={i}>
                            <TableCell className="text-sm">{r.name}</TableCell>
                            <TableCell><Badge variant="outline" className="text-[10px]">{r.channel || "—"}</Badge></TableCell>
                            <TableCell>
                              {r.status === "READY"
                                ? <span className="text-xs text-green-600 dark:text-green-400 flex items-center gap-1"><CheckCircle className="h-3 w-3" />Готов</span>
                                : <span className="text-xs text-yellow-600 dark:text-yellow-400 flex items-center gap-1"><AlertTriangle className="h-3 w-3" />Пропущен</span>
                              }
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">{r.reason || ""}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {previewMut.isPending && <Skeleton className="h-32" />}
        </div>
      )}

      {!readOnly && (
        <div className="flex items-center gap-2 justify-end flex-wrap">
          {step > 0 && (
            <Button variant="outline" size="sm" onClick={() => setStep(step - 1)} data-testid="button-prev-step">
              Назад
            </Button>
          )}
          <Button
            size="sm"
            onClick={handleSaveAndNext}
            disabled={saveMut.isPending}
            data-testid="button-next-step"
          >
            {saveMut.isPending && <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" />}
            {step < STEPS.length - 1 ? "Далее" : "Сохранить"}
          </Button>
        </div>
      )}
    </div>
  );
}
