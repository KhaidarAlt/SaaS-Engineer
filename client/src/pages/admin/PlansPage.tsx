import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CreditCard, CheckCircle2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DashboardLayout } from "@/components/DashboardLayout";
import { CardSkeleton } from "@/components/LoadingSpinner";
import type { Plan } from "@shared/schema";

export default function PlansPage() {
  const { data: plans, isLoading } = useQuery<Plan[]>({
    queryKey: ["/api/admin/plans"],
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("ru-KZ").format(price) + " ₸";
  };

  return (
    <DashboardLayout isSuperAdmin>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Тарифы</h1>
          <p className="text-muted-foreground">
            Управление тарифными планами
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[...Array(3)].map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : plans && plans.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {plans.map((plan, index) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className="h-full">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl">{plan.name}</CardTitle>
                      <Badge variant={plan.isActive ? "default" : "secondary"}>
                        {plan.isActive ? "Активен" : "Неактивен"}
                      </Badge>
                    </div>
                    <div className="mt-2">
                      <span className="text-3xl font-bold">{formatPrice(plan.price)}</span>
                      <span className="text-muted-foreground"> / {plan.periodDays} дней</span>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <span>До {plan.maxProducts} товаров</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <span>До {plan.maxCategories} категорий</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <span>До {plan.maxPromotions} акций</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <span>До {plan.maxDiscountRules} правил скидок</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <span>До {plan.maxManagers} менеджеров</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <span>До {plan.maxWahaInstances} WhatsApp каналов</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <span>{plan.aiMessagesLimit} AI-сообщений/мес</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-16 text-center">
              <CreditCard className="h-12 w-12 text-muted-foreground/50 mx-auto mb-3" />
              <p className="font-medium">Нет тарифов</p>
              <p className="text-sm text-muted-foreground">
                Тарифы будут созданы автоматически при первом запуске
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </DashboardLayout>
  );
}
