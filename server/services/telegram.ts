interface TelegramNotification {
  botToken: string;
  chatId: string;
  message: string;
  parseMode?: 'HTML' | 'Markdown';
}

const BASE_URL = process.env.APP_URL || 'https://botfactory.kz';

function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function formatPrice(price: string | number): string {
  const num = typeof price === 'string' ? parseFloat(price) : price;
  if (isNaN(num)) return '0';
  return num.toLocaleString('ru-RU', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

export async function sendTelegramMessage({
  botToken,
  chatId,
  message,
  parseMode = 'HTML',
}: TelegramNotification): Promise<{ success: boolean; error?: string }> {
  if (!botToken || !chatId) {
    return { success: false, error: 'Telegram не настроен' };
  }

  try {
    const url = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text: message,
        parse_mode: parseMode,
        disable_web_page_preview: true,
      }),
    });

    const data = await response.json();
    
    if (!data.ok) {
      console.error('Telegram API error:', data);
      return { success: false, error: data.description || 'Ошибка Telegram API' };
    }

    return { success: true };
  } catch (error) {
    console.error('Telegram send error:', error);
    return { success: false, error: 'Ошибка отправки сообщения' };
  }
}

export async function verifyTelegramBot(botToken: string): Promise<{ success: boolean; botName?: string; error?: string }> {
  try {
    const url = `https://api.telegram.org/bot${botToken}/getMe`;
    const response = await fetch(url);
    const data = await response.json();

    if (!data.ok) {
      return { success: false, error: 'Неверный токен бота' };
    }

    return { success: true, botName: data.result.username };
  } catch (error) {
    console.error('Telegram verify error:', error);
    return { success: false, error: 'Ошибка проверки токена' };
  }
}

export function formatNewOrderNotification(order: {
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  total: string;
  comment?: string | null;
  items?: Array<{
    productName: string;
    quantity: number;
    unitPrice: string;
    total?: string;
  }>;
  orderId?: string;
  conversationId?: string;
}): string {
  let msg = `🛒 <b>Новый заказ #${escapeHtml(order.orderNumber)}</b>\n`;
  msg += `\n👤 Клиент: ${escapeHtml(order.customerName)}`;
  msg += `\n📞 Телефон: ${escapeHtml(order.customerPhone)}`;
  msg += `\n💰 Сумма: ${formatPrice(order.total)} ₸`;

  if (order.items && order.items.length > 0) {
    msg += `\n\n📋 <b>Состав заказа:</b>`;
    for (const item of order.items) {
      const lineTotal = item.total || (parseFloat(item.unitPrice) * item.quantity).toFixed(2);
      msg += `\n  • ${escapeHtml(item.productName)} — ${item.quantity} шт × ${formatPrice(item.unitPrice)} ₸ = ${formatPrice(lineTotal)} ₸`;
    }
  }

  if (order.comment) {
    msg += `\n\n💬 Комментарий: ${escapeHtml(order.comment)}`;
  }

  if (order.orderId) {
    msg += `\n\n📎 <a href="${BASE_URL}/dashboard/orders/${encodeURIComponent(order.orderId)}">Открыть заказ</a>`;
  }

  if (order.conversationId) {
    msg += `${order.orderId ? ' | ' : '\n\n📎 '}<a href="${BASE_URL}/dashboard/ai/rop/analytics?dialog=${encodeURIComponent(order.conversationId)}">Открыть диалог</a>`;
  }

  return msg;
}

export function formatHumanRequestNotification(data: {
  customerPhone: string;
  customerName?: string;
  message?: string;
  conversationId?: string;
}): string {
  let msg = `🙋 <b>Запрос на менеджера</b>\n`;
  msg += `\n👤 Клиент: ${escapeHtml(data.customerName || 'Не указано')}`;
  msg += `\n📞 Телефон: ${escapeHtml(data.customerPhone)}`;

  if (data.message) {
    msg += `\n\n💬 Сообщение: ${escapeHtml(data.message)}`;
  }

  if (data.conversationId) {
    msg += `\n\n📎 <a href="${BASE_URL}/dashboard/ai/rop/analytics?dialog=${encodeURIComponent(data.conversationId)}">Открыть диалог</a>`;
  }

  return msg;
}

export function formatAiUnknownNotification(data: {
  customerPhone: string;
  question: string;
  conversationId?: string;
}): string {
  let msg = `❓ <b>AI не знает ответ</b>\n`;
  msg += `\n📞 Клиент: ${escapeHtml(data.customerPhone)}`;
  msg += `\n💬 Вопрос: ${escapeHtml(data.question)}`;
  msg += `\n\nРекомендуется связаться с клиентом или дополнить базу знаний.`;

  if (data.conversationId) {
    msg += `\n\n📎 <a href="${BASE_URL}/dashboard/ai/rop/analytics?dialog=${encodeURIComponent(data.conversationId)}">Открыть диалог</a>`;
  }

  return msg;
}

export function formatCustomerComplaintNotification(data: {
  customerPhone: string;
  customerName?: string;
  complaint: string;
  conversationId?: string;
}): string {
  let msg = `⚠️ <b>Жалоба клиента</b>\n`;
  msg += `\n👤 Клиент: ${escapeHtml(data.customerName || 'Не указано')}`;
  msg += `\n📞 Телефон: ${escapeHtml(data.customerPhone)}`;
  msg += `\n💬 Жалоба: ${escapeHtml(data.complaint)}`;

  if (data.conversationId) {
    msg += `\n\n📎 <a href="${BASE_URL}/dashboard/ai/rop/analytics?dialog=${encodeURIComponent(data.conversationId)}">Открыть диалог</a>`;
  }

  return msg;
}
