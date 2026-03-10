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
  Globe,
  Settings,
  Bot,
  Banknote,
  Shield,
} from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { DashboardLayout } from "@/components/DashboardLayout";
import { CardSkeleton } from "@/components/LoadingSpinner";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type DateRange = "7d" | "30d" | "90d" | "custom";

interface OverviewMetrics {
  visits: number;
  uniqueVisitors: number;
  productViews: number;
  addToCart: number;
  checkoutStarts: number;
  ordersCreated: number;
  whatsappClicks: number;
  revenue: number;
  avgCheck: number;
  abandonedCarts: number;
  conversionRate: number;
  cartConversion: number;
  whatsappConversion: number;
}

interface PaymentBreakdownItem {
  method: string;
  label: string;
  revenue: number;
  count: number;
}

interface OverviewData {
  current: OverviewMetrics;
  previous: OverviewMetrics;
  changes: {
    visits: number;
    uniqueVisitors: number;
    ordersCreated: number;
    revenue: number;
    conversionRate: number;
    abandonedCarts: number;
  };
  netRevenue: number;
  totalCommissions: number;
  aiRevenue: number;
  aiOrdersCount: number;
  paymentBreakdown: PaymentBreakdownItem[];
}

interface FunnelData {
  funnel: Array<{
    step: string;
    count: number;
    conversionToNext: number;
  }>;
  bottleneckIndex: number;
  recommendations: string[];
}

interface ProductStat {
  id: string;
  name: string;
  views: number;
  addToCart: number;
  orders: number;
  revenue: number;
  conversion: number;
}

interface ProductAnalyticsData {
  products: ProductStat[];
  totals: {
    views: number;
    addToCart: number;
    orders: number;
    revenue: number;
  };
}

interface OrderItem {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  total: string;
  status: string;
  createdAt: string;
  utmSource?: string;
}

interface OrderAnalyticsData {
  orders: OrderItem[];
  summary: {
    total: number;
    revenue: number;
    avgCheck: number;
    byStatus: {
      new: number;
      processing: number;
      completed: number;
      cancelled: number;
    };
  };
}

interface CartSession {
  id: string;
  tenantId: string;
  visitorId: string;
  sessionId: string;
  checkoutPhone: string | null;
  checkoutEmail: string | null;
  cartJson: string | null;
  totalEstimated: string | null;
  lastStep: string | null;
  processedStatus: string;
  note: string | null;
  createdAt: string;
  lastActivityAt: string;
}

interface AbandonedCartsData {
  sessions: CartSession[];
  summary: {
    total: number;
    withPhone: number;
    totalValue: number;
  };
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

interface TrafficSourcesData {
  referrers: Array<{ source: string; visitors: number; percentage: number }>;
  utmSources: Array<{ source: string; medium: string; campaign: string; visitors: number; percentage: number }>;
  totalVisitors: number;
}

const dateRanges: { value: DateRange; label: string }[] = [
  { value: "7d", label: "7 дней" },
  { value: "30d", label: "30 дней" },
  { value: "90d", label: "90 дней" },
];

function getDateRangeStrings(range: DateRange): { fromStr: string; toStr: string } {
  const now = new Date();
  const to = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const from = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  
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
  return { fromStr: from.toISOString(), toStr: to.toISOString() };
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
  conversionFromPrev,
  isLast,
  isFirst,
  index,
  color,
}: {
  name: string;
  count: number;
  percentage: number;
  dropoff: number;
  conversionFromPrev: number;
  isLast: boolean;
  isFirst: boolean;
  index: number;
  color: string;
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
                {Math.round(percentage)}%
              </Badge>
            </div>
          </div>
          <div className="h-3 w-full rounded-full bg-secondary overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${percentage}%` }}
              transition={{ duration: 0.6, delay: index * 0.15 }}
              className={`h-full rounded-full ${color}`}
            />
          </div>
        </div>
      </div>
      {!isFirst && conversionFromPrev > 0 && (
        <div className="ml-4 mt-1 mb-1 text-xs text-muted-foreground flex items-center gap-1">
          <ArrowDownRight className="h-3 w-3 text-muted-foreground" />
          <span>Конверсия из предыдущего: {Math.round(conversionFromPrev)}%</span>
        </div>
      )}
      {!isLast && dropoff > 0 && (
        <div className="ml-4 my-1 text-sm text-muted-foreground flex items-center gap-1">
          <TrendingDown className="h-3 w-3 text-orange-500" />
          <span>Отток: {Math.round(dropoff)}%</span>
        </div>
      )}
    </motion.div>
  );
}

const PAYMENT_COLORS: Record<string, string> = {
  paid: "#34d399",
  prepayment: "#38bdf8",
  installment: "#2dd4bf",
  credit: "#818cf8",
  kaspi_red: "#fb7185",
};

const COMMISSION_LABELS: Record<string, string> = {
  paid: "Полная оплата",
  prepayment: "Предоплата",
  installment: "Рассрочка",
  credit: "Кредит",
  kaspi_red: "Kaspi RED",
};

function CommissionSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const { data } = useQuery<{ rates: Record<string, number> }>({
    queryKey: ["/api/settings/commissions"],
  });
  const [localRates, setLocalRates] = useState<Record<string, number> | null>(null);

  const rates = localRates || data?.rates || {};

  const saveMutation = useMutation({
    mutationFn: async (newRates: Record<string, number>) => {
      await apiRequest("PATCH", "/api/settings/commissions", { rates: newRates });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings/commissions"] });
      queryClient.invalidateQueries({ predicate: (q) => (q.queryKey[0] as string)?.includes("/api/analytics/overview") });
      toast({ title: "Комиссии сохранены" });
      onOpenChange(false);
      setLocalRates(null);
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Комиссии банков (%)</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          {Object.entries(COMMISSION_LABELS).map(([key, label]) => (
            <div key={key} className="flex items-center justify-between gap-3">
              <Label className="text-sm">{label}</Label>
              <div className="flex items-center gap-1">
                <Input
                  data-testid={`input-commission-${key}`}
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  className="w-20 text-right"
                  value={rates[key] ?? 0}
                  onChange={(e) => {
                    setLocalRates({ ...rates, [key]: parseFloat(e.target.value) || 0 });
                  }}
                />
                <span className="text-sm text-muted-foreground">%</span>
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button
            data-testid="button-save-commissions"
            onClick={() => saveMutation.mutate(localRates || rates)}
            disabled={saveMutation.isPending}
          >
            {saveMutation.isPending ? "Сохраняю..." : "Сохранить"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function PaymentDonutChart({ breakdown }: { breakdown: PaymentBreakdownItem[] }) {
  if (!breakdown || breakdown.length === 0) return null;

  const total = breakdown.reduce((s, b) => s + b.revenue, 0);
  const chartData = breakdown.map((b) => ({
    name: b.label,
    value: b.revenue,
    method: b.method,
  }));

  const formatCurrency = (value: number) =>
    new Intl.NumberFormat("ru-KZ", { maximumFractionDigits: 0 }).format(value) + " ₸";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Banknote className="h-5 w-5" />
          Источники оплат
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col md:flex-row items-center gap-6">
          <div className="w-48 h-48 shrink-0">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={chartData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {chartData.map((entry) => (
                    <Cell
                      key={entry.method}
                      fill={PAYMENT_COLORS[entry.method] || "#94a3b8"}
                    />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(value: number) => formatCurrency(value)}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex-1 space-y-2">
            {breakdown.map((b) => {
              const pct = total > 0 ? Math.round((b.revenue / total) * 100) : 0;
              return (
                <div key={b.method} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-full shrink-0"
                      style={{ backgroundColor: PAYMENT_COLORS[b.method] || "#94a3b8" }}
                    />
                    <span>{b.label}</span>
                  </div>
                  <div className="flex items-center gap-2 text-right">
                    <span className="font-medium">{formatCurrency(b.revenue)}</span>
                    <Badge variant="secondary" className="text-xs">{pct}%</Badge>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function OverviewTab({ dateRange }: { dateRange: DateRange }) {
  const [commissionsOpen, setCommissionsOpen] = useState(false);
  const url = useMemo(() => {
    const { fromStr, toStr } = getDateRangeStrings(dateRange);
    return `/api/analytics/overview?from=${fromStr}&to=${toStr}`;
  }, [dateRange]);
  
  const { data, isLoading } = useQuery<OverviewData>({
    queryKey: [url],
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("ru-KZ", { maximumFractionDigits: 0 }).format(Math.round(value)) + " ₸";
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[...Array(12)].map((_, i) => (
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

  const current = data?.current;
  const changes = data?.changes;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Просмотры каталога"
          value={current?.visits || 0}
          subtitle={`${current?.uniqueVisitors || 0} уникальных`}
          icon={Eye}
          change={changes?.visits}
          changeType={getChangeType(changes?.visits || 0)}
          index={0}
        />
        <StatCard
          title="Просмотры товаров"
          value={current?.productViews || 0}
          icon={Package}
          index={1}
        />
        <StatCard
          title="Добавлено в корзину"
          value={current?.addToCart || 0}
          icon={ShoppingCart}
          index={2}
        />
        <StatCard
          title="Заказы"
          value={current?.ordersCreated || 0}
          icon={CheckCircle}
          change={changes?.ordersCreated}
          changeType={getChangeType(changes?.ordersCreated || 0)}
          index={3}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Выручка"
          value={formatCurrency(current?.revenue || 0)}
          icon={DollarSign}
          change={changes?.revenue}
          changeType={getChangeType(changes?.revenue || 0)}
          index={4}
        />
        <StatCard
          title="Средний чек"
          value={formatCurrency(current?.avgCheck || 0)}
          icon={TrendingUp}
          index={5}
        />
        <StatCard
          title="Конверсия"
          value={`${(current?.conversionRate || 0).toFixed(1)}%`}
          subtitle="Заказы / Посетители"
          icon={Target}
          change={changes?.conversionRate}
          changeType={getChangeType(changes?.conversionRate || 0)}
          index={6}
        />
        <StatCard
          title="Брошенные корзины"
          value={current?.abandonedCarts || 0}
          icon={XCircle}
          change={changes?.abandonedCarts}
          changeType={getChangeType(-(changes?.abandonedCarts || 0))}
          index={7}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.4 }}
        >
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-muted-foreground mb-1">Чистая выручка (оценка)</p>
                  <p className="text-2xl font-bold text-green-600">{formatCurrency(data?.netRevenue || 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">За вычетом комиссий</p>
                </div>
                <div className="w-9 h-9 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                  <Shield className="h-4 w-4 text-green-600" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.45 }}
        >
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-muted-foreground mb-1">Комиссии банков</p>
                  <p className="text-2xl font-bold text-red-500">{formatCurrency(data?.totalCommissions || 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">Удержано платёжными системами</p>
                </div>
                <button
                  onClick={() => setCommissionsOpen(true)}
                  className="w-9 h-9 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0 hover:bg-red-500/20 transition-colors"
                  data-testid="button-open-commissions"
                >
                  <Settings className="h-4 w-4 text-red-500" />
                </button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.5 }}
        >
          <Card>
            <CardContent className="p-5">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-muted-foreground mb-1">Закрыто с помощью ИИ</p>
                  <p className="text-2xl font-bold">{formatCurrency(data?.aiRevenue || 0)}</p>
                  <p className="text-xs text-muted-foreground mt-1">{data?.aiOrdersCount || 0} заказов с участием бота</p>
                </div>
                <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Bot className="h-4 w-4 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {data?.paymentBreakdown && data.paymentBreakdown.length > 0 && (
        <PaymentDonutChart breakdown={data.paymentBreakdown} />
      )}

      <CommissionSettingsDialog open={commissionsOpen} onOpenChange={setCommissionsOpen} />
    </div>
  );
}

function FunnelTab({ dateRange }: { dateRange: DateRange }) {
  const url = useMemo(() => {
    const { fromStr, toStr } = getDateRangeStrings(dateRange);
    return `/api/analytics/funnel?from=${fromStr}&to=${toStr}`;
  }, [dateRange]);
  
  const { data, isLoading } = useQuery<FunnelData & { avgCheck?: number }>({
    queryKey: [url],
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(4)].map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  const funnel = data?.funnel || [];
  const maxCount = funnel.length > 0 ? funnel[0].count : 0;
  const lastCount = funnel.length > 0 ? funnel[funnel.length - 1]?.count || 0 : 0;
  const overallConversion = maxCount > 0 ? Math.round(lastCount / maxCount * 100) : 0;

  const stepColors = [
    "bg-blue-500",
    "bg-indigo-500",
    "bg-amber-500",
    "bg-green-500",
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Воронка продаж
          </CardTitle>
          <CardDescription className="flex items-center gap-3">
            <span>Общая конверсия (Посетитель → Оплата): <strong className="text-foreground">{overallConversion}%</strong></span>
            {data?.avgCheck && data.avgCheck > 0 && (
              <span className="text-muted-foreground">· Средний чек: <strong className="text-foreground">{data.avgCheck.toLocaleString("ru-RU")} ₸</strong></span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {funnel.map((step, index) => {
            const percentage = maxCount > 0 ? (step.count / maxCount) * 100 : 0;
            const dropoff = index < funnel.length - 1 ? 100 - step.conversionToNext : 0;
            const conversionFromPrev = index > 0 && funnel[index - 1].count > 0
              ? (step.count / funnel[index - 1].count) * 100
              : 0;
            return (
              <FunnelStep
                key={step.step}
                name={step.step}
                count={step.count}
                percentage={percentage}
                dropoff={dropoff}
                conversionFromPrev={conversionFromPrev}
                isLast={index === funnel.length - 1}
                isFirst={index === 0}
                index={index}
                color={stepColors[index] || "bg-primary"}
              />
            );
          })}
          {funnel.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              <BarChart3 className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Нет данных за выбранный период</p>
            </div>
          )}
        </CardContent>
      </Card>
      
      {data?.recommendations && data.recommendations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Target className="h-5 w-5" />
              Рекомендации
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2">
              {data.recommendations.map((rec, i) => (
                <li key={i} className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 mt-1 text-green-500 shrink-0" />
                  <span className="text-sm">{rec}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function ProductsTab({ dateRange }: { dateRange: DateRange }) {
  const [sortBy, setSortBy] = useState<string>("revenue");
  const url = useMemo(() => {
    const { fromStr, toStr } = getDateRangeStrings(dateRange);
    return `/api/analytics/products?from=${fromStr}&to=${toStr}&sortBy=${sortBy}`;
  }, [dateRange, sortBy]);
  
  const { data, isLoading } = useQuery<ProductAnalyticsData>({
    queryKey: [url],
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

  const products = data?.products || [];

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle>Аналитика товаров</CardTitle>
            <CardDescription>
              {data?.totals && (
                <span>Всего: {formatCurrency(data.totals.revenue)} / {data.totals.orders} заказов</span>
              )}
            </CardDescription>
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
        {products.length > 0 ? (
          <div className="space-y-3">
            {products.map((product, index) => (
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
                      {product.conversion.toFixed(1)}% конв.
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
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const url = useMemo(() => {
    const { fromStr, toStr } = getDateRangeStrings(dateRange);
    const statusParam = statusFilter !== "all" ? `&status=${statusFilter}` : "";
    return `/api/analytics/orders?from=${fromStr}&to=${toStr}${statusParam}`;
  }, [dateRange, statusFilter]);
  
  const { data, isLoading } = useQuery<OrderAnalyticsData>({
    queryKey: [url],
  });

  const formatCurrency = (value: string | number) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat("ru-KZ").format(num) + " ₸";
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const orders = data?.orders || [];

  const exportToCSV = () => {
    if (orders.length === 0) return;
    
    const headers = ["Номер", "Клиент", "Телефон", "Сумма", "Статус", "Дата"];
    const rows = orders.map((o) => [
      o.orderNumber,
      o.customerName,
      o.customerPhone,
      o.total,
      o.status,
      new Date(o.createdAt).toISOString(),
    ]);
    
    const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const csvUrl = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = csvUrl;
    a.download = `orders_${dateRange}_${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(csvUrl);
  };

  const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    new: { label: "Новый", variant: "default" },
    processing: { label: "В работе", variant: "secondary" },
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
            <CardDescription>
              {data?.summary && (
                <span>{data.summary.total} заказов · {formatCurrency(data.summary.revenue)}</span>
              )}
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-32" data-testid="select-status-filter">
                <SelectValue placeholder="Статус" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все</SelectItem>
                <SelectItem value="new">Новые</SelectItem>
                <SelectItem value="processing">В работе</SelectItem>
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
        {orders.length > 0 ? (
          <div className="space-y-3">
            {orders.map((order, index) => (
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

interface CartItem {
  productId: string;
  name: string;
  qty: number;
  price: number;
}

function AbandonedCartsTab({ dateRange }: { dateRange: DateRange }) {
  const { toast } = useToast();
  const [selectedCart, setSelectedCart] = useState<CartSession | null>(null);
  const [note, setNote] = useState("");
  const url = useMemo(() => {
    const { fromStr, toStr } = getDateRangeStrings(dateRange);
    return `/api/analytics/abandoned?from=${fromStr}&to=${toStr}`;
  }, [dateRange]);
  
  const { data, isLoading } = useQuery<AbandonedCartsData>({
    queryKey: [url],
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, processedStatus, note }: { id: string; processedStatus: string; note?: string }) => {
      return apiRequest("PATCH", `/api/analytics/abandoned/${id}`, { processedStatus, note });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ 
        predicate: (query) => {
          const key = query.queryKey[0];
          return typeof key === 'string' && key.startsWith('/api/analytics/abandoned');
        }
      });
      toast({ title: "Статус обновлён" });
      setSelectedCart(null);
    },
  });

  const formatCurrency = (value: number | string) => {
    const num = typeof value === 'string' ? parseFloat(value) : value;
    return new Intl.NumberFormat("ru-KZ").format(num || 0) + " ₸";
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const parseCartJson = (cartJson: string | null): CartItem[] => {
    if (!cartJson) return [];
    try {
      return JSON.parse(cartJson);
    } catch {
      return [];
    }
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

  const sessions = data?.sessions || [];
  const summary = data?.summary;

  return (
    <>
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard
            title="Брошенных корзин"
            value={summary?.total || 0}
            icon={ShoppingCart}
            index={0}
          />
          <StatCard
            title="С контактами"
            value={summary?.withPhone || 0}
            subtitle="Можно связаться"
            icon={Phone}
            index={1}
          />
          <StatCard
            title="Потенциальная выручка"
            value={formatCurrency(summary?.totalValue || 0)}
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
            {sessions.length > 0 ? (
              <div className="space-y-3">
                {sessions.map((cart, index) => {
                  const status = statusLabels[cart.processedStatus] || statusLabels.not_processed;
                  const StatusIcon = status.icon;
                  const cartItems = parseCartJson(cart.cartJson);
                  
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
                              {cart.lastStep || "Корзина"}
                            </Badge>
                          </div>
                          <div className="flex items-center gap-3 text-sm text-muted-foreground">
                            {cart.checkoutPhone && (
                              <span className="flex items-center gap-1">
                                <Phone className="h-3 w-3" />
                                {cart.checkoutPhone}
                              </span>
                            )}
                            {cart.checkoutEmail && (
                              <span className="flex items-center gap-1">
                                <Mail className="h-3 w-3" />
                                {cart.checkoutEmail}
                              </span>
                            )}
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDate(cart.createdAt)}
                            </span>
                          </div>
                          <div className="mt-2 text-sm">
                            {cartItems.slice(0, 2).map((item: CartItem, i: number) => (
                              <span key={i} className="mr-2">
                                {item.name} x{item.qty}
                              </span>
                            ))}
                            {cartItems.length > 2 && (
                              <span className="text-muted-foreground">
                                +{cartItems.length - 2} ещё
                              </span>
                            )}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold">{formatCurrency(cart.totalEstimated || 0)}</p>
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
          {selectedCart && (() => {
            const cartItems = parseCartJson(selectedCart.cartJson);
            return (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="font-medium">Товары:</p>
                {cartItems.map((item: CartItem, i: number) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span>{item.name} x{item.qty}</span>
                    <span>{formatCurrency(item.price * item.qty)}</span>
                  </div>
                ))}
                <div className="flex justify-between font-bold pt-2 border-t">
                  <span>Итого:</span>
                  <span>{formatCurrency(selectedCart.totalEstimated || 0)}</span>
                </div>
              </div>

              {(selectedCart.checkoutPhone || selectedCart.checkoutEmail) && (
                <div className="space-y-1">
                  <p className="font-medium">Контакты:</p>
                  {selectedCart.checkoutPhone && (
                    <a
                      href={`tel:${selectedCart.checkoutPhone}`}
                      className="flex items-center gap-2 text-primary hover:underline"
                    >
                      <Phone className="h-4 w-4" />
                      {selectedCart.checkoutPhone}
                    </a>
                  )}
                  {selectedCart.checkoutEmail && (
                    <a
                      href={`mailto:${selectedCart.checkoutEmail}`}
                      className="flex items-center gap-2 text-primary hover:underline"
                    >
                      <Mail className="h-4 w-4" />
                      {selectedCart.checkoutEmail}
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
          );
          })()}
        </DialogContent>
      </Dialog>
    </>
  );
}

function PromotionsTab({ dateRange }: { dateRange: DateRange }) {
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

function TrafficSourcesTab({ dateRange }: { dateRange: DateRange }) {
  const url = useMemo(() => {
    const { fromStr, toStr } = getDateRangeStrings(dateRange);
    return `/api/analytics/traffic-sources?from=${fromStr}&to=${toStr}`;
  }, [dateRange]);

  const { data, isLoading } = useQuery<TrafficSourcesData>({
    queryKey: [url],
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, i) => (
          <CardSkeleton key={i} />
        ))}
      </div>
    );
  }

  const referrers = data?.referrers || [];
  const utmSources = data?.utmSources || [];
  const totalVisitors = data?.totalVisitors || 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Globe className="h-5 w-5" />
            Источники трафика
          </CardTitle>
          <CardDescription>
            Откуда приходят посетители ({totalVisitors} уникальных)
          </CardDescription>
        </CardHeader>
        <CardContent>
          {referrers.length > 0 ? (
            <div className="space-y-3">
              {referrers.map((ref, index) => (
                <motion.div
                  key={ref.source}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="flex items-center justify-between py-2 border-b last:border-0"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-sm font-medium text-muted-foreground w-5 shrink-0">
                      {index + 1}
                    </span>
                    <span className="truncate">{ref.source}</span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Badge variant="secondary">{ref.visitors}</Badge>
                    <span className="text-sm text-muted-foreground w-12 text-right">
                      {ref.percentage}%
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Globe className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Нет данных об источниках</p>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            UTM-метки
          </CardTitle>
          <CardDescription>
            Рекламные кампании и источники
          </CardDescription>
        </CardHeader>
        <CardContent>
          {utmSources.length > 0 ? (
            <div className="space-y-3">
              {utmSources.map((utm, index) => (
                <motion.div
                  key={`${utm.source}-${utm.medium}-${utm.campaign}`}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className="py-2 border-b last:border-0"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium truncate">{utm.source}</p>
                      <p className="text-sm text-muted-foreground">
                        {utm.medium !== '-' && <span>{utm.medium}</span>}
                        {utm.campaign !== '-' && <span> / {utm.campaign}</span>}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge variant="secondary">{utm.visitors}</Badge>
                      <span className="text-sm text-muted-foreground w-12 text-right">
                        {utm.percentage}%
                      </span>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>Нет UTM-меток</p>
              <p className="text-sm">Добавляйте ?utm_source=... к ссылкам</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
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
          <TabsList className="grid grid-cols-4 sm:grid-cols-7 w-full">
            <TabsTrigger value="overview" data-testid="tab-overview">Обзор</TabsTrigger>
            <TabsTrigger value="funnel" data-testid="tab-funnel">Воронка</TabsTrigger>
            <TabsTrigger value="traffic" data-testid="tab-traffic">Источники</TabsTrigger>
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
            <TabsContent value="traffic" className="m-0">
              <TrafficSourcesTab dateRange={dateRange} />
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
