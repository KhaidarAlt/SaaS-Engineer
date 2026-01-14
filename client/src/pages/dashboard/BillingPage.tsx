import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import {
  CreditCard,
  Calendar,
  CheckCircle2,
  AlertCircle,
  Clock,
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
}

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

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("ru-KZ").format(price) + " ₸";
  };

  const formatDate = (date: string | Date) => {
    return new Date(date).toLocaleDateString("ru-RU", {
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const getStatusBadge = (status: string, daysLeft: number) => {
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
          <h1 className="text-2xl font-bold tracking-tight">Биллинг</h1>
          <p className="text-muted-foreground">
            Управляйте подпиской и отслеживайте использование
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
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Текущий тариф
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="text-2xl font-bold">
                          {billing.subscription.plan.name}
                        </h3>
                        <p className="text-muted-foreground">
                          {formatPrice(billing.subscription.plan.price)} / месяц
                        </p>
                      </div>
                      <Badge
                        variant={
                          getStatusBadge(billing.subscription.status, billing.daysLeft)
                            .variant
                        }
                      >
                        {getStatusBadge(billing.subscription.status, billing.daysLeft)
                          .label}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>
                        Действует до: {formatDate(billing.subscription.endsAt)}
                      </span>
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
                    <CardTitle className="text-lg">Использование лимитов</CardTitle>
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
                    <UsageBar
                      label="AI-сообщения (в месяц)"
                      current={billing.usage.aiMessages.current}
                      limit={billing.usage.aiMessages.limit}
                    />
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
                  <CardTitle className="text-lg">Все тарифы</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {[
                      {
                        name: "Старт",
                        price: 19900,
                        features: ["300 товаров", "30 категорий", "500 AI-сообщ."],
                      },
                      {
                        name: "Про",
                        price: 49900,
                        features: ["3 000 товаров", "200 категорий", "5 000 AI-сообщ."],
                        popular: true,
                      },
                      {
                        name: "Бизнес",
                        price: 99900,
                        features: [
                          "20 000 товаров",
                          "1 000 категорий",
                          "20 000 AI-сообщ.",
                        ],
                      },
                    ].map((plan) => (
                      <div
                        key={plan.name}
                        className={`p-4 rounded-lg border ${
                          plan.popular ? "ring-2 ring-primary" : ""
                        } ${
                          billing.subscription.plan.name === plan.name
                            ? "bg-primary/5"
                            : ""
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <h4 className="font-semibold">{plan.name}</h4>
                          {plan.popular && (
                            <Badge variant="secondary">Популярный</Badge>
                          )}
                        </div>
                        <p className="text-xl font-bold mb-3">
                          {formatPrice(plan.price)}
                          <span className="text-sm text-muted-foreground font-normal">
                            {" "}
                            / мес
                          </span>
                        </p>
                        <ul className="text-sm space-y-1 text-muted-foreground">
                          {plan.features.map((f) => (
                            <li key={f} className="flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4 text-primary" />
                              {f}
                            </li>
                          ))}
                        </ul>
                        {billing.subscription.plan.name !== plan.name && (
                          <Button variant="outline" className="w-full mt-4" size="sm">
                            Выбрать
                          </Button>
                        )}
                      </div>
                    ))}
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
              <Button>Выбрать тариф</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
