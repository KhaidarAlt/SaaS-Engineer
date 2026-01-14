import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  TrendingUp,
  ShoppingCart,
  Users,
  Eye,
  Package,
  ArrowUpRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/DashboardLayout";
import { CardSkeleton } from "@/components/LoadingSpinner";

interface AnalyticsData {
  totalVisits: number;
  uniqueVisitors: number;
  productViews: number;
  addToCart: number;
  checkoutStarts: number;
  ordersCreated: number;
  revenue: number;
  conversionRate: number;
  abandonedCarts: number;
  topProducts: Array<{
    id: string;
    name: string;
    views: number;
    orders: number;
    revenue: number;
  }>;
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  index,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  trend?: number;
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
              {subtitle && (
                <p className="text-sm text-muted-foreground mt-1">{subtitle}</p>
              )}
              {trend !== undefined && (
                <div className="flex items-center gap-1 mt-1">
                  <ArrowUpRight className="h-4 w-4 text-green-500" />
                  <span className="text-sm text-green-500">+{trend}%</span>
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

export default function AnalyticsPage() {
  const { data: analytics, isLoading } = useQuery<AnalyticsData>({
    queryKey: ["/api/analytics"],
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("ru-KZ").format(value) + " ₸";
  };

  const formatPercent = (value: number) => {
    return value.toFixed(1) + "%";
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Аналитика</h1>
          <p className="text-muted-foreground">
            Отслеживайте эффективность вашего каталога
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(8)].map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                title="Посещения"
                value={analytics?.totalVisits || 0}
                subtitle={`${analytics?.uniqueVisitors || 0} уникальных`}
                icon={Users}
                index={0}
              />
              <StatCard
                title="Просмотры товаров"
                value={analytics?.productViews || 0}
                icon={Eye}
                index={1}
              />
              <StatCard
                title="Добавлено в корзину"
                value={analytics?.addToCart || 0}
                icon={ShoppingCart}
                index={2}
              />
              <StatCard
                title="Заказы"
                value={analytics?.ordersCreated || 0}
                icon={Package}
                index={3}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <StatCard
                title="Выручка"
                value={formatCurrency(analytics?.revenue || 0)}
                icon={TrendingUp}
                index={4}
              />
              <StatCard
                title="Конверсия"
                value={formatPercent(analytics?.conversionRate || 0)}
                subtitle="Заказы / Посещения"
                icon={TrendingUp}
                index={5}
              />
              <StatCard
                title="Брошенные корзины"
                value={analytics?.abandonedCarts || 0}
                icon={ShoppingCart}
                index={6}
              />
            </div>
          </>
        )}

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.7 }}
        >
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Топ товаров</CardTitle>
            </CardHeader>
            <CardContent>
              {analytics?.topProducts && analytics.topProducts.length > 0 ? (
                <div className="space-y-4">
                  {analytics.topProducts.map((product, index) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between py-2 border-b last:border-0"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-muted-foreground w-6">
                          {index + 1}
                        </span>
                        <div>
                          <p className="font-medium">{product.name}</p>
                          <p className="text-sm text-muted-foreground">
                            {product.views} просмотров · {product.orders} заказов
                          </p>
                        </div>
                      </div>
                      <Badge variant="secondary">
                        {formatCurrency(product.revenue)}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Package className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                  <p className="text-muted-foreground">Пока нет данных</p>
                  <p className="text-sm text-muted-foreground">
                    Статистика появится после первых посещений каталога
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
