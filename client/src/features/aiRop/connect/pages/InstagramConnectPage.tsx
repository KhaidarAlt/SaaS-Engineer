import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { WizardLayout } from "../components/WizardLayout";
import { StatusPill } from "../components/StatusPill";
import { fetchChannels, CONNECT_KEYS } from "../api/connectApi";
import { ExternalLink, Clock } from "lucide-react";
import { SiInstagram } from "react-icons/si";
import type { ChannelStatus } from "../types/connectTypes";

export function InstagramConnectPage() {
  const { data: channels } = useQuery({
    queryKey: CONNECT_KEYS.channels,
    queryFn: fetchChannels,
  });

  const igChannel = channels?.find((c) => c.channelType === "INSTAGRAM");
  const isConnected = igChannel?.status === "CONNECTED";

  return (
    <WizardLayout
      title="Instagram Direct"
      subtitle="Подключение AI-ответов в Instagram"
      backPath="/dashboard/ai/rop/connections"
    >
      <div className="max-w-lg" data-testid="instagram-connect-page">
        <Card>
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <SiInstagram className="h-7 w-7 text-pink-600 dark:text-pink-400" />
              <div className="flex-1">
                <h3 className="font-medium">Instagram Direct</h3>
                {igChannel?.displayName && (
                  <p className="text-xs text-muted-foreground">@{igChannel.displayName}</p>
                )}
              </div>
              {igChannel && igChannel.status !== "NOT_CONNECTED" && (
                <StatusPill status={igChannel.status as ChannelStatus} />
              )}
            </div>

            {isConnected ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Instagram подключён. AI отвечает на входящие сообщения.
                </p>
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => window.open("/dashboard/ai/integrations", "_blank")}
                  data-testid="button-ig-settings"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Управление подключением
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-md bg-muted/50 p-4 space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <p className="text-sm font-medium">Подключение через Meta</p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Instagram Direct подключается через Meta Business Platform. Для подключения требуется Facebook Page, связанная с Instagram Business аккаунтом.
                  </p>
                </div>

                <Button
                  className="w-full"
                  onClick={() => window.open("/dashboard/ai/integrations", "_blank")}
                  data-testid="button-connect-ig"
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Начать подключение
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </WizardLayout>
  );
}
