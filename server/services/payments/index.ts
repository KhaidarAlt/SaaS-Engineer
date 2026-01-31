import { storage } from "../../storage";
import { kaspiService, type KaspiPaymentResult } from "./kaspi.service";
import type { Order, Payment, KaspiIntegration } from "@shared/schema";

export { kaspiService };

export interface CreatePaymentOptions {
  order: Order;
  tenantId: string;
  source?: "auto" | "manual";
}

export interface PaymentResult {
  success: boolean;
  payment?: Payment;
  paymentUrl?: string;
  error?: string;
}

export async function createPaymentForOrder(options: CreatePaymentOptions): Promise<PaymentResult> {
  const { order, tenantId, source = "auto" } = options;
  
  const kaspiIntegration = await storage.getKaspiIntegration(tenantId);
  
  if (!kaspiIntegration || kaspiIntegration.status !== "connected") {
    return {
      success: false,
      error: "Kaspi не подключен",
    };
  }
  
  const existingPayment = await storage.getPaymentByOrderId(order.id);
  if (existingPayment && existingPayment.status === "pending") {
    return {
      success: true,
      payment: existingPayment,
      paymentUrl: existingPayment.paymentUrl || undefined,
    };
  }
  
  const timeout = kaspiIntegration.paymentTimeout || 30;
  const expiresAt = new Date(Date.now() + timeout * 60 * 1000);
  
  const kaspiResult = await kaspiService.createPayment(kaspiIntegration, order, timeout);
  
  if (!kaspiResult.success) {
    return {
      success: false,
      error: kaspiResult.error || "Ошибка создания платежа в Kaspi",
    };
  }
  
  const payment = await storage.createPayment({
    tenantId,
    orderId: order.id,
    amount: order.total,
    currency: "KZT",
    status: "pending",
    provider: "kaspi",
    externalId: kaspiResult.paymentId,
    paymentUrl: kaspiResult.paymentUrl,
    customerPhone: order.customerPhone,
    customerName: order.customerName,
    source,
    expiresAt,
  });
  
  await storage.updateOrderWithPayment(order.id, tenantId, {
    status: "awaiting_payment",
    paymentStatus: "pending",
    paymentId: payment.id,
    paymentProvider: "kaspi",
  });
  
  return {
    success: true,
    payment,
    paymentUrl: kaspiResult.paymentUrl,
  };
}

export async function processPaymentWebhook(
  tenantId: string,
  externalPaymentId: string,
  webhookData: Record<string, unknown>
): Promise<{ success: boolean; orderId?: string; error?: string }> {
  const payment = await storage.getPaymentByExternalId(externalPaymentId);
  
  if (!payment) {
    return { success: false, error: "Платёж не найден" };
  }
  
  if (payment.status === "paid") {
    return { success: true, orderId: payment.orderId };
  }
  
  const kaspiIntegration = await storage.getKaspiIntegration(tenantId);
  if (!kaspiIntegration) {
    return { success: false, error: "Интеграция Kaspi не найдена" };
  }
  
  const status = await kaspiService.getPaymentStatus(kaspiIntegration, externalPaymentId);
  
  if (status.status === "paid") {
    await storage.updatePayment(payment.id, {
      status: "paid",
      paidAt: status.paidAt || new Date(),
      webhookData,
      webhookReceivedAt: new Date(),
    });
    
    const tenant = await storage.getTenant(tenantId);
    const order = await storage.getOrder(payment.orderId, tenantId);
    
    // Always update payment status on orders, optionally update order status
    if (order) {
      const updateData: Record<string, unknown> = {
        paymentStatus: "paid",
        paidAt: new Date(),
        paymentSource: "auto",
      };
      
      // Only update order.status to "paid" if configured
      if (kaspiIntegration.updateOrderStatus) {
        updateData.status = "paid";
      }
      
      await storage.updateOrderWithPayment(order.id, tenantId, updateData);
      
      await storage.logOrderStatusChange({
        orderId: order.id,
        oldStatus: order.status,
        newStatus: kaspiIntegration.updateOrderStatus ? "paid" : order.status,
        oldPaymentStatus: order.paymentStatus || "pending",
        newPaymentStatus: "paid",
        changedBy: "system",
        source: "kaspi_webhook",
      });
    }
    
    if (kaspiIntegration.notifyManager && tenant?.telegramBotToken && tenant?.telegramChatId) {
      const { sendTelegramMessage } = await import("../telegram");
      sendTelegramMessage({
        botToken: tenant.telegramBotToken,
        chatId: tenant.telegramChatId,
        message: `Оплата получена!\n\nЗаказ: #${order?.orderNumber}\nСумма: ${order?.total} тг\nКлиент: ${order?.customerName}\nИсточник: автоматически (Kaspi)`,
      }).catch(err => console.error("Failed to send Telegram notification:", err));
    }
    
    // Send WhatsApp confirmation to customer
    if (order?.customerPhone) {
      try {
        const { wahaService } = await import("../waha");
        const wahaInstances = await storage.getWahaInstances(tenantId);
        const activeInstance = wahaInstances.find(i => i.status === "active");
        
        if (activeInstance) {
          const customerChatId = order.customerPhone.replace(/\D/g, "") + "@c.us";
          const confirmationMessage = `Оплата получена!\n\nВаш заказ #${order.orderNumber} на сумму ${order.total} тг успешно оплачен.\n\nСпасибо за покупку! Мы свяжемся с вами для уточнения деталей доставки.`;
          
          await wahaService.sendTextMessage(
            activeInstance.instanceName,
            customerChatId,
            confirmationMessage
          );
          console.log(`[Payment] Sent WhatsApp confirmation to ${order.customerPhone}`);
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
      telegramNotified: true,
      crmSynced: kaspiIntegration.syncWithCrm,
    });
    
    return { success: true, orderId: payment.orderId };
  }
  
  if (status.status === "failed" || status.status === "expired" || status.status === "cancelled") {
    await storage.updatePayment(payment.id, {
      status: status.status,
      failedAt: new Date(),
      webhookData,
      webhookReceivedAt: new Date(),
    });
    
    return { success: true, orderId: payment.orderId };
  }
  
  return { success: true, orderId: payment.orderId };
}

export async function checkPaymentStatus(
  tenantId: string,
  orderId: string
): Promise<{ status: string; payment?: Payment }> {
  const payment = await storage.getPaymentByOrderId(orderId);
  
  if (!payment) {
    return { status: "not_found" };
  }
  
  if (payment.status !== "pending") {
    return { status: payment.status, payment };
  }
  
  const kaspiIntegration = await storage.getKaspiIntegration(tenantId);
  if (!kaspiIntegration || !payment.externalId) {
    return { status: payment.status, payment };
  }
  
  const kaspiStatus = await kaspiService.getPaymentStatus(kaspiIntegration, payment.externalId);
  
  if (kaspiStatus.status !== "pending") {
    await storage.updatePayment(payment.id, {
      status: kaspiStatus.status,
      paidAt: kaspiStatus.paidAt,
    });
    
    const updatedPayment = await storage.getPayment(payment.id);
    return { status: kaspiStatus.status, payment: updatedPayment };
  }
  
  if (payment.expiresAt && new Date() > payment.expiresAt) {
    await storage.updatePayment(payment.id, {
      status: "expired",
      failedAt: new Date(),
      failureReason: "Истёк срок оплаты",
    });
    
    const updatedPayment = await storage.getPayment(payment.id);
    return { status: "expired", payment: updatedPayment };
  }
  
  return { status: payment.status, payment };
}
