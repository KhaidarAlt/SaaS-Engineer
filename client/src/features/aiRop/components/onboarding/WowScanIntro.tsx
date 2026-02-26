import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CheckCircle2, Loader2, Package, Layers, CreditCard, Megaphone, Sparkles, ArrowLeft } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import type { CatalogSummary } from "../../types/aiRopTypes";

const SCAN_STEPS = [
  { label: "Сканирую товары…", icon: Package, key: "products" },
  { label: "Анализирую категории…", icon: Layers, key: "categories" },
  { label: "Проверяю оплату…", icon: CreditCard, key: "payments" },
  { label: "Проверяю промо-зону…", icon: Megaphone, key: "promos" },
];

interface Props {
  onComplete: () => void;
  summary: CatalogSummary | null;
  isLoading: boolean;
  isError?: boolean;
}

export function WowScanIntro({ onComplete, summary, isLoading, isError }: Props) {
  const [visibleCount, setVisibleCount] = useState(0);
  const [doneCount, setDoneCount] = useState(0);
  const [allDone, setAllDone] = useState(false);

  useEffect(() => {
    if (visibleCount < SCAN_STEPS.length) {
      const timer = setTimeout(() => {
        setVisibleCount((prev) => prev + 1);
      }, 800);
      return () => clearTimeout(timer);
    }
  }, [visibleCount]);

  useEffect(() => {
    if (visibleCount > 0 && doneCount < visibleCount) {
      const timer = setTimeout(() => {
        setDoneCount((prev) => prev + 1);
      }, 600);
      return () => clearTimeout(timer);
    }
  }, [visibleCount, doneCount]);

  useEffect(() => {
    if (doneCount === SCAN_STEPS.length && !allDone) {
      const timer = setTimeout(() => {
        setAllDone(true);
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [doneCount, allDone]);

  return (
    <div className="flex flex-col items-center justify-center py-12" data-testid="wow-scan-intro">
      <h2 className="mb-8 text-2xl font-bold" data-testid="text-scan-title">
        Сканирую ваш каталог…
      </h2>

      <div className="w-full max-w-md space-y-4">
        <AnimatePresence>
          {SCAN_STEPS.slice(0, visibleCount).map((step, index) => {
            const isDone = index < doneCount;
            const StepIcon = step.icon;
            return (
              <motion.div
                key={step.key}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className="flex items-center gap-3 rounded-md p-3"
                data-testid={`scan-step-${step.key}`}
              >
                <StepIcon className="h-5 w-5 text-muted-foreground" />
                <span className="flex-1 text-sm">{step.label}</span>
                {isDone ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" data-testid={`check-done-${step.key}`} />
                ) : (
                  <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" data-testid={`loader-${step.key}`} />
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {allDone && (summary || isError) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
            className="mt-8 w-full max-w-md"
          >
            <Card data-testid="card-scan-summary">
              <CardContent className="pt-6 space-y-2">
                {summary ? (
                  <>
                    <p className="font-semibold mb-3" data-testid="text-catalog-intro">Я изучил ваш каталог:</p>
                    <p className="text-sm text-muted-foreground" data-testid="text-products-count">
                      {summary.productsCount} товаров в {summary.categoriesCount} категориях
                    </p>
                    <p className="text-sm text-muted-foreground" data-testid="text-avg-price">
                      Средняя цена: {summary.avgPrice.toLocaleString()} ₸
                    </p>
                    <p className="text-sm text-muted-foreground" data-testid="text-payments-status">
                      Оплата: {summary.paymentsReady ? "Подключена" : "Не настроена"}
                    </p>
                    <p className="text-sm text-muted-foreground" data-testid="text-promo-status">
                      Промо-зона: {summary.promoZoneActive ? "Активна" : "Не активна"}
                    </p>
                  </>
                ) : (
                  <p className="font-semibold mb-3 text-muted-foreground" data-testid="text-catalog-error">
                    Не удалось загрузить данные каталога, но вы можете продолжить настройку
                  </p>
                )}
                <div className="pt-4 space-y-3">
                  <Button
                    className="w-full"
                    onClick={onComplete}
                    data-testid="button-start-interview"
                  >
                    <Sparkles className="mr-2 h-4 w-4" />
                    Начать интервью
                  </Button>
                  <Link href="/dashboard" data-testid="link-back-to-dashboard">
                    <button className="w-full flex items-center justify-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors py-2">
                      <ArrowLeft className="h-4 w-4" />
                      Перейти в панель управления
                    </button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>

      {allDone && isLoading && !isError && (
        <div className="mt-8 flex items-center gap-2 text-sm text-muted-foreground" data-testid="loading-summary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Загружаю данные…
        </div>
      )}
    </div>
  );
}
