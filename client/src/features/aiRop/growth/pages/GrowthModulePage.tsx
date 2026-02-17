import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { GrowthSubNav } from "../components/GrowthSubNav";
import { CampaignList } from "../components/CampaignList";
import { NewCampaignModal } from "../components/NewCampaignModal";
import { fetchCampaigns, GROWTH_KEYS } from "../api/growthApi";
import {
  CAMPAIGN_TYPE_LABELS, CAMPAIGN_TYPE_DESCRIPTIONS,
  type CampaignType, type GrowthCampaign,
} from "../types/growthTypes";
import { Plus, Sparkles } from "lucide-react";

interface Props {
  type: CampaignType;
}

const AUDIENCE_PRESETS: Record<CampaignType, Array<{ label: string; value: Record<string, unknown> }>> = {
  REACTIVATION: [
    { label: "Не писали 7+ дней", value: { inactiveDays: 7 } },
    { label: "Не писали 14+ дней", value: { inactiveDays: 14 } },
    { label: "Не писали 30+ дней", value: { inactiveDays: 30 } },
    { label: "Не писали 60+ дней", value: { inactiveDays: 60 } },
    { label: "Не писали 90+ дней", value: { inactiveDays: 90 } },
  ],
  UPSELL: [
    { label: "Оплатили за последние 7 дней", value: { orderStatus: "PAID", orderDaysAgo: 7 } },
    { label: "Доставлено за последние 14 дней", value: { orderStatus: "DELIVERED", orderDaysAgo: 14 } },
  ],
  ABANDONED: [
    { label: "Неактивны 24+ часа после запроса", value: { inactiveHours: 24 } },
    { label: "Неактивны 48+ часов после запроса", value: { inactiveHours: 48 } },
    { label: "Неактивны 72+ часа после запроса", value: { inactiveHours: 72 } },
  ],
  REMINDER: [
    { label: "Интересовались товаром", value: { tags: ["interested"] } },
    { label: "Просматривали категорию", value: { tags: ["viewed_category"] } },
  ],
  NPS: [
    { label: "Завершённые заказы за 7 дней", value: { orderStatus: "COMPLETED", orderDaysAgo: 7 } },
    { label: "Завершённые заказы за 14 дней", value: { orderStatus: "COMPLETED", orderDaysAgo: 14 } },
  ],
};

const MESSAGE_PRESETS: Record<CampaignType, string[]> = {
  REACTIVATION: [
    "Здравствуйте, {name}! Давно не виделись. У нас появились новинки — хотите посмотреть?",
    "Привет, {name}! Специально для вас — персональная скидка. Напишите, и расскажу подробнее.",
    "Здравствуйте! Напоминаем о себе. Чем можем помочь?",
  ],
  UPSELL: [
    "Здравствуйте, {name}! К вашему заказу отлично подойдёт {last_product}. Хотите добавить?",
    "Спасибо за покупку! Рекомендуем посмотреть аксессуары к вашему заказу.",
  ],
  ABANDONED: [
    "Здравствуйте, {name}! Вы интересовались нашими товарами. Хотите продолжить? Могу предложить альтернативу.",
    "Привет! Видим, что вы не завершили выбор. Могу помочь с подбором?",
  ],
  REMINDER: [
    "Здравствуйте! Товар, который вас интересовал, снова в наличии!",
    "Хорошие новости — цена на интересующий вас товар снижена!",
  ],
  NPS: [
    "Здравствуйте, {name}! Оцените наш сервис от 1 до 5. Ваше мнение важно для нас!",
  ],
};

export function GrowthModulePage({ type }: Props) {
  const [, navigate] = useLocation();
  const [showNewModal, setShowNewModal] = useState(false);

  const { data: campaigns, isLoading } = useQuery<GrowthCampaign[]>({
    queryKey: [...GROWTH_KEYS.campaigns, type],
    queryFn: () => fetchCampaigns(type),
  });

  const typeLabel = CAMPAIGN_TYPE_LABELS[type];
  const typeDesc = CAMPAIGN_TYPE_DESCRIPTIONS[type];
  const presets = AUDIENCE_PRESETS[type] || [];
  const messages = MESSAGE_PRESETS[type] || [];

  return (
    <div className="space-y-6" data-testid={`growth-module-${type.toLowerCase()}`}>
      <GrowthSubNav />

      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">{typeLabel}</h2>
          <p className="text-sm text-muted-foreground">{typeDesc}</p>
        </div>
        <Button size="sm" onClick={() => setShowNewModal(true)} data-testid="button-new-module-campaign">
          <Plus className="h-4 w-4 mr-1" />
          Новая кампания
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-medium">Шаблоны аудитории</h3>
            <div className="flex flex-wrap gap-1.5">
              {presets.map((p, i) => (
                <Badge key={i} variant="outline" className="text-xs cursor-default">
                  {p.label}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4 space-y-2">
            <h3 className="text-sm font-medium flex items-center gap-1.5">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
              Шаблоны сообщений
            </h3>
            <div className="space-y-1.5">
              {messages.map((m, i) => (
                <p key={i} className="text-xs text-muted-foreground bg-muted/50 rounded-md p-2">{m}</p>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="text-sm font-medium mb-2">Кампании ({campaigns?.length ?? 0})</h3>
        {isLoading ? (
          <div className="space-y-2">
            {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-16" />)}
          </div>
        ) : (
          <CampaignList campaigns={campaigns ?? []} />
        )}
      </div>

      <NewCampaignModal open={showNewModal} onOpenChange={setShowNewModal} />
    </div>
  );
}
