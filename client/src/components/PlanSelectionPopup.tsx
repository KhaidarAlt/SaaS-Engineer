import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Crown, Zap, Rocket, Star, Loader2, AlertTriangle } from "lucide-react";
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
  blockDismiss?: boolean;
}

export function PlanSelectionPopup({ open, onClose, blockDismiss = false }: PlanSelectionPopupProps) {
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: plans, isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ["/api/plans"],
  });

  const requestPlanMutation = useMutation({
    mutationFn: async (planId: string) => {
      await apiRequest("POST", `/api/request-plan`, { planId });
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

  const startPlan = plans?.find((p) => p.name === "Start");
  const businessPlan = plans?.find((p) => p.name === "Business");
  const scalePlan = plans?.find((p) => p.name === "Scale");
  const freePlan = plans?.find((p) => p.name === "Free" || p.price === 0);

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat("ru-KZ").format(price) + " \u20B8";
  };

  const handleSelectPlan = (planId: string) => {
    setSelectedPlanId(planId);
  };

  const handleSubmitRequest = () => {
    if (selectedPlanId) {
      requestPlanMutation.mutate(selectedPlanId);
    }
  };

  const handleActivateFree = () => {
    if (freePlan) {
      requestPlanMutation.mutate(freePlan.id);
    }
  };

  const handleClose = () => {
    if (blockDismiss) return;
    setShowSuccess(false);
    setSelectedPlanId(null);
    onClose();
  };

  const handleGoToBilling = () => {
    setShowSuccess(false);
    setSelectedPlanId(null);
    onClose();
    navigate("/dashboard/billing");
  };

  const mainPlans = [
    {
      plan: startPlan,
      icon: Zap,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
      features: [
        "SmartCatalog",
        "AI-\u043F\u0440\u043E\u0434\u0430\u0432\u0435\u0446 (\u0432\u0441\u0435 \u0444\u0443\u043D\u043A\u0446\u0438\u0438)",
        "\u0420\u0430\u0437\u0434\u0435\u043B \u0420\u043E\u0441\u0442",
        "1 \u043A\u0430\u043D\u0430\u043B \u043F\u043E\u0434\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F",
        "100 \u0434\u0438\u0430\u043B\u043E\u0433\u043E\u0432/\u043C\u0435\u0441",
      ],
    },
    {
      plan: businessPlan,
      icon: Crown,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      popular: true,
      features: [
        "\u0412\u0441\u0435 \u0444\u0443\u043D\u043A\u0446\u0438\u0438 \u043F\u043B\u0430\u0442\u0444\u043E\u0440\u043C\u044B",
        "AI-\u043F\u0440\u043E\u0434\u0430\u0432\u0435\u0446 + Growth Engine",
        "\u041C\u0443\u043B\u044C\u0442\u0438\u043A\u0430\u043D\u0430\u043B (WA, IG, TG)",
        "\u0410\u043D\u0430\u043B\u0438\u0442\u0438\u043A\u0430",
        "300 \u0434\u0438\u0430\u043B\u043E\u0433\u043E\u0432/\u043C\u0435\u0441",
      ],
    },
    {
      plan: scalePlan,
      icon: Rocket,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10",
      features: [
        "\u0412\u0441\u0435 \u0444\u0443\u043D\u043A\u0446\u0438\u0438",
        "Growth \u0430\u0432\u0442\u043E\u043C\u0430\u0442\u0438\u0437\u0430\u0446\u0438\u0438",
        "\u0420\u0430\u0441\u0448\u0438\u0440\u0435\u043D\u043D\u0430\u044F \u0430\u043D\u0430\u043B\u0438\u0442\u0438\u043A\u0430",
        "\u041F\u0440\u0438\u043E\u0440\u0438\u0442\u0435\u0442\u043D\u0430\u044F \u043F\u043E\u0434\u0434\u0435\u0440\u0436\u043A\u0430",
        "700 \u0434\u0438\u0430\u043B\u043E\u0433\u043E\u0432/\u043C\u0435\u0441",
      ],
    },
  ];

  if (plansLoading) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className={`sm:max-w-md ${blockDismiss ? "[&>button.absolute]:hidden" : ""}`} onPointerDownOutside={blockDismiss ? (e) => e.preventDefault() : undefined} onEscapeKeyDown={blockDismiss ? (e) => e.preventDefault() : undefined}>
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u0442\u0430\u0440\u0438\u0444\u043E\u0432...</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (showSuccess) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className={`sm:max-w-md ${blockDismiss ? "[&>button.absolute]:hidden" : ""}`} onPointerDownOutside={blockDismiss ? (e) => e.preventDefault() : undefined} onEscapeKeyDown={blockDismiss ? (e) => e.preventDefault() : undefined}>
          <div className="flex flex-col items-center text-center py-6">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", duration: 0.5 }}
              className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-4"
            >
              <Check className="h-8 w-8 text-green-500" />
            </motion.div>
            <h2 className="text-xl font-bold mb-2">\u0421\u043F\u0430\u0441\u0438\u0431\u043E, \u0432\u0430\u0448 \u0437\u0430\u043F\u0440\u043E\u0441 \u043E\u0442\u043F\u0440\u0430\u0432\u043B\u0435\u043D!</h2>
            <p className="text-muted-foreground mb-6">
              \u0421 \u0432\u0430\u043C\u0438 \u0432 \u0441\u0430\u043C\u043E\u0435 \u0431\u043B\u0438\u0436\u0430\u0439\u0448\u0435\u0435 \u0432\u0440\u0435\u043C\u044F \u0441\u0432\u044F\u0436\u0435\u0442\u0441\u044F \u043D\u0430\u0448 \u043C\u0435\u043D\u0435\u0434\u0436\u0435\u0440.
            </p>
            <Button onClick={handleGoToBilling} data-testid="button-go-to-billing">
              \u041F\u0435\u0440\u0435\u0439\u0442\u0438 \u043A \u043E\u043F\u043B\u0430\u0442\u0435
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={`sm:max-w-4xl max-h-[90vh] overflow-y-auto ${blockDismiss ? "[&>button.absolute]:hidden" : ""}`} onPointerDownOutside={blockDismiss ? (e) => e.preventDefault() : undefined} onEscapeKeyDown={blockDismiss ? (e) => e.preventDefault() : undefined}>
        {blockDismiss && (
          <div className="flex items-center gap-3 p-3 rounded-md bg-destructive/10 border border-destructive/20 mb-2">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
            <p className="text-sm">
              \u0412\u0430\u0448 \u0431\u0435\u0441\u043F\u043B\u0430\u0442\u043D\u044B\u0439 \u043F\u0440\u043E\u0431\u043D\u044B\u0439 \u043F\u0435\u0440\u0438\u043E\u0434 \u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043D. \u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0442\u0430\u0440\u0438\u0444, \u0447\u0442\u043E\u0431\u044B \u043F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C \u0440\u0430\u0431\u043E\u0442\u0443.
            </p>
          </div>
        )}
        <DialogHeader>
          <DialogTitle className="text-2xl text-center">
            {blockDismiss ? "\u041F\u0440\u043E\u0431\u043D\u044B\u0439 \u043F\u0435\u0440\u0438\u043E\u0434 \u0437\u0430\u0432\u0435\u0440\u0448\u0451\u043D \u2014 \u0432\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0442\u0430\u0440\u0438\u0444" : "\u0412\u044B\u0431\u0435\u0440\u0438\u0442\u0435 \u0442\u0430\u0440\u0438\u0444 \u0434\u043B\u044F \u0432\u0430\u0448\u0435\u0433\u043E \u043C\u0430\u0433\u0430\u0437\u0438\u043D\u0430"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          {mainPlans.map(({ plan, icon: Icon, color, bgColor, popular, features }) => {
            if (!plan) return null;
            const isSelected = selectedPlanId === plan.id;

            return (
              <motion.div
                key={plan.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => handleSelectPlan(plan.id)}
                className={`relative p-5 rounded-md border-2 cursor-pointer transition-all ${
                  isSelected
                    ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                    : "border-border hover:border-primary/50"
                } ${popular ? "ring-2 ring-amber-500/30" : ""}`}
                data-testid={`plan-card-${plan.name.toLowerCase()}`}
              >
                {popular && (
                  <Badge className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500 text-white">
                    \u041F\u043E\u043F\u0443\u043B\u044F\u0440\u043D\u044B\u0439
                  </Badge>
                )}

                <div className={`w-12 h-12 rounded-md ${bgColor} flex items-center justify-center mb-4`}>
                  <Icon className={`h-6 w-6 ${color}`} />
                </div>

                <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
                <p className="text-2xl font-bold mb-4">
                  {formatPrice(plan.price)}
                  <span className="text-sm font-normal text-muted-foreground"> / \u043C\u0435\u0441</span>
                </p>

                <ul className="space-y-2 mb-4">
                  {features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 flex-shrink-0" />
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
                \u041E\u0442\u043F\u0440\u0430\u0432\u0438\u0442\u044C \u0437\u0430\u043F\u0440\u043E\u0441
              </Button>
            </motion.div>
          )}
        </AnimatePresence>

        {!blockDismiss && (
          <div className="mt-6 pt-6 border-t border-border">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-md bg-muted/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center">
                  <Star className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <h4 className="font-medium">Free</h4>
                  <p className="text-sm text-muted-foreground">
                    \u0411\u0435\u0441\u043F\u043B\u0430\u0442\u043D\u043E \u2014 \u0434\u043E 100 \u0442\u043E\u0432\u0430\u0440\u043E\u0432, \u0431\u0430\u0437\u043E\u0432\u044B\u0439 \u043A\u0430\u0442\u0430\u043B\u043E\u0433
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={handleActivateFree}
                disabled={requestPlanMutation.isPending}
                data-testid="button-activate-free"
              >
                \u0410\u043A\u0442\u0438\u0432\u0438\u0440\u043E\u0432\u0430\u0442\u044C
              </Button>
            </div>
          </div>
        )}

        {blockDismiss && (
          <div className="mt-6 pt-6 border-t border-border">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-4 rounded-md bg-muted/50">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-md bg-muted flex items-center justify-center">
                  <Star className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <h4 className="font-medium">Free</h4>
                  <p className="text-sm text-muted-foreground">
                    \u0411\u0435\u0441\u043F\u043B\u0430\u0442\u043D\u043E \u2014 \u0434\u043E 100 \u0442\u043E\u0432\u0430\u0440\u043E\u0432, \u0431\u0430\u0437\u043E\u0432\u044B\u0439 \u043A\u0430\u0442\u0430\u043B\u043E\u0433, \u0431\u0435\u0437 AI
                  </p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={handleActivateFree}
                disabled={requestPlanMutation.isPending}
                data-testid="button-activate-free"
              >
                \u041F\u0440\u043E\u0434\u043E\u043B\u0436\u0438\u0442\u044C \u0431\u0435\u0441\u043F\u043B\u0430\u0442\u043D\u043E
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
