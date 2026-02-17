import { Card } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Users, CheckCircle, ArrowRight, AlertTriangle } from "lucide-react";
import { motion } from "framer-motion";
import type { KpiData } from "../types/analyticsTypes";

interface KpiCardsProps {
  data: KpiData;
}

function AnimatedNumber({ value, suffix = "" }: { value: number; suffix?: string }) {
  return (
    <motion.span
      key={value}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {value}{suffix}
    </motion.span>
  );
}

const cards = [
  {
    key: "total",
    label: "Диалоги",
    icon: Users,
    getValue: (d: KpiData) => d.totalDialogs,
    getSub: (d: KpiData) => `Ср. ${d.avgMessages} сообщ.`,
  },
  {
    key: "success",
    label: "Успешных",
    icon: CheckCircle,
    getValue: (d: KpiData) => d.successCount,
    getSuffix: (d: KpiData) => ` (${d.successRate}%)`,
    getSub: () => null,
    colorClass: "text-green-600 dark:text-green-400",
  },
  {
    key: "handover",
    label: "Передано",
    icon: ArrowRight,
    getValue: (d: KpiData) => d.handoverCount,
    getSuffix: (d: KpiData) => ` (${d.handoverRate}%)`,
    getSub: () => null,
    colorClass: "text-blue-600 dark:text-blue-400",
  },
  {
    key: "abandoned",
    label: "Потеряно",
    icon: AlertTriangle,
    getValue: (d: KpiData) => d.abandonedCount,
    getSuffix: (d: KpiData) => ` (${d.abandonedRate}%)`,
    getSub: () => null,
    colorClass: "text-orange-600 dark:text-orange-400",
  },
];

export function KpiCards({ data }: KpiCardsProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3" data-testid="kpi-cards">
      {cards.map((card) => {
        const Icon = card.icon;
        const value = card.getValue(data);
        const suffix = card.getSuffix?.(data) || "";
        const sub = card.getSub?.(data);
        const colorClass = card.colorClass || "text-foreground";
        return (
          <Card key={card.key} className="p-4" data-testid={`kpi-card-${card.key}`}>
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="text-sm text-muted-foreground">{card.label}</span>
              <Icon className={`h-4 w-4 ${colorClass}`} />
            </div>
            <div className={`text-2xl font-bold mt-1 ${colorClass}`}>
              <AnimatedNumber value={value} />
              {suffix && <span className="text-sm font-normal text-muted-foreground">{suffix}</span>}
            </div>
            {sub && <p className="text-xs text-muted-foreground mt-1">{sub}</p>}
          </Card>
        );
      })}
    </div>
  );
}
