import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { WizardLayout } from "../components/WizardLayout";
import { StatusPill } from "../components/StatusPill";
import {
  fetchChannels, validateTelegramToken, connectTelegram,
  disconnectTelegram, testTelegram, CONNECT_KEYS,
} from "../api/connectApi";
import { queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Loader2, CheckCircle, XCircle, Zap, Trash2, ExternalLink } from "lucide-react";
import { SiTelegram } from "react-icons/si";
import type { ChannelStatus } from "../types/connectTypes";

export function TelegramConnectPage() {
  const { toast } = useToast();
  const [botToken, setBotToken] = useState("");
  const [validated, setValidated] = useState<{ success: boolean; botName?: string } | null>(null);

  const { data: channels } = useQuery({
    queryKey: CONNECT_KEYS.channels,
    queryFn: fetchChannels,
  });

  const tgChannel = channels?.find((c) => c.channelType === "TELEGRAM");
  const isConnected = tgChannel?.status === "CONNECTED";

  const validateMut = useMutation({
    mutationFn: () => validateTelegramToken(botToken),
    onSuccess: (data) => {
      setValidated(data);
      if (!data.success) {
        toast({ title: "Невалидный токен", description: data.error, variant: "destructive" });
      }
    },
  });

  const connectMut = useMutation({
    mutationFn: () => connectTelegram(botToken),
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: CONNECT_KEYS.channels });
        queryClient.invalidateQueries({ queryKey: CONNECT_KEYS.events });
        toast({ title: "Telegram подключён", description: `Бот: @${data.botUsername}` });
        setBotToken("");
        setValidated(null);
      } else {
        toast({ title: "Ошибка подключения", description: data.error, variant: "destructive" });
      }
    },
  });

  const disconnectMut = useMutation({
    mutationFn: disconnectTelegram,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: CONNECT_KEYS.channels });
      queryClient.invalidateQueries({ queryKey: CONNECT_KEYS.events });
      toast({ title: "Telegram отключён" });
    },
  });

  const testMut = useMutation({
    mutationFn: testTelegram,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: CONNECT_KEYS.events });
      toast({
        title: data.success ? "Тест пройден" : "Ошибка теста",
        description: data.success ? `Бот ${data.botName} активен` : data.error,
        variant: data.success ? "default" : "destructive",
      });
    },
  });

  return (
    <WizardLayout
      title="Telegram Bot"
      subtitle="Подключите бот для автоматических AI-ответов"
      backPath="/dashboard/ai/rop/connections"
    >
      <div className="max-w-lg space-y-4" data-testid="telegram-connect-page">
        {isConnected ? (
          <Card data-testid="card-telegram-connected">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <SiTelegram className="h-7 w-7 text-blue-500" />
                <div className="flex-1">
                  <h3 className="font-medium">Telegram Bot</h3>
                  {tgChannel?.displayName && (
                    <p className="text-xs text-muted-foreground">{tgChannel.displayName}</p>
                  )}
                </div>
                <StatusPill status={tgChannel!.status as ChannelStatus} />
              </div>

              <p className="text-sm text-muted-foreground">
                AI отвечает на сообщения в Telegram. Проверьте работоспособность бота.
              </p>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => testMut.mutate()}
                  disabled={testMut.isPending}
                  data-testid="button-test-telegram"
                >
                  {testMut.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Zap className="h-4 w-4 mr-1" />}
                  Тест
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => disconnectMut.mutate()}
                  disabled={disconnectMut.isPending}
                  data-testid="button-disconnect-telegram"
                >
                  {disconnectMut.isPending ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Trash2 className="h-4 w-4 mr-1" />}
                  Отключить
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card data-testid="card-telegram-connect">
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-3">
                <SiTelegram className="h-7 w-7 text-blue-500" />
                <h3 className="font-medium">Подключить Telegram Bot</h3>
              </div>

              <div className="space-y-2">
                <Label htmlFor="bot-token" className="text-sm">Токен бота (BotFather)</Label>
                <Input
                  id="bot-token"
                  placeholder="123456:ABC-DEF..."
                  value={botToken}
                  onChange={(e) => { setBotToken(e.target.value); setValidated(null); }}
                  data-testid="input-bot-token"
                />
                <p className="text-[11px] text-muted-foreground">
                  Получите токен у{" "}
                  <a
                    href="https://t.me/BotFather"
                    target="_blank"
                    rel="noopener"
                    className="underline inline-flex items-center gap-0.5"
                  >
                    @BotFather <ExternalLink className="h-3 w-3" />
                  </a>
                </p>
              </div>

              {validated && (
                <div className="flex items-center gap-2 text-sm">
                  {validated.success ? (
                    <>
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span className="text-green-600 dark:text-green-400">Бот найден: @{validated.botName}</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4 text-red-500" />
                      <span className="text-red-600 dark:text-red-400">Невалидный токен</span>
                    </>
                  )}
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                {!validated?.success ? (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => validateMut.mutate()}
                    disabled={!botToken.trim() || validateMut.isPending}
                    data-testid="button-validate-token"
                  >
                    {validateMut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    Проверить
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    onClick={() => connectMut.mutate()}
                    disabled={connectMut.isPending}
                    data-testid="button-connect-telegram"
                  >
                    {connectMut.isPending && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}
                    Подключить
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-4">
            <h4 className="text-xs font-medium mb-2">Как настроить Telegram бота:</h4>
            <ol className="text-xs text-muted-foreground space-y-1 list-decimal pl-4">
              <li>Откройте @BotFather в Telegram</li>
              <li>Создайте нового бота командой /newbot</li>
              <li>Скопируйте токен и вставьте выше</li>
              <li>Нажмите "Проверить" и затем "Подключить"</li>
            </ol>
          </CardContent>
        </Card>
      </div>
    </WizardLayout>
  );
}
