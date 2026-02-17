import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, CheckCircle, ArrowRight, AlertTriangle, DollarSign, MessageSquare } from "lucide-react";
import { motion } from "framer-motion";
import { fetchSummary, ANALYTICS_KEYS } from "../analytics/api/analyticsApi";
import type { KpiData } from "../analytics/types/analyticsTypes";

interface KpiStripProps {
  period?: string;
}

function KpiMini({ icon: Icon, label, value, suffix, colorClass }: { icon: typeof Users; label: string; value: string | number; suffix?: string; colorClass?: string }) {
  return (
    <Card className="p-3 text-center" data-testid={`kpi-mini-${label}`}>
      <Icon className={`h-4 w-4 mx-auto mb-1 ${colorClass || "text-muted-foreground"}`} />
      <motion.p
        className={`text-xl font-bold ${colorClass || ""}`}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4 }}
      >
        {value}{suffix}
      </motion.p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </Card>
  );
}

export function KpiStrip({ period = "30d" }: KpiStripProps) {
  const [, navigate] = useLocation();
  const { data, isLoading } = useQuery({
    queryKey: ANALYTICS_KEYS.summary(period, "ALL"),
    queryFn: () => fetchSummary(period, "ALL"),
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3" data-testid="kpi-strip">
        {[1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
      </div>
    );
  }

  if (!data || data.kpis.totalDialogs < 5) {
    return (
      <Card className="p-6 text-center" data-testid="kpi-strip-empty">
        <p className="text-sm text-muted-foreground mb-2">
          Недостаточно данных для KPI. Запустите тестирование для получения статистики.
        </p>
        <Button
          size="sm"
          onClick={() => navigate("/dashboard/ai/rop/testing")}
          data-testid="button-kpi-go-testing"
        >
          <MessageSquare className="h-4 w-4 mr-1" />
          Начать тестирование
        </Button>
      </Card>
    );
  }

  const k = data.kpis;

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3" data-testid="kpi-strip">
      <KpiMini icon={Users} label="Диалоги" value={k.totalDialogs} />
      <KpiMini icon={CheckCircle} label="Успешных" value={k.successCount} suffix={` (${k.successRate}%)`} colorClass="text-green-600 dark:text-green-400" />
      <KpiMini icon={ArrowRight} label="Передач" value={`${k.handoverRate}%`} colorClass="text-blue-600 dark:text-blue-400" />
      <KpiMini icon={AlertTriangle} label="Потеряно" value={`${k.abandonedRate}%`} colorClass="text-orange-600 dark:text-orange-400" />
      {k.totalRevenue > 0 ? (
        <KpiMini icon={DollarSign} label="Выручка" value={k.totalRevenue.toLocaleString()} colorClass="text-green-600 dark:text-green-400" />
      ) : (
        <KpiMini icon={MessageSquare} label="Ср. сообщ." value={k.avgMessages} />
      )}
    </div>
  );
}
