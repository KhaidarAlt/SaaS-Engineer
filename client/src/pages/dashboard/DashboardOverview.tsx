import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Package,
  ShoppingCart,
  Users,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Plus,
  Upload,
  Zap,
  Check,
  Lock,
} from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { DashboardLayout } from "@/components/DashboardLayout";
import { CardSkeleton } from "@/components/LoadingSpinner";
import { useAuth } from "@/contexts/AuthContext";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

interface DashboardStats {
  totalProducts: number;
  activeProducts: number;
  totalOrders: number;
  pendingOrders: number;
  totalVisitors: number;
  revenue: number;
  conversionRate: number;
}

interface RecentOrder {
  id: string;
  orderNumber: string;
  customerName: string;
  total: string;
  status: string;
  createdAt: string;
}

interface TenantData {
  id: string;
  name: string;
  importSource?: string | null;
  catalogProductLimit: number;
  status: string;
}

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  new: { label: "Новый", variant: "default" },
  in_progress: { label: "В работе", variant: "secondary" },
  completed: { label: "Выполнен", variant: "outline" },
  cancelled: { label: "Отменён", variant: "destructive" },
};

const PACKAGES = [
  {
    type: "1000" as const,
    label: "+1 000 товаров",
    price: 6990,
    description: "Идеально для растущего каталога",
    icon: Zap,
  },
  {
    type: "5000" as const,
    label: "+5 000 товаров",
    price: 12990,
    description: "Для крупных магазинов",
    icon: Zap,
    highlight: true,
  },
];

function StatCard({
  title,
  value,
  change,
  changeType,
  icon: Icon,
  index,
}: {
  title: string;
  value: string | number;
  change?: string;
  changeType?: "up" | "down";
  icon: React.ElementType;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.1 }}
    >
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">{title}</p>
              <p className="text-2xl font-bold">{value}</p>
              {change && (
                <div className="flex items-center gap-1 mt-1">
                  {changeType === "up" ? (
                    <ArrowUpRight className="h-4 w-4 text-green-500" />
                  ) : (
                    <ArrowDownRight className="h-4 w-4 text-red-500" />
                  )}
                  <span
                    className={`text-sm ${
                      changeType === "up" ? "text-green-500" : "text-red-500"
                    }`}
                  >
                    {change}
                  </span>
                </div>
              )}
            </div>
            <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Icon className="h-5 w-5 text-primary" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

function CatalogLimitCard({
  totalProducts,
  catalogProductLimit,
  onUpgrade,
}: {
  totalProducts: number;
  catalogProductLimit: number;
  onUpgrade: () => void;
}) {
  const pct = Math.min(100, Math.round((totalProducts / catalogProductLimit) * 100));
  const isNearLimit = pct >= 80;
  const isAtLimit = totalProducts >= catalogProductLimit;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.4 }}
    >
      <Card className={isAtLimit ? "border-destructive/50" : isNearLimit ? "border-yellow-400/50" : ""}>
        <CardContent className="p-6">
          <div className="flex items-start justify-between mb-4">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Лимит каталога</p>
              <p className="text-2xl font-bold">
                {totalProducts} <span className="text-sm font-normal text-muted-foreground">/ {catalogProductLimit}</span>
              </p>
            </div>
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isAtLimit ? "bg-destructive/10" : "bg-primary/10"}`}>
              {isAtLimit ? <Lock className="h-5 w-5 text-destructive" /> : <Package className="h-5 w-5 text-primary" />}
            </div>
          </div>
          <Progress value={pct} className={`h-2 mb-3 ${isAtLimit ? "[&>div]:bg-destructive" : isNearLimit ? "[&>div]:bg-yellow-400" : ""}`} />
          {isAtLimit ? (
            <div className="space-y-2">
              <p className="text-xs text-destructive font-medium">Лимит достигнут — новые товары не добавляются</p>
              <Button size="sm" className="w-full gap-2" onClick={onUpgrade} data-testid="button-upgrade-limit">
                <Zap className="h-4 w-4" />
                Расширить лимит
              </Button>
            </div>
          ) : isNearLimit ? (
            <div className="space-y-2">
              <p className="text-xs text-yellow-600 dark:text-yellow-400 font-medium">Осталось {catalogProductLimit - totalProducts} позиций</p>
              <Button size="sm" variant="outline" className="w-full gap-2" onClick={onUpgrade} data-testid="button-upgrade-limit">
                <Zap className="h-4 w-4" />
                Расширить лимит
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">Осталось {catalogProductLimit - totalProducts} позиций из {catalogProductLimit}</p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}

function UpgradeModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [selectedPkg, setSelectedPkg] = useState<"1000" | "5000" | null>(null);
  const [step, setStep] = useState<"select" | "payment" | "done">("select");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const requestMutation = useMutation({
    mutationFn: async (packageType: "1000" | "5000") => {
      const res = await apiRequest("POST", "/api/scrape-packages/request", { packageType });
      return res.json();
    },
    onSuccess: () => {
      setStep("payment");
      queryClient.invalidateQueries({ queryKey: ["/api/scrape-packages/my"] });
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Ошибка запроса";
      toast({ title: "Ошибка", description: msg, variant: "destructive" });
    },
  });

  const handleClose = () => {
    setStep("select");
    setSelectedPkg(null);
    onClose();
  };

  const handleRequest = () => {
    if (!selectedPkg) return;
    requestMutation.mutate(selectedPkg);
  };

  const selectedPackage = PACKAGES.find(p => p.type === selectedPkg);
  const KASPI_PHONE = "77001234567";

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        {step === "select" && (
          <>
            <DialogHeader>
              <DialogTitle>Расширить лимит товаров</DialogTitle>
              <DialogDescription>
                Выберите пакет для расширения каталога
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-3 my-2">
              {PACKAGES.map((pkg) => (
                <button
                  key={pkg.type}
                  type="button"
                  onClick={() => setSelectedPkg(pkg.type)}
                  data-testid={`package-option-${pkg.type}`}
                  className={`w-full text-left p-4 rounded-xl border-2 transition-all ${
                    selectedPkg === pkg.type
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  } ${pkg.highlight ? "relative overflow-hidden" : ""}`}
                >
                  {pkg.highlight && (
                    <span className="absolute top-2 right-2 text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded-full">Выгодно</span>
                  )}
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${selectedPkg === pkg.type ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                      <pkg.icon className="h-4 w-4" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold">{pkg.label}</p>
                      <p className="text-xs text-muted-foreground">{pkg.description}</p>
                    </div>
                    <div className="text-right">
                      <p className="font-bold">{pkg.price.toLocaleString("ru-KZ")} ₸</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <Button
              className="w-full"
              onClick={handleRequest}
              disabled={!selectedPkg || requestMutation.isPending}
              data-testid="button-confirm-package"
            >
              {requestMutation.isPending ? "Отправляем запрос..." : "Выбрать пакет"}
            </Button>
          </>
        )}

        {step === "payment" && selectedPackage && (
          <>
            <DialogHeader>
              <DialogTitle>Оплата пакета</DialogTitle>
              <DialogDescription>
                Переведите оплату через Kaspi и нажмите «Я оплатил»
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 my-2">
              <div className="bg-muted rounded-xl p-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Пакет</span>
                  <span className="font-medium">{selectedPackage.label}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Сумма</span>
                  <span className="font-bold">{selectedPackage.price.toLocaleString("ru-KZ")} ₸</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Kaspi номер</span>
                  <span className="font-mono font-medium">{KASPI_PHONE}</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground text-center">
                После подтверждения оплаты администратором лимит будет увеличен автоматически
              </p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" className="flex-1" onClick={handleClose}>
                Закрыть
              </Button>
              <Button
                className="flex-1 gap-2"
                onClick={() => setStep("done")}
                data-testid="button-paid-confirmed"
              >
                <Check className="h-4 w-4" />
                Я оплатил
              </Button>
            </div>
          </>
        )}

        {step === "done" && (
          <>
            <DialogHeader>
              <DialogTitle>Спасибо!</DialogTitle>
              <DialogDescription>
                Ваш запрос отправлен
              </DialogDescription>
            </DialogHeader>
            <div className="py-4 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto">
                <Check className="h-8 w-8 text-green-600" />
              </div>
              <p className="text-sm text-muted-foreground">
                Мы проверим оплату и расширим лимит в течение нескольких часов
              </p>
            </div>
            <Button className="w-full" onClick={handleClose} data-testid="button-close-upgrade">
              Закрыть
            </Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default function DashboardOverview() {
  const { user } = useAuth();
  const [upgradeModalOpen, setUpgradeModalOpen] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: recentOrders, isLoading: ordersLoading } = useQuery<RecentOrder[]>({
    queryKey: ["/api/orders"],
  });

  const { data: tenant } = useQuery<TenantData>({
    queryKey: ["/api/tenant"],
    enabled: !!user?.tenantId,
  });

  const showCatalogLimit = !!tenant?.importSource;

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("ru-KZ", {
      style: "decimal",
      minimumFractionDigits: 0,
    }).format(value) + " ₸";
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Добро пожаловать, {user?.name?.split(" ")[0]}!
            </h1>
            <p className="text-muted-foreground">
              Вот что происходит в вашем магазине сегодня
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/dashboard/products/new">
              <Button data-testid="button-add-product">
                <Plus className="h-4 w-4 mr-2" />
                Добавить товар
              </Button>
            </Link>
            <Button variant="outline" data-testid="button-import">
              <Upload className="h-4 w-4 mr-2" />
              Импорт
            </Button>
          </div>
        </div>

        {statsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <div className={`grid grid-cols-1 sm:grid-cols-2 gap-4 ${showCatalogLimit ? "lg:grid-cols-5" : "lg:grid-cols-4"}`}>
            <StatCard
              title="Товары"
              value={stats?.totalProducts || 0}
              change={`${stats?.activeProducts || 0} активных`}
              changeType="up"
              icon={Package}
              index={0}
            />
            <StatCard
              title="Заказы"
              value={stats?.totalOrders || 0}
              change={`${stats?.pendingOrders || 0} новых`}
              changeType="up"
              icon={ShoppingCart}
              index={1}
            />
            <StatCard
              title="Посетители"
              value={stats?.totalVisitors || 0}
              icon={Users}
              index={2}
            />
            <StatCard
              title="Выручка"
              value={formatCurrency(stats?.revenue || 0)}
              change={`${stats?.conversionRate?.toFixed(1) || 0}% конверсия`}
              changeType="up"
              icon={TrendingUp}
              index={3}
            />
            {showCatalogLimit && tenant && (
              <CatalogLimitCard
                totalProducts={stats?.totalProducts || 0}
                catalogProductLimit={tenant.catalogProductLimit ?? 200}
                onUpgrade={() => setUpgradeModalOpen(true)}
              />
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.4 }}
          >
            <Card>
              <CardHeader className="flex flex-row items-center justify-between gap-2">
                <CardTitle className="text-lg">Последние заказы</CardTitle>
                <Link href="/dashboard/orders">
                  <Button variant="ghost" size="sm" data-testid="link-all-orders">
                    Все заказы
                  </Button>
                </Link>
              </CardHeader>
              <CardContent>
                {ordersLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : recentOrders && recentOrders.length > 0 ? (
                  <div className="space-y-3">
                    {recentOrders.slice(0, 5).map((order) => (
                      <Link key={order.id} href={`/dashboard/orders/${order.id}`}>
                        <div className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                          <div>
                            <p className="font-medium">#{order.orderNumber}</p>
                            <p className="text-sm text-muted-foreground">
                              {order.customerName}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">{formatCurrency(parseFloat(order.total))}</p>
                            <Badge variant={statusLabels[order.status]?.variant || "secondary"}>
                              {statusLabels[order.status]?.label || order.status}
                            </Badge>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <ShoppingCart className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-muted-foreground">Пока нет заказов</p>
                    <p className="text-sm text-muted-foreground">
                      Заказы появятся здесь, когда клиенты начнут покупать
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay: 0.5 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Быстрые действия</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Link href="/dashboard/products/new">
                  <Button variant="outline" className="w-full justify-start gap-3" data-testid="quick-add-product">
                    <Plus className="h-4 w-4" />
                    Добавить товар
                  </Button>
                </Link>
                <Link href="/dashboard/categories/new">
                  <Button variant="outline" className="w-full justify-start gap-3" data-testid="quick-add-category">
                    <Plus className="h-4 w-4" />
                    Добавить категорию
                  </Button>
                </Link>
                <Link href="/dashboard/discounts/new">
                  <Button variant="outline" className="w-full justify-start gap-3" data-testid="quick-add-discount">
                    <Plus className="h-4 w-4" />
                    Создать скидку
                  </Button>
                </Link>
                <Button variant="outline" className="w-full justify-start gap-3" data-testid="quick-import">
                  <Upload className="h-4 w-4" />
                  Импортировать каталог
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>

      <UpgradeModal open={upgradeModalOpen} onClose={() => setUpgradeModalOpen(false)} />
    </DashboardLayout>
  );
}
