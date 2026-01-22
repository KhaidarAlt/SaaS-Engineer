import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { X, Check, Crown, Zap, Rocket, Star, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { Plan } from "@shared/schema";

interface PlanSelectionPopupProps {
  open: boolean;
  onClose: () => void;
}

export function PlanSelectionPopup({ open, onClose }: PlanSelectionPopupProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const { toast } = useToast();

  const { data: plans, isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ["/api/plans"],
  });

  const requestPlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      return apiRequest("POST", `/api/request-plan`, { planId });
    },
    onSuccess: () => {
      setShowSuccess(true);
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/billing"] });
    },
    onError: () => {
      toast({ title: "Ошибка отправки запроса", variant: "destructive" });
    },
  });

  const dismissPopupMutation = useMutation({
    mutationFn: async () => {
      return apiRequest("POST", `/api/dismiss-plan-popup`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
    },
  });

  // Match plans by name - order: Каталог (no AI), Каталог + AI (with AI), Про (advanced)
  const catalogPlan = plans?.find((p) => p.name === "Каталог" && !p.hasAiAccess);
  const catalogAiPlan = plans?.find((p) => p.name === "Каталог + AI" || (p.name.includes("Каталог") && p.hasAiAccess));
  const proPlan = plans?.find((p) => p.name === "Про" || p.name === "PRO");
  const startPlan = plans?.find((p) => p.name === "Старт" || p.price === 0);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("ru-KZ").format(price) + " ₸";
  };

  const handleSelectPlan = (planId: string) => {
    setSelectedPlanId(planId);
  };

  const handleSubmitRequest = () => {
    if (selectedPlanId) {
      requestPlanMutation.mutate(selectedPlanId);
    }
  };

  const handleActivateStart = () => {
    if (startPlan) {
      requestPlanMutation.mutate(startPlan.id);
    }
  };

  const handleClose = () => {
    setShowSuccess(false);
    setSelectedPlanId(null);
    onClose();
  };

  const handleDismiss = () => {
    dismissPopupMutation.mutate();
    handleClose();
  };

  const mainPlans = [
    {
      plan: catalogPlan,
      icon: Zap,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      features: [
        "До 300 товаров",
        "30 категорий",
        "WhatsApp заказы",
        "Базовая аналитика",
      ],
      noFeatures: ["AI-ассистент"],
    },
    {
      plan: catalogAiPlan,
      icon: Crown,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      popular: true,
      features: [
        "До 1000 товаров",
        "50 категорий",
        "WhatsApp интеграция",
        "AI-ассистент",
        "1000 диалогов/мес",
      ],
      noFeatures: [],
    },
    {
      plan: proPlan,
      icon: Rocket,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      features: [
        "До 3000 товаров",
        "200 категорий",
        "WhatsApp интеграция",
        "AI-ассистент",
        "5000 диалогов/мес",
        "Приоритетная поддержка",
      ],
      noFeatures: [],
    },
  ];

  // Loading state
  if (plansLoading) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Загрузка тарифов...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (showSuccess) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="sm:max-w-md">
          <div className="flex flex-col items-center text-center py-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-4"
            >
              <Check className="h-8 w-8 text-green-500" />
            </motion.div>
            <h2 className="text-xl font-bold mb-2">Спасибо, ваш запрос отправлен!</h2>
            <p className="text-muted-foreground mb-6">
              С вами в самое ближайшее время свяжется наш менеджер. Можете начинать создавать ваш каталог.
            </p>
            <Button onClick={handleClose} data-testid="button-close-success">
              Начать работу
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">
            Выберите тариф для вашего магазина
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          {mainPlans.map(({ plan, icon: Icon, color, bgColor, popular, features, noFeatures }) => {
            if (!plan) return null;
            const isSelected = selectedPlanId === plan.id;

            return (
              <motion.div
                key={plan.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSelectPlan(plan.id)}
                className={`relative p-5 rounded-xl border-2 cursor-pointer transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-border hover:border-primary/50"
                } ${popular ? "ring-2 ring-amber-500/30" : ""}`}
                data-testid={`plan-card-${plan.name.toLowerCase()}`}
              >
                {popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white">
                    Популярный
                  </Badge>
                )}

                <div className={`w-12 h-12 rounded-xl ${bgColor} flex items-center justify-center mb-4`}>
                  <Icon className={`h-6 w-6 ${color}`} />
                </div>

                <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                <p className="text-2xl font-bold mb-4">
                  {formatPrice(plan.price)}
                  <span className="text-sm font-normal text-muted-foreground"> / мес</span>
                </p>

                <ul className="space-y-2 mb-4">
                  {features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                  {noFeatures.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm text-muted-foreground">
                      <X className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>

                {isSelected && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="absolute top-3 right-3"
                  >
                    <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                      <Check className="h-4 w-4 text-primary-foreground" />
                    </div>
                  </motion.div>
                )}
              </motion.div>
            );
          })}
        </div>

        <AnimatePresence>
          {selectedPlanId && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex justify-center mt-4"
            >
              <Button
                size="lg"
                onClick={handleSubmitRequest}
                disabled={requestPlanMutation.isPending}
                data-testid="button-submit-request"
              >
                Отправить запрос
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-6 pt-6 border-t border-border">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <Star className="h-5 w-5 text-muted-foreground" />
              </div>
              <div>
                <h4 className="font-medium">Старт</h4>
                <p className="text-sm text-muted-foreground">
                  Бесплатно — до 20 товаров, базовый каталог
                </p>
              </div>
            </div>
            <Button
              variant="outline"
              onClick={handleActivateStart}
              disabled={requestPlanMutation.isPending}
              data-testid="button-activate-start"
            >
              Активировать
            </Button>
          </div>
        </div>

        <div className="flex justify-center mt-4">
          <Button
            variant="ghost"
            onClick={handleDismiss}
            disabled={dismissPopupMutation.isPending}
            data-testid="button-dismiss-popup"
            className="text-muted-foreground"
          >
            Решу позже
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
