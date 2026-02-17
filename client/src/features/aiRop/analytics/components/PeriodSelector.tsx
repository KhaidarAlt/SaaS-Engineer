import { Button } from "@/components/ui/button";
import type { PeriodKey } from "../types/analyticsTypes";

interface PeriodSelectorProps {
  value: PeriodKey;
  onChange: (period: PeriodKey) => void;
}

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: "1d", label: "Сегодня" },
  { key: "7d", label: "7 дней" },
  { key: "30d", label: "30 дней" },
  { key: "90d", label: "90 дней" },
];

export function PeriodSelector({ value, onChange }: PeriodSelectorProps) {
  return (
    <div className="flex items-center gap-1 flex-wrap" data-testid="period-selector">
      {PERIODS.map((p) => (
        <Button
          key={p.key}
          size="sm"
          variant={value === p.key ? "default" : "outline"}
          onClick={() => onChange(p.key)}
          data-testid={`period-${p.key}`}
          className="toggle-elevate"
        >
          {p.label}
        </Button>
      ))}
    </div>
  );
}
