import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { StatusPill } from "./StatusPill";
import type { ChannelInfo, ChannelType } from "../types/connectTypes";
import { CHANNEL_LABELS } from "../types/connectTypes";
import { MessageCircle, Send, Zap, ChevronRight } from "lucide-react";
import { SiWhatsapp, SiInstagram, SiTelegram } from "react-icons/si";

const CHANNEL_ICONS: Record<ChannelType, typeof MessageCircle> = {
  WHATSAPP_META: MessageCircle,
  WHATSAPP_WAHA: MessageCircle,
  INSTAGRAM: MessageCircle,
  TELEGRAM: Send,
};

const CHANNEL_BRAND_ICONS: Record<ChannelType, any> = {
  WHATSAPP_META: SiWhatsapp,
  WHATSAPP_WAHA: SiWhatsapp,
  INSTAGRAM: SiInstagram,
  TELEGRAM: SiTelegram,
};

const CHANNEL_BRAND_COLORS: Record<ChannelType, string> = {
  WHATSAPP_META: "text-green-600 dark:text-green-400",
  WHATSAPP_WAHA: "text-green-600 dark:text-green-400",
  INSTAGRAM: "text-pink-600 dark:text-pink-400",
  TELEGRAM: "text-blue-500 dark:text-blue-400",
};

interface ChannelCardProps {
  channel: ChannelInfo;
  onConnect: () => void;
  onTest?: () => void;
}

export function ChannelCard({ channel, onConnect, onTest }: ChannelCardProps) {
  const BrandIcon = CHANNEL_BRAND_ICONS[channel.channelType];
  const brandColor = CHANNEL_BRAND_COLORS[channel.channelType];
  const isConnected = channel.status === "CONNECTED";

  return (
    <Card className="hover-elevate" data-testid={`card-channel-${channel.channelType}`}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-3">
            <div className={`${brandColor}`}>
              <BrandIcon className="h-6 w-6" />
            </div>
            <div>
              <h3 className="text-sm font-medium" data-testid={`channel-name-${channel.channelType}`}>
                {CHANNEL_LABELS[channel.channelType]}
              </h3>
              {channel.displayName && (
                <p className="text-xs text-muted-foreground truncate max-w-[160px]">{channel.displayName}</p>
              )}
            </div>
          </div>
          <StatusPill status={channel.status as any} />
        </div>

        <p className="text-xs text-muted-foreground">
          AI активен: {channel.isAiEnabled ? "да" : "нет"}
        </p>

        {channel.lastError && (
          <p className="text-xs text-red-600 dark:text-red-400 truncate" data-testid={`channel-error-${channel.channelType}`}>
            {channel.lastError}
          </p>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={onConnect}
            data-testid={`button-connect-${channel.channelType}`}
          >
            {isConnected ? "Управлять" : "Подключить"}
            <ChevronRight className="h-3.5 w-3.5 ml-1" />
          </Button>
          {isConnected && onTest && (
            <Button
              size="sm"
              variant="outline"
              onClick={onTest}
              data-testid={`button-test-${channel.channelType}`}
            >
              <Zap className="h-3.5 w-3.5 mr-1" />
              Тест
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
