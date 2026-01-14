import { useQuery } from "@tanstack/react-query";
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
} from "lucide-react";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/DashboardLayout";
import { CardSkeleton } from "@/components/LoadingSpinner";
import { useAuth } from "@/contexts/AuthContext";

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

const statusLabels: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  new: { label: "Новый", variant: "default" },
  in_progress: { label: "В работе", variant: "secondary" },
  completed: { label: "Выполнен", variant: "outline" },
  cancelled: { label: "Отменён", variant: "destructive" },
};

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

export default function DashboardOverview() {
  const { user } = useAuth();

  const { data: stats, isLoading: statsLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: recentOrders, isLoading: ordersLoading } = useQuery<RecentOrder[]>({
    queryKey: ["/api/orders"],
  });

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
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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
    </DashboardLayout>
  );
}
