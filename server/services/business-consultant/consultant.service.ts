import OpenAI from "openai";
import { storage } from "../../storage";
import { SMARTCATALOG_PRODUCT_KB, CONSULTANT_MODES, type ConsultantMode } from "./smartcatalog-kb";

const openai = new OpenAI();

interface ConsultantMessage {
  role: "user" | "assistant";
  content: string;
}

interface TenantContext {
  productsCount: number;
  categoriesCount: number;
  ordersCount: number;
  ordersTotal: number;
  avgOrderValue: number;
  recentOrders: Array<{
    orderNumber: string;
    total: string;
    status: string;
    createdAt: Date;
  }>;
  topProducts: Array<{
    name: string;
    orderCount: number;
    revenue: number;
  }>;
  promotionsCount: number;
  discountsCount: number;
  paymentStats: {
    pending: number;
    paid: number;
    failed: number;
  };
  planName: string;
  hasAiAccess: boolean;
}

async function getTenantContext(tenantId: string): Promise<TenantContext> {
  const [products, categories, orders, promotions, discounts, subscription] = await Promise.all([
    storage.getProducts(tenantId),
    storage.getCategories(tenantId),
    storage.getOrders(tenantId),
    storage.getPromotions(tenantId),
    storage.getDiscounts(tenantId),
    storage.getSubscription(tenantId),
  ]);

  const ordersTotal = orders.reduce((sum, o) => sum + parseFloat(o.total), 0);
  const avgOrderValue = orders.length > 0 ? ordersTotal / orders.length : 0;

  const recentOrders = orders
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 10)
    .map(o => ({
      orderNumber: o.orderNumber,
      total: o.total,
      status: o.status,
      createdAt: o.createdAt,
    }));

  const productOrderCounts = new Map<string, { count: number; revenue: number; name: string }>();
  for (const order of orders) {
    const items = await storage.getOrderItems(order.id);
    for (const item of items) {
      const existing = productOrderCounts.get(item.productId) || { count: 0, revenue: 0, name: item.productName };
      existing.count += item.quantity;
      existing.revenue += parseFloat(item.total);
      productOrderCounts.set(item.productId, existing);
    }
  }

  const topProducts = Array.from(productOrderCounts.entries())
    .sort((a, b) => b[1].revenue - a[1].revenue)
    .slice(0, 5)
    .map(([_, data]) => ({
      name: data.name,
      orderCount: data.count,
      revenue: data.revenue,
    }));

  const paymentStats = {
    pending: orders.filter(o => o.paymentStatus === "pending").length,
    paid: orders.filter(o => o.paymentStatus === "paid").length,
    failed: orders.filter(o => o.paymentStatus === "failed" || o.paymentStatus === "expired").length,
  };

  return {
    productsCount: products.length,
    categoriesCount: categories.length,
    ordersCount: orders.length,
    ordersTotal,
    avgOrderValue,
    recentOrders,
    topProducts,
    promotionsCount: promotions.length,
    discountsCount: discounts.length,
    paymentStats,
    planName: subscription?.plan?.name || "Старт",
    hasAiAccess: subscription?.plan?.hasAiAccess || false,
  };
}

function buildContextMessage(context: TenantContext): string {
  return `
КОНТЕКСТ МАГАЗИНА:
- Товаров: ${context.productsCount}
- Категорий: ${context.categoriesCount}
- Заказов: ${context.ordersCount}
- Общая выручка: ${context.ordersTotal.toLocaleString('ru-RU')} ₸
- Средний чек: ${context.avgOrderValue.toLocaleString('ru-RU', { maximumFractionDigits: 0 })} ₸
- Акций: ${context.promotionsCount}
- Скидок: ${context.discountsCount}
- Тариф: ${context.planName}

СТАТУСЫ ОПЛАТЫ:
- Ожидают: ${context.paymentStats.pending}
- Оплачены: ${context.paymentStats.paid}
- Неудачные: ${context.paymentStats.failed}

ТОП-5 ТОВАРОВ ПО ВЫРУЧКЕ:
${context.topProducts.length > 0 
  ? context.topProducts.map((p, i) => `${i + 1}. ${p.name}: ${p.revenue.toLocaleString('ru-RU')} ₸ (${p.orderCount} шт)`).join('\n')
  : 'Нет данных о продажах'}

ПОСЛЕДНИЕ ЗАКАЗЫ:
${context.recentOrders.length > 0
  ? context.recentOrders.slice(0, 5).map(o => `- ${o.orderNumber}: ${o.total} ₸ (${o.status})`).join('\n')
  : 'Нет заказов'}
`;
}

const OFF_TOPIC_RESPONSE = "Я — Бизнес-консультант SmartCatalog и работаю только с данными вашего бизнеса и функционалом платформы. Пожалуйста, задайте вопрос о вашем магазине или о работе с SmartCatalog.";

const OFF_TOPIC_PATTERNS = [
  /погод/i, /weather/i,
  /политик/i, /politic/i,
  /код|программ|javascript|python|code/i,
  /анекдот|шутк/i,
  /новост|news/i,
  /игр|game/i,
  /фильм|movie|сериал/i,
  /музык|music/i,
  /рецепт|готов/i,
  /курс валют|bitcoin|crypto/i,
];

function isOffTopic(message: string): boolean {
  return OFF_TOPIC_PATTERNS.some(pattern => pattern.test(message));
}

export async function chat(
  tenantId: string,
  mode: ConsultantMode,
  messages: ConsultantMessage[],
  userMessage: string
): Promise<{ response: string; suggestedActions?: string[] }> {
  if (isOffTopic(userMessage)) {
    return { response: OFF_TOPIC_RESPONSE };
  }

  const modeConfig = CONSULTANT_MODES[mode];
  if (!modeConfig) {
    return { response: "Неизвестный режим консультанта." };
  }

  let systemMessage = modeConfig.systemPrompt;

  if (mode === 'support') {
    systemMessage += `\n\nБАЗА ЗНАНИЙ SMARTCATALOG:\n${SMARTCATALOG_PRODUCT_KB}`;
  } else {
    const context = await getTenantContext(tenantId);
    systemMessage += `\n\n${buildContextMessage(context)}`;
  }

  const chatMessages: OpenAI.Chat.ChatCompletionMessageParam[] = [
    { role: "system", content: systemMessage },
    ...messages.map(m => ({
      role: m.role as "user" | "assistant",
      content: m.content,
    })),
    { role: "user", content: userMessage },
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o",
      messages: chatMessages,
      temperature: 0.7,
      max_tokens: 1500,
    });

    const response = completion.choices[0]?.message?.content || "Не удалось получить ответ.";

    const suggestedActions = getSuggestedActions(mode, userMessage);

    return { response, suggestedActions };
  } catch (error) {
    console.error("Business consultant error:", error);
    return { 
      response: "Произошла ошибка при обработке запроса. Пожалуйста, попробуйте ещё раз." 
    };
  }
}

function getSuggestedActions(mode: ConsultantMode, lastMessage: string): string[] {
  if (mode === 'support') {
    return [
      "Как подключить Kaspi Business?",
      "Как добавить товар?",
      "Как настроить скидку?",
      "Как работают акции?",
    ];
  }

  if (mode === 'analyst' || mode === 'finance') {
    return [
      "Отчёт за сегодня",
      "Отчёт за неделю",
      "Топ товаров",
      "Анализ конверсии",
    ];
  }

  if (mode === 'marketer') {
    return [
      "Эффективность акций",
      "Анализ UTM-меток",
      "Конверсия каталога",
      "Рекомендации по продвижению",
    ];
  }

  if (mode === 'rop') {
    return [
      "Воронка продаж",
      "Анализ WhatsApp",
      "Брошенные корзины",
      "План действий",
    ];
  }

  return [];
}

export const QUICK_TEMPLATES = [
  { id: 'today', label: 'Отчёт за сегодня', prompt: 'Дай отчёт по продажам за сегодня' },
  { id: 'month', label: 'Отчёт за месяц', prompt: 'Дай отчёт по продажам за последний месяц' },
  { id: 'top', label: 'Топ товаров', prompt: 'Покажи топ-5 товаров по продажам' },
  { id: 'whatsapp', label: 'Анализ WhatsApp', prompt: 'Проанализируй эффективность WhatsApp коммуникаций' },
  { id: 'risks', label: 'Риски', prompt: 'Какие риски есть в моём бизнесе сейчас?' },
  { id: 'plan', label: 'План действий', prompt: 'Составь план действий для увеличения продаж' },
];

export { CONSULTANT_MODES };
export type { ConsultantMode, ConsultantMessage };
