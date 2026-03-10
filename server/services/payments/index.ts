import { storage } from "../../storage";
import { kaspiBusinessService } from "./kaspi-business.service";
import type { Order, Payment, KaspiIntegration } from "@shared/schema";

export { kaspiBusinessService };

export interface CreatePaymentOptions {
  order: Order;
  tenantId: string;
  source?: "auto" | "manual" | "catalog";
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

  const kaspiPayLink = kaspiBusinessService.getPaymentLink(kaspiIntegration);
  if (!kaspiPayLink) {
    return {
      success: false,
      error: "Ссылка Kaspi Pay не настроена",
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

  const payment = await storage.createPayment({
    tenantId,
    orderId: order.id,
    amount: order.total,
    currency: "KZT",
    status: "pending",
    provider: "kaspi",
    paymentUrl: kaspiPayLink,
    customerPhone: order.customerPhone,
    customerName: order.customerName,
    source,
    expiresAt,
  });

  await storage.updateOrderWithPayment(order.id, tenantId, {
    paymentStatus: "pending",
    paymentId: payment.id,
    paymentProvider: "kaspi",
  });

  return {
    success: true,
    payment,
    paymentUrl: kaspiPayLink,
  };
}

export interface CreateKaspiPaymentOptions {
  order: Order;
  tenantId: string;
  sendWhatsApp?: boolean;
}

export interface KaspiPaymentResult {
  success: boolean;
  payment?: Payment;
  paymentUrl?: string;
  whatsappSent?: boolean;
  error?: string;
}

export async function createKaspiBusinessInvoice(
  options: CreateKaspiPaymentOptions
): Promise<KaspiPaymentResult> {
  const { order, tenantId, sendWhatsApp = true } = options;

  const kaspiIntegration = await storage.getKaspiIntegration(tenantId);

  if (!kaspiIntegration || kaspiIntegration.status !== "connected") {
    return {
      success: false,
      error: "Kaspi не подключен",
    };
  }

  const kaspiPayLink = kaspiBusinessService.getPaymentLink(kaspiIntegration);
  if (!kaspiPayLink) {
    return {
      success: false,
      error: "Ссылка Kaspi Pay не настроена",
    };
  }

  const existingPayment = await storage.getPaymentByOrderId(order.id);
  if (existingPayment && existingPayment.status === "pending") {
    return {
      success: true,
      payment: existingPayment,
      paymentUrl: existingPayment.paymentUrl || undefined,
      whatsappSent: false,
    };
  }

  const timeout = kaspiIntegration.paymentTimeout || 30;
  const expiresAt = new Date(Date.now() + timeout * 60 * 1000);

  const payment = await storage.createPayment({
    tenantId,
    orderId: order.id,
    amount: order.total,
    currency: "KZT",
    status: "pending",
    provider: "kaspi",
    paymentUrl: kaspiPayLink,
    customerPhone: order.customerPhone,
    customerName: order.customerName,
    source: "auto",
    expiresAt,
  });

  await storage.updateOrderWithPayment(order.id, tenantId, {
    paymentStatus: "pending",
    paymentId: payment.id,
    paymentProvider: "kaspi",
  });

  let whatsappSent = false;

  if (sendWhatsApp && order.customerPhone) {
    try {
      const { wahaService } = await import("../waha");
      const wahaInstances = await storage.getWahaInstances(tenantId);
      const activeInstance = wahaInstances.find(i => i.status === "active");

      if (activeInstance) {
        const tenant = await storage.getTenant(tenantId);
        const storeName = tenant?.name || "SmartCatalog";

        const paymentMessage = kaspiBusinessService.buildPaymentMessage(
          order,
          kaspiPayLink,
          storeName
        );

        const customerChatId = order.customerPhone.replace(/\D/g, "") + "@c.us";
        await wahaService.sendTextMessage(
          activeInstance.instanceName,
          customerChatId,
          paymentMessage
        );

        whatsappSent = true;
        console.log(`[KaspiBusiness] Payment link sent via WhatsApp to ${order.customerPhone}`);
      }
    } catch (whatsappErr) {
      console.error("Failed to send WhatsApp payment link:", whatsappErr);
    }
  }

  return {
    success: true,
    payment,
    paymentUrl: kaspiPayLink,
    whatsappSent,
  };
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

export async function confirmPaymentByManager(
  tenantId: string,
  paymentId: string,
  confirmedBy: string
): Promise<{ success: boolean; error?: string }> {
  const payment = await storage.getPayment(paymentId);
  if (!payment || payment.tenantId !== tenantId) {
    return { success: false, error: "Платёж не найден" };
  }

  const kaspiIntegration = await storage.getKaspiIntegration(tenantId);
  if (!kaspiIntegration) {
    return { success: false, error: "Интеграция Kaspi не найдена" };
  }

  return kaspiBusinessService.confirmPayment(payment, confirmedBy, kaspiIntegration);
}
