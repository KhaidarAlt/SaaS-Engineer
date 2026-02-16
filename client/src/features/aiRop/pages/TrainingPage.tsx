import { GraduationCap } from "lucide-react";
import { SectionHeader } from "../components/SectionHeader";
import { EmptyStateCard } from "../components/EmptyStateCard";

export default function TrainingPage() {
  return (
    <div data-testid="page-training">
      <SectionHeader
        title="Обучение"
        subtitle="Настройка знаний и поведения AI-продавца"
      />
      <EmptyStateCard
        icon={GraduationCap}
        title="Обучение AI"
        description="Здесь появятся: триггеры, база знаний, история правок ответов и обучение на диалогах."
        bullets={[
          "Триггеры и правила реагирования",
          "База знаний: товары, доставка, оплата, возвраты",
          "История правок ответов и обучение на реальных диалогах",
        ]}
        ctaLabel="Перейти в Тестирование"
        ctaHref="/dashboard/ai/rop/testing"
      />
    </div>
  );
}
