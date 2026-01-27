interface TelegramNotification {
  botToken: string;
  chatId: string;
  message: string;
  parseMode?: 'HTML' | 'Markdown';
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
  itemsCount: number;
}): string {
  return `🛒 <b>Новый заказ #${order.orderNumber}</b>

👤 Клиент: ${order.customerName}
📞 Телефон: ${order.customerPhone}
💰 Сумма: ${order.total} ₸
📦 Товаров: ${order.itemsCount}`;
}

export function formatHumanRequestNotification(data: {
  customerPhone: string;
  customerName?: string;
  message?: string;
}): string {
  return `🙋 <b>Запрос на менеджера</b>

👤 Клиент: ${data.customerName || 'Не указано'}
📞 Телефон: ${data.customerPhone}
${data.message ? `\n💬 Сообщение: ${data.message}` : ''}`;
}

export function formatAiUnknownNotification(data: {
  customerPhone: string;
  question: string;
}): string {
  return `❓ <b>AI не знает ответ</b>

📞 Клиент: ${data.customerPhone}
💬 Вопрос: ${data.question}

Рекомендуется связаться с клиентом или дополнить базу знаний.`;
}

export function formatCustomerComplaintNotification(data: {
  customerPhone: string;
  customerName?: string;
  complaint: string;
}): string {
  return `⚠️ <b>Жалоба клиента</b>

👤 Клиент: ${data.customerName || 'Не указано'}
📞 Телефон: ${data.customerPhone}
💬 Жалоба: ${data.complaint}`;
}
