import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AiPaywall } from "@/components/AiPaywall";
import { Plug, MessageCircle, Globe, Settings, ArrowLeft, Plus, Loader2, RefreshCw, Trash2, Play, Square, QrCode, Phone, CheckCircle, AlertCircle, Copy, Code } from "lucide-react";
import { SiWhatsapp, SiTelegram, SiInstagram } from "react-icons/si";
import { Link } from "wouter";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { DashboardLayout } from "@/components/DashboardLayout";

interface WahaInstance {
  id: string;
  tenantId: string;
  instanceName: string;
  phoneNumber: string | null;
  status: string;
  qrCode: string | null;
  liveStatus?: string;
  createdAt: string;
}

interface WahaHealth {
  healthy: boolean;
  baseUrl?: string;
}

interface InstagramIntegration {
  id: string;
  tenantId: string;
  instagramUsername: string | null;
  instagramAccountId: string | null;
  status: string;
}

interface TelegramIntegration {
  id: string;
  tenantId: string;
  botUsername: string | null;
  botId: string | null;
  status: string;
}

interface WidgetIntegration {
  id: string;
  tenantId: string;
  widgetKey: string;
  name: string;
  primaryColor: string;
  isActive: boolean;
}

const statusLabels: Record<string, string> = {
  created: "Создан",
  starting: "Запуск...",
  running: "Работает",
  stopped: "Остановлен",
  failed: "Ошибка",
  scan_qr: "Сканируйте QR",
  unknown: "Неизвестно",
};

const statusColors: Record<string, string> = {
  running: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100",
  scan_qr: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100",
  starting: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100",
  stopped: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100",
  created: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100",
  unknown: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-100",
};

export default function AiIntegrationsPage() {
  const { toast } = useToast();
  const [selectedInstance, setSelectedInstance] = useState<WahaInstance | null>(null);
  const [qrDialogOpen, setQrDialogOpen] = useState(false);
  const [pollingInstanceId, setPollingInstanceId] = useState<string | null>(null);

  const { data: status } = useQuery<{ hasAccess: boolean; planName?: string }>({
    queryKey: ["/api/ai/status"],
  });

  const { data: health } = useQuery<WahaHealth>({
    queryKey: ["/api/waha/health"],
    enabled: status?.hasAccess,
  });

  const { data: instances, isLoading: instancesLoading, refetch: refetchInstances } = useQuery<WahaInstance[]>({
    queryKey: ["/api/waha/instances"],
    enabled: status?.hasAccess,
    refetchInterval: pollingInstanceId ? 3000 : false,
  });

  const { data: qrData, refetch: refetchQr } = useQuery<{ qrCode: string; instanceName: string }>({
    queryKey: ["/api/waha/instances", selectedInstance?.id, "qr"],
    enabled: !!selectedInstance && qrDialogOpen,
    refetchInterval: qrDialogOpen ? 5000 : false,
  });

  const { data: instanceStatus, refetch: refetchStatus } = useQuery<WahaInstance>({
    queryKey: ["/api/waha/instances", selectedInstance?.id, "status"],
    enabled: !!selectedInstance && qrDialogOpen,
    refetchInterval: qrDialogOpen ? 3000 : false,
  });

  useEffect(() => {
    if (instanceStatus?.status === "running") {
      setQrDialogOpen(false);
      setPollingInstanceId(null);
      toast({ title: "WhatsApp подключен!" });
      refetchInstances();
    }
  }, [instanceStatus?.status]);

  const { data: instagramIntegration, isLoading: instagramLoading, refetch: refetchInstagram } = useQuery<InstagramIntegration | null>({
    queryKey: ["/api/instagram/integration"],
    enabled: status?.hasAccess,
  });

  const instagramConnectMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/instagram/onboarding/start");
      return res.json();
    },
    onSuccess: (data: { authUrl: string }) => {
      window.location.href = data.authUrl;
    },
    onError: () => {
      toast({ title: "Ошибка подключения Instagram", variant: "destructive" });
    },
  });

  const instagramDisconnectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/instagram/integration");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/instagram/integration"] });
      toast({ title: "Instagram отключен" });
    },
    onError: () => {
      toast({ title: "Ошибка отключения Instagram", variant: "destructive" });
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/waha/instances");
      return res.json();
    },
    onSuccess: (data: WahaInstance) => {
      queryClient.invalidateQueries({ queryKey: ["/api/waha/instances"] });
      setSelectedInstance(data);
      setPollingInstanceId(data.id);
      setTimeout(() => setQrDialogOpen(true), 1000);
      toast({ title: "Инстанс создан, сканируйте QR-код" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка", description: error.message, variant: "destructive" });
    },
  });

  const startMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/waha/instances/${id}/start`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/waha/instances"] });
      toast({ title: "Инстанс запущен" });
    },
  });

  const stopMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("POST", `/api/waha/instances/${id}/stop`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/waha/instances"] });
      toast({ title: "Инстанс остановлен" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return apiRequest("DELETE", `/api/waha/instances/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/waha/instances"] });
      toast({ title: "Инстанс удалён" });
    },
  });

  // Telegram integration
  const [telegramDialogOpen, setTelegramDialogOpen] = useState(false);
  const [telegramBotToken, setTelegramBotToken] = useState("");

  const { data: telegramIntegration, isLoading: telegramLoading } = useQuery<TelegramIntegration | null>({
    queryKey: ["/api/telegram/integration"],
    enabled: status?.hasAccess,
  });

  const telegramConnectMutation = useMutation({
    mutationFn: async (botToken: string) => {
      const res = await apiRequest("POST", "/api/telegram/connect", { botToken });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telegram/integration"] });
      setTelegramDialogOpen(false);
      setTelegramBotToken("");
      toast({ title: "Telegram бот подключен!" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка подключения", description: error.message, variant: "destructive" });
    },
  });

  const telegramDisconnectMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/telegram/integration");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/telegram/integration"] });
      toast({ title: "Telegram бот отключен" });
    },
    onError: () => {
      toast({ title: "Ошибка отключения", variant: "destructive" });
    },
  });

  // Widget integration
  const [widgetDialogOpen, setWidgetDialogOpen] = useState(false);
  const [embedCode, setEmbedCode] = useState("");

  const { data: widgetIntegration, isLoading: widgetLoading } = useQuery<WidgetIntegration | null>({
    queryKey: ["/api/widget/integration"],
    enabled: status?.hasAccess,
  });

  const widgetCreateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/widget/create", {});
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/widget/integration"] });
      toast({ title: "Виджет создан!" });
    },
    onError: (error: Error) => {
      toast({ title: "Ошибка создания", description: error.message, variant: "destructive" });
    },
  });

  const widgetDeleteMutation = useMutation({
    mutationFn: async () => {
      await apiRequest("DELETE", "/api/widget/integration");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/widget/integration"] });
      toast({ title: "Виджет удален" });
    },
    onError: () => {
      toast({ title: "Ошибка удаления", variant: "destructive" });
    },
  });

  const fetchEmbedCode = async () => {
    try {
      const res = await apiRequest("GET", "/api/widget/embed-code");
      const data = await res.json();
      setEmbedCode(data.embedCode);
      setWidgetDialogOpen(true);
    } catch {
      toast({ title: "Ошибка получения кода", variant: "destructive" });
    }
  };

  const copyEmbedCode = () => {
    navigator.clipboard.writeText(embedCode);
    toast({ title: "Код скопирован!" });
  };

  if (!status?.hasAccess) {
    return <DashboardLayout><div className="p-6"><AiPaywall currentPlan={status?.planName} /></div></DashboardLayout>;
  }


  return (
    <DashboardLayout>
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-4">
        <Link href="/dashboard/ai">
          <Button variant="ghost" size="icon" data-testid="button-back">
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Интеграции</h1>
          <p className="text-muted-foreground">Подключите AI-ассистента к каналам общения с клиентами</p>
        </div>
      </div>

      <Card data-testid="card-integration-whatsapp">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900 flex items-center justify-center">
                <SiWhatsapp className="h-6 w-6 text-green-600" />
              </div>
              <div>
                <CardTitle className="text-base">WhatsApp</CardTitle>
                <CardDescription>Подключите номера для автоматических ответов</CardDescription>
              </div>
            </div>
            {health?.healthy ? (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                <CheckCircle className="h-3 w-3 mr-1" />
                Сервер доступен
              </Badge>
            ) : (
              <Badge variant="destructive">
                <AlertCircle className="h-3 w-3 mr-1" />
                Сервер недоступен
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {instancesLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : instances && instances.length > 0 ? (
            <div className="space-y-3">
              {instances.map((instance) => (
                <div 
                  key={instance.id} 
                  className="flex items-center justify-between p-4 border rounded-lg"
                  data-testid={`waha-instance-${instance.id}`}
                >
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-green-100 dark:bg-green-900 flex items-center justify-center">
                      <Phone className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">
                        {instance.phoneNumber ? `+${instance.phoneNumber}` : instance.instanceName}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(instance.createdAt).toLocaleDateString("ru-RU")}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={statusColors[instance.status] || statusColors.unknown}>
                      {statusLabels[instance.status] || instance.status}
                    </Badge>
                    {instance.status === "scan_qr" && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => {
                          setSelectedInstance(instance);
                          setQrDialogOpen(true);
                        }}
                        data-testid={`button-qr-${instance.id}`}
                      >
                        <QrCode className="h-4 w-4 mr-1" />
                        QR
                      </Button>
                    )}
                    {instance.status === "stopped" && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => startMutation.mutate(instance.id)}
                        disabled={startMutation.isPending}
                        data-testid={`button-start-${instance.id}`}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    )}
                    {instance.status === "running" && (
                      <Button 
                        size="sm" 
                        variant="outline"
                        onClick={() => stopMutation.mutate(instance.id)}
                        disabled={stopMutation.isPending}
                        data-testid={`button-stop-${instance.id}`}
                      >
                        <Square className="h-4 w-4" />
                      </Button>
                    )}
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => deleteMutation.mutate(instance.id)}
                      disabled={deleteMutation.isPending}
                      data-testid={`button-delete-${instance.id}`}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6 text-muted-foreground">
              Нет подключенных номеров WhatsApp
            </div>
          )}
          
          <Button 
            onClick={() => createMutation.mutate()} 
            disabled={createMutation.isPending || !health?.healthy}
            className="w-full"
            data-testid="button-connect-whatsapp"
          >
            {createMutation.isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Plus className="mr-2 h-4 w-4" />
            )}
            Подключить номер WhatsApp
          </Button>
        </CardContent>
      </Card>

      <Card data-testid="card-integration-instagram">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center">
                <SiInstagram className="h-6 w-6 text-white" />
              </div>
              <div>
                <CardTitle className="text-lg">Instagram Direct</CardTitle>
                <CardDescription>Автоматические ответы в Instagram сообщениях</CardDescription>
              </div>
            </div>
            {instagramIntegration?.status === "connected" ? (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                <CheckCircle className="h-3 w-3 mr-1" />
                Подключен
              </Badge>
            ) : (
              <Badge variant="secondary">Не подключен</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {instagramLoading ? (
            <Skeleton className="h-16" />
          ) : instagramIntegration?.status === "connected" ? (
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center">
                  <SiInstagram className="h-5 w-5 text-white" />
                </div>
                <div>
                  <p className="font-medium">@{instagramIntegration.instagramUsername}</p>
                  <p className="text-sm text-muted-foreground">Instagram Business Account</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => instagramDisconnectMutation.mutate()}
                disabled={instagramDisconnectMutation.isPending}
                data-testid="button-disconnect-instagram"
              >
                {instagramDisconnectMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 text-destructive" />
                )}
              </Button>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              Подключите Instagram Business аккаунт для автоматических ответов
            </div>
          )}
          
          {instagramIntegration?.status !== "connected" && (
            <Button 
              onClick={() => instagramConnectMutation.mutate()} 
              disabled={instagramConnectMutation.isPending}
              className="w-full"
              data-testid="button-connect-instagram"
            >
              {instagramConnectMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Подключить Instagram
            </Button>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-integration-telegram">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                <SiTelegram className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <CardTitle className="text-lg">Telegram Bot</CardTitle>
                <CardDescription>Автоматизируйте общение через Telegram бота</CardDescription>
              </div>
            </div>
            {telegramIntegration?.status === "active" ? (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                <CheckCircle className="h-3 w-3 mr-1" />
                Подключен
              </Badge>
            ) : (
              <Badge variant="secondary">Не подключен</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {telegramLoading ? (
            <Skeleton className="h-16" />
          ) : telegramIntegration?.status === "active" ? (
            <div className="flex items-center justify-between p-4 border rounded-lg">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                  <SiTelegram className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="font-medium">@{telegramIntegration.botUsername}</p>
                  <p className="text-sm text-muted-foreground">Telegram Bot</p>
                </div>
              </div>
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => telegramDisconnectMutation.mutate()}
                disabled={telegramDisconnectMutation.isPending}
                data-testid="button-disconnect-telegram"
              >
                {telegramDisconnectMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Trash2 className="h-4 w-4 text-destructive" />
                )}
              </Button>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              Подключите Telegram бота для автоматических ответов клиентам
            </div>
          )}
          
          {telegramIntegration?.status !== "active" && (
            <Button 
              onClick={() => setTelegramDialogOpen(true)} 
              className="w-full"
              data-testid="button-connect-telegram"
            >
              <Plus className="mr-2 h-4 w-4" />
              Подключить Telegram бота
            </Button>
          )}
        </CardContent>
      </Card>

      <Card data-testid="card-integration-widget">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Globe className="h-6 w-6 text-primary" />
              </div>
              <div>
                <CardTitle className="text-lg">Виджет на сайте</CardTitle>
                <CardDescription>Встройте чат-виджет на ваш сайт</CardDescription>
              </div>
            </div>
            {widgetIntegration?.isActive ? (
              <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100">
                <CheckCircle className="h-3 w-3 mr-1" />
                Активен
              </Badge>
            ) : widgetIntegration ? (
              <Badge variant="secondary">Отключен</Badge>
            ) : (
              <Badge variant="secondary">Не создан</Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {widgetLoading ? (
            <Skeleton className="h-16" />
          ) : widgetIntegration ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between p-4 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full flex items-center justify-center" style={{ backgroundColor: widgetIntegration.primaryColor + "20" }}>
                    <MessageCircle className="h-5 w-5" style={{ color: widgetIntegration.primaryColor }} />
                  </div>
                  <div>
                    <p className="font-medium">{widgetIntegration.name}</p>
                    <p className="text-sm text-muted-foreground">Ключ: {widgetIntegration.widgetKey.slice(0, 8)}...</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={fetchEmbedCode}
                    data-testid="button-get-widget-code"
                  >
                    <Code className="h-4 w-4 mr-1" />
                    Код
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => widgetDeleteMutation.mutate()}
                    disabled={widgetDeleteMutation.isPending}
                    data-testid="button-delete-widget"
                  >
                    {widgetDeleteMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="h-4 w-4 text-destructive" />
                    )}
                  </Button>
                </div>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-muted-foreground">
              Создайте виджет для встраивания чата на ваш сайт
            </div>
          )}
          
          {!widgetIntegration && (
            <Button 
              onClick={() => widgetCreateMutation.mutate()} 
              disabled={widgetCreateMutation.isPending}
              className="w-full"
              data-testid="button-create-widget"
            >
              {widgetCreateMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Plus className="mr-2 h-4 w-4" />
              )}
              Создать виджет
            </Button>
          )}
        </CardContent>
      </Card>

      <Dialog open={qrDialogOpen} onOpenChange={setQrDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Сканируйте QR-код</DialogTitle>
            <DialogDescription>
              Откройте WhatsApp на телефоне, перейдите в Связанные устройства и отсканируйте этот QR-код
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center py-6">
            {instanceStatus?.status === "running" ? (
              <div className="text-center">
                <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
                <p className="text-lg font-medium">WhatsApp подключен!</p>
                {instanceStatus.phoneNumber && (
                  <p className="text-muted-foreground">+{instanceStatus.phoneNumber}</p>
                )}
              </div>
            ) : qrData?.qrCode ? (
              <div className="p-4 bg-white rounded-lg">
                <img 
                  src={qrData.qrCode} 
                  alt="WhatsApp QR Code" 
                  className="w-64 h-64"
                  data-testid="img-qr-code"
                />
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <Loader2 className="h-12 w-12 animate-spin text-muted-foreground" />
                <p className="text-muted-foreground">Загрузка QR-кода...</p>
              </div>
            )}
          </div>
          <DialogFooter className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => {
                refetchQr();
                refetchStatus();
              }}
            >
              <RefreshCw className="mr-2 h-4 w-4" />
              Обновить
            </Button>
            <Button variant="ghost" onClick={() => setQrDialogOpen(false)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={telegramDialogOpen} onOpenChange={setTelegramDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Подключить Telegram бота</DialogTitle>
            <DialogDescription>
              Создайте бота через @BotFather в Telegram и введите полученный токен
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="telegram-token">Токен бота</Label>
              <Input
                id="telegram-token"
                placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                value={telegramBotToken}
                onChange={(e) => setTelegramBotToken(e.target.value)}
                data-testid="input-telegram-token"
              />
              <p className="text-xs text-muted-foreground">
                Получите токен у @BotFather командой /newbot
              </p>
            </div>
          </div>
          <DialogFooter className="flex gap-2">
            <Button 
              onClick={() => telegramConnectMutation.mutate(telegramBotToken)}
              disabled={telegramConnectMutation.isPending || telegramBotToken.length < 40}
              data-testid="button-submit-telegram"
            >
              {telegramConnectMutation.isPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              Подключить
            </Button>
            <Button variant="ghost" onClick={() => setTelegramDialogOpen(false)}>
              Отмена
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={widgetDialogOpen} onOpenChange={setWidgetDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Код для встраивания виджета</DialogTitle>
            <DialogDescription>
              Скопируйте этот код и вставьте перед закрывающим тегом &lt;/body&gt; на вашем сайте
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="relative">
              <pre className="p-4 bg-muted rounded-lg text-sm overflow-x-auto whitespace-pre-wrap break-all">
                {embedCode}
              </pre>
              <Button
                variant="outline"
                size="sm"
                className="absolute top-2 right-2"
                onClick={copyEmbedCode}
                data-testid="button-copy-embed"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setWidgetDialogOpen(false)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
    </DashboardLayout>
  );
}
