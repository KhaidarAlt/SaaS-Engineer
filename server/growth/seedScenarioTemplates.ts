import { db } from "../db";
import { growthScenarioTemplates } from "@shared/schema";
import { sql } from "drizzle-orm";

const TEMPLATES = [
  // ===== ELECTRONICS =====
  {
    niche: "electronics",
    key: "reactivation",
    title: "Реактивация клиентов",
    description: "Вернуть клиентов, которые ранее интересовались техникой",
    messageBlueprintJson: {
      text: "{firstName}, привет! Это {shopName}. Вы раньше интересовались техникой. Сейчас есть новые поступления и акции по {categoryHint}. Подсказать варианты?",
      placeholders: ["firstName", "shopName", "categoryHint"],
    },
  },
  {
    niche: "electronics",
    key: "price_availability",
    title: "Обновление цен и наличия",
    description: "Уведомить о новых ценах или появлении товара",
    messageBlueprintJson: {
      text: "{firstName}, добрый день! По {categoryHint} обновили наличие и цены. Хотите пришлю актуальные варианты?",
      placeholders: ["firstName", "categoryHint"],
    },
  },
  {
    niche: "electronics",
    key: "upsell_post_order",
    title: "Допродажа после заказа",
    description: "Предложить аксессуары или гарантию после покупки",
    messageBlueprintJson: {
      text: "{firstName}, к вашему заказу часто берут: гарантия, аксессуары, расходники. Актуально?",
      placeholders: ["firstName"],
    },
  },
  {
    niche: "electronics",
    key: "abandoned_dialog",
    title: "Брошенные диалоги",
    description: "Вернуть клиентов, которые не завершили разговор",
    messageBlueprintJson: {
      text: "{firstName}, здравствуйте! Мы общались насчёт {categoryHint}, но разговор прервался. Ещё актуально? Могу быстро подобрать лучший вариант.",
      placeholders: ["firstName", "categoryHint"],
    },
  },
  {
    niche: "electronics",
    key: "nps",
    title: "Отзыв и оценка",
    description: "Попросить отзыв после покупки",
    messageBlueprintJson: {
      text: "{firstName}, спасибо за покупку в {shopName}! Как вам товар? Будем благодарны за короткий отзыв — это поможет нам стать лучше.",
      placeholders: ["firstName", "shopName"],
    },
  },

  // ===== FASHION =====
  {
    niche: "fashion",
    key: "reactivation",
    title: "Реактивация клиентов",
    description: "Вернуть клиентов с новой коллекцией или скидками",
    messageBlueprintJson: {
      text: "{firstName}, привет! {shopName}. У нас новое поступление и скидки. Под ваш стиль могу быстро подобрать 3-5 вариантов. Интересно?",
      placeholders: ["firstName", "shopName"],
    },
  },
  {
    niche: "fashion",
    key: "upsell_post_order",
    title: "Допродажа после покупки",
    description: "Предложить дополнительные товары к покупке",
    messageBlueprintJson: {
      text: "{firstName}, к вашей покупке часто берут: ремень, сумку, уход. Хотите 2-3 предложения?",
      placeholders: ["firstName"],
    },
  },
  {
    niche: "fashion",
    key: "abandoned_dialog",
    title: "Брошенные диалоги",
    description: "Напомнить клиентам, которые не завершили выбор",
    messageBlueprintJson: {
      text: "{firstName}, привет! Вы недавно смотрели у нас {categoryHint}. Ещё ищете? Могу подобрать лучшие варианты по вашему размеру.",
      placeholders: ["firstName", "categoryHint"],
    },
  },
  {
    niche: "fashion",
    key: "price_availability",
    title: "Новое поступление",
    description: "Уведомить о новых коллекциях или снижении цен",
    messageBlueprintJson: {
      text: "{firstName}, добрый день! В {shopName} новая коллекция {categoryHint}. Хотите покажу самые интересные позиции?",
      placeholders: ["firstName", "shopName", "categoryHint"],
    },
  },
  {
    niche: "fashion",
    key: "nps",
    title: "Отзыв и оценка",
    description: "Попросить отзыв о покупке",
    messageBlueprintJson: {
      text: "{firstName}, спасибо за покупку! Как вам вещи? Будем рады вашему отзыву — это помогает нам подбирать лучшее.",
      placeholders: ["firstName"],
    },
  },

  // ===== FOOD =====
  {
    niche: "food",
    key: "reactivation",
    title: "Реактивация клиентов",
    description: "Вернуть клиентов с акциями и комбо",
    messageBlueprintJson: {
      text: "{firstName}, привет! {shopName}. Сегодня свежие акции и комбо. Хотите быстро соберу заказ на 2-3 позиции?",
      placeholders: ["firstName", "shopName"],
    },
  },
  {
    niche: "food",
    key: "upsell_post_order",
    title: "Повторный заказ",
    description: "Напомнить о повторном заказе любимых позиций",
    messageBlueprintJson: {
      text: "{firstName}, обычно через несколько дней заказывают повторно. Хотите предложу ваши любимые позиции плюс новинку?",
      placeholders: ["firstName"],
    },
  },
  {
    niche: "food",
    key: "abandoned_dialog",
    title: "Брошенные заказы",
    description: "Вернуть клиентов, которые начали заказ, но не завершили",
    messageBlueprintJson: {
      text: "{firstName}, здравствуйте! Вы начинали заказ, но не завершили. Помочь быстро оформить? Доставка от 30 минут.",
      placeholders: ["firstName"],
    },
  },
  {
    niche: "food",
    key: "price_availability",
    title: "Меню дня / акции",
    description: "Рассказать о дневных акциях и специальных предложениях",
    messageBlueprintJson: {
      text: "{firstName}, добрый день! Сегодня в {shopName}: {categoryHint}. Хотите оформить заказ?",
      placeholders: ["firstName", "shopName", "categoryHint"],
    },
  },
  {
    niche: "food",
    key: "nps",
    title: "Отзыв о доставке",
    description: "Попросить оценку качества доставки и еды",
    messageBlueprintJson: {
      text: "{firstName}, спасибо за заказ! Всё ли понравилось? Ваш отзыв очень важен для нас.",
      placeholders: ["firstName"],
    },
  },

  // ===== GENERAL =====
  {
    niche: "general",
    key: "reactivation",
    title: "Реактивация клиентов",
    description: "Универсальное возвращение клиентов",
    messageBlueprintJson: {
      text: "{firstName}, здравствуйте! Это {shopName}. Подскажите, актуально ли ещё подобрать {categoryHint}? Я помогу быстро.",
      placeholders: ["firstName", "shopName", "categoryHint"],
    },
  },
  {
    niche: "general",
    key: "upsell_post_order",
    title: "Допродажа после заказа",
    description: "Предложить сопутствующие товары",
    messageBlueprintJson: {
      text: "{firstName}, рады, что выбрали {shopName}! К вашему заказу часто берут дополнительные товары. Показать подборку?",
      placeholders: ["firstName", "shopName"],
    },
  },
  {
    niche: "general",
    key: "abandoned_dialog",
    title: "Брошенные диалоги",
    description: "Напомнить клиентам, с которыми прервался разговор",
    messageBlueprintJson: {
      text: "{firstName}, здравствуйте! Мы общались, но разговор прервался. Ещё актуально? Готов помочь.",
      placeholders: ["firstName"],
    },
  },
  {
    niche: "general",
    key: "price_availability",
    title: "Обновление ассортимента",
    description: "Уведомить о новых товарах или обновлении цен",
    messageBlueprintJson: {
      text: "{firstName}, в {shopName} обновили ассортимент и цены. Хотите пришлю актуальные предложения по {categoryHint}?",
      placeholders: ["firstName", "shopName", "categoryHint"],
    },
  },
  {
    niche: "general",
    key: "nps",
    title: "Отзыв и обратная связь",
    description: "Запросить обратную связь о покупке или сервисе",
    messageBlueprintJson: {
      text: "{firstName}, спасибо что выбрали {shopName}! Как вам наш сервис? Будем рады короткому отзыву.",
      placeholders: ["firstName", "shopName"],
    },
  },
];

export async function seedScenarioTemplates() {
  try {
    const existing = await db.select({ id: growthScenarioTemplates.id }).from(growthScenarioTemplates).limit(1);
    if (existing.length > 0) {
      console.log("[GrowthSeed] Scenario templates already seeded, skipping");
      return;
    }

    await db.insert(growthScenarioTemplates).values(TEMPLATES);
    console.log(`[GrowthSeed] Seeded ${TEMPLATES.length} scenario templates`);
  } catch (err) {
    console.error("[GrowthSeed] Error seeding scenario templates:", err);
  }
}
