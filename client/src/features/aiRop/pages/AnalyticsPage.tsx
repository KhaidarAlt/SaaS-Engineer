import { BarChart3 } from "lucide-react";
import { SectionHeader } from "../components/SectionHeader";
import { EmptyStateCard } from "../components/EmptyStateCard";

export default function AnalyticsPage() {
  return (
    <div data-testid="page-analytics">
      <SectionHeader
        title="Аналитика"
        subtitle="Показатели эффективности AI-продавца"
      />
      <EmptyStateCard
        icon={BarChart3}
        title="Аналитика AI"
        description="Здесь будет воронка, отвал клиентов, причины отказов и деньги (потеряно/принесено)."
        bullets={[
          "Воронка продаж: от первого сообщения до оплаты",
          "Анализ отвала и причины отказов",
          "Финансовые показатели: потеряно / принесено",
        ]}
        ctaLabel="Запустить тестирование"
        ctaHref="/dashboard/ai/rop/testing"
      />
    </div>
  );
}
