import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  CreditCard,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
  Crown,
  MessageSquare,
  Package,
  Shield,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DashboardLayout } from "@/components/DashboardLayout";
import { CardSkeleton } from "@/components/LoadingSpinner";
import { useAuth } from "@/contexts/AuthContext";
import type { Plan, Subscription } from "@shared/schema";

interface BillingData {
  subscription: Subscription & { plan: Plan };
  usage: {
    products: { current: number; limit: number };
    categories: { current: number; limit: number };
    promotions: { current: number; limit: number };
    discounts: { current: number; limit: number };
    managers: { current: number; limit: number };
    aiMessages: { current: number; limit: number };
  };
  daysLeft: number;
  overage?: {
    dialogs: number;
    costPerDialog: number;
    totalCost: number;
  };
}

const DIALOG_PACKAGES = [
  { id: "pkg-100", dialogs: 100, price: 5000, popular: false },
  { id: "pkg-300", dialogs: 300, price: 12000, popular: true },
  { id: "pkg-500", dialogs: 500, price: 17500, popular: false },
  { id: "pkg-1000", dialogs: 1000, price: 30000, popular: false },
];

function UsageBar({
  label,
  current,
  limit,
}: {
  label: string;
  current: number;
  limit: number;
}) {
  const percentage = (current / limit) * 100;
  const isNearLimit = percentage >= 80;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className={isNearLimit ? "text-orange-500 font-medium" : "text-muted-foreground"}>
          {current} / {limit}
        </span>
      </div>
      <Progress
        value={Math.min(percentage, 100)}
        className={isNearLimit ? "[&>div]:bg-orange-500" : ""}
      />
    </div>
  );
}

export default function BillingPage() {
  const { user } = useAuth();

  const { data: billing, isLoading } = useQuery<BillingData>({
    queryKey: ["/api/billing"],
  });

  const formatPrice = (price: string | number) => {
    const numPrice = typeof price === "string" ? parseFloat(price) : price;
    return new Intl.NumberFormat("ru-KZ").format(numPrice) + " ₸";
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: string, daysLeft: number) => {
    if (status === "trial") {
      return { label: `Пробный (${daysLeft > 0 ? daysLeft + " дн." : "истёк"})`, variant: "secondary" as const, icon: Clock };
    }
    if (status === "active" && daysLeft > 7) {
      return { label: "Активна", variant: "default" as const, icon: CheckCircle2 };
    }
    if (status === "active" && daysLeft <= 7) {
      return { label: "Скоро истекает", variant: "secondary" as const, icon: Clock };
    }
    return { label: "Истекла", variant: "destructive" as const, icon: AlertCircle };
  };

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight" data-testid="text-billing-title">Биллинг</h1>
          <p className="text-muted-foreground">
            Управляйте подпиской и пакетами диалогов
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        ) : billing ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <Card className="border-amber-500/20">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Crown className="h-5 w-5 text-amber-500" />
                      Текущий тариф
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="text-2xl font-bold" data-testid="text-plan-name">
                            {billing.subscription.plan.name}
                          </h3>
                          <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 no-default-hover-elevate no-default-active-elevate text-[10px]">
                            Founder
                          </Badge>
                        </div>
                        <p className="text-muted-foreground" data-testid="text-plan-price">
                          {formatPrice(billing.subscription.plan.price)} / год
                        </p>
                      </div>
                      <Badge
                        variant={
                          getStatusBadge(billing.subscription.status, billing.daysLeft)
                            .variant
                        }
                        data-testid="badge-subscription-status"
                      >
                        {getStatusBadge(billing.subscription.status, billing.daysLeft)
                          .label}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span data-testid="text-subscription-end">
                        Действует до: {formatDate(billing.subscription.endsAt)}
                      </span>
                    </div>

                    <div className="rounded-lg border border-border/60 bg-muted/30 p-3 space-y-2">
                      <p className="text-xs font-medium flex items-center gap-1.5 text-muted-foreground">
                        <Shield className="w-3.5 h-3.5" />
                        Гарантии Founder's Edition
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-background border border-border/50">14 дней возврата</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-background border border-border/50">Перенос остатка</span>
                        <span className="text-[11px] px-2 py-0.5 rounded-full bg-background border border-border/50">Цена навсегда</span>
                      </div>
                    </div>

                    {billing.daysLeft <= 7 && (
                      <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/20">
                        <div className="flex items-start gap-3">
                          <AlertCircle className="h-5 w-5 text-orange-500 mt-0.5" />
                          <div>
                            <p className="font-medium text-orange-500">
                              {billing.daysLeft > 0
                                ? `Подписка истекает через ${billing.daysLeft} дней`
                                : "Подписка истекла"}
                            </p>
                            <p className="text-sm text-muted-foreground mt-1">
                              Продлите подписку, чтобы каталог и приём заказов
                              работали без перерыва.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    <Button className="w-full" data-testid="button-extend">
                      Продлить подписку
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
              >
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg" data-testid="text-usage-title">Использование лимитов</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <UsageBar
                      label="Товары"
                      current={billing.usage.products.current}
                      limit={billing.usage.products.limit}
                    />
                    <UsageBar
                      label="Категории"
                      current={billing.usage.categories.current}
                      limit={billing.usage.categories.limit}
                    />
                    <UsageBar
                      label="Скидки"
                      current={billing.usage.discounts.current}
                      limit={billing.usage.discounts.limit}
                    />
                    <UsageBar
                      label="Акции"
                      current={billing.usage.promotions.current}
                      limit={billing.usage.promotions.limit}
                    />
                    <UsageBar
                      label="Менеджеры"
                      current={billing.usage.managers.current}
                      limit={billing.usage.managers.limit}
                    />
                    {billing.usage.aiMessages.limit > 0 && (
                      <>
                        <UsageBar
                          label="Диалоги AI (в месяц)"
                          current={billing.usage.aiMessages.current}
                          limit={billing.usage.aiMessages.limit}
                        />
                        {billing.usage.aiMessages.current > billing.usage.aiMessages.limit && (
                          <div className="text-xs text-orange-500 flex items-center gap-2">
                            <AlertCircle className="w-3 h-3" />
                            <span>Превышен лимит на {billing.usage.aiMessages.current - billing.usage.aiMessages.limit} диалогов</span>
                          </div>
                        )}
                        <p className="text-[11px] text-muted-foreground">
                          Неиспользованные диалоги переносятся на следующий месяц
                        </p>
                      </>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            </div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
            >
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Package className="h-5 w-5" />
                      Пакеты диалогов
                    </CardTitle>
                    <Badge variant="secondary" className="no-default-hover-elevate no-default-active-elevate text-[10px]">
                      Бессрочные
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    Докупите диалоги, если основного лимита недостаточно. Купленные пакеты действуют бессрочно и никогда не сгорают.
                  </p>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    {DIALOG_PACKAGES.map((pkg) => (
                      <div
                        key={pkg.id}
                        className={`relative p-4 rounded-xl border transition-colors ${
                          pkg.popular
                            ? "ring-2 ring-amber-500/50 border-amber-500/30"
                            : "hover:border-primary/30"
                        }`}
                        data-testid={`card-package-${pkg.dialogs}`}
                      >
                        {pkg.popular && (
                          <div className="absolute -top-2.5 left-1/2 -translate-x-1/2">
                            <Badge className="bg-gradient-to-r from-amber-500 to-amber-600 text-white border-0 no-default-hover-elevate no-default-active-elevate text-[10px] px-2.5 py-0.5">
                              <Sparkles className="w-3 h-3 mr-1" />
                              Выгодный
                            </Badge>
                          </div>
                        )}
                        <div className="text-center space-y-2">
                          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto">
                            <MessageSquare className="w-5 h-5 text-primary" />
                          </div>
                          <div>
                            <p className="text-2xl font-bold">{pkg.dialogs}</p>
                            <p className="text-xs text-muted-foreground">диалогов</p>
                          </div>
                          <div>
                            <p className="text-lg font-semibold">{new Intl.NumberFormat("ru-KZ").format(pkg.price)} ₸</p>
                            <p className="text-[11px] text-muted-foreground">
                              {new Intl.NumberFormat("ru-KZ").format(Math.round(pkg.price / pkg.dialogs))} ₸ / диалог
                            </p>
                          </div>
                          <Button
                            variant={pkg.popular ? "default" : "outline"}
                            size="sm"
                            className="w-full"
                            data-testid={`button-buy-package-${pkg.dialogs}`}
                          >
                            Купить
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.3 }}
            >
              <Card className="border-amber-500/10">
                <CardContent className="p-6">
                  <div className="flex flex-col sm:flex-row items-center gap-4 text-center sm:text-left">
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-600/10 flex items-center justify-center shrink-0">
                      <Crown className="w-6 h-6 text-amber-500" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold">Founder's Edition</h3>
                      <p className="text-sm text-muted-foreground">
                        500 диалогов/мес включено в тариф. Неиспользованные переносятся. Приоритетная поддержка и индивидуальные доработки.
                      </p>
                    </div>
                    <Button variant="outline" size="sm" className="shrink-0" data-testid="button-request-feature">
                      <Sparkles className="w-4 h-4 mr-1.5" />
                      Запросить фичу
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </>
        ) : (
          <Card>
            <CardContent className="py-16 text-center">
              <CreditCard className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="font-medium">Нет активной подписки</p>
              <p className="text-sm text-muted-foreground mb-4">
                Выберите тариф для начала работы
              </p>
              <Button data-testid="button-choose-plan">Выбрать тариф</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}