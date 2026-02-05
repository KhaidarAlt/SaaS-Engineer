import crypto from "crypto";
import { storage } from "../../storage";
import type { TelegramIntegration, Tenant } from "@shared/schema";

interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
}

interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  chat: {
    id: number;
    type: string;
    title?: string;
    username?: string;
    first_name?: string;
    last_name?: string;
  };
  date: number;
  text?: string;
}

interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
}

interface BotInfo {
  id: number;
  is_bot: boolean;
  first_name: string;
  username: string;
}

export class TelegramService {
  private baseUrl = "https://api.telegram.org";

  async verifyBotToken(botToken: string): Promise<{ success: boolean; botInfo?: BotInfo; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/bot${botToken}/getMe`);
      const data = await response.json();

      if (!data.ok) {
        return { success: false, error: data.description || "Неверный токен бота" };
      }

      return { success: true, botInfo: data.result };
    } catch (error) {
      console.error("Telegram verify error:", error);
      return { success: false, error: "Ошибка проверки токена" };
    }
  }

  async setWebhook(
    botToken: string,
    webhookUrl: string,
    secret: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/bot${botToken}/setWebhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: webhookUrl,
          secret_token: secret,
          allowed_updates: ["message"],
        }),
      });

      const data = await response.json();

      if (!data.ok) {
        return { success: false, error: data.description || "Ошибка установки вебхука" };
      }

      return { success: true };
    } catch (error) {
      console.error("Telegram setWebhook error:", error);
      return { success: false, error: "Ошибка установки вебхука" };
    }
  }

  async deleteWebhook(botToken: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/bot${botToken}/deleteWebhook`, {
        method: "POST",
      });

      const data = await response.json();

      if (!data.ok) {
        return { success: false, error: data.description };
      }

      return { success: true };
    } catch (error) {
      console.error("Telegram deleteWebhook error:", error);
      return { success: false, error: "Ошибка удаления вебхука" };
    }
  }

  async sendMessage(
    botToken: string,
    chatId: string | number,
    text: string,
    parseMode: "HTML" | "Markdown" = "HTML"
  ): Promise<{ success: boolean; messageId?: number; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/bot${botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text: text,
          parse_mode: parseMode,
        }),
      });

      const data = await response.json();

      if (!data.ok) {
        return { success: false, error: data.description };
      }

      return { success: true, messageId: data.result.message_id };
    } catch (error) {
      console.error("Telegram sendMessage error:", error);
      return { success: false, error: "Ошибка отправки сообщения" };
    }
  }

  async connectBot(
    tenantId: string,
    botToken: string,
    baseAppUrl: string
  ): Promise<{ success: boolean; integration?: TelegramIntegration; error?: string }> {
    const existingIntegration = await storage.getTelegramIntegration(tenantId);
    if (existingIntegration) {
      return { success: false, error: "Telegram бот уже подключен" };
    }

    const verification = await this.verifyBotToken(botToken);
    if (!verification.success || !verification.botInfo) {
      return { success: false, error: verification.error || "Неверный токен бота" };
    }

    const webhookSecret = crypto.randomBytes(32).toString("hex");
    const webhookUrl = `${baseAppUrl}/api/telegram/webhook/${verification.botInfo.id}`;

    const webhookResult = await this.setWebhook(botToken, webhookUrl, webhookSecret);
    if (!webhookResult.success) {
      return { success: false, error: webhookResult.error };
    }

    const integration = await storage.createTelegramIntegration({
      tenantId,
      botToken,
      botUsername: verification.botInfo.username,
      botId: String(verification.botInfo.id),
      webhookUrl,
      webhookSecret,
      status: "active",
    });

    return { success: true, integration };
  }

  async disconnectBot(tenantId: string): Promise<{ success: boolean; error?: string }> {
    const integration = await storage.getTelegramIntegration(tenantId);
    if (!integration) {
      return { success: false, error: "Интеграция не найдена" };
    }

    await this.deleteWebhook(integration.botToken);

    await storage.deleteTelegramIntegration(tenantId);

    return { success: true };
  }

  verifyWebhookRequest(secret: string | undefined, expectedSecret: string): boolean {
    if (!secret || !expectedSecret) return false;
    
    if (secret.length !== expectedSecret.length) return false;
    
    try {
      return crypto.timingSafeEqual(
        Buffer.from(secret),
        Buffer.from(expectedSecret)
      );
    } catch {
      return false;
    }
  }

  async processWebhookUpdate(
    update: TelegramUpdate,
    integration: TelegramIntegration,
    tenant: Tenant
  ): Promise<void> {
    const message = update.message;
    if (!message || !message.text) return;

    await storage.createTelegramMessage({
      tenantId: integration.tenantId,
      integrationId: integration.id,
      chatId: String(message.chat.id),
      messageId: String(message.message_id),
      senderName: message.from
        ? `${message.from.first_name}${message.from.last_name ? " " + message.from.last_name : ""}`
        : undefined,
      senderUsername: message.from?.username,
      messageText: message.text,
      direction: "inbound",
      status: "received",
    });

    const responseText = await this.generateAIResponse(message.text, tenant);

    if (responseText) {
      const sendResult = await this.sendMessage(
        integration.botToken,
        message.chat.id,
        responseText
      );

      if (sendResult.success) {
        await storage.createTelegramMessage({
          tenantId: integration.tenantId,
          integrationId: integration.id,
          chatId: String(message.chat.id),
          messageId: sendResult.messageId ? String(sendResult.messageId) : undefined,
          messageText: responseText,
          direction: "outbound",
          status: "sent",
        });
      }
    }
  }

  private async generateAIResponse(text: string, tenant: Tenant): Promise<string | null> {
    if (!tenant.aiEnabled) {
      return "Здравствуйте! К сожалению, AI-ассистент временно недоступен. Мы свяжемся с вами в ближайшее время.";
    }

    try {
      const { generateAIResponse } = await import("../openai");
      const response = await generateAIResponse(
        tenant.id,
        text,
        [],
        { phone: "telegram" }
      );
      return response;
    } catch (error) {
      console.error("AI response generation error:", error);
      return "Спасибо за ваше сообщение! Мы скоро ответим.";
    }
  }

  async findIntegrationByBotId(botId: string): Promise<TelegramIntegration | null> {
    const integration = await storage.getTelegramIntegrationByBotId(botId);
    return integration || null;
  }
}

export const telegramService = new TelegramService();
