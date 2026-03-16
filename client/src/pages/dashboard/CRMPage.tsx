import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import {
  Search,
  Users,
  Eye,
  CreditCard,
  Clock,
  CheckCircle,
  XCircle,
  LayoutGrid,
  List,
  Filter,
  BrainCircuit,
  MessageSquare,
  Tag,
  AlertCircle,
  ArrowRight,
  Lightbulb,
  Package,
  Calendar,
  ChevronDown,
  Percent,
  Wallet,
  Banknote,
  UserPlus,
  UserX,
  UserCheck,
  Phone,
} from "lucide-react";
import { SiWhatsapp } from "react-icons/si";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DashboardLayout } from "@/components/DashboardLayout";
import { TableRowSkeleton } from "@/components/LoadingSpinner";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Order, CrmLead } from "@shared/schema";

const leadStatusOptions = [
  { value: "new", label: "Новый", icon: UserPlus, color: "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200", bgColor: "bg-slate-50 dark:bg-slate-950/30" },
  { value: "unqualified", label: "Не квалифицирован", icon: UserX, color: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300", bgColor: "bg-gray-50 dark:bg-gray-950/30" },
  { value: "qualified", label: "Квалифицирован", icon: UserCheck, color: "bg-violet-100 text-violet-800 dark:bg-violet-900 dark:text-violet-200", bgColor: "bg-violet-50 dark:bg-violet-950/30" },
];

const dealStatusOptions = [
  { value: "new", label: "Новый", color: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200", bgColor: "bg-blue-50 dark:bg-blue-950/30" },
  { value: "confirmed", label: "Подтверждён", color: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200", bgColor: "bg-cyan-50 dark:bg-cyan-950/30" },
  { value: "assembling", label: "Сборка", color: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200", bgColor: "bg-yellow-50 dark:bg-yellow-950/30" },
  { value: "delivering", label: "Доставка", color: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200", bgColor: "bg-orange-50 dark:bg-orange-950/30" },
  { value: "completed", label: "Выполнен", color: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200", bgColor: "bg-green-50 dark:bg-green-950/30" },
  { value: "cancelled", label: "Отменён", color: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200", bgColor: "bg-red-50 dark:bg-red-950/30" },
];

const paymentStatusOptions = [
  { value: "pending", label: "Ожидает оплаты", icon: Clock, color: "text-yellow-600", badgeColor: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200" },
  { value: "prepayment", label: "Предоплата", icon: Percent, color: "text-amber-600", badgeColor: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  { value: "paid", label: "Оплачено", icon: CheckCircle, color: "text-green-600", badgeColor: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" },
  { value: "installment", label: "Рассрочка", icon: Wallet, color: "text-teal-600", badgeColor: "bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200" },
  { value: "credit", label: "Кредит", icon: Banknote, color: "text-blue-600", badgeColor: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200" },
  { value: "kaspi_red", label: "Kaspi RED", icon: CreditCard, color: "text-red-600", badgeColor: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200" },
];

type ViewMode = "table" | "kanban";

export default function CRMPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [paymentFilter, setPaymentFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [syncTriggered, setSyncTriggered] = useState(false);

  const { data: orders, isLoading } = useQuery<Order[]>({
    queryKey: ["/api/orders"],
  });

  const { data: leads, isLoading: leadsLoading } = useQuery<CrmLead[]>({
    queryKey: ["/api/crm/leads"],
  });

  const { data: stats } = useQuery<{
    total: number;
    new: number;
    inProgress: number;
    awaitingPayment: number;
    paid: number;
    completed: number;
  }>({
    queryKey: ["/api/crm/stats"],
  });

  const syncMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", "/api/crm/leads/sync");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
    },
  });

  useEffect(() => {
    if (!syncTriggered) {
      setSyncTriggered(true);
      syncMutation.mutate();
    }
  }, []);

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PATCH", `/api/orders/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/stats"] });
      toast({ title: "Статус сделки обновлён" });
    },
  });

  const updatePaymentMutation = useMutation({
    mutationFn: async ({ id, paymentStatus, prepaymentPercentage }: { id: string; paymentStatus: string; prepaymentPercentage?: number }) => {
      return apiRequest("PATCH", `/api/orders/${id}`, { paymentStatus, prepaymentPercentage });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/orders"] });
      queryClient.invalidateQueries({ queryKey: ["/api/crm/stats"] });
      toast({ title: "Статус оплаты обновлён" });
    },
  });

  const updateLeadStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      return apiRequest("PATCH", `/api/crm/leads/${id}`, { status });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/crm/leads"] });
      toast({ title: "Статус лида обновлён" });
    },
  });

  const filteredOrders = orders?.filter((order) => {
    const matchesSearch =
      order.orderNumber.toLowerCase().includes(search.toLowerCase()) ||
      order.customerName.toLowerCase().includes(search.toLowerCase()) ||
      order.customerPhone.includes(search);
    const matchesStatus = statusFilter === "all" || order.status === statusFilter;
    const matchesPayment = paymentFilter === "all" || order.paymentStatus === paymentFilter;
    return matchesSearch && matchesStatus && matchesPayment;
  });

  const filteredLeads = leads?.filter((lead) => {
    if (!search) return true;
    return (
      lead.phone.includes(search) ||
      (lead.name && lead.name.toLowerCase().includes(search.toLowerCase()))
    );
  });

  const leadsByStatus = leadStatusOptions.reduce((acc, status) => {
    acc[status.value] = filteredLeads?.filter((l) => l.status === status.value) || [];
    return acc;
  }, {} as Record<string, CrmLead[]>);

  const formatPrice = (price: string) => {
    return new Intl.NumberFormat("ru-KZ").format(parseFloat(price)) + " ₸";
  };

  const formatDate = (date: string | Date | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getStatusBadge = (status: string) => {
    const mapped = mapLegacyStatus(status);
    const option = dealStatusOptions.find((s) => s.value === mapped);
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

  const formatPhoneDisplay = (phone: string) => {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 11) {
      return `+${digits[0]} (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9)}`;
    }
    return phone;
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

  const createLeadWhatsAppLink = (phone: string) => {
    const digits = formatPhoneForWhatsApp(phone);
    return `https://wa.me/${digits}`;
  };

  const isFirstDeal = orders && orders.length === 1;
  const hasAwaitingPayment = orders?.some(
    (o) => o.paymentStatus === "pending" && 
    new Date(o.createdAt).getTime() < Date.now() - 60 * 60 * 1000
  );

  const mapLegacyStatus = (status: string) => {
    const legacyMap: Record<string, string> = {
      in_progress: "confirmed",
      awaiting_payment: "confirmed",
      paid: "confirmed",
      payment_verification: "confirmed",
    };
    return legacyMap[status] || status;
  };

  const ordersByStatus = dealStatusOptions.reduce((acc, status) => {
    acc[status.value] = filteredOrders?.filter((o) => mapLegacyStatus(o.status) === status.value) || [];
    return acc;
  }, {} as Record<string, Order[]>);

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-bold tracking-tight">CRM</h1>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6">
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p className="max-w-xs">CRM — учёт лидов, сделок, оплат и переписки с клиентами</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <p className="text-muted-foreground">Управляйте лидами, сделками, клиентами и оплатами</p>
          </div>
          <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as ViewMode)}>
            <TabsList>
              <TabsTrigger value="table" className="gap-2" data-testid="tab-table">
                <List className="h-4 w-4" />
                Таблица
              </TabsTrigger>
              <TabsTrigger value="kanban" className="gap-2" data-testid="tab-kanban">
                <LayoutGrid className="h-4 w-4" />
                Канбан
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {(isFirstDeal || hasAwaitingPayment) && (
          <Card className="border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/20">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <Lightbulb className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5" />
                <div>
                  {isFirstDeal && (
                    <div>
                      <p className="font-medium text-blue-900 dark:text-blue-100">Начните работу с первой сделкой:</p>
                      <ol className="text-sm text-blue-800 dark:text-blue-200 mt-1 space-y-1">
                        <li>1. Напишите клиенту в WhatsApp</li>
                        <li>2. Отправьте ссылку на оплату</li>
                        <li>3. Переведите сделку в "В работе"</li>
                      </ol>
                    </div>
                  )}
                  {hasAwaitingPayment && !isFirstDeal && (
                    <p className="text-sm text-blue-800 dark:text-blue-200">
                      <span className="font-medium">Напоминание:</span> есть сделки с ожидающей оплатой более 1 часа. Отправьте напоминание клиенту.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {dealStatusOptions.map((status) => (
            <Card 
              key={status.value} 
              className={`cursor-pointer transition-all hover-elevate ${statusFilter === status.value ? 'ring-2 ring-primary' : ''}`}
              onClick={() => setStatusFilter(statusFilter === status.value ? 'all' : status.value)}
              data-testid={`stat-${status.value}`}
            >
              <CardContent className="p-3">
                <div className="flex items-center justify-between">
                  <Badge className={status.color}>{status.label}</Badge>
                  <span className="text-lg font-bold">
                    {isLoading ? <Skeleton className="h-6 w-8" /> : ordersByStatus[status.value]?.length || 0}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Card>
          <CardContent className="p-4">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Поиск по номеру, имени или телефону..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-10"
                  data-testid="input-search"
                />
              </div>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48" data-testid="select-status">
                  <SelectValue placeholder="Статус сделки" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все статусы</SelectItem>
                  {dealStatusOptions.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={paymentFilter} onValueChange={setPaymentFilter}>
                <SelectTrigger className="w-full sm:w-40" data-testid="select-payment">
                  <SelectValue placeholder="Оплата" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все</SelectItem>
                  {paymentStatusOptions.map((ps) => (
                    <SelectItem key={ps.value} value={ps.value}>
                      {ps.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {viewMode === "table" ? (
          <Card>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Сделка</TableHead>
                    <TableHead>Клиент</TableHead>
                    <TableHead>Сумма</TableHead>
                    <TableHead>Оплата</TableHead>
                    <TableHead>Статус</TableHead>
                    <TableHead>WhatsApp</TableHead>
                    <TableHead>AI</TableHead>
                    <TableHead>Дата</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    [...Array(5)].map((_, i) => <TableRowSkeleton key={i} cols={9} />)
                  ) : filteredOrders && filteredOrders.length > 0 ? (
                    filteredOrders.map((order, index) => (
                      <motion.tr
                        key={order.id}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: index * 0.03 }}
                        className="group"
                      >
                        <TableCell className="font-medium">
                          <button
                            onClick={() => navigate(`/dashboard/crm/${order.id}`)}
                            className="hover:underline text-primary cursor-pointer"
                            data-testid={`link-deal-${order.id}`}
                          >
                            #{order.orderNumber}
                          </button>
                        </TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{order.customerName}</p>
                            <p className="text-sm text-muted-foreground">
                              {order.customerPhone}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell className="font-medium">
                          {formatPrice(order.total)}
                        </TableCell>
                        <TableCell>
                          <Select
                            value={order.paymentStatus || "pending"}
                            onValueChange={(paymentStatus) => {
                              if (paymentStatus === "prepayment") {
                                const pct = prompt("Введите процент предоплаты (1-100):", "30");
                                if (pct) {
                                  updatePaymentMutation.mutate({ id: order.id, paymentStatus, prepaymentPercentage: Number(pct) });
                                }
                              } else {
                                updatePaymentMutation.mutate({ id: order.id, paymentStatus });
                              }
                            }}
                          >
                            <SelectTrigger className="w-40 h-8">
                              {(() => {
                                const badge = getPaymentBadge(order.paymentStatus);
                                const Icon = badge.icon;
                                const label = order.paymentStatus === "prepayment" && (order as any).prepaymentPercentage
                                  ? `${badge.label} ${(order as any).prepaymentPercentage}%`
                                  : badge.label;
                                return (
                                  <div className={`flex items-center gap-1.5 ${badge.color}`}>
                                    <Icon className="h-3.5 w-3.5" />
                                    <span className="text-sm">{label}</span>
                                  </div>
                                );
                              })()}
                            </SelectTrigger>
                            <SelectContent>
                              {paymentStatusOptions.map((ps) => (
                                <SelectItem key={ps.value} value={ps.value}>
                                  <div className={`flex items-center gap-1.5 ${ps.color}`}>
                                    <ps.icon className="h-3.5 w-3.5" />
                                    <span>{ps.label}</span>
                                  </div>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={order.status}
                            onValueChange={(status) =>
                              updateStatusMutation.mutate({ id: order.id, status })
                            }
                          >
                            <SelectTrigger className="w-36 h-8">
                              <Badge className={getStatusBadge(order.status).color}>
                                {getStatusBadge(order.status).label}
                              </Badge>
                            </SelectTrigger>
                            <SelectContent>
                              {dealStatusOptions.map((status) => (
                                <SelectItem key={status.value} value={status.value}>
                                  <Badge className={status.color}>{status.label}</Badge>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-2"
                            onClick={() => window.open(createWhatsAppLink(order), "_blank")}
                            data-testid={`whatsapp-deal-${order.id}`}
                          >
                            <SiWhatsapp className="h-4 w-4 text-green-600" />
                            Написать
                          </Button>
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/dashboard/crm/${order.id}?ai=1`)}
                            data-testid={`ai-deal-${order.id}`}
                          >
                            <BrainCircuit className="h-4 w-4 text-purple-600" />
                          </Button>
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">
                          {formatDate(order.createdAt)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => navigate(`/dashboard/crm/${order.id}`)}
                            data-testid={`view-deal-${order.id}`}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </motion.tr>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={9} className="h-48">
                        <div className="flex flex-col items-center justify-center text-center">
                          <Users className="h-12 w-12 text-muted-foreground/50 mb-3" />
                          <p className="font-medium">Нет сделок</p>
                          <p className="text-sm text-muted-foreground">
                            Сделки появятся здесь после оформления заказов клиентами
                          </p>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </Card>
        ) : (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">Лиды</h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {leadStatusOptions.map((status) => (
                  <div key={status.value} className="space-y-3">
                    <div className={`p-3 rounded-lg ${status.bgColor}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <status.icon className="h-4 w-4" />
                          <Badge className={status.color}>{status.label}</Badge>
                        </div>
                        <span className="text-sm font-medium">
                          {leadsLoading ? <Skeleton className="h-5 w-6 inline-block" /> : leadsByStatus[status.value]?.length || 0}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2 min-h-[120px]">
                      {leadsLoading ? (
                        [...Array(2)].map((_, i) => (
                          <Card key={i} className="p-3">
                            <Skeleton className="h-4 w-24 mb-2" />
                            <Skeleton className="h-3 w-full mb-1" />
                            <Skeleton className="h-3 w-20" />
                          </Card>
                        ))
                      ) : (
                        leadsByStatus[status.value]?.map((lead) => (
                          <motion.div
                            key={lead.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="group"
                          >
                            <Card className="p-3 hover-elevate" data-testid={`kanban-lead-${lead.id}`}>
                              <div className="flex items-start justify-between mb-1">
                                <div className="flex items-center gap-1.5">
                                  <Phone className="h-3.5 w-3.5 text-muted-foreground" />
                                  <span className="text-sm font-medium">{formatPhoneDisplay(lead.phone)}</span>
                                </div>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                                      onClick={(e) => e.stopPropagation()}
                                      data-testid={`lead-menu-${lead.id}`}
                                    >
                                      <ChevronDown className="h-3 w-3" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {leadStatusOptions
                                      .filter((s) => s.value !== lead.status)
                                      .map((s) => (
                                        <DropdownMenuItem
                                          key={s.value}
                                          onClick={() =>
                                            updateLeadStatusMutation.mutate({ id: lead.id, status: s.value })
                                          }
                                          data-testid={`lead-move-${lead.id}-${s.value}`}
                                        >
                                          <ArrowRight className="h-3 w-3 mr-2" />
                                          {s.label}
                                        </DropdownMenuItem>
                                      ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                              {lead.name && (
                                <p className="text-sm text-muted-foreground truncate">{lead.name}</p>
                              )}
                              <div className="flex items-center gap-1.5 mt-1">
                                {(() => {
                                  const statusOpt = leadStatusOptions.find(s => s.value === lead.status);
                                  return statusOpt ? (
                                    <Badge className={`text-[10px] px-1.5 py-0 ${statusOpt.color}`} data-testid={`lead-badge-${lead.id}`}>
                                      {statusOpt.label}
                                    </Badge>
                                  ) : null;
                                })()}
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                                  <SiWhatsapp className="h-2.5 w-2.5 mr-0.5 text-green-600" />
                                  {lead.channel === 'whatsapp' ? 'WA' : lead.channel}
                                </Badge>
                              </div>
                              <div className="mt-2 space-y-0.5 text-[11px] text-muted-foreground">
                                <div className="flex justify-between">
                                  <span>Первое сообщение:</span>
                                  <span>{formatDate(lead.firstMessageAt)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span>Последнее:</span>
                                  <span>{formatDate(lead.lastMessageAt)}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-1 mt-2 pt-2 border-t">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={() => window.open(createLeadWhatsAppLink(lead.phone), "_blank")}
                                  data-testid={`whatsapp-lead-${lead.id}`}
                                >
                                  <SiWhatsapp className="h-3 w-3 text-green-600" />
                                </Button>
                              </div>
                            </Card>
                          </motion.div>
                        ))
                      )}
                      {!leadsLoading && leadsByStatus[status.value]?.length === 0 && (
                        <div className="flex items-center justify-center h-20 border-2 border-dashed rounded-lg">
                          <p className="text-xs text-muted-foreground">Пусто</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-medium text-muted-foreground mb-3 uppercase tracking-wider">Заказы</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
                {dealStatusOptions.map((status) => (
                  <div key={status.value} className="space-y-3">
                    <div className={`p-3 rounded-lg ${status.bgColor}`}>
                      <div className="flex items-center justify-between">
                        <Badge className={status.color}>{status.label}</Badge>
                        <span className="text-sm font-medium">
                          {ordersByStatus[status.value]?.length || 0}
                        </span>
                      </div>
                    </div>
                    <div className="space-y-2 min-h-[200px]">
                      {isLoading ? (
                        [...Array(2)].map((_, i) => (
                          <Card key={i} className="p-3">
                            <Skeleton className="h-4 w-24 mb-2" />
                            <Skeleton className="h-3 w-full mb-1" />
                            <Skeleton className="h-3 w-20" />
                          </Card>
                        ))
                      ) : (
                        ordersByStatus[status.value]?.map((order) => (
                          <motion.div
                            key={order.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="group"
                          >
                            <Card 
                              className="p-3 cursor-pointer hover-elevate"
                              onClick={() => navigate(`/dashboard/crm/${order.id}`)}
                              data-testid={`kanban-deal-${order.id}`}
                            >
                              <div className="flex items-start justify-between mb-2">
                                <span className="text-sm font-medium text-primary">
                                  #{order.orderNumber}
                                </span>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button
                                      variant="ghost"
                                      size="icon"
                                      className="h-6 w-6 opacity-0 group-hover:opacity-100"
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <ChevronDown className="h-3 w-3" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    {dealStatusOptions
                                      .filter((s) => s.value !== order.status)
                                      .map((s) => (
                                        <DropdownMenuItem
                                          key={s.value}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            updateStatusMutation.mutate({ id: order.id, status: s.value });
                                          }}
                                        >
                                          <ArrowRight className="h-3 w-3 mr-2" />
                                          {s.label}
                                        </DropdownMenuItem>
                                      ))}
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>
                              <p className="font-medium text-sm truncate">{order.customerName}</p>
                              <p className="text-xs text-muted-foreground">{order.customerPhone}</p>
                              <div className="flex items-center justify-between mt-2">
                                <span className="font-medium text-sm">{formatPrice(order.total)}</span>
                                {(() => {
                                  const badge = getPaymentBadge(order.paymentStatus);
                                  const Icon = badge.icon;
                                  const label = order.paymentStatus === "prepayment" && (order as any).prepaymentPercentage
                                    ? `${(order as any).prepaymentPercentage}%`
                                    : null;
                                  return (
                                    <Badge className={`text-[10px] px-1.5 py-0 ${badge.badgeColor || ""}`}>
                                      <Icon className="h-3 w-3 mr-0.5" />
                                      {label || badge.label}
                                    </Badge>
                                  );
                                })()}
                              </div>
                              <div className="flex items-center gap-1 mt-2 pt-2 border-t">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    window.open(createWhatsAppLink(order), "_blank");
                                  }}
                                >
                                  <SiWhatsapp className="h-3 w-3 text-green-600" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-6 w-6"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    navigate(`/dashboard/crm/${order.id}?ai=1`);
                                  }}
                                >
                                  <BrainCircuit className="h-3 w-3 text-purple-600" />
                                </Button>
                                <span className="text-xs text-muted-foreground ml-auto">
                                  {formatDate(order.createdAt)}
                                </span>
                              </div>
                            </Card>
                          </motion.div>
                        ))
                      )}
                      {!isLoading && ordersByStatus[status.value]?.length === 0 && (
                        <div className="flex items-center justify-center h-24 border-2 border-dashed rounded-lg">
                          <p className="text-xs text-muted-foreground">Пусто</p>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}