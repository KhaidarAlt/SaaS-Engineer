import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AiPaywall } from "@/components/AiPaywall";
import { Plug, MessageCircle, Globe, Settings, ArrowLeft, Plus, Loader2, RefreshCw, Trash2, Play, Square, QrCode, Phone, CheckCircle, AlertCircle } from "lucide-react";
import { SiWhatsapp, SiTelegram } from "react-icons/si";
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

  if (!status?.hasAccess) {
    return <DashboardLayout><div className="p-6"><AiPaywall currentPlan={status?.planName} /></div></DashboardLayout>;
  }

  const otherIntegrations = [
    {
      id: "telegram",
      name: "Telegram",
      description: "Автоматизируйте общение через Telegram бота",
      icon: SiTelegram,
      status: "coming_soon" as const,
      color: "text-blue-500",
    },
    {
      id: "instagram",
      name: "Instagram Direct",
      description: "Отвечайте на сообщения в Instagram автоматически",
      icon: MessageCircle,
      status: "coming_soon" as const,
      color: "text-pink-600",
    },
    {
      id: "website",
      name: "Виджет на сайте",
      description: "Встройте чат-виджет на ваш сайт",
      icon: Globe,
      status: "coming_soon" as const,
      color: "text-primary",
    },
  ];

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {otherIntegrations.map((integration) => (
          <Card key={integration.id} data-testid={`card-integration-${integration.id}`}>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                    <integration.icon className={`h-6 w-6 ${integration.color}`} />
                  </div>
                  <CardTitle className="text-base">{integration.name}</CardTitle>
                </div>
                <Badge variant="secondary">Скоро</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <CardDescription className="mb-4">{integration.description}</CardDescription>
              <Button variant="secondary" className="w-full" disabled>
                Скоро будет доступно
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>

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
    </div>
    </DashboardLayout>
  );
}
