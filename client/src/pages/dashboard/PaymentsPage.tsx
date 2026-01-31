import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  CreditCard,
  Settings,
  History,
  CheckCircle,
  XCircle,
  Clock,
  AlertCircle,
  RefreshCw,
  Link as LinkIcon,
  ExternalLink,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { KaspiIntegration, Payment } from "@shared/schema";

const paymentStatusConfig = {
  pending: { label: "Ожидает оплаты", icon: Clock, color: "text-yellow-600", bgColor: "bg-yellow-100" },
  paid: { label: "Оплачен", icon: CheckCircle, color: "text-green-600", bgColor: "bg-green-100" },
  failed: { label: "Ошибка", icon: XCircle, color: "text-red-600", bgColor: "bg-red-100" },
  expired: { label: "Просрочен", icon: AlertCircle, color: "text-muted-foreground", bgColor: "bg-muted" },
  cancelled: { label: "Отменён", icon: XCircle, color: "text-muted-foreground", bgColor: "bg-muted" },
};

export default function PaymentsPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const [kaspiForm, setKaspiForm] = useState({
    merchantId: "",
    apiToken: "",
    webhookSecret: "",
  });

  const { data: kaspiIntegration, isLoading: kaspiLoading } = useQuery<KaspiIntegration | null>({
    queryKey: ["/api/kaspi/integration"],
  });

  const { data: payments, isLoading: paymentsLoading } = useQuery<Payment[]>({
    queryKey: ["/api/payments"],
  });

  const saveKaspiMutation = useMutation({
    mutationFn: async (data: typeof kaspiForm) => {
      return apiRequest("POST", "/api/kaspi/integration", data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kaspi/integration"] });
      toast({ title: "Kaspi подключен" });
    },
    onError: () => {
      toast({ title: "Ошибка подключения", variant: "destructive" });
    },
  });

  const testKaspiMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/kaspi/test", {});
      return res.json() as Promise<{ success: boolean; message: string }>;
    },
    onSuccess: (data) => {
      if (data.success) {
        toast({ title: "Подключение успешно" });
      } else {
        toast({ title: data.message || "Ошибка подключения", variant: "destructive" });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/kaspi/integration"] });
    },
  });

  const disconnectKaspiMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("DELETE", "/api/kaspi/integration", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kaspi/integration"] });
      toast({ title: "Kaspi отключен" });
    },
  });

  const updateSettingsMutation = useMutation({
    mutationFn: async (settings: Partial<KaspiIntegration>) => {
      return apiRequest("PATCH", "/api/kaspi/settings", settings);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kaspi/integration"] });
      toast({ title: "Настройки сохранены" });
    },
  });

  const filteredPayments = payments?.filter((payment) => {
    if (statusFilter === "all") return true;
    return payment.status === statusFilter;
  });

  const formatPrice = (price: string | number) => {
    const num = typeof price === "string" ? parseFloat(price) : price;
    return new Intl.NumberFormat("ru-KZ").format(num) + " ₸";
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    const config = paymentStatusConfig[status as keyof typeof paymentStatusConfig] || paymentStatusConfig.pending;
    const Icon = config.icon;
    return (
      <div className={`flex items-center gap-1.5 ${config.color}`}>
        <Icon className="h-4 w-4" />
        <span className="text-sm font-medium">{config.label}</span>
      </div>
    );
  };

  const getConnectionStatus = () => {
    if (!kaspiIntegration) {
      return { label: "Не подключено", color: "text-red-600", bg: "bg-red-100", icon: XCircle };
    }
    if (kaspiIntegration.status === "connected") {
      return { label: "Подключено", color: "text-green-600", bg: "bg-green-100", icon: CheckCircle };
    }
    if (kaspiIntegration.status === "error") {
      return { label: "Требуется переподключение", color: "text-yellow-600", bg: "bg-yellow-100", icon: AlertCircle };
    }
    return { label: "Не подключено", color: "text-red-600", bg: "bg-red-100", icon: XCircle };
  };

  const connectionStatus = getConnectionStatus();

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Платежи</h1>
          <p className="text-muted-foreground">Управляйте платежами и интеграцией с Kaspi</p>
        </div>

        <Tabs defaultValue="connection" className="space-y-4">
          <TabsList>
            <TabsTrigger value="connection" className="gap-2" data-testid="tab-connection">
              <CreditCard className="h-4 w-4" />
              Подключение
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2" data-testid="tab-settings">
              <Settings className="h-4 w-4" />
              Настройки
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2" data-testid="tab-history">
              <History className="h-4 w-4" />
              История
            </TabsTrigger>
          </TabsList>

          <TabsContent value="connection" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Kaspi Business</span>
                  <Badge className={`${connectionStatus.bg} ${connectionStatus.color} border-0`}>
                    <connectionStatus.icon className="h-3.5 w-3.5 mr-1" />
                    {connectionStatus.label}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Подключите ваш аккаунт Kaspi Business для приёма платежей
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {kaspiIntegration?.status === "connected" ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 p-4 rounded-lg bg-green-50 dark:bg-green-900/20">
                      <CheckCircle className="h-8 w-8 text-green-600" />
                      <div>
                        <p className="font-medium">Kaspi подключен</p>
                        <p className="text-sm text-muted-foreground">
                          Merchant ID: {kaspiIntegration.merchantId}
                        </p>
                        {kaspiIntegration.lastCheckedAt && (
                          <p className="text-xs text-muted-foreground">
                            Последняя проверка: {formatDate(kaspiIntegration.lastCheckedAt)}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {kaspiIntegration.lastError && (
                      <div className="flex items-center gap-4 p-4 rounded-lg bg-yellow-50 dark:bg-yellow-900/20">
                        <AlertCircle className="h-6 w-6 text-yellow-600" />
                        <div>
                          <p className="font-medium text-yellow-700">Ошибка</p>
                          <p className="text-sm text-muted-foreground">{kaspiIntegration.lastError}</p>
                        </div>
                      </div>
                    )}

                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        onClick={() => testKaspiMutation.mutate()}
                        disabled={testKaspiMutation.isPending}
                        data-testid="button-test-connection"
                      >
                        {testKaspiMutation.isPending ? (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        ) : (
                          <RefreshCw className="h-4 w-4 mr-2" />
                        )}
                        Проверить соединение
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => disconnectKaspiMutation.mutate()}
                        disabled={disconnectKaspiMutation.isPending}
                        data-testid="button-disconnect"
                      >
                        Отключить
                      </Button>
                    </div>
                  </div>
                ) : (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      saveKaspiMutation.mutate(kaspiForm);
                    }}
                    className="space-y-4"
                  >
                    <div className="grid gap-4 sm:grid-cols-2">
                      <div className="space-y-2">
                        <Label htmlFor="merchantId">Merchant ID</Label>
                        <Input
                          id="merchantId"
                          placeholder="Ваш Merchant ID"
                          value={kaspiForm.merchantId}
                          onChange={(e) => setKaspiForm({ ...kaspiForm, merchantId: e.target.value })}
                          required
                          data-testid="input-merchant-id"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="apiToken">API Token</Label>
                        <Input
                          id="apiToken"
                          type="password"
                          placeholder="API ключ"
                          value={kaspiForm.apiToken}
                          onChange={(e) => setKaspiForm({ ...kaspiForm, apiToken: e.target.value })}
                          required
                          data-testid="input-api-token"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="webhookSecret">Webhook Secret (опционально)</Label>
                      <Input
                        id="webhookSecret"
                        type="password"
                        placeholder="Секретный ключ для вебхуков"
                        value={kaspiForm.webhookSecret}
                        onChange={(e) => setKaspiForm({ ...kaspiForm, webhookSecret: e.target.value })}
                        data-testid="input-webhook-secret"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={saveKaspiMutation.isPending}
                      data-testid="button-connect-kaspi"
                    >
                      {saveKaspiMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Подключить Kaspi
                    </Button>
                  </form>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Настройки платежей</CardTitle>
                <CardDescription>
                  Настройте автоматическое формирование счетов и уведомления
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Автоматически формировать счёт</Label>
                    <p className="text-sm text-muted-foreground">
                      Создавать счёт на оплату после оформления заказа
                    </p>
                  </div>
                  <Switch
                    checked={kaspiIntegration?.autoGenerateInvoice ?? true}
                    onCheckedChange={(checked) => 
                      updateSettingsMutation.mutate({ autoGenerateInvoice: checked })
                    }
                    disabled={!kaspiIntegration}
                    data-testid="switch-auto-invoice"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Таймаут оплаты (минуты)</Label>
                    <p className="text-sm text-muted-foreground">
                      Время, в течение которого клиент может оплатить
                    </p>
                  </div>
                  <Select
                    value={String(kaspiIntegration?.paymentTimeout ?? 30)}
                    onValueChange={(value) => 
                      updateSettingsMutation.mutate({ paymentTimeout: parseInt(value) })
                    }
                    disabled={!kaspiIntegration}
                  >
                    <SelectTrigger className="w-24" data-testid="select-timeout">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="15">15</SelectItem>
                      <SelectItem value="30">30</SelectItem>
                      <SelectItem value="60">60</SelectItem>
                      <SelectItem value="120">120</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Напоминание клиенту</Label>
                    <p className="text-sm text-muted-foreground">
                      Отправлять напоминание об оплате
                    </p>
                  </div>
                  <Switch
                    checked={kaspiIntegration?.sendReminder ?? true}
                    onCheckedChange={(checked) => 
                      updateSettingsMutation.mutate({ sendReminder: checked })
                    }
                    disabled={!kaspiIntegration}
                    data-testid="switch-reminder"
                  />
                </div>

                <div className="border-t pt-6 space-y-4">
                  <h4 className="font-medium">Действия после оплаты</h4>
                  
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Перевести заказ в "Оплачен"</Label>
                      <p className="text-sm text-muted-foreground">
                        Автоматически обновлять статус заказа
                      </p>
                    </div>
                    <Switch
                      checked={kaspiIntegration?.updateOrderStatus ?? true}
                      onCheckedChange={(checked) => 
                        updateSettingsMutation.mutate({ updateOrderStatus: checked })
                      }
                      disabled={!kaspiIntegration}
                      data-testid="switch-update-status"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Уведомить менеджера</Label>
                      <p className="text-sm text-muted-foreground">
                        Отправить уведомление в Telegram
                      </p>
                    </div>
                    <Switch
                      checked={kaspiIntegration?.notifyManager ?? true}
                      onCheckedChange={(checked) => 
                        updateSettingsMutation.mutate({ notifyManager: checked })
                      }
                      disabled={!kaspiIntegration}
                      data-testid="switch-notify-manager"
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label>Синхронизировать с CRM</Label>
                      <p className="text-sm text-muted-foreground">
                        Обновить статус сделки в Bitrix24/amoCRM
                      </p>
                    </div>
                    <Switch
                      checked={kaspiIntegration?.syncWithCrm ?? true}
                      onCheckedChange={(checked) => 
                        updateSettingsMutation.mutate({ syncWithCrm: checked })
                      }
                      disabled={!kaspiIntegration}
                      data-testid="switch-sync-crm"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="history" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle>История платежей</CardTitle>
                    <CardDescription>
                      Все платежи вашего магазина
                    </CardDescription>
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-48" data-testid="select-payment-status">
                      <SelectValue placeholder="Все статусы" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Все статусы</SelectItem>
                      <SelectItem value="pending">Ожидает оплаты</SelectItem>
                      <SelectItem value="paid">Оплачен</SelectItem>
                      <SelectItem value="failed">Ошибка</SelectItem>
                      <SelectItem value="expired">Просрочен</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Заказ</TableHead>
                        <TableHead>Клиент</TableHead>
                        <TableHead>Сумма</TableHead>
                        <TableHead>Статус</TableHead>
                        <TableHead>Источник</TableHead>
                        <TableHead>Дата</TableHead>
                        <TableHead className="w-16"></TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paymentsLoading ? (
                        [...Array(5)].map((_, i) => (
                          <TableRow key={i}>
                            <TableCell colSpan={7}>
                              <div className="h-10 bg-muted animate-pulse rounded" />
                            </TableCell>
                          </TableRow>
                        ))
                      ) : filteredPayments && filteredPayments.length > 0 ? (
                        filteredPayments.map((payment, index) => (
                          <motion.tr
                            key={payment.id}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: index * 0.03 }}
                          >
                            <TableCell>
                              <button
                                onClick={() => navigate(`/dashboard/orders/${payment.orderId}`)}
                                className="text-primary hover:underline font-medium"
                                data-testid={`link-order-${payment.orderId}`}
                              >
                                Заказ
                              </button>
                            </TableCell>
                            <TableCell>
                              <div>
                                <p className="font-medium">{payment.customerName}</p>
                                <p className="text-sm text-muted-foreground">{payment.customerPhone}</p>
                              </div>
                            </TableCell>
                            <TableCell className="font-medium">
                              {formatPrice(payment.amount)}
                            </TableCell>
                            <TableCell>
                              {getStatusBadge(payment.status)}
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {payment.source === "auto" ? "Автоматически" : "Вручную"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {formatDate(payment.createdAt)}
                            </TableCell>
                            <TableCell>
                              {payment.paymentUrl && payment.status === "pending" && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => window.open(payment.paymentUrl!, "_blank")}
                                  data-testid={`link-payment-${payment.id}`}
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          </motion.tr>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={7} className="h-48">
                            <div className="flex flex-col items-center justify-center text-center">
                              <CreditCard className="h-12 w-12 text-muted-foreground/50 mb-3" />
                              <p className="font-medium">Нет платежей</p>
                              <p className="text-sm text-muted-foreground">
                                Платежи появятся здесь после оформления заказов
                              </p>
                            </div>
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
