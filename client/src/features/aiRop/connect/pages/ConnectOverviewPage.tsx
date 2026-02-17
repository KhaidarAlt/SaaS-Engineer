import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { RefreshCw, Loader2 } from "lucide-react";
import { ChannelCard } from "../components/ChannelCard";
import { EventsList } from "../components/EventsList";
import { fetchChannels, healthCheckAll, testTelegram, CONNECT_KEYS } from "../api/connectApi";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { ChannelType } from "../types/connectTypes";

export function ConnectOverviewPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();

  const { data: channels, isLoading } = useQuery({
    queryKey: CONNECT_KEYS.channels,
    queryFn: fetchChannels,
    refetchInterval: 30000,
  });

  const healthMut = useMutation({
    mutationFn: healthCheckAll,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: CONNECT_KEYS.channels });
      queryClient.invalidateQueries({ queryKey: CONNECT_KEYS.events });
      toast({
        title: "Проверка завершена",
        description: `Проверено: ${Object.keys(data.results).length} каналов`,
      });
    },
  });

  const handleConnect = (type: ChannelType) => {
    if (type === "WHATSAPP_META" || type === "WHATSAPP_WAHA") {
      navigate("/dashboard/ai/rop/connections/whatsapp");
    } else if (type === "INSTAGRAM") {
      navigate("/dashboard/ai/rop/connections/instagram");
    } else if (type === "TELEGRAM") {
      navigate("/dashboard/ai/rop/connections/telegram");
    }
  };

  const handleTest = async (type: ChannelType) => {
    if (type === "TELEGRAM") {
      try {
        const result = await testTelegram();
        queryClient.invalidateQueries({ queryKey: CONNECT_KEYS.events });
        toast({
          title: result.success ? "Тест пройден" : "Ошибка теста",
          description: result.success ? `Бот ${result.botName} активен` : result.error,
          variant: result.success ? "default" : "destructive",
        });
      } catch {
        toast({ title: "Ошибка теста", variant: "destructive" });
      }
    }
  };

  return (
    <div data-testid="page-connect-overview">
      <div className="flex items-center justify-between gap-2 mb-6 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold">Подключение каналов</h2>
          <p className="text-sm text-muted-foreground">
            Подключите каналы, где клиенты пишут вам — AI начнёт отвечать автоматически
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => healthMut.mutate()}
          disabled={healthMut.isPending}
          data-testid="button-health-check"
        >
          {healthMut.isPending ? (
            <Loader2 className="h-4 w-4 mr-1 animate-spin" />
          ) : (
            <RefreshCw className="h-4 w-4 mr-1" />
          )}
          Проверить статус
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 mb-6">
          {channels?.map((ch) => (
            <ChannelCard
              key={ch.channelType}
              channel={ch}
              onConnect={() => handleConnect(ch.channelType as ChannelType)}
              onTest={ch.status === "CONNECTED" ? () => handleTest(ch.channelType as ChannelType) : undefined}
            />
          ))}
        </div>
      )}

      <EventsList />
    </div>
  );
}
