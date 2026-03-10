import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { motion } from "framer-motion";
import { Check, Crown, Loader2, AlertTriangle, Zap, Shield, Sparkles, Brain, Building2, Code, RefreshCw, Infinity } from "lucide-react";
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
  const [showSuccess, setShowSuccess] = useState(false);
  const { toast } = useToast();
  const [, navigate] = useLocation();

  const { data: plans, isLoading: plansLoading } = useQuery<Plan[]>({
    queryKey: ["/api/plans"],
  });

  const founderPlan = plans?.find((p) => p.name === "Founder's Edition");

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

  const handleClose = () => {
    if (blockDismiss) return;
    setShowSuccess(false);
    onClose();
  };

  const handleGoToBilling = () => {
    setShowSuccess(false);
    onClose();
    navigate("/dashboard/billing");
  };

  const handleSubmit = () => {
    if (founderPlan) {
      requestPlanMutation.mutate(founderPlan.id);
    } else {
      toast({ title: "Тариф временно недоступен", variant: "destructive" });
    }
  };

  const spotsTotal = 50;
  const spotsTaken = 3;
  const spotsLeft = spotsTotal - spotsTaken;

  if (plansLoading) {
    return (
      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className={`sm:max-w-md ${blockDismiss ? "[&>button.absolute]:hidden" : ""}`} onPointerDownOutside={blockDismiss ? (e) => e.preventDefault() : undefined} onEscapeKeyDown={blockDismiss ? (e) => e.preventDefault() : undefined}>
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Загрузка...</p>
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
            <h2 className="text-xl font-bold mb-2">Спасибо, ваш запрос отправлен!</h2>
            <p className="text-muted-foreground mb-6">
              С вами в самое ближайшее время свяжется наш менеджер.
            </p>
            <Button onClick={handleGoToBilling} data-testid="button-go-to-billing">
              Перейти к оплате
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className={`sm:max-w-lg max-h-[90vh] overflow-y-auto p-0 ${blockDismiss ? "[&>button.absolute]:hidden" : ""}`} onPointerDownOutside={blockDismiss ? (e) => e.preventDefault() : undefined} onEscapeKeyDown={blockDismiss ? (e) => e.preventDefault() : undefined}>
        {blockDismiss && (
          <div className="flex items-center gap-3 p-3 mx-6 mt-6 rounded-md bg-destructive/10 border border-destructive/20">
            <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0" />
            <p className="text-sm">
              Ваш бесплатный пробный период завершён. Оформите подписку, чтобы продолжить работу.
            </p>
          </div>
        )}

        <div className="flex flex-col items-center px-6 pt-6 pb-2">
          <Badge className="bg-gradient-to-r from-amber-500 to-orange-500 text-white border-0 mb-4 text-sm px-4 py-1" data-testid="badge-founders-edition">
            <Crown className="h-3.5 w-3.5 mr-1.5" />
            Founder's Edition
          </Badge>

          <div className="w-14 h-14 rounded-full bg-amber-500/10 flex items-center justify-center mb-3">
            <Crown className="h-7 w-7 text-amber-500" />
          </div>

          <DialogHeader className="text-center space-y-1">
            <DialogTitle className="text-2xl font-bold">Партнёр-основатель</DialogTitle>
            <p className="text-sm text-muted-foreground">Полный доступ ко всей платформе. Навсегда.</p>
          </DialogHeader>

          <div className="mt-4 mb-1">
            <span className="text-4xl font-bold bg-gradient-to-r from-amber-600 to-orange-500 bg-clip-text text-transparent" data-testid="text-price">360 000 ₸</span>
            <span className="text-muted-foreground ml-1">/ год</span>
          </div>
          <p className="text-xs text-muted-foreground italic mb-1">Цена зафиксирована за вами НАВСЕГДА</p>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mb-4">
            <Sparkles className="h-3.5 w-3.5 text-amber-500" />
            Осталось мест: <span className="font-semibold text-foreground">{spotsLeft}</span> /{spotsTotal}
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 px-6">
          <div className="flex items-start gap-2.5 p-2.5 rounded-md bg-muted/50">
            <Zap className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium">Plug & Play</p>
              <p className="text-[11px] text-muted-foreground">База знаний из каталога за 5 минут (pgvector)</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 p-2.5 rounded-md bg-muted/50">
            <Brain className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium">AI Business Analyst</p>
              <p className="text-[11px] text-muted-foreground">Разбор прибыли, отвалов и поведения</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 p-2.5 rounded-md bg-muted/50">
            <Sparkles className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium">Self-Learning (AI Coach)</p>
              <p className="text-[11px] text-muted-foreground">Бот находит пробелы и улучшает себя сам</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 p-2.5 rounded-md bg-muted/50">
            <Shield className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium">Human-Like</p>
              <p className="text-[11px] text-muted-foreground">Имитация печатания, паузы, фото товаров</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 p-2.5 rounded-md bg-muted/50">
            <Building2 className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium">Enterprise</p>
              <p className="text-[11px] text-muted-foreground">Свой домен, AMO CRM, Bitrix24, Kaspi мониторинг</p>
            </div>
          </div>
          <div className="flex items-start gap-2.5 p-2.5 rounded-md bg-muted/50">
            <Code className="h-4 w-4 text-amber-500 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-xs font-medium">Custom Development</p>
              <p className="text-[11px] text-muted-foreground">Индивидуальные фичи под ваш бизнес</p>
            </div>
          </div>
        </div>

        <div className="mx-6 mt-4 p-3 rounded-md border border-border bg-muted/30">
          <p className="text-xs font-medium text-center mb-2.5 flex items-center justify-center gap-1.5">
            <Shield className="h-3.5 w-3.5" />
            Гарантии и гибкость
          </p>
          <div className="grid grid-cols-3 gap-2">
            <div className="text-center p-2 rounded bg-background">
              <p className="text-[11px] font-medium">14-Day Refund</p>
              <p className="text-[10px] text-muted-foreground">Возврат за вычетом AI-токенов</p>
            </div>
            <div className="text-center p-2 rounded bg-background">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <RefreshCw className="h-3 w-3 text-muted-foreground" />
                <p className="text-[11px] font-medium">Credit Rollover</p>
              </div>
              <p className="text-[10px] text-muted-foreground">500 диалогов/мес. Остаток переносится</p>
            </div>
            <div className="text-center p-2 rounded bg-background">
              <div className="flex items-center justify-center gap-1 mb-0.5">
                <Infinity className="h-3 w-3 text-muted-foreground" />
                <p className="text-[11px] font-medium">No Expiration</p>
              </div>
              <p className="text-[10px] text-muted-foreground">Доп. пакеты действуют бессрочно</p>
            </div>
          </div>
        </div>

        <div className="px-6 pt-4 pb-6">
          <Button
            size="lg"
            className="w-full bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white font-semibold text-base h-12"
            onClick={handleSubmit}
            disabled={requestPlanMutation.isPending || !founderPlan}
            data-testid="button-founders-submit"
          >
            {requestPlanMutation.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <>
                <Crown className="h-5 w-5 mr-2" />
                Занять место партнёра-основателя
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
