import { Plug } from "lucide-react";
import { SectionHeader } from "../components/SectionHeader";
import { EmptyStateCard } from "../components/EmptyStateCard";

export default function ConnectionsPage() {
  return (
    <div data-testid="page-connections">
      <SectionHeader
        title="Подключение"
        subtitle="Каналы связи AI-продавца с клиентами"
      />
      <EmptyStateCard
        icon={Plug}
        title="Подключения каналов"
        description="Здесь будут подключения каналов: WhatsApp (WAHA), WhatsApp Cloud API (Meta), Instagram Direct, Telegram."
        bullets={[
          "WhatsApp через WAHA (собственный сервер)",
          "WhatsApp Cloud API через Meta Business",
          "Instagram Direct и Telegram Bot",
        ]}
        ctaLabel="Перейти в Стратегию"
        ctaHref="/dashboard/ai/rop/strategy"
      />
    </div>
  );
}
