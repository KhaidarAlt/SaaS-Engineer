import { MessageSquare } from "lucide-react";
import { SectionHeader } from "../components/SectionHeader";
import { EmptyStateCard } from "../components/EmptyStateCard";

export default function TestingPage() {
  return (
    <div data-testid="page-testing">
      <SectionHeader
        title="Тестирование"
        subtitle="Проверка AI-продавца в действии"
      />
      <EmptyStateCard
        icon={MessageSquare}
        title="Тестирование AI"
        description="Здесь будет песочница: тестовый чат, симуляция клиентов, стресс-тесты."
        bullets={[
          "Тестовый чат с AI-продавцом в реальном времени",
          "Симуляция различных типов клиентов",
          "Стресс-тесты и проверка граничных сценариев",
        ]}
        ctaLabel="Открыть текущий тест-чат"
        ctaHref="/dashboard/ai/rop/strategy"
      />
    </div>
  );
}
