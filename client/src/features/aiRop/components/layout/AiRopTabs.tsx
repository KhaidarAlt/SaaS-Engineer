import { useLocation } from "wouter";
import { LayoutDashboard, GraduationCap, MessageSquare, Plug, BarChart3, Settings2 } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface TabDef {
  key: string;
  label: string;
  icon: LucideIcon;
  path: string;
}

const TABS: TabDef[] = [
  { key: "overview", label: "Обзор", icon: LayoutDashboard, path: "/dashboard/ai/rop/overview" },
  { key: "training", label: "Обучение", icon: GraduationCap, path: "/dashboard/ai/rop/training" },
  { key: "testing", label: "Тестирование", icon: MessageSquare, path: "/dashboard/ai/rop/testing" },
  { key: "connections", label: "Подключение", icon: Plug, path: "/dashboard/ai/rop/connections" },
  { key: "analytics", label: "Аналитика", icon: BarChart3, path: "/dashboard/ai/rop/analytics" },
  { key: "strategy", label: "Стратегия", icon: Settings2, path: "/dashboard/ai/rop/strategy" },
];

export function AiRopTabs() {
  const [location, navigate] = useLocation();

  const activeTab = TABS.find((t) => location.startsWith(t.path))?.key ?? "overview";

  return (
    <div className="border-b" data-testid="ai-rop-tabs">
      <div className="flex items-center gap-1 overflow-x-auto px-4 py-1">
        {TABS.map((tab) => {
          const isActive = activeTab === tab.key;
          const Icon = tab.icon;
          return (
            <button
              key={tab.key}
              data-testid={`tab-${tab.key}`}
              onClick={() => navigate(tab.path)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary/10 text-primary"
                  : "text-muted-foreground hover-elevate"
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
