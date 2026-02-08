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
  ExternalLink,
  Loader2,
  LinkIcon,
  Eye,
  ThumbsUp,
  ThumbsDown,
  ImageIcon,
  ShieldCheck,
  ShieldAlert,
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DashboardLayout } from "@/components/DashboardLayout";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { KaspiIntegration, Payment } from "@shared/schema";

const paymentStatusConfig = {
  pending: { label: "Ожидает оплаты", icon: Clock, color: "text-yellow-600", bgColor: "bg-yellow-100" },
  paid: { label: "Оплачен", icon: CheckCircle, color: "text-green-600", bgColor: "bg-green-100" },
  failed: { label: "Отклонён", icon: XCircle, color: "text-red-600", bgColor: "bg-red-100" },
  expired: { label: "Просрочен", icon: AlertCircle, color: "text-muted-foreground", bgColor: "bg-muted" },
  cancelled: { label: "Отменён", icon: XCircle, color: "text-muted-foreground", bgColor: "bg-muted" },
};

export default function PaymentsPage() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [kaspiPayLink, setKaspiPayLink] = useState("");
  const [selectedPayment, setSelectedPayment] = useState<Payment | null>(null);
  const [receiptDialogOpen, setReceiptDialogOpen] = useState(false);

  const { data: kaspiIntegration, isLoading: kaspiLoading } = useQuery<KaspiIntegration | null>({
    queryKey: ["/api/kaspi/integration"],
  });

  const { data: payments, isLoading: paymentsLoading } = useQuery<Payment[]>({
    queryKey: ["/api/payments"],
  });

  const connectMutation = useMutation({
    mutationFn: async (link: string) => {
      const res = await apiRequest("POST", "/api/kaspi/connect", { kaspiPayLink: link });
      return res.json() as Promise<{ success: boolean; message?: string }>;
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/kaspi/integration"] });
        toast({ title: "Kaspi Pay подключен" });
        setKaspiPayLink("");
      } else {
        toast({ title: data.message || "Ошибка подключения", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Ошибка подключения", variant: "destructive" });
    },
  });

  const disconnectMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/kaspi/disconnect", {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/kaspi/integration"] });
      toast({ title: "Kaspi Pay отключен" });
    },
  });

  const confirmPaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const res = await apiRequest("POST", `/api/payments/${paymentId}/confirm`, {});
      return res.json() as Promise<{ success: boolean; message?: string }>;
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
        toast({ title: "Оплата подтверждена" });
        setSelectedPayment(null);
        setReceiptDialogOpen(false);
      } else {
        toast({ title: data.message || "Ошибка", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Ошибка подтверждения", variant: "destructive" });
    },
  });

  const rejectPaymentMutation = useMutation({
    mutationFn: async (paymentId: string) => {
      const res = await apiRequest("POST", `/api/payments/${paymentId}/reject`, {
        reason: "Оплата отклонена менеджером",
      });
      return res.json() as Promise<{ success: boolean; message?: string }>;
    },
    onSuccess: (data) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
        toast({ title: "Оплата отклонена" });
        setSelectedPayment(null);
        setReceiptDialogOpen(false);
      } else {
        toast({ title: data.message || "Ошибка", variant: "destructive" });
      }
    },
    onError: () => {
      toast({ title: "Ошибка отклонения", variant: "destructive" });
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
    return new Intl.NumberFormat("ru-KZ").format(num) + " \u20B8";
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

  const isConnected = kaspiIntegration?.status === "connected" && kaspiIntegration?.kaspiPayLink;

  const aiVerification = (payment: Payment) => {
    const data = payment.aiVerificationData as Record<string, unknown> | null;
    if (!data) return null;
    return {
      verified: data.verified as boolean,
      confidence: data.confidence as number,
      extractedAmount: data.extractedAmount as number | undefined,
      details: data.details as string,
      warnings: (data.warnings as string[]) || [],
    };
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-page-title">Платежи</h1>
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
                <CardTitle className="flex items-center justify-between gap-4 flex-wrap">
                  <span>Kaspi Pay</span>
                  <Badge className={isConnected
                    ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 border-0"
                    : "bg-muted text-muted-foreground border-0"
                  }>
                    {isConnected ? (
                      <><CheckCircle className="h-3.5 w-3.5 mr-1" /> Подключено</>
                    ) : (
                      <><XCircle className="h-3.5 w-3.5 mr-1" /> Не подключено</>
                    )}
                  </Badge>
                </CardTitle>
                <CardDescription>
                  Вставьте вашу персональную ссылку Kaspi Pay для приёма платежей
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {isConnected ? (
                  <div className="space-y-4">
                    <div className="flex items-center gap-4 p-4 rounded-md bg-green-50 dark:bg-green-900/20">
                      <CheckCircle className="h-8 w-8 text-green-600 shrink-0" />
                      <div className="min-w-0">
                        <p className="font-medium">Kaspi Pay подключен</p>
                        <p className="text-sm text-muted-foreground truncate" data-testid="text-kaspi-link">
                          {kaspiIntegration?.kaspiPayLink}
                        </p>
                        {kaspiIntegration?.verifiedAt && (
                          <p className="text-xs text-muted-foreground mt-1">
                            Подключено: {formatDate(kaspiIntegration.verifiedAt)}
                          </p>
                        )}
                      </div>
                    </div>

                    <div className="p-4 rounded-md bg-muted/50 space-y-2">
                      <p className="text-sm font-medium">Как это работает:</p>
                      <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                        <li>ИИ отправляет клиенту ссылку для оплаты с суммой заказа</li>
                        <li>Клиент оплачивает по ссылке в приложении Kaspi</li>
                        <li>ИИ просит клиента отправить скриншот чека</li>
                        <li>ИИ проверяет чек и уведомляет менеджера</li>
                        <li>Менеджер подтверждает оплату</li>
                        <li>Статус меняется на "Оплачен" во всех системах</li>
                      </ol>
                    </div>

                    <Button
                      variant="destructive"
                      onClick={() => disconnectMutation.mutate()}
                      disabled={disconnectMutation.isPending}
                      data-testid="button-disconnect"
                    >
                      {disconnectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Отключить
                    </Button>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="p-4 rounded-md bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                      <h4 className="font-medium flex items-center gap-2 mb-3">
                        <LinkIcon className="h-5 w-5 text-blue-600" />
                        Как получить ссылку Kaspi Pay
                      </h4>
                      <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
                        <li>Откройте приложение <strong>Kaspi Business</strong> на телефоне</li>
                        <li>Найдите раздел <strong>Kaspi Pay</strong> или <strong>Оплата по ссылке</strong></li>
                        <li>Скопируйте вашу индивидуальную ссылку для оплаты</li>
                        <li>Вставьте ссылку в поле ниже</li>
                      </ol>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="kaspiPayLink">Ссылка Kaspi Pay</Label>
                      <Input
                        id="kaspiPayLink"
                        placeholder="https://pay.kaspi.kz/pay/ваш_код"
                        value={kaspiPayLink}
                        onChange={(e) => setKaspiPayLink(e.target.value.trim())}
                        data-testid="input-kaspi-pay-link"
                      />
                      <p className="text-xs text-muted-foreground">
                        Формат: https://pay.kaspi.kz/pay/XXXX
                      </p>
                    </div>

                    <Button
                      onClick={() => connectMutation.mutate(kaspiPayLink)}
                      disabled={!kaspiPayLink || connectMutation.isPending}
                      data-testid="button-connect-kaspi"
                    >
                      {connectMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Подключить Kaspi Pay
                    </Button>
                  </div>
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
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="space-y-0.5">
                    <Label>Автоматически формировать счёт</Label>
                    <p className="text-sm text-muted-foreground">
                      Создавать запрос на оплату после оформления заказа
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

                <div className="flex items-center justify-between gap-4 flex-wrap">
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

                <div className="flex items-center justify-between gap-4 flex-wrap">
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
                  <h4 className="font-medium">Действия после подтверждения оплаты</h4>

                  <div className="flex items-center justify-between gap-4 flex-wrap">
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

                  <div className="flex items-center justify-between gap-4 flex-wrap">
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

                  <div className="flex items-center justify-between gap-4 flex-wrap">
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
                <div className="flex items-center justify-between gap-4 flex-wrap">
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
                      <SelectItem value="failed">Отклонён</SelectItem>
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
                        <TableHead>Чек</TableHead>
                        <TableHead>Дата</TableHead>
                        <TableHead className="w-28">Действия</TableHead>
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
                        filteredPayments.map((payment, index) => {
                          const ai = aiVerification(payment);
                          return (
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
                                {payment.receiptImageUrl ? (
                                  <div className="flex items-center gap-1">
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => {
                                        setSelectedPayment(payment);
                                        setReceiptDialogOpen(true);
                                      }}
                                      data-testid={`button-view-receipt-${payment.id}`}
                                    >
                                      <Eye className="h-4 w-4" />
                                    </Button>
                                    {ai && (
                                      ai.verified ? (
                                        <ShieldCheck className="h-4 w-4 text-green-600" />
                                      ) : (
                                        <ShieldAlert className="h-4 w-4 text-yellow-600" />
                                      )
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-sm text-muted-foreground">---</span>
                                )}
                              </TableCell>
                              <TableCell className="text-muted-foreground">
                                {formatDate(payment.createdAt)}
                              </TableCell>
                              <TableCell>
                                <div className="flex items-center gap-1">
                                  {payment.status === "pending" && (
                                    <>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => confirmPaymentMutation.mutate(payment.id)}
                                        disabled={confirmPaymentMutation.isPending}
                                        title="Подтвердить оплату"
                                        data-testid={`button-confirm-${payment.id}`}
                                      >
                                        <ThumbsUp className="h-4 w-4 text-green-600" />
                                      </Button>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => rejectPaymentMutation.mutate(payment.id)}
                                        disabled={rejectPaymentMutation.isPending}
                                        title="Отклонить оплату"
                                        data-testid={`button-reject-${payment.id}`}
                                      >
                                        <ThumbsDown className="h-4 w-4 text-red-600" />
                                      </Button>
                                    </>
                                  )}
                                  {payment.paymentUrl && payment.status === "pending" && (
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      onClick={() => window.open(payment.paymentUrl!, "_blank")}
                                      title="Открыть ссылку оплаты"
                                      data-testid={`link-payment-${payment.id}`}
                                    >
                                      <ExternalLink className="h-4 w-4" />
                                    </Button>
                                  )}
                                </div>
                              </TableCell>
                            </motion.tr>
                          );
                        })
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

      <Dialog open={receiptDialogOpen} onOpenChange={setReceiptDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Чек оплаты</DialogTitle>
            <DialogDescription>
              Проверьте чек и подтвердите или отклоните оплату
            </DialogDescription>
          </DialogHeader>
          {selectedPayment && (
            <div className="space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <p className="text-sm text-muted-foreground">Сумма</p>
                  <p className="text-lg font-bold">{formatPrice(selectedPayment.amount)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Клиент</p>
                  <p className="font-medium">{selectedPayment.customerName}</p>
                </div>
              </div>

              {selectedPayment.receiptImageUrl && (
                <div className="border rounded-md overflow-hidden">
                  <img
                    src={selectedPayment.receiptImageUrl}
                    alt="Чек оплаты"
                    className="w-full max-h-96 object-contain bg-muted"
                    data-testid="img-receipt"
                  />
                </div>
              )}

              {(() => {
                const ai = aiVerification(selectedPayment);
                if (!ai) return null;
                return (
                  <div className={`p-3 rounded-md ${ai.verified ? "bg-green-50 dark:bg-green-900/20" : "bg-yellow-50 dark:bg-yellow-900/20"}`}>
                    <div className="flex items-center gap-2 mb-1">
                      {ai.verified ? (
                        <ShieldCheck className="h-5 w-5 text-green-600" />
                      ) : (
                        <ShieldAlert className="h-5 w-5 text-yellow-600" />
                      )}
                      <span className="font-medium text-sm">
                        {ai.verified ? "AI: Чек подтверждён" : "AI: Требует проверки"}
                      </span>
                      <Badge variant="secondary" className="ml-auto">
                        {Math.round(ai.confidence * 100)}%
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">{ai.details}</p>
                    {ai.extractedAmount !== undefined && (
                      <p className="text-sm mt-1">
                        Сумма на чеке: <span className="font-medium">{formatPrice(ai.extractedAmount)}</span>
                      </p>
                    )}
                    {ai.warnings.length > 0 && (
                      <div className="mt-2 space-y-1">
                        {ai.warnings.map((w, i) => (
                          <p key={i} className="text-xs text-yellow-700 dark:text-yellow-400">{w}</p>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })()}

              {selectedPayment.status === "pending" && (
                <div className="flex gap-2 pt-2">
                  <Button
                    className="flex-1"
                    onClick={() => confirmPaymentMutation.mutate(selectedPayment.id)}
                    disabled={confirmPaymentMutation.isPending}
                    data-testid="button-dialog-confirm"
                  >
                    {confirmPaymentMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <ThumbsUp className="h-4 w-4 mr-2" />
                    Подтвердить оплату
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => rejectPaymentMutation.mutate(selectedPayment.id)}
                    disabled={rejectPaymentMutation.isPending}
                    data-testid="button-dialog-reject"
                  >
                    {rejectPaymentMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <ThumbsDown className="h-4 w-4 mr-2" />
                    Отклонить
                  </Button>
                </div>
              )}

              {selectedPayment.status === "paid" && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-green-50 dark:bg-green-900/20">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-medium text-green-700 dark:text-green-400">Оплата подтверждена</span>
                  {selectedPayment.confirmedAt && (
                    <span className="text-sm text-muted-foreground ml-auto">
                      {formatDate(selectedPayment.confirmedAt)}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
