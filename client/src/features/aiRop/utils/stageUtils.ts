import { STAGE_LABELS } from "../types/aiRopTypes";

export function getStageName(stage: string): string {
  return STAGE_LABELS[stage] || stage;
}

export function getStageColor(stage: string): string {
  const colors: Record<string, string> = {
    greeting: "text-blue-500",
    need_detection: "text-indigo-500",
    product_offer: "text-purple-500",
    objection_handling: "text-amber-500",
    closing_attempt: "text-orange-500",
    order_created: "text-green-500",
    payment: "text-emerald-500",
    handover: "text-red-500",
  };
  return colors[stage] || "text-muted-foreground";
}

export function formatConversionRate(rate: number): string {
  if (isNaN(rate) || !isFinite(rate)) return "—";
  return `${rate.toFixed(1)}%`;
}

export function formatNumber(num: number): string {
  if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
  if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
  return num.toString();
}

export function getPeriodDates(period: string): { from: Date; to: Date } {
  const now = new Date();
  const to = now;
  let from: Date;

  switch (period) {
    case "today":
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      break;
    case "yesterday": {
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      from = new Date(yesterday.getFullYear(), yesterday.getMonth(), yesterday.getDate());
      break;
    }
    case "7d":
      from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case "30d":
      from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case "90d":
      from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    default:
      from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }

  return { from, to };
}
