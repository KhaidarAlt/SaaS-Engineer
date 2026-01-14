import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  Building2,
  Users,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/DashboardLayout";
import { CardSkeleton } from "@/components/LoadingSpinner";

interface AdminStats {
  totalTenants: number;
  activeTenants: number;
  suspendedTenants: number;
  newTenantsThisMonth: number;
  expiringSubscriptions: number;
  totalUsers: number;
  totalRevenue: number;
}

interface RecentTenant {
  id: string;
  name: string;
  slug: string;
  status: string;
  planName: string;
  createdAt: string;
}

function StatCard({
  title,
  value,
  subtitle,
  icon: Icon,
  variant = "default",
  index,
}: {
  title: string;
  value: string | number;
  subtitle?: string;
  icon: React.ElementType;
  variant?: "default" | "success" | "warning" | "danger";
  index: number;
}) {
  const iconColors = {
    default: "text-primary bg-primary/10",
    success: "text-green-500 bg-green-500/10",
    warning: "text-orange-500 bg-orange-500/10",
    danger: "text-red-500 bg-red-500/10",
  };

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
            </div>
            <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${iconColors[variant]}`}>
              <Icon className="h-5 w-5" />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

export default function AdminOverview() {
  const { data: stats, isLoading: statsLoading } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
  });

  const { data: recentTenants, isLoading: tenantsLoading } = useQuery<RecentTenant[]>({
    queryKey: ["/api/admin/tenants", { limit: 5 }],
  });

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat("ru-KZ").format(value) + " ₸";
  };

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "short",
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return { label: "Активен", variant: "default" as const };
      case "suspended":
        return { label: "Приостановлен", variant: "secondary" as const };
      case "banned":
        return { label: "Заблокирован", variant: "destructive" as const };
      default:
        return { label: status, variant: "outline" as const };
    }
  };

  return (
    <DashboardLayout isSuperAdmin>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Панель администратора</h1>
          <p className="text-muted-foreground">
            Обзор платформы SmartCatalog
          </p>
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
              title="Всего тенантов"
              value={stats?.totalTenants || 0}
              subtitle={`+${stats?.newTenantsThisMonth || 0} за месяц`}
              icon={Building2}
              index={0}
            />
            <StatCard
              title="Активные"
              value={stats?.activeTenants || 0}
              icon={CheckCircle2}
              variant="success"
              index={1}
            />
            <StatCard
              title="Приостановленные"
              value={stats?.suspendedTenants || 0}
              icon={Clock}
              variant="warning"
              index={2}
            />
            <StatCard
              title="Истекает подписка"
              value={stats?.expiringSubscriptions || 0}
              subtitle="в течение 7 дней"
              icon={AlertCircle}
              variant="danger"
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
              <CardHeader>
                <CardTitle className="text-lg">Последние тенанты</CardTitle>
              </CardHeader>
              <CardContent>
                {tenantsLoading ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="h-16 bg-muted rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : recentTenants && recentTenants.length > 0 ? (
                  <div className="space-y-3">
                    {recentTenants.map((tenant) => (
                      <div
                        key={tenant.id}
                        className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div>
                          <p className="font-medium">{tenant.name}</p>
                          <p className="text-sm text-muted-foreground">
                            /{tenant.slug} · {tenant.planName}
                          </p>
                        </div>
                        <div className="text-right">
                          <Badge variant={getStatusBadge(tenant.status).variant}>
                            {getStatusBadge(tenant.status).label}
                          </Badge>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatDate(tenant.createdAt)}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <Building2 className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
                    <p className="text-muted-foreground">Пока нет тенантов</p>
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
                <CardTitle className="text-lg">Метрики</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Users className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">Пользователи</p>
                      <p className="text-sm text-muted-foreground">Всего зарегистрировано</p>
                    </div>
                  </div>
                  <span className="text-xl font-bold">{stats?.totalUsers || 0}</span>
                </div>
                <div className="flex items-center justify-between py-2">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                      <TrendingUp className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <p className="font-medium">Выручка</p>
                      <p className="text-sm text-muted-foreground">За текущий месяц</p>
                    </div>
                  </div>
                  <span className="text-xl font-bold">
                    {formatCurrency(stats?.totalRevenue || 0)}
                  </span>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </DashboardLayout>
  );
}
