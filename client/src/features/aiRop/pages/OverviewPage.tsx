import { LayoutDashboard } from "lucide-react";
import { SectionHeader } from "../components/SectionHeader";
import { EmptyStateCard } from "../components/EmptyStateCard";

export default function OverviewPage() {
  return (
    <div data-testid="page-overview">
      <SectionHeader
        title="Обзор"
        subtitle="Общая картина работы AI-продавца"
      />
      <EmptyStateCard
        icon={LayoutDashboard}
        title="Обзор AI-РОП"
        description="Здесь будет общий результат работы AI-РОПа: KPI, диагностика, рекомендации и статус готовности."
        bullets={[
          "Ключевые показатели: конверсия, диалоги, выручка",
          "Диагностика и рекомендации по улучшению",
          "Статус готовности и контроль качества",
        ]}
        ctaLabel="Перейти в Стратегию"
        ctaHref="/dashboard/ai/rop/strategy"
      />
    </div>
  );
}
