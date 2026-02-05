import { storage } from "../../storage";
import type { KaspiIntegration, Order, Payment } from "@shared/schema";
import crypto from "crypto";

export interface KaspiInvoiceResult {
  success: boolean;
  invoiceId?: string;
  paymentUrl?: string;
  qrToken?: string;
  error?: string;
}

export interface KaspiInvoiceStatus {
  status: "pending" | "paid" | "cancelled" | "expired" | "refunded";
  paidAt?: Date;
  clientName?: string;
  clientPhone?: string;
}

export interface VerificationResult {
  success: boolean;
  status: "pending" | "verified" | "failed" | "expired";
  organizationName?: string;
  error?: string;
}

const SMARTCATALOG_KASPI_PHONE = "77765348417";

const KASPI_BUSINESS_API_BASE = "https://bpapi.bazarbay.site/api";

class KaspiBusinessService {
  
  private async callApi(
    apiKey: string,
    endpoint: string,
    method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
    body?: Record<string, unknown>,
    queryParams?: Record<string, string>
  ): Promise<unknown> {
    let url = `${KASPI_BUSINESS_API_BASE}${endpoint}`;
    
    if (queryParams) {
      const params = new URLSearchParams(queryParams);
      url = `${url}?${params.toString()}`;
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "X-API-Key": apiKey,
    };

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`Kaspi Business API error: ${response.status} - ${errorText}`);
        throw new Error(`Kaspi API error: ${response.status}`);
      }

      return response.json();
    } catch (error) {
      console.error("Kaspi Business API call failed:", error);
      throw error;
    }
  }

  async requestVerification(
    integration: KaspiIntegration,
    iinBin: string
  ): Promise<VerificationResult> {
    if (!iinBin || iinBin.length !== 12 || !/^\d{12}$/.test(iinBin)) {
      return {
        success: false,
        status: "failed",
        error: "ИИН/БИН должен содержать 12 цифр",
      };
    }

    try {
      await storage.updateKaspiIntegration(integration.tenantId, {
        iinBin,
        verificationStatus: "pending",
        verificationRequestedAt: new Date(),
        status: "pending_verification",
        verificationError: null,
      });

      return {
        success: true,
        status: "pending",
      };
    } catch (error) {
      return {
        success: false,
        status: "failed",
        error: error instanceof Error ? error.message : "Ошибка запроса верификации",
      };
    }
  }

  async checkVerificationStatus(integration: KaspiIntegration): Promise<VerificationResult> {
    if (!integration.iinBin) {
      return {
        success: false,
        status: "failed",
        error: "ИИН/БИН не указан",
      };
    }

    if (integration.verificationStatus === "verified") {
      return {
        success: true,
        status: "verified",
        organizationName: integration.organizationName || undefined,
      };
    }

    return {
      success: true,
      status: integration.verificationStatus as "pending" | "verified" | "failed" | "expired",
      organizationName: integration.organizationName || undefined,
    };
  }

  async confirmVerification(
    integration: KaspiIntegration,
    apiKey: string
  ): Promise<VerificationResult> {
    try {
      await this.callApi(apiKey, "/invoices", "GET", undefined, {
        page: "1",
        per_page: "1",
      });

      await storage.updateKaspiIntegration(integration.tenantId, {
        apiToken: apiKey,
        verificationStatus: "verified",
        verifiedAt: new Date(),
        status: "connected",
        verificationError: null,
      });

      return {
        success: true,
        status: "verified",
      };
    } catch (error) {
      await storage.updateKaspiIntegration(integration.tenantId, {
        verificationStatus: "failed",
        verificationError: error instanceof Error ? error.message : "Ошибка проверки API ключа",
      });

      return {
        success: false,
        status: "failed",
        error: error instanceof Error ? error.message : "Не удалось подтвердить верификацию",
      };
    }
  }

  async testConnection(integration: KaspiIntegration): Promise<boolean> {
    if (!integration.apiToken) {
      return false;
    }

    try {
      await this.callApi(integration.apiToken, "/invoices", "GET", undefined, {
        page: "1",
        per_page: "1",
      });
      return true;
    } catch {
      return false;
    }
  }

  async createInvoice(
    integration: KaspiIntegration,
    order: Order,
    phoneNumber: string
  ): Promise<KaspiInvoiceResult> {
    if (!integration.apiToken) {
      return {
        success: false,
        error: "API ключ не настроен",
      };
    }

    if (integration.verificationStatus !== "verified") {
      return {
        success: false,
        error: "Kaspi Business не верифицирован",
      };
    }

    try {
      const formattedPhone = this.formatPhoneNumber(phoneNumber);
      
      const invoiceData = {
        amount: parseFloat(order.total),
        phone_number: formattedPhone,
        description: `Заказ #${order.orderNumber}`,
        external_order_id: order.id,
      };

      const result = await this.callApi(
        integration.apiToken,
        "/invoices",
        "POST",
        invoiceData
      ) as {
        id: number;
        kaspi_invoice_id: string;
        kaspi_qr_token: string;
        payment_url: string;
        amount: string;
        status: string;
      };

      return {
        success: true,
        invoiceId: result.id.toString(),
        paymentUrl: result.payment_url,
        qrToken: result.kaspi_qr_token,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : "Ошибка создания счёта",
      };
    }
  }

  async getInvoiceStatus(
    integration: KaspiIntegration,
    invoiceId: string
  ): Promise<KaspiInvoiceStatus> {
    if (!integration.apiToken) {
      return { status: "pending" };
    }

    try {
      const result = await this.callApi(
        integration.apiToken,
        `/invoices/${invoiceId}`,
        "GET"
      ) as {
        status: string;
        paid_at?: string;
        client_name?: string;
        client_phone?: string;
      };

      return {
        status: result.status as KaspiInvoiceStatus["status"],
        paidAt: result.paid_at ? new Date(result.paid_at) : undefined,
        clientName: result.client_name,
        clientPhone: result.client_phone,
      };
    } catch {
      return { status: "pending" };
    }
  }

  async cancelInvoice(
    integration: KaspiIntegration,
    invoiceId: string
  ): Promise<boolean> {
    if (!integration.apiToken) {
      return false;
    }

    try {
      await this.callApi(
        integration.apiToken,
        `/invoices/${invoiceId}/cancel`,
        "POST"
      );
      return true;
    } catch {
      return false;
    }
  }

  validateWebhook(
    webhookSecret: string,
    signature: string,
    payload: string
  ): boolean {
    if (!webhookSecret || !signature) {
      return false;
    }

    const expectedSignature = "sha256=" + crypto
      .createHmac("sha256", webhookSecret)
      .update(payload)
      .digest("hex");

    try {
      return crypto.timingSafeEqual(
        Buffer.from(expectedSignature),
        Buffer.from(signature)
      );
    } catch {
      return false;
    }
  }

  private formatPhoneNumber(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    
    if (digits.startsWith("7") && digits.length === 11) {
      return "8" + digits.slice(1);
    }
    if (digits.startsWith("8") && digits.length === 11) {
      return digits;
    }
    if (digits.length === 10) {
      return "8" + digits;
    }
    
    return digits;
  }

  getSmartCatalogPhone(): string {
    return SMARTCATALOG_KASPI_PHONE;
  }

  getVerificationInstructions(): string[] {
    return [
      `Откройте приложение Kaspi Business на телефоне`,
      `Перейдите в Настройки → Сотрудники → Добавить сотрудника`,
      `Введите номер телефона: +7 ${SMARTCATALOG_KASPI_PHONE.slice(1, 4)} ${SMARTCATALOG_KASPI_PHONE.slice(4, 7)} ${SMARTCATALOG_KASPI_PHONE.slice(7)}`,
      `Выберите права доступа: "Бухгалтер"`,
      `Подтвердите добавление сотрудника`,
      `Вернитесь в SmartCatalog и введите ваш ИИН или БИН`,
      `Подтвердите запрос в приложении Kaspi Business (появится в течение 2 минут)`,
    ];
  }
}

export const kaspiBusinessService = new KaspiBusinessService();
