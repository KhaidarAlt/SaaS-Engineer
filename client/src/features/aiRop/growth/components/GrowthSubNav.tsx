import { useLocation } from "wouter";
import { RefreshCw, TrendingUp, ShoppingBag, MessageCircle, Bell, Star, Users, FileText } from "lucide-react";

const SUBNAV_ITEMS = [
  { key: "", label: "Обзор", icon: TrendingUp, path: "/dashboard/ai/rop/growth" },
  { key: "audience", label: "Аудитория", icon: Users, path: "/dashboard/ai/rop/growth/audience" },
  { key: "scenarios", label: "Сценарии", icon: FileText, path: "/dashboard/ai/rop/growth/scenarios" },
  { key: "reactivation", label: "Реактивация", icon: RefreshCw, path: "/dashboard/ai/rop/growth/reactivation" },
  { key: "upsell", label: "Апселл", icon: ShoppingBag, path: "/dashboard/ai/rop/growth/upsell" },
  { key: "abandoned", label: "Брошенные", icon: MessageCircle, path: "/dashboard/ai/rop/growth/abandoned" },
  { key: "reminders", label: "Напоминания", icon: Bell, path: "/dashboard/ai/rop/growth/reminders" },
  { key: "nps", label: "Отзывы", icon: Star, path: "/dashboard/ai/rop/growth/nps" },
];

export function GrowthSubNav() {
  const [location, navigate] = useLocation();
  const growthPath = location.replace("/dashboard/ai/rop/growth", "").replace(/^\//, "").split("/")[0] || "";

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-1" data-testid="growth-subnav">
      {SUBNAV_ITEMS.map((item) => {
        const isActive = growthPath === item.key;
        const Icon = item.icon;
        return (
          <button
            key={item.key}
            data-testid={`subnav-${item.key || "overview"}`}
            onClick={() => navigate(item.path)}
            className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors ${
              isActive ? "bg-primary/10 text-primary" : "text-muted-foreground hover-elevate"
            }`}
          >
            <Icon className="h-3.5 w-3.5" />
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
