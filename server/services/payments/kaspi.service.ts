import { storage } from "../../storage";
import type { KaspiIntegration, Order, Payment } from "@shared/schema";

export interface KaspiPaymentResult {
  success: boolean;
  paymentId?: string;
  paymentUrl?: string;
  error?: string;
}

export interface KaspiPaymentStatus {
  status: "pending" | "paid" | "failed" | "expired" | "cancelled";
  paidAt?: Date;
  transactionId?: string;
}

class KaspiService {
  private async callApi(
    integration: KaspiIntegration,
    endpoint: string,
    method: "GET" | "POST" = "GET",
    body?: Record<string, unknown>
  ): Promise<unknown> {
    if (!integration.merchantId || !integration.apiToken) {
      throw new Error("Kaspi credentials not configured");
    }

    const baseUrl = "https://kaspi.kz/pay/api/v1";
    const url = `${baseUrl}${endpoint}`;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${integration.apiToken}`,
      "X-Merchant-ID": integration.merchantId,
    };

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Kaspi API error: ${response.status} - ${errorText}`);
        throw new Error(`Kaspi API error: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error("Kaspi API call failed:", error);
      throw error;
    }
  }

  async testConnection(integration: KaspiIntegration): Promise<boolean> {
    try {
      await this.callApi(integration, "/merchant/info");
      return true;
    } catch {
      return false;
    }
  }

  async createPayment(
    integration: KaspiIntegration,
    order: Order,
    expiresInMinutes: number = 30
  ): Promise<KaspiPaymentResult> {
    try {
      const expiresAt = new Date(Date.now() + expiresInMinutes * 60 * 1000);
      
      const paymentData = {
        merchantId: integration.merchantId,
        orderId: order.id,
        orderNumber: order.orderNumber,
        amount: parseFloat(order.total),
        currency: "KZT",
        description: `Заказ #${order.orderNumber}`,
        returnUrl: `https://smartcatalog.kz/payment/success`,
        failUrl: `https://smartcatalog.kz/payment/fail`,
        expiresAt: expiresAt.toISOString(),
        customer: {
          phone: order.customerPhone,
          name: order.customerName,
        },
      };

      const result = await this.callApi(integration, "/payments/create", "POST", paymentData) as {
        id: string;
        paymentUrl: string;
      };

      return {
        success: true,
        paymentId: result.id,
        paymentUrl: result.paymentUrl,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Ошибка создания платежа",
      };
    }
  }

  async getPaymentStatus(
    integration: KaspiIntegration,
    paymentId: string
  ): Promise<KaspiPaymentStatus> {
    try {
      const result = await this.callApi(integration, `/payments/${paymentId}/status`) as {
        status: string;
        paidAt?: string;
        transactionId?: string;
      };

      return {
        status: result.status as KaspiPaymentStatus["status"],
        paidAt: result.paidAt ? new Date(result.paidAt) : undefined,
        transactionId: result.transactionId,
      };
    } catch {
      return { status: "pending" };
    }
  }

  async cancelPayment(
    integration: KaspiIntegration,
    paymentId: string
  ): Promise<boolean> {
    try {
      await this.callApi(integration, `/payments/${paymentId}/cancel`, "POST");
      return true;
    } catch {
      return false;
    }
  }

  validateWebhook(
    integration: KaspiIntegration,
    signature: string,
    payload: string
  ): { valid: boolean; error?: string } {
    if (!integration.webhookSecret) {
      console.error("Webhook secret not configured - rejecting webhook for security");
      return { valid: false, error: "Webhook secret not configured" };
    }

    if (!signature) {
      console.error("No signature provided in webhook request");
      return { valid: false, error: "Missing signature" };
    }

    const crypto = require("crypto");
    const expectedSignature = crypto
      .createHmac("sha256", integration.webhookSecret)
      .update(payload)
      .digest("hex");

    // Use constant-time comparison to prevent timing attacks
    const signatureBuffer = Buffer.from(signature, "hex");
    const expectedBuffer = Buffer.from(expectedSignature, "hex");
    
    if (signatureBuffer.length !== expectedBuffer.length) {
      return { valid: false, error: "Invalid signature format" };
    }

    const isValid = crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
    
    if (!isValid) {
      console.error("Webhook signature validation failed");
      return { valid: false, error: "Invalid signature" };
    }

    return { valid: true };
  }

  generatePaymentLink(orderId: string, amount: number): string {
    const params = new URLSearchParams({
      orderId,
      amount: amount.toString(),
    });
    return `kaspi://pay?${params.toString()}`;
  }
}

export const kaspiService = new KaspiService();
