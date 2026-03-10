import { storage } from "../../storage";
import type { KaspiIntegration, Order, Payment } from "@shared/schema";
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

export interface ReceiptVerificationResult {
  verified: boolean;
  confidence: number;
  extractedAmount?: number;
  extractedDate?: string;
  extractedRecipient?: string;
  details: string;
  warnings: string[];
}

export interface KaspiConnectResult {
  success: boolean;
  error?: string;
}

class KaspiBusinessService {

  validateKaspiPayLink(link: string): { valid: boolean; error?: string } {
    if (!link || link.trim().length === 0) {
      return { valid: false, error: "Ссылка не может быть пустой" };
    }

    const trimmed = link.trim();

    const pattern = /^https:\/\/pay\.kaspi\.kz\/pay\/[a-zA-Z0-9]+$/;
    if (!pattern.test(trimmed)) {
      return {
        valid: false,
        error: "Ссылка должна быть в формате https://pay.kaspi.kz/pay/XXXX",
      };
    }

    return { valid: true };
  }

  async connect(tenantId: string, kaspiPayLink: string): Promise<KaspiConnectResult> {
    const validation = this.validateKaspiPayLink(kaspiPayLink);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    const existing = await storage.getKaspiIntegration(tenantId);

    if (existing) {
      await storage.updateKaspiIntegration(tenantId, {
        kaspiPayLink: kaspiPayLink.trim(),
        status: "connected",
        verificationStatus: "verified",
        verifiedAt: new Date(),
        verificationError: null,
        lastError: null,
        lastErrorAt: null,
      });
    } else {
      await storage.createKaspiIntegration({
        tenantId,
        kaspiPayLink: kaspiPayLink.trim(),
        status: "connected",
        verificationStatus: "verified",
        verifiedAt: new Date(),
      });
    }

    return { success: true };
  }

  async disconnect(tenantId: string): Promise<void> {
    await storage.updateKaspiIntegration(tenantId, {
      kaspiPayLink: null,
      status: "disconnected",
      verificationStatus: "not_started",
      verifiedAt: null,
      verificationError: null,
      apiToken: null,
      merchantId: null,
      webhookSecret: null,
    });
  }

  getPaymentLink(integration: KaspiIntegration): string | null {
    return integration.kaspiPayLink || null;
  }

  buildPaymentMessage(
    order: Order,
    kaspiPayLink: string,
    storeName: string
  ): string {
    return `Здравствуйте, ${order.customerName}!

Ваш заказ #${order.orderNumber} на сумму ${order.total} ₸ оформлен в ${storeName}.

Для оплаты через Kaspi перейдите по ссылке:
${kaspiPayLink}

Введите сумму: ${order.total} ₸
В комментарии укажите: Заказ #${order.orderNumber}

После оплаты, пожалуйста, отправьте скриншот чека для подтверждения.

Спасибо за заказ!`;
  }

  async verifyReceipt(
    imageUrl: string,
    expectedAmount: number,
    orderNumber: string
  ): Promise<ReceiptVerificationResult> {
    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `Ты — система верификации платёжных чеков Kaspi. Проанализируй изображение чека и извлеки данные.

Верни JSON в формате:
{
  "verified": true/false,
  "confidence": 0.0-1.0,
  "extractedAmount": число (сумма в тенге),
  "extractedDate": "дата платежа",
  "extractedRecipient": "получатель",
  "details": "краткое описание",
  "warnings": ["предупреждение1"]
}

Правила верификации:
- Проверь что это реальный чек Kaspi (логотип, формат)
- Извлеки сумму платежа
- Ожидаемая сумма: ${expectedAmount} ₸
- Номер заказа: ${orderNumber}
- Допустимое отклонение суммы: ±1 ₸
- Если сумма совпадает и чек выглядит подлинным — verified: true
- Если есть сомнения — добавь предупреждения в warnings
- confidence показывает уверенность в подлинности чека`,
          },
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Проверь этот чек оплаты. Ожидаемая сумма: ${expectedAmount} ₸, заказ #${orderNumber}`,
              },
              {
                type: "image_url",
                image_url: { url: imageUrl },
              },
            ],
          },
        ],
        response_format: { type: "json_object" },
        max_tokens: 500,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        return {
          verified: false,
          confidence: 0,
          details: "Не удалось проанализировать изображение",
          warnings: ["AI не вернул ответ"],
        };
      }

      const result = JSON.parse(content) as ReceiptVerificationResult;
      return {
        verified: result.verified ?? false,
        confidence: result.confidence ?? 0,
        extractedAmount: result.extractedAmount,
        extractedDate: result.extractedDate,
        extractedRecipient: result.extractedRecipient,
        details: result.details || "Анализ завершён",
        warnings: result.warnings || [],
      };
    } catch (error) {
      console.error("[KaspiBusiness] Receipt verification error:", error);
      return {
        verified: false,
        confidence: 0,
        details: "Ошибка при анализе чека",
        warnings: [error instanceof Error ? error.message : "Неизвестная ошибка"],
      };
    }
  }

  async confirmPayment(
    payment: Payment,
    confirmedBy: string,
    kaspiIntegration: KaspiIntegration
  ): Promise<{ success: boolean; error?: string }> {
    if (payment.status === "paid") {
      return { success: false, error: "Платёж уже подтверждён" };
    }

    const tenantId = payment.tenantId;

    await storage.updatePayment(payment.id, {
      status: "paid",
      paidAt: new Date(),
      confirmedBy,
      confirmedAt: new Date(),
    });

    const order = await storage.getOrder(payment.orderId, tenantId);
    if (!order) {
      return { success: true };
    }

    const updateData: Record<string, unknown> = {
      paymentStatus: "paid",
      paidAt: new Date(),
      paymentSource: "manual",
    };

    if (kaspiIntegration.updateOrderStatus && order.status === "new") {
      updateData.status = "confirmed";
    }

    await storage.updateOrderWithPayment(order.id, tenantId, updateData);

    await storage.logOrderStatusChange({
      orderId: order.id,
      oldStatus: order.status,
      newStatus: (updateData.status as string) || order.status,
      oldPaymentStatus: order.paymentStatus || "pending",
      newPaymentStatus: "paid",
      changedBy: confirmedBy,
      source: "manager_confirm",
    });

    const tenant = await storage.getTenant(tenantId);

    if (kaspiIntegration.notifyManager && tenant?.telegramBotToken && tenant?.telegramChatId) {
      try {
        const { sendTelegramMessage } = await import("../telegram");
        await sendTelegramMessage({
          botToken: tenant.telegramBotToken,
          chatId: tenant.telegramChatId,
          message: `Оплата подтверждена!\n\nЗаказ: #${order.orderNumber}\nСумма: ${order.total} ₸\nКлиент: ${order.customerName}\nПодтвердил: менеджер`,
        });
      } catch (err) {
        console.error("Failed to send Telegram notification:", err);
      }
    }

    if (order.customerPhone) {
      try {
        const { wahaService } = await import("../waha");
        const wahaInstances = await storage.getWahaInstances(tenantId);
        const activeInstance = wahaInstances.find(i => i.status === "active");

        if (activeInstance) {
          const customerChatId = order.customerPhone.replace(/\D/g, "") + "@c.us";
          const storeName = tenant?.name || "SmartCatalog";
          const confirmationMessage = `Оплата получена!\n\nВаш заказ #${order.orderNumber} на сумму ${order.total} ₸ в ${storeName} успешно оплачен.\n\nСпасибо за покупку! Мы свяжемся с вами для уточнения деталей доставки.`;

          await wahaService.sendTextMessage(
            activeInstance.instanceName,
            customerChatId,
            confirmationMessage
          );
        }
      } catch (whatsappErr) {
        console.error("Failed to send WhatsApp confirmation:", whatsappErr);
      }
    }

    if (kaspiIntegration.syncWithCrm && order) {
      try {
        const { syncOrderStatusToCrm } = await import("../crm");
        syncOrderStatusToCrm(order, "paid").catch(err =>
          console.error("Failed to sync with CRM:", err)
        );
      } catch (err) {
        console.error("CRM sync error:", err);
      }
    }

    await storage.updatePayment(payment.id, {
      crmSynced: kaspiIntegration.syncWithCrm || false,
    });

    return { success: true };
  }
}

export const kaspiBusinessService = new KaspiBusinessService();
