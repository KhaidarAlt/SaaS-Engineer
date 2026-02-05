import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation, useSearch } from "wouter";
import { motion } from "framer-motion";
import {
  ArrowLeft,
  Phone,
  MapPin,
  MessageCircle,
  Package,
  Calendar,
  User,
  BrainCircuit,
  Send,
  Copy,
  Clock,
  CheckCircle,
  XCircle,
  CreditCard,
  Loader2,
  Sparkles,
  Mail,
  Tag,
  FileText,
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { DashboardLayout } from "@/components/DashboardLayout";
import { PageLoader } from "@/components/LoadingSpinner";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Order, OrderItem } from "@shared/schema";

const dealStatusOptions = [
  { value: "new", label: "Новый", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "in_progress", label: "В работе", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  { value: "awaiting_payment", label: "Ожидает оплаты", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200" },
  { value: "paid", label: "Оплачен", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "completed", label: "Выполнен", color: "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200" },
  { value: "cancelled", label: "Отменён", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
];

const paymentStatusOptions = [
  { value: "pending", label: "Ожидает", icon: Clock, color: "text-yellow-600" },
  { value: "paid", label: "Оплачен", icon: CheckCircle, color: "text-green-600" },
  { value: "cancelled", label: "Отменён", icon: XCircle, color: "text-red-600" },
];

const messageTemplates = [
  { id: "payment_reminder", label: "Напоминание об оплате", icon: CreditCard },
  { id: "delivery_confirmation", label: "Уточнение доставки", icon: Package },
  { id: "cart_followup", label: "Дожим после корзины", icon: Tag },
  { id: "thank_you", label: "Благодарность", icon: CheckCircle },
];

interface OrderWithItems extends Order {
  items: OrderItem[];
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const searchParams = useSearch();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  
  const [aiDialogOpen, setAiDialogOpen] = useState(false);
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [generatedMessage, setGeneratedMessage] = useState("");
  const [aiAnalysis, setAiAnalysis] = useState("");
  
  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (params.get("ai") === "1") {
      setAiDialogOpen(true);
    }
  }, [searchParams]);

  const { data: order, isLoading, error } = useQuery<OrderWithItems>({
    queryKey: ["/api/orders", id],
    enabled: !!id,
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      return apiRequest("PATCH", `/api/orders/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/stats"] });
      toast({ title: "Статус сделки обновлён" });
    },
  });

  const updatePaymentMutation = useMutation({
    mutationFn: async (paymentStatus: string) => {
      return apiRequest("PATCH", `/api/orders/${id}`, { paymentStatus });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders", id] });
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/stats"] });
      toast({ title: "Статус оплаты обновлён" });
    },
  });

  const aiAnalyzeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", `/api/crm/deals/${id}/ai-analyze`);
      return res.json();
    },
    onSuccess: (data) => {
      setAiAnalysis(data.analysis);
    },
    onError: () => {
      toast({ title: "Ошибка AI анализа", variant: "destructive" });
    },
  });

  const generateMessageMutation = useMutation({
    mutationFn: async (template: string) => {
      const res = await apiRequest("POST", `/api/crm/deals/${id}/generate-message`, { template });
      return res.json();
    },
    onSuccess: (data) => {
      setGeneratedMessage(data.message);
    },
    onError: () => {
      toast({ title: "Ошибка генерации сообщения", variant: "destructive" });
    },
  });

  const formatPrice = (price: string | number) => {
    const value = typeof price === "string" ? parseFloat(price) : price;
    return new Intl.NumberFormat("ru-KZ").format(value) + " ₸";
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    const option = dealStatusOptions.find((s) => s.value === status);
    return option || { label: status, color: "bg-gray-100 text-gray-800" };
  };

  const getPaymentBadge = (paymentStatus: string | null | undefined) => {
    const option = paymentStatusOptions.find((s) => s.value === paymentStatus);
    return option || paymentStatusOptions[0];
  };

  const formatPhoneForWhatsApp = (phone: string) => {
    let digits = phone.replace(/\D/g, "");
    if (digits.startsWith("8") && digits.length === 11) {
      digits = "7" + digits.slice(1);
    }
    if (digits.length === 10) {
      digits = "7" + digits;
    }
    return digits;
  };

  const openWhatsAppWithMessage = (message: string) => {
    if (!order) return;
    const phone = formatPhoneForWhatsApp(order.customerPhone);
    const encodedMessage = encodeURIComponent(message);
    window.open(`https://wa.me/${phone}?text=${encodedMessage}`, "_blank");
  };

  const createWhatsAppLink = (order: Order) => {
    const phone = formatPhoneForWhatsApp(order.customerPhone);
    const message = encodeURIComponent(
      `Здравствуйте, ${order.customerName}!\n\n` +
      `Ваш заказ #${order.orderNumber} на сумму ${formatPrice(order.total)} принят.\n\n` +
      `Спасибо за заказ!`
    );
    return `https://wa.me/${phone}?text=${message}`;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: "Скопировано!" });
  };

  if (isLoading) {
    return (
      <DashboardLayout>
        <PageLoader />
      </DashboardLayout>
    );
  }

  if (error || !order) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center h-64">
          <Package className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <h2 className="text-xl font-semibold mb-2">Сделка не найдена</h2>
          <p className="text-muted-foreground mb-4">
            Возможно, сделка была удалена или у вас нет доступа
          </p>
          <Button onClick={() => navigate("/dashboard/crm")} data-testid="button-back-crm">
            Вернуться в CRM
          </Button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/dashboard/crm")}
            data-testid="button-back"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-2xl font-bold tracking-tight">
              Сделка #{order.orderNumber}
            </h1>
            <p className="text-muted-foreground">
              {formatDate(order.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => {
                setAiDialogOpen(true);
                if (!aiAnalysis) {
                  aiAnalyzeMutation.mutate();
                }
              }}
              data-testid="button-ai-analyze"
            >
              <BrainCircuit className="h-4 w-4 text-purple-600" />
              Спросить ИИ
            </Button>
            <Button
              className="gap-2 bg-green-600 hover:bg-green-700"
              onClick={() => window.open(createWhatsAppLink(order), "_blank")}
              data-testid="button-whatsapp"
            >
              <SiWhatsapp className="h-4 w-4" />
              Написать клиенту
            </Button>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="lg:col-span-2 space-y-6"
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Товары
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {order.items && order.items.length > 0 ? (
                    order.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between py-3 border-b last:border-0"
                      >
                        <div className="flex-1">
                          <p className="font-medium">{item.productName}</p>
                          <p className="text-sm text-muted-foreground">
                            {formatPrice(item.unitPrice)} × {item.quantity} шт.
                          </p>
                        </div>
                        <p className="font-semibold">{formatPrice(item.total)}</p>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted-foreground text-center py-4">
                      Детали товаров недоступны
                    </p>
                  )}
                </div>

                <div className="border-t mt-4 pt-4 space-y-2">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Сумма товаров</span>
                    <span>{formatPrice(order.subtotal)}</span>
                  </div>
                  {parseFloat(order.discountTotal) > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>Скидка</span>
                      <span>-{formatPrice(order.discountTotal)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-bold pt-2 border-t">
                    <span>Итого</span>
                    <span>{formatPrice(order.total)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Сгенерировать сообщение
                </CardTitle>
                <CardDescription>
                  Выберите шаблон для генерации персонального сообщения клиенту
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-2">
                  {messageTemplates.map((template) => (
                    <Button
                      key={template.id}
                      variant="outline"
                      className="justify-start gap-2 h-auto py-3"
                      onClick={() => {
                        generateMessageMutation.mutate(template.id);
                        setMessageDialogOpen(true);
                      }}
                      disabled={generateMessageMutation.isPending}
                      data-testid={`template-${template.id}`}
                    >
                      <template.icon className="h-4 w-4" />
                      <span className="text-sm">{template.label}</span>
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>

            {order.comment && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <MessageCircle className="h-5 w-5" />
                    Комментарий клиента
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-muted-foreground">{order.comment}</p>
                </CardContent>
              </Card>
            )}
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="space-y-6"
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <User className="h-5 w-5" />
                  Клиент
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="font-medium text-lg">{order.customerName}</p>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <a
                    href={`tel:${order.customerPhone}`}
                    className="hover:underline"
                  >
                    {order.customerPhone}
                  </a>
                </div>
                {order.customerEmail && (
                  <div className="flex items-center gap-2 text-sm">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <a
                      href={`mailto:${order.customerEmail}`}
                      className="hover:underline"
                    >
                      {order.customerEmail}
                    </a>
                  </div>
                )}
                {order.deliveryAddress && (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                    <span>{order.deliveryAddress}</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Статус сделки
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-2">
                  <Badge className={getStatusBadge(order.status).color}>
                    {getStatusBadge(order.status).label}
                  </Badge>
                </div>
                <Select
                  value={order.status}
                  onValueChange={(status) => updateStatusMutation.mutate(status)}
                >
                  <SelectTrigger data-testid="select-deal-status">
                    <SelectValue placeholder="Изменить статус" />
                  </SelectTrigger>
                  <SelectContent>
                    {dealStatusOptions.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        <Badge className={status.color}>{status.label}</Badge>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Статус оплаты
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {(() => {
                  const badge = getPaymentBadge(order.paymentStatus);
                  const Icon = badge.icon;
                  return (
                    <div className={`flex items-center gap-2 ${badge.color}`}>
                      <Icon className="h-5 w-5" />
                      <span className="font-medium">{badge.label}</span>
                    </div>
                  );
                })()}
                <Select
                  value={order.paymentStatus || "pending"}
                  onValueChange={(paymentStatus) => updatePaymentMutation.mutate(paymentStatus)}
                >
                  <SelectTrigger data-testid="select-payment-status">
                    <SelectValue placeholder="Изменить оплату" />
                  </SelectTrigger>
                  <SelectContent>
                    {paymentStatusOptions.map((ps) => (
                      <SelectItem key={ps.value} value={ps.value}>
                        <div className={`flex items-center gap-2 ${ps.color}`}>
                          <ps.icon className="h-4 w-4" />
                          <span>{ps.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      <Dialog open={aiDialogOpen} onOpenChange={setAiDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <BrainCircuit className="h-5 w-5 text-purple-600" />
              AI-анализ сделки #{order.orderNumber}
            </DialogTitle>
            <DialogDescription>
              Искусственный интеллект проанализирует сделку и даст рекомендации
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {aiAnalyzeMutation.isPending ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600 mb-4" />
                <p className="text-muted-foreground">Анализируем сделку...</p>
              </div>
            ) : aiAnalysis ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <div className="whitespace-pre-wrap bg-muted/50 p-4 rounded-lg">
                  {aiAnalysis}
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <BrainCircuit className="h-12 w-12 text-muted-foreground/50 mx-auto mb-4" />
                <p className="text-muted-foreground">Нажмите кнопку для запуска анализа</p>
              </div>
            )}
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => aiAnalyzeMutation.mutate()}
              disabled={aiAnalyzeMutation.isPending}
            >
              {aiAnalyzeMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Обновить анализ
            </Button>
            <Button variant="ghost" onClick={() => setAiDialogOpen(false)}>
              Закрыть
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageCircle className="h-5 w-5" />
              Сгенерированное сообщение
            </DialogTitle>
            <DialogDescription>
              Отредактируйте текст при необходимости и отправьте клиенту
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            {generateMessageMutation.isPending ? (
              <div className="flex flex-col items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
                <p className="text-muted-foreground">Генерируем сообщение...</p>
              </div>
            ) : (
              <Textarea
                value={generatedMessage}
                onChange={(e) => setGeneratedMessage(e.target.value)}
                className="min-h-[150px]"
                placeholder="Сообщение появится здесь..."
                data-testid="textarea-message"
              />
            )}
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => copyToClipboard(generatedMessage)}
              disabled={!generatedMessage}
            >
              <Copy className="h-4 w-4 mr-2" />
              Копировать
            </Button>
            <Button
              className="gap-2 bg-green-600 hover:bg-green-700"
              onClick={() => {
                openWhatsAppWithMessage(generatedMessage);
                setMessageDialogOpen(false);
              }}
              disabled={!generatedMessage}
            >
              <SiWhatsapp className="h-4 w-4" />
              Отправить в WhatsApp
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
