import { useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { WizardLayout } from "../components/WizardLayout";
import { StatusPill } from "../components/StatusPill";
import { fetchChannels, CONNECT_KEYS } from "../api/connectApi";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Trash2, AlertCircle } from "lucide-react";
import { SiInstagram } from "react-icons/si";
import type { ChannelStatus } from "../types/connectTypes";

export function InstagramConnectPage() {
  const { toast } = useToast();

  const { data: channels } = useQuery({
    queryKey: CONNECT_KEYS.channels,
    queryFn: fetchChannels,
  });

  const igChannel = channels?.find((c) => c.channelType === "INSTAGRAM");
  const isConnected = igChannel?.status === "CONNECTED";

  const params = new URLSearchParams(window.location.search);
  const oauthSuccess = params.get("instagram") === "success";
  const oauthError = params.get("error");

  useEffect(() => {
    if (oauthSuccess) {
      queryClient.invalidateQueries({ queryKey: CONNECT_KEYS.channels });
      queryClient.invalidateQueries({ queryKey: CONNECT_KEYS.events });
      toast({ title: "Instagram подключён" });
      window.history.replaceState({}, "", window.location.pathname);
    }
    if (oauthError) {
      toast({
        title: "Ошибка подключения",
        description: decodeURIComponent(oauthError),
        variant: "destructive",
      });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  const connectMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/instagram/onboarding/start");
      return res.json();
    },
    onSuccess: (data: { authUrl?: string; error?: string }) => {
      if (data.authUrl) {
        window.location.href = data.authUrl;
      } else {
        toast({ title: "Ошибка", description: data.error || "Не удалось начать подключение", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Ошибка подключения", variant: "destructive" });
    },
  });

  const disconnectMut = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("DELETE", "/api/instagram/integration");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONNECT_KEYS.channels });
      queryClient.invalidateQueries({ queryKey: CONNECT_KEYS.events });
      toast({ title: "Instagram отключён" });
    },
  });

  return (
    <WizardLayout
      title="Instagram Direct"
      subtitle="Подключение AI-ответов в Instagram"
      backPath="/dashboard/ai/rop/connections"
    >
      <div className="max-w-lg space-y-4" data-testid="instagram-connect-page">
        {isConnected ? (
          <Card data-testid="card-instagram-connected">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <SiInstagram className="h-7 w-7 text-pink-600 dark:text-pink-400" />
                <div className="flex-1">
                  <h3 className="font-medium">Instagram Direct</h3>
                  {igChannel?.displayName && (
                    <p className="text-xs text-muted-foreground">@{igChannel.displayName}</p>
                  )}
                </div>
                <StatusPill status={igChannel!.status as ChannelStatus} />
              </div>

              <p className="text-sm text-muted-foreground">
                Instagram подключён. AI отвечает на входящие сообщения в Direct.
              </p>

              {igChannel?.lastError && (
                <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
                  <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>{igChannel.lastError}</span>
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => disconnectMut.mutate()}
                  disabled={disconnectMut.isPending}
                  data-testid="button-disconnect-instagram"
                >
                  {disconnectMut.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
                  Отключить
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card data-testid="card-instagram-connect">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <SiInstagram className="h-7 w-7 text-pink-600 dark:text-pink-400" />
                <h3 className="font-medium">Подключить Instagram Direct</h3>
              </div>

              <div className="rounded-md bg-muted/50 p-4 space-y-2">
                <p className="text-sm font-medium">Требования для подключения:</p>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
                  <li>Instagram Business или Creator аккаунт</li>
                  <li>Facebook Page, связанная с Instagram</li>
                  <li>Права администратора на Facebook Page</li>
                </ul>
              </div>

              <Button
                className="w-full"
                onClick={() => connectMut.mutate()}
                disabled={connectMut.isPending}
                data-testid="button-connect-instagram"
              >
                {connectMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Подключить через Meta
              </Button>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-4">
            <h4 className="text-xs font-medium mb-2">Как подключить Instagram Direct:</h4>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal pl-4">
              <li>Переведите Instagram аккаунт в Business/Creator</li>
              <li>Свяжите Instagram с Facebook Page</li>
              <li>Нажмите "Подключить через Meta" выше</li>
              <li>Авторизуйтесь и предоставьте доступ</li>
              <li>AI начнёт отвечать на сообщения в Direct</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </WizardLayout>
  );
}
