import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  TrendingUp,
  TrendingDown,
  ShoppingCart,
  Users,
  Eye,
  Package,
  ArrowUpRight,
  ArrowDownRight,
  Calendar,
  Download,
  Filter,
  Phone,
  Mail,
  Clock,
  CheckCircle,
  XCircle,
  AlertCircle,
  Percent,
  DollarSign,
  BarChart3,
  Target,
  Tag,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { DashboardLayout } from "@/components/DashboardLayout";
import { CardSkeleton } from "@/components/LoadingSpinner";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type DateRange = "7d" | "30d" | "90d" | "custom";

interface OverviewData {
  catalogViews: number;
  uniqueVisitors: number;
  productViews: number;
  addToCart: number;
  checkoutStarts: number;
  ordersCreated: number;
  revenue: number;
  avgOrderValue: number;
  conversionRate: number;
  cartAbandonmentRate: number;
  periodComparison: {
    catalogViewsChange: number;
    revenueChange: number;
    ordersChange: number;
    conversionChange: number;
  };
}

interface FunnelData {
  steps: Array<{
    name: string;
    count: number;
    percentage: number;
    dropoff: number;
  }>;
  overallConversion: number;
}

interface ProductAnalytics {
  id: string;
  name: string;
  sku: string;
  views: number;
  addToCart: number;
  orders: number;
  revenue: number;
  conversionRate: number;
}

interface OrderAnalytics {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  total: string;
  status: string;
  createdAt: string;
  source: string;
}

interface AbandonedCart {
  id: string;
  visitorId: string;
  customerPhone: string | null;
  customerEmail: string | null;
  cartJson: Array<{ productId: string; name: string; qty: number; price: number }>;
  totalEstimated: number;
  lastStep: string;
  processedStatus: string;
  note: string | null;
  createdAt: string;
  updatedAt: string;
}

interface PromotionAnalytics {
  id: string;
  name: string;
  code: string | null;
  type: string;
  views: number;
  uses: number;
  revenue: number;
  isActive: boolean;
}

const dateRanges: { value: DateRange; label: string }[] = [
  { value: "7d", label: "7 дней" },
  { value: "30d", label: "30 дней" },
  { value: "90d", label: "90 дней" },
];

function getDateRange(range: DateRange): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date();
  switch (range) {
    case "7d":
      from.setDate(from.getDate() - 7);
      break;
    case "30d":
      from.setDate(from.getDate() - 30);
      break;
    case "90d":
      from.setDate(from.getDate() - 90);
      break;
    default:
      from.setDate(from.getDate() - 30);
  }
  return { from, to };
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  change,
  changeType,
  index,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  change?: number;
  changeType?: "positive" | "negative" | "neutral";
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Card>
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted-foreground mb-1 truncate">{title}</p>
              <p className="text-2xl font-bold truncate">{value}</p>
              {subtitle && (
                <p className="text-xs text-muted-foreground mt-1 truncate">{subtitle}</p>
              )}
              {change !== undefined && change !== 0 && (
                <div className="flex items-center gap-1 mt-1">
                  {changeType === "positive" ? (
                    <ArrowUpRight className="h-3 w-3 text-green-500 shrink-0" />
                  ) : changeType === "negative" ? (
                    <ArrowDownRight className="h-3 w-3 text-red-500 shrink-0" />
                  ) : null}
                  <span
                    className={`text-xs ${
                      changeType === "positive"
                        ? "text-green-500"
                        : changeType === "negative"
                        ? "text-red-500"
                        : "text-muted-foreground"
                    }`}
                  >
                    {change > 0 ? "+" : ""}{change.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
            <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
              <Icon className="h-4 w-4 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function FunnelStep({
  name,
  count,
  percentage,
  dropoff,
  isLast,
  index,
}: {
  name: string;
  count: number;
  percentage: number;
  dropoff: number;
  isLast: boolean;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className="relative"
    >
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <span className="font-medium">{name}</span>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold">{count.toLocaleString("ru-RU")}</span>
              <Badge variant="secondary" className="text-xs">
                {percentage.toFixed(1)}%
              </Badge>
            </div>
          </div>
          <Progress value={percentage} className="h-3" />
        </div>
      </div>
      {!isLast && dropoff > 0 && (
        <div className="ml-4 my-2 text-sm text-muted-foreground flex items-center gap-1">
          <TrendingDown className="h-3 w-3 text-orange-500" />
          <span>Отток: {dropoff.toFixed(1)}%</span>
        </div>
      )}
    </motion.div>
  );
}

function OverviewTab({ dateRange }: { dateRange: DateRange }) {
  const { from, to } = getDateRange(dateRange);
  
  const { data, isLoading } = useQuery<OverviewData>({
    queryKey: ["/api/analytics/overview", from.toISOString(), to.toISOString()],
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("ru-KZ").format(value) + " ₸";
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(8)].map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  const getChangeType = (change: number): "positive" | "negative" | "neutral" => {
    if (change > 0) return "positive";
    if (change < 0) return "negative";
    return "neutral";
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Просмотры каталога"
          value={data?.catalogViews || 0}
          subtitle={`${data?.uniqueVisitors || 0} уникальных`}
          icon={Eye}
          change={data?.periodComparison?.catalogViewsChange}
          changeType={getChangeType(data?.periodComparison?.catalogViewsChange || 0)}
          index={0}
        />
        <StatCard
          title="Просмотры товаров"
          value={data?.productViews || 0}
          icon={Package}
          index={1}
        />
        <StatCard
          title="Добавлено в корзину"
          value={data?.addToCart || 0}
          icon={ShoppingCart}
          index={2}
        />
        <StatCard
          title="Заказы"
          value={data?.ordersCreated || 0}
          icon={CheckCircle}
          change={data?.periodComparison?.ordersChange}
          changeType={getChangeType(data?.periodComparison?.ordersChange || 0)}
          index={3}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Выручка"
          value={formatCurrency(data?.revenue || 0)}
          icon={DollarSign}
          change={data?.periodComparison?.revenueChange}
          changeType={getChangeType(data?.periodComparison?.revenueChange || 0)}
          index={4}
        />
        <StatCard
          title="Средний чек"
          value={formatCurrency(data?.avgOrderValue || 0)}
          icon={TrendingUp}
          index={5}
        />
        <StatCard
          title="Конверсия"
          value={`${(data?.conversionRate || 0).toFixed(2)}%`}
          subtitle="Заказы / Просмотры"
          icon={Target}
          change={data?.periodComparison?.conversionChange}
          changeType={getChangeType(data?.periodComparison?.conversionChange || 0)}
          index={6}
        />
        <StatCard
          title="Брошенные корзины"
          value={`${(data?.cartAbandonmentRate || 0).toFixed(1)}%`}
          icon={XCircle}
          index={7}
        />
      </div>
    </div>
  );
}

function FunnelTab({ dateRange }: { dateRange: DateRange }) {
  const { from, to } = getDateRange(dateRange);
  
  const { data, isLoading } = useQuery<FunnelData>({
    queryKey: ["/api/analytics/funnel", from.toISOString(), to.toISOString()],
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Воронка продаж
        </CardTitle>
        <CardDescription>
          Общая конверсия: {(data?.overallConversion || 0).toFixed(2)}%
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {data?.steps?.map((step, index) => (
          <FunnelStep
            key={step.name}
            name={step.name}
            count={step.count}
            percentage={step.percentage}
            dropoff={step.dropoff}
            isLast={index === (data?.steps?.length || 0) - 1}
            index={index}
          />
        ))}
        {(!data?.steps || data.steps.length === 0) && (
          <div className="text-center py-8 text-muted-foreground">
            <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Нет данных за выбранный период</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ProductsTab({ dateRange }: { dateRange: DateRange }) {
  const { from, to } = getDateRange(dateRange);
  const [sortBy, setSortBy] = useState<string>("revenue");
  
  const { data, isLoading } = useQuery<ProductAnalytics[]>({
    queryKey: ["/api/analytics/products", from.toISOString(), to.toISOString(), sortBy],
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("ru-KZ").format(value) + " ₸";
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Аналитика товаров</CardTitle>
            <CardDescription>Эффективность товаров за период</CardDescription>
          </div>
          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-40" data-testid="select-sort-products">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="revenue">По выручке</SelectItem>
              <SelectItem value="views">По просмотрам</SelectItem>
              <SelectItem value="orders">По заказам</SelectItem>
              <SelectItem value="conversion">По конверсии</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>
        {data && data.length > 0 ? (
          <div className="space-y-3">
            {data.map((product, index) => (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between py-3 border-b last:border-0"
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className="text-lg font-bold text-muted-foreground w-6 shrink-0">
                    {index + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="font-medium truncate">{product.name}</p>
                    <p className="text-xs text-muted-foreground">{product.sku}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-sm">{product.views} просм.</p>
                    <p className="text-xs text-muted-foreground">{product.orders} заказ.</p>
                  </div>
                  <div className="text-right">
                    <Badge variant="secondary">{formatCurrency(product.revenue)}</Badge>
                    <p className="text-xs text-muted-foreground mt-1">
                      {product.conversionRate.toFixed(1)}% конв.
                    </p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Нет данных о товарах за период</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function OrdersTab({ dateRange }: { dateRange: DateRange }) {
  const { from, to } = getDateRange(dateRange);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  
  const { data, isLoading } = useQuery<OrderAnalytics[]>({
    queryKey: ["/api/analytics/orders", from.toISOString(), to.toISOString(), statusFilter],
  });

  const formatCurrency = (value: string) => {
    return new Intl.NumberFormat("ru-KZ").format(parseFloat(value)) + " ₸";
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const exportToCSV = () => {
    if (!data || data.length === 0) return;
    
    const headers = ["Номер", "Клиент", "Телефон", "Сумма", "Статус", "Дата"];
    const rows = data.map((o) => [
      o.orderNumber,
      o.customerName,
      o.customerPhone,
      o.total,
      o.status,
      new Date(o.createdAt).toISOString(),
    ]);
    
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `orders_${from.toISOString().slice(0, 10)}_${to.toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    new: { label: "Новый", variant: "default" },
    in_progress: { label: "В работе", variant: "secondary" },
    completed: { label: "Выполнен", variant: "outline" },
    cancelled: { label: "Отменён", variant: "destructive" },
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Заказы</CardTitle>
            <CardDescription>{data?.length || 0} заказов за период</CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32" data-testid="select-status-filter">
                <SelectValue placeholder="Статус" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все</SelectItem>
                <SelectItem value="new">Новые</SelectItem>
                <SelectItem value="in_progress">В работе</SelectItem>
                <SelectItem value="completed">Выполнены</SelectItem>
                <SelectItem value="cancelled">Отменены</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={exportToCSV} data-testid="button-export-csv">
              <Download className="h-4 w-4 mr-1" />
              CSV
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {data && data.length > 0 ? (
          <div className="space-y-3">
            {data.map((order, index) => (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.03 }}
                className="flex items-center justify-between py-3 border-b last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">#{order.orderNumber}</p>
                    <Badge variant={statusLabels[order.status]?.variant || "secondary"}>
                      {statusLabels[order.status]?.label || order.status}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground truncate">
                    {order.customerName} · {order.customerPhone}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold">{formatCurrency(order.total)}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <ShoppingCart className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Нет заказов за период</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AbandonedCartsTab({ dateRange }: { dateRange: DateRange }) {
  const { from, to } = getDateRange(dateRange);
  const { toast } = useToast();
  const [selectedCart, setSelectedCart] = useState<AbandonedCart | null>(null);
  const [note, setNote] = useState("");
  
  const { data, isLoading, refetch } = useQuery<AbandonedCart[]>({
    queryKey: ["/api/analytics/abandoned", from.toISOString(), to.toISOString()],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, processedStatus, note }: { id: string; processedStatus: string; note?: string }) => {
      return apiRequest("PATCH", `/api/analytics/abandoned/${id}`, { processedStatus, note });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/analytics/abandoned"] });
      toast({ title: "Статус обновлён" });
      setSelectedCart(null);
    },
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("ru-KZ").format(value) + " ₸";
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const statusLabels: Record<string, { label: string; icon: React.ElementType; color: string }> = {
    not_processed: { label: "Не обработан", icon: AlertCircle, color: "text-yellow-500" },
    contacted: { label: "Связались", icon: Phone, color: "text-blue-500" },
    recovered: { label: "Восстановлен", icon: CheckCircle, color: "text-green-500" },
    lost: { label: "Потерян", icon: XCircle, color: "text-red-500" },
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(5)].map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  const cartsWithContact = data?.filter((c) => c.customerPhone || c.customerEmail) || [];
  const totalValue = data?.reduce((sum, c) => sum + (c.totalEstimated || 0), 0) || 0;

  return (
    <>
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Брошенных корзин"
            value={data?.length || 0}
            icon={ShoppingCart}
            index={0}
          />
          <StatCard
            title="С контактами"
            value={cartsWithContact.length}
            subtitle="Можно связаться"
            icon={Phone}
            index={1}
          />
          <StatCard
            title="Потенциальная выручка"
            value={formatCurrency(totalValue)}
            icon={DollarSign}
            index={2}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Брошенные корзины</CardTitle>
            <CardDescription>
              Клиенты, которые добавили товары, но не завершили заказ
            </CardDescription>
          </CardHeader>
          <CardContent>
            {data && data.length > 0 ? (
              <div className="space-y-3">
                {data.map((cart, index) => {
                  const status = statusLabels[cart.processedStatus] || statusLabels.not_processed;
                  const StatusIcon = status.icon;
                  
                  return (
                    <motion.div
                      key={cart.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                      className="border rounded-lg p-4 hover-elevate cursor-pointer"
                      onClick={() => {
                        setSelectedCart(cart);
                        setNote(cart.note || "");
                      }}
                      data-testid={`abandoned-cart-${cart.id}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <StatusIcon className={`h-4 w-4 ${status.color}`} />
                            <span className="text-sm">{status.label}</span>
                            <Badge variant="outline" className="text-xs">
                              {cart.lastStep}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            {cart.customerPhone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {cart.customerPhone}
                              </span>
                            )}
                            {cart.customerEmail && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {cart.customerEmail}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(cart.createdAt)}
                            </span>
                          </div>
                          <div className="mt-2 text-sm">
                            {cart.cartJson?.slice(0, 2).map((item, i) => (
                              <span key={i} className="mr-2">
                                {item.name} ×{item.qty}
                              </span>
                            ))}
                            {(cart.cartJson?.length || 0) > 2 && (
                              <span className="text-muted-foreground">
                                +{(cart.cartJson?.length || 0) - 2} ещё
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold">{formatCurrency(cart.totalEstimated)}</p>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <CheckCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                <p>Нет брошенных корзин за период</p>
                <p className="text-sm">Все клиенты завершают покупки</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Dialog open={!!selectedCart} onOpenChange={() => setSelectedCart(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Обработка брошенной корзины</DialogTitle>
          </DialogHeader>
          {selectedCart && (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="font-medium">Товары:</p>
                {selectedCart.cartJson?.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{item.name} ×{item.qty}</span>
                    <span>{formatCurrency(item.price * item.qty)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold pt-2 border-t">
                  <span>Итого:</span>
                  <span>{formatCurrency(selectedCart.totalEstimated)}</span>
                </div>
              </div>

              {(selectedCart.customerPhone || selectedCart.customerEmail) && (
                <div className="space-y-1">
                  <p className="font-medium">Контакты:</p>
                  {selectedCart.customerPhone && (
                    <a
                      href={`tel:${selectedCart.customerPhone}`}
                      className="flex items-center gap-2 text-primary hover:underline"
                    >
                      <Phone className="h-4 w-4" />
                      {selectedCart.customerPhone}
                    </a>
                  )}
                  {selectedCart.customerEmail && (
                    <a
                      href={`mailto:${selectedCart.customerEmail}`}
                      className="flex items-center gap-2 text-primary hover:underline"
                    >
                      <Mail className="h-4 w-4" />
                      {selectedCart.customerEmail}
                    </a>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <p className="font-medium">Заметка:</p>
                <Textarea
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Добавьте заметку о контакте с клиентом..."
                  data-testid="input-cart-note"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  onClick={() => updateMutation.mutate({
                    id: selectedCart.id,
                    processedStatus: "contacted",
                    note,
                  })}
                  disabled={updateMutation.isPending}
                  data-testid="button-mark-contacted"
                >
                  <Phone className="h-4 w-4 mr-1" />
                  Связались
                </Button>
                <Button
                  variant="default"
                  onClick={() => updateMutation.mutate({
                    id: selectedCart.id,
                    processedStatus: "recovered",
                    note,
                  })}
                  disabled={updateMutation.isPending}
                  data-testid="button-mark-recovered"
                >
                  <CheckCircle className="h-4 w-4 mr-1" />
                  Восстановлен
                </Button>
                <Button
                  variant="destructive"
                  onClick={() => updateMutation.mutate({
                    id: selectedCart.id,
                    processedStatus: "lost",
                    note,
                  })}
                  disabled={updateMutation.isPending}
                  className="col-span-2"
                  data-testid="button-mark-lost"
                >
                  <XCircle className="h-4 w-4 mr-1" />
                  Потерян
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function PromotionsTab({ dateRange }: { dateRange: DateRange }) {
  const { from, to } = getDateRange(dateRange);
  
  const { data: promotions, isLoading } = useQuery<PromotionAnalytics[]>({
    queryKey: ["/api/promotions"],
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("ru-KZ").format(value) + " ₸";
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Tag className="h-5 w-5" />
          Эффективность акций
        </CardTitle>
        <CardDescription>
          Анализ промо-кодов и скидок
        </CardDescription>
      </CardHeader>
      <CardContent>
        {promotions && promotions.length > 0 ? (
          <div className="space-y-4">
            {promotions.map((promo, index) => (
              <motion.div
                key={promo.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="flex items-center justify-between py-3 border-b last:border-0"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{promo.name}</p>
                    {promo.code && (
                      <Badge variant="outline" className="font-mono">
                        {promo.code}
                      </Badge>
                    )}
                    <Badge variant={promo.isActive ? "default" : "secondary"}>
                      {promo.isActive ? "Активна" : "Неактивна"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Тип: {promo.type === "percentage" ? "Процент" : "Фиксированная сумма"}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm">{promo.uses || 0} использований</p>
                  <p className="font-bold text-green-600">
                    {formatCurrency(promo.revenue || 0)}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <Tag className="h-12 w-12 mx-auto mb-3 opacity-50" />
            <p>Нет активных акций</p>
            <p className="text-sm">Создайте акцию в разделе «Скидки»</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function AnalyticsPage() {
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Аналитика</h1>
            <p className="text-muted-foreground">
              Отслеживайте эффективность вашего каталога
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <Select value={dateRange} onValueChange={(v) => setDateRange(v as DateRange)}>
              <SelectTrigger className="w-32" data-testid="select-date-range">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {dateRanges.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {r.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-3 sm:grid-cols-6 w-full">
            <TabsTrigger value="overview" data-testid="tab-overview">Обзор</TabsTrigger>
            <TabsTrigger value="funnel" data-testid="tab-funnel">Воронка</TabsTrigger>
            <TabsTrigger value="orders" data-testid="tab-orders">Заказы</TabsTrigger>
            <TabsTrigger value="abandoned" data-testid="tab-abandoned">Корзины</TabsTrigger>
            <TabsTrigger value="products" data-testid="tab-products">Товары</TabsTrigger>
            <TabsTrigger value="promotions" data-testid="tab-promotions">Акции</TabsTrigger>
          </TabsList>

          <div className="mt-6">
            <TabsContent value="overview" className="m-0">
              <OverviewTab dateRange={dateRange} />
            </TabsContent>
            <TabsContent value="funnel" className="m-0">
              <FunnelTab dateRange={dateRange} />
            </TabsContent>
            <TabsContent value="orders" className="m-0">
              <OrdersTab dateRange={dateRange} />
            </TabsContent>
            <TabsContent value="abandoned" className="m-0">
              <AbandonedCartsTab dateRange={dateRange} />
            </TabsContent>
            <TabsContent value="products" className="m-0">
              <ProductsTab dateRange={dateRange} />
            </TabsContent>
            <TabsContent value="promotions" className="m-0">
              <PromotionsTab dateRange={dateRange} />
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
