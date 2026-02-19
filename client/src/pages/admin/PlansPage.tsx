import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { CreditCard, CheckCircle2, Edit, Bot, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { DashboardLayout } from "@/components/DashboardLayout";
import { CardSkeleton } from "@/components/LoadingSpinner";
import { useToast } from "@/hooks/use-toast";
import { queryClient, apiRequest } from "@/lib/queryClient";
import type { Plan } from "@shared/schema";

export default function PlansPage() {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingPlan, setEditingPlan] = useState<Plan | null>(null);
  const [formData, setFormData] = useState({
    price: 0,
    aiMessagesLimit: 0,
  });
  const { toast } = useToast();

  const { data: plans, isLoading } = useQuery<Plan[]>({
    queryKey: ["/api/admin/plans"],
  });

  const updatePlanMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: { price: number; aiMessagesLimit: number } }) => {
      return apiRequest("PATCH", `/api/admin/plans/${id}`, data);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/plans"] });
      toast({ title: "Тариф обновлён" });
      setEditDialogOpen(false);
    },
    onError: () => {
      toast({ title: "Ошибка обновления", variant: "destructive" });
    },
  });

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("ru-KZ").format(price) + " ₸";
  };

  const openEditDialog = (plan: Plan) => {
    setEditingPlan(plan);
    setFormData({
      price: plan.price,
      aiMessagesLimit: plan.aiMessagesLimit,
    });
    setEditDialogOpen(true);
  };

  const handleSave = () => {
    if (editingPlan) {
      updatePlanMutation.mutate({
        id: editingPlan.id,
        data: formData,
      });
    }
  };

  const sortedPlans = plans?.slice().sort((a, b) => a.price - b.price);

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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[...Array(4)].map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : sortedPlans && sortedPlans.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {sortedPlans.map((plan, index) => (
              <motion.div
                key={plan.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card className={`h-full flex flex-col ${plan.name === "Business" ? "border-primary" : ""}`}>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl flex items-center gap-2">
                        {plan.name}
                        {plan.hasAiAccess && <Bot className="h-4 w-4 text-primary" />}
                      </CardTitle>
                      <Badge variant={plan.isActive ? "default" : "secondary"}>
                        {plan.isActive ? "Активен" : "Неактивен"}
                      </Badge>
                    </div>
                    <div className="mt-2">
                      <span className="text-3xl font-bold">
                        {plan.price === 0 ? "Бесплатно" : formatPrice(plan.price)}
                      </span>
                      {plan.price > 0 && (
                        <span className="text-muted-foreground"> / мес</span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 space-y-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <span>До {plan.maxProducts.toLocaleString()} товаров</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                        <span>До {plan.maxCategories} категорий</span>
                      </div>
                      {plan.maxPromotions > 0 && (
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                          <span>До {plan.maxPromotions} акций</span>
                        </div>
                      )}
                      {plan.maxManagers > 0 && (
                        <div className="flex items-center gap-2 text-sm">
                          <CheckCircle2 className="h-4 w-4 text-primary" />
                          <span>До {plan.maxManagers} менеджеров</span>
                        </div>
                      )}
                      {plan.hasAiAccess && (
                        <div className="flex items-center gap-2 text-sm font-medium text-primary">
                          <Bot className="h-4 w-4" />
                          <span>{plan.aiMessagesLimit} диалогов/мес</span>
                        </div>
                      )}
                      {!plan.hasAiAccess && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <X className="h-4 w-4" />
                          <span>Без AI</span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                  <CardFooter>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => openEditDialog(plan)}
                    >
                      <Edit className="h-4 w-4 mr-2" />
                      Редактировать
                    </Button>
                  </CardFooter>
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

      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Редактировать тариф</DialogTitle>
            <DialogDescription>
              {editingPlan?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="price">Цена (₸/мес)</Label>
              <Input
                id="price"
                type="number"
                value={formData.price}
                onChange={(e) => setFormData({ ...formData, price: parseInt(e.target.value) || 0 })}
              />
            </div>
            {editingPlan?.hasAiAccess && (
              <div className="space-y-2">
                <Label htmlFor="aiMessagesLimit">Лимит диалогов AI (в месяц)</Label>
                <Input
                  id="aiMessagesLimit"
                  type="number"
                  value={formData.aiMessagesLimit}
                  onChange={(e) => setFormData({ ...formData, aiMessagesLimit: parseInt(e.target.value) || 0 })}
                />
              </div>
            )}
            <div className="flex justify-end gap-3 pt-4">
              <Button variant="outline" onClick={() => setEditDialogOpen(false)}>
                Отмена
              </Button>
              <Button
                onClick={handleSave}
                disabled={updatePlanMutation.isPending}
              >
                Сохранить
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
