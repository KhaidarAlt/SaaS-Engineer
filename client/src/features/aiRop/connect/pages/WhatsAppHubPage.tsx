import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WizardLayout } from "../components/WizardLayout";
import { StatusPill } from "../components/StatusPill";
import { fetchChannels, CONNECT_KEYS } from "../api/connectApi";
import { Shield, Zap, ChevronRight, Star } from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import type { ChannelStatus } from "../types/connectTypes";

export function WhatsAppHubPage() {
  const [, navigate] = useLocation();

  const { data: channels } = useQuery({
    queryKey: CONNECT_KEYS.channels,
    queryFn: fetchChannels,
  });

  const metaChannel = channels?.find((c) => c.channelType === "WHATSAPP_META");
  const wahaChannel = channels?.find((c) => c.channelType === "WHATSAPP_WAHA");

  return (
    <WizardLayout
      title="Запустить AI в WhatsApp"
      subtitle="Выберите способ подключения"
      backPath="/dashboard/ai/rop/connections"
    >
      <div className="grid gap-4 sm:grid-cols-2 max-w-2xl" data-testid="whatsapp-hub">
        <Card className="hover-elevate relative" data-testid="card-meta-option">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <SiWhatsapp className="h-6 w-6 text-green-600 dark:text-green-400" />
              <div className="flex-1">
                <h3 className="text-sm font-medium">Официальный WhatsApp (Meta)</h3>
              </div>
              <Badge variant="secondary" className="text-[10px]">
                <Star className="h-3 w-3 mr-0.5" />
                Рекомендуем
              </Badge>
            </div>

            {metaChannel && metaChannel.status !== "NOT_CONNECTED" && (
              <StatusPill status={metaChannel.status as ChannelStatus} />
            )}

            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <Shield className="h-3 w-3 shrink-0" /> Надёжное подключение
              </li>
              <li className="flex items-center gap-1.5">
                <Shield className="h-3 w-3 shrink-0" /> Шаблоны сообщений
              </li>
              <li className="flex items-center gap-1.5">
                <Shield className="h-3 w-3 shrink-0" /> Масштабирование
              </li>
            </ul>

            <p className="text-[11px] text-muted-foreground">Требует Meta Business</p>

            <Button
              className="w-full"
              onClick={() => navigate("/dashboard/ai/rop/connections/whatsapp/meta")}
              data-testid="button-connect-meta"
            >
              {metaChannel?.status === "CONNECTED" ? "Открыть настройки Meta" : "Подключить Meta"}
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>

        <Card className="hover-elevate" data-testid="card-waha-option">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-2">
              <SiWhatsapp className="h-6 w-6 text-green-600 dark:text-green-400" />
              <h3 className="text-sm font-medium">Быстрое подключение (WAHA QR)</h3>
            </div>

            {wahaChannel && wahaChannel.status !== "NOT_CONNECTED" && (
              <StatusPill status={wahaChannel.status as ChannelStatus} />
            )}

            <ul className="space-y-1.5 text-xs text-muted-foreground">
              <li className="flex items-center gap-1.5">
                <Zap className="h-3 w-3 shrink-0" /> Быстрый старт
              </li>
              <li className="flex items-center gap-1.5">
                <Zap className="h-3 w-3 shrink-0" /> Подходит для теста
              </li>
            </ul>

            <Badge variant="outline" className="text-[10px] bg-yellow-50 text-yellow-700 border-yellow-200 dark:bg-yellow-900/20 dark:text-yellow-400 dark:border-yellow-800">
              Есть риск блокировки при нарушениях
            </Badge>

            <Button
              className="w-full"
              variant="outline"
              onClick={() => navigate("/dashboard/ai/rop/connections/whatsapp/waha")}
              data-testid="button-connect-waha"
            >
              Подключить WAHA
              <ChevronRight className="h-4 w-4 ml-1" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </WizardLayout>
  );
}
