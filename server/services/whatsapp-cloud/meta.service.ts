import { storage } from "../../storage";
import crypto from "crypto";
import type { WaCloudIntegration, WaCloudPhoneNumber, WaCloudTemplate, WaCloudWarmupStatus } from "@shared/schema";

const META_GRAPH_API_URL = "https://graph.facebook.com/v18.0";

interface MetaOAuthResponse {
  access_token: string;
  token_type: string;
  expires_in?: number;
}

interface MetaPhoneNumberInfo {
  id: string;
  verified_name: string;
  display_phone_number: string;
  quality_rating: string;
  messaging_limit_tier: string;
  account_mode?: string;
}

interface MetaTemplateInfo {
  id: string;
  name: string;
  status: string;
  category: string;
  language: string;
  rejected_reason?: string;
  components: any[];
}

interface MetaWebhookEvent {
  entry?: Array<{
    id: string;
    changes?: Array<{
      value: {
        messaging_product: string;
        metadata: { phone_number_id: string };
        contacts?: Array<{ profile: { name: string }; wa_id: string }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: string;
          text?: { body: string };
        }>;
        statuses?: Array<{
          id: string;
          status: string;
          timestamp: string;
          recipient_id: string;
        }>;
      };
      field: string;
    }>;
  }>;
}

class MetaCloudService {
  private getAuthHeaders(accessToken: string): HeadersInit {
    return {
      "Authorization": `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    };
  }

  async initiateOAuth(tenantId: string, appId: string, redirectUri: string, appSecret: string): Promise<string> {
    const webhookVerifyToken = this.generateVerifyToken();
    const nonce = crypto.randomBytes(16).toString("hex");
    
    const existing = await storage.getWaCloudIntegration(tenantId);
    if (existing) {
      await storage.updateWaCloudIntegration(existing.id, {
        status: "connecting",
        webhookVerifyToken,
        onboardingStep: 1,
        oauthNonce: nonce,
      });
    } else {
      await storage.createWaCloudIntegration({
        tenantId,
        status: "connecting",
        webhookVerifyToken,
        onboardingStep: 1,
        oauthNonce: nonce,
      });
    }
    
    const scopes = [
      "whatsapp_business_management",
      "whatsapp_business_messaging",
      "business_management",
    ].join(",");
    
    const statePayload = { tenantId, nonce, ts: Date.now() };
    const stateData = Buffer.from(JSON.stringify(statePayload)).toString("base64");
    const stateSignature = crypto.createHmac("sha256", appSecret).update(stateData).digest("hex");
    const state = `${stateData}.${stateSignature}`;
    
    return `https://www.facebook.com/v18.0/dialog/oauth?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${scopes}&state=${encodeURIComponent(state)}&response_type=code`;
  }

  verifyOAuthState(state: string, appSecret: string): { valid: boolean; tenantId?: string; nonce?: string; error?: string } {
    try {
      const [stateData, stateSignature] = state.split(".");
      if (!stateData || !stateSignature) {
        return { valid: false, error: "Invalid state format" };
      }
      
      const expectedSignature = crypto.createHmac("sha256", appSecret).update(stateData).digest("hex");
      const expectedSigBuffer = Buffer.from(expectedSignature, "hex");
      const receivedSigBuffer = Buffer.from(stateSignature, "hex");
      
      if (expectedSigBuffer.length !== receivedSigBuffer.length) {
        return { valid: false, error: "Invalid state signature" };
      }
      
      if (!crypto.timingSafeEqual(expectedSigBuffer, receivedSigBuffer)) {
        return { valid: false, error: "Invalid state signature" };
      }
      
      const payload = JSON.parse(Buffer.from(stateData, "base64").toString());
      const maxAge = 10 * 60 * 1000;
      if (Date.now() - payload.ts > maxAge) {
        return { valid: false, error: "State expired" };
      }
      
      return { valid: true, tenantId: payload.tenantId, nonce: payload.nonce };
    } catch (error) {
      return { valid: false, error: "Failed to parse state" };
    }
  }

  async validateOAuthNonce(tenantId: string, nonce: string): Promise<boolean> {
    const integration = await storage.getWaCloudIntegration(tenantId);
    if (!integration || integration.oauthNonce !== nonce) {
      return false;
    }
    await storage.updateWaCloudIntegration(integration.id, { oauthNonce: null });
    return true;
  }

  async handleOAuthCallback(
    tenantId: string,
    code: string,
    appId: string,
    appSecret: string,
    redirectUri: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      const tokenUrl = `https://graph.facebook.com/v18.0/oauth/access_token?client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}&client_secret=${appSecret}&code=${code}`;
      
      const response = await fetch(tokenUrl);
      if (!response.ok) {
        const error = await response.text();
        console.error("Meta OAuth token error:", error);
        return { success: false, error: "Ошибка авторизации Meta" };
      }
      
      const data = await response.json() as MetaOAuthResponse;
      
      const tokenExpiresAt = data.expires_in 
        ? new Date(Date.now() + data.expires_in * 1000)
        : new Date(Date.now() + 60 * 24 * 60 * 60 * 1000);
      
      await storage.updateWaCloudIntegration(tenantId, {
        accessToken: data.access_token,
        tokenExpiresAt,
        status: "connected",
        onboardingStep: 2,
        connectionError: null,
      });
      
      return { success: true };
    } catch (error) {
      console.error("OAuth callback error:", error);
      await storage.updateWaCloudIntegration(tenantId, {
        status: "error",
        connectionError: "Ошибка обработки авторизации",
      });
      return { success: false, error: "Ошибка обработки авторизации" };
    }
  }

  async fetchBusinessAccounts(tenantId: string): Promise<{
    success: boolean;
    accounts?: Array<{ id: string; name: string }>;
    error?: string;
  }> {
    const integration = await storage.getWaCloudIntegration(tenantId);
    if (!integration?.accessToken) {
      return { success: false, error: "Требуется авторизация" };
    }
    
    try {
      const response = await fetch(
        `${META_GRAPH_API_URL}/me/businesses`,
        { headers: this.getAuthHeaders(integration.accessToken) }
      );
      
      if (!response.ok) {
        return { success: false, error: "Ошибка получения бизнес-аккаунтов" };
      }
      
      const data = await response.json();
      return {
        success: true,
        accounts: data.data?.map((b: any) => ({ id: b.id, name: b.name })) || [],
      };
    } catch (error) {
      console.error("Fetch business accounts error:", error);
      return { success: false, error: "Ошибка сети" };
    }
  }

  async selectBusinessAccount(tenantId: string, businessId: string): Promise<{ success: boolean; wabaId?: string; error?: string }> {
    const integration = await storage.getWaCloudIntegration(tenantId);
    if (!integration?.accessToken) {
      return { success: false, error: "Требуется авторизация" };
    }
    
    try {
      const response = await fetch(
        `${META_GRAPH_API_URL}/${businessId}/owned_whatsapp_business_accounts`,
        { headers: this.getAuthHeaders(integration.accessToken) }
      );
      
      if (!response.ok) {
        return { success: false, error: "Ошибка получения WABA" };
      }
      
      const data = await response.json();
      const waba = data.data?.[0];
      
      if (!waba) {
        return { success: false, error: "WABA не найден. Создайте WABA в Meta Business Manager." };
      }
      
      await storage.updateWaCloudIntegration(tenantId, {
        businessId,
        wabaId: waba.id,
        onboardingStep: 3,
      });
      
      return { success: true, wabaId: waba.id };
    } catch (error) {
      console.error("Select business account error:", error);
      return { success: false, error: "Ошибка сети" };
    }
  }

  async fetchPhoneNumbers(tenantId: string): Promise<{
    success: boolean;
    phones?: MetaPhoneNumberInfo[];
    error?: string;
  }> {
    const integration = await storage.getWaCloudIntegration(tenantId);
    if (!integration?.accessToken || !integration.wabaId) {
      return { success: false, error: "WABA не подключен" };
    }
    
    try {
      const response = await fetch(
        `${META_GRAPH_API_URL}/${integration.wabaId}/phone_numbers`,
        { headers: this.getAuthHeaders(integration.accessToken) }
      );
      
      if (!response.ok) {
        return { success: false, error: "Ошибка получения номеров" };
      }
      
      const data = await response.json();
      return { success: true, phones: data.data || [] };
    } catch (error) {
      console.error("Fetch phone numbers error:", error);
      return { success: false, error: "Ошибка сети" };
    }
  }

  async registerPhoneNumber(
    tenantId: string,
    phoneNumberId: string,
    displayPhoneNumber: string
  ): Promise<{ success: boolean; error?: string }> {
    const integration = await storage.getWaCloudIntegration(tenantId);
    if (!integration) {
      return { success: false, error: "Интеграция не найдена" };
    }
    
    try {
      const existingPhones = await storage.getWaCloudPhoneNumbers(tenantId);
      const isDefault = existingPhones.length === 0;
      
      await storage.createWaCloudPhoneNumber({
        tenantId,
        integrationId: integration.id,
        phoneNumber: displayPhoneNumber,
        phoneNumberId,
        displayPhoneNumber,
        status: "pending",
        verificationStatus: "pending",
        qualityRating: "unknown",
        messagingTier: "tier_1",
        channelType: "cloud_api",
        isDefault,
      });
      
      await storage.updateWaCloudIntegration(tenantId, { onboardingStep: 4 });
      
      return { success: true };
    } catch (error) {
      console.error("Register phone number error:", error);
      return { success: false, error: "Ошибка регистрации номера" };
    }
  }

  async verifyPhoneNumber(
    tenantId: string,
    phoneNumberId: string,
    verificationCode: string
  ): Promise<{ success: boolean; error?: string }> {
    const integration = await storage.getWaCloudIntegration(tenantId);
    if (!integration?.accessToken) {
      return { success: false, error: "Требуется авторизация" };
    }
    
    try {
      const response = await fetch(
        `${META_GRAPH_API_URL}/${phoneNumberId}/verify_code`,
        {
          method: "POST",
          headers: this.getAuthHeaders(integration.accessToken),
          body: JSON.stringify({ code: verificationCode }),
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.error?.message || "Неверный код" };
      }
      
      const phones = await storage.getWaCloudPhoneNumbers(tenantId);
      const phone = phones.find(p => p.phoneNumberId === phoneNumberId);
      if (phone) {
        await storage.updateWaCloudPhoneNumber(phone.id, {
          status: "active",
          verificationStatus: "verified",
        });
      }
      
      return { success: true };
    } catch (error) {
      console.error("Verify phone error:", error);
      return { success: false, error: "Ошибка проверки кода" };
    }
  }

  async requestVerificationCode(
    tenantId: string,
    phoneNumberId: string,
    codeMethod: "SMS" | "VOICE" = "SMS",
    language: string = "ru"
  ): Promise<{ success: boolean; error?: string }> {
    const integration = await storage.getWaCloudIntegration(tenantId);
    if (!integration?.accessToken) {
      return { success: false, error: "Требуется авторизация" };
    }
    
    try {
      const response = await fetch(
        `${META_GRAPH_API_URL}/${phoneNumberId}/request_code`,
        {
          method: "POST",
          headers: this.getAuthHeaders(integration.accessToken),
          body: JSON.stringify({ code_method: codeMethod, language }),
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.error?.message || "Ошибка отправки кода" };
      }
      
      return { success: true };
    } catch (error) {
      console.error("Request verification code error:", error);
      return { success: false, error: "Ошибка сети" };
    }
  }

  async registerWebhook(tenantId: string): Promise<{ success: boolean; webhookUrl?: string; error?: string }> {
    const integration = await storage.getWaCloudIntegration(tenantId);
    if (!integration) {
      return { success: false, error: "Интеграция не найдена" };
    }
    
    const baseUrl = process.env.REPLIT_DEV_DOMAIN 
      ? `https://${process.env.REPLIT_DEV_DOMAIN}`
      : process.env.BASE_URL || "http://localhost:5000";
    
    const webhookUrl = `${baseUrl}/api/whatsapp-cloud/webhook/${tenantId}`;
    
    await storage.updateWaCloudIntegration(tenantId, {
      webhookActive: true,
      onboardingStep: 5,
    });
    
    return { success: true, webhookUrl };
  }

  async checkBillingStatus(tenantId: string): Promise<{
    success: boolean;
    billingStatus?: string;
    error?: string;
  }> {
    const integration = await storage.getWaCloudIntegration(tenantId);
    if (!integration?.accessToken || !integration.wabaId) {
      return { success: false, error: "WABA не подключен" };
    }
    
    try {
      const response = await fetch(
        `${META_GRAPH_API_URL}/${integration.wabaId}?fields=message_template_namespace,on_behalf_of_business_info`,
        { headers: this.getAuthHeaders(integration.accessToken) }
      );
      
      if (!response.ok) {
        return { success: false, error: "Ошибка проверки биллинга" };
      }
      
      const billingStatus = "unknown";
      
      await storage.updateWaCloudIntegration(tenantId, { billingStatus });
      
      return { success: true, billingStatus };
    } catch (error) {
      console.error("Check billing status error:", error);
      return { success: false, error: "Ошибка сети" };
    }
  }

  async sendTestMessage(
    tenantId: string,
    phoneNumberId: string,
    recipientPhone: string
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const integration = await storage.getWaCloudIntegration(tenantId);
    if (!integration?.accessToken) {
      return { success: false, error: "Требуется авторизация" };
    }
    
    try {
      const response = await fetch(
        `${META_GRAPH_API_URL}/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: this.getAuthHeaders(integration.accessToken),
          body: JSON.stringify({
            messaging_product: "whatsapp",
            to: recipientPhone.replace(/\D/g, ""),
            type: "text",
            text: { body: "Тестовое сообщение от SmartCatalog. WhatsApp Cloud API подключен успешно!" },
          }),
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.error?.message || "Ошибка отправки" };
      }
      
      const data = await response.json();
      return { success: true, messageId: data.messages?.[0]?.id };
    } catch (error) {
      console.error("Send test message error:", error);
      return { success: false, error: "Ошибка сети" };
    }
  }

  async sendTemplateMessage(
    tenantId: string,
    phoneNumberId: string,
    recipientPhone: string,
    templateName: string,
    languageCode: string = "ru",
    components?: any[]
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const integration = await storage.getWaCloudIntegration(tenantId);
    if (!integration?.accessToken) {
      return { success: false, error: "Требуется авторизация" };
    }
    
    const warmup = await storage.getWaCloudWarmupStatus(tenantId);
    if (warmup && warmup.dailyMessagesSent >= warmup.dailyMessageLimit) {
      return { success: false, error: "Достигнут дневной лимит сообщений. Прогрев аккаунта продолжается." };
    }
    
    try {
      const body: any = {
        messaging_product: "whatsapp",
        to: recipientPhone.replace(/\D/g, ""),
        type: "template",
        template: {
          name: templateName,
          language: { code: languageCode },
        },
      };
      
      if (components?.length) {
        body.template.components = components;
      }
      
      const response = await fetch(
        `${META_GRAPH_API_URL}/${phoneNumberId}/messages`,
        {
          method: "POST",
          headers: this.getAuthHeaders(integration.accessToken),
          body: JSON.stringify(body),
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.error?.message || "Ошибка отправки шаблона" };
      }
      
      if (warmup) {
        await storage.updateWaCloudWarmupStatus(tenantId, {
          dailyMessagesSent: (warmup.dailyMessagesSent || 0) + 1,
        });
      }
      
      const data = await response.json();
      return { success: true, messageId: data.messages?.[0]?.id };
    } catch (error) {
      console.error("Send template message error:", error);
      return { success: false, error: "Ошибка сети" };
    }
  }

  async syncTemplates(tenantId: string): Promise<{ success: boolean; count?: number; error?: string }> {
    const integration = await storage.getWaCloudIntegration(tenantId);
    if (!integration?.accessToken || !integration.wabaId) {
      return { success: false, error: "WABA не подключен" };
    }
    
    try {
      const response = await fetch(
        `${META_GRAPH_API_URL}/${integration.wabaId}/message_templates`,
        { headers: this.getAuthHeaders(integration.accessToken) }
      );
      
      if (!response.ok) {
        return { success: false, error: "Ошибка получения шаблонов" };
      }
      
      const data = await response.json();
      const templates: MetaTemplateInfo[] = data.data || [];
      
      for (const template of templates) {
        const existingTemplates = await storage.getWaCloudTemplates(tenantId);
        const existing = existingTemplates.find(t => t.metaTemplateId === template.id);
        
        const status = template.status === "APPROVED" ? "approved" 
          : template.status === "REJECTED" ? "rejected"
          : template.status === "PENDING" ? "pending"
          : "draft";
        
        if (existing) {
          await storage.updateWaCloudTemplate(existing.id, {
            status,
            rejectionReason: template.rejected_reason,
          });
        } else {
          await storage.createWaCloudTemplate({
            tenantId,
            integrationId: integration.id,
            name: template.name,
            language: template.language,
            category: template.category.toLowerCase(),
            bodyText: "",
            metaTemplateId: template.id,
            status,
            rejectionReason: template.rejected_reason,
          });
        }
      }
      
      return { success: true, count: templates.length };
    } catch (error) {
      console.error("Sync templates error:", error);
      return { success: false, error: "Ошибка синхронизации" };
    }
  }

  async createTemplate(
    tenantId: string,
    template: {
      name: string;
      language: string;
      category: string;
      headerType?: string;
      headerContent?: string;
      bodyText: string;
      footerText?: string;
      buttons?: any[];
    }
  ): Promise<{ success: boolean; templateId?: string; error?: string }> {
    const integration = await storage.getWaCloudIntegration(tenantId);
    if (!integration?.accessToken || !integration.wabaId) {
      return { success: false, error: "WABA не подключен" };
    }
    
    try {
      const components: any[] = [];
      
      if (template.headerType && template.headerContent) {
        components.push({
          type: "HEADER",
          format: template.headerType.toUpperCase(),
          text: template.headerType === "text" ? template.headerContent : undefined,
        });
      }
      
      components.push({
        type: "BODY",
        text: template.bodyText,
      });
      
      if (template.footerText) {
        components.push({
          type: "FOOTER",
          text: template.footerText,
        });
      }
      
      if (template.buttons?.length) {
        components.push({
          type: "BUTTONS",
          buttons: template.buttons.map(b => ({
            type: b.type.toUpperCase(),
            text: b.text,
            url: b.url,
            phone_number: b.phoneNumber,
          })),
        });
      }
      
      const response = await fetch(
        `${META_GRAPH_API_URL}/${integration.wabaId}/message_templates`,
        {
          method: "POST",
          headers: this.getAuthHeaders(integration.accessToken),
          body: JSON.stringify({
            name: template.name,
            language: template.language,
            category: template.category.toUpperCase(),
            components,
          }),
        }
      );
      
      if (!response.ok) {
        const error = await response.json();
        return { success: false, error: error.error?.message || "Ошибка создания шаблона" };
      }
      
      const data = await response.json();
      
      await storage.createWaCloudTemplate({
        tenantId,
        integrationId: integration.id,
        name: template.name,
        language: template.language,
        category: template.category,
        headerType: template.headerType,
        headerContent: template.headerContent,
        bodyText: template.bodyText,
        footerText: template.footerText,
        buttons: template.buttons,
        metaTemplateId: data.id,
        status: "pending",
      });
      
      return { success: true, templateId: data.id };
    } catch (error) {
      console.error("Create template error:", error);
      return { success: false, error: "Ошибка сети" };
    }
  }

  async syncPhoneStatus(tenantId: string, phoneNumberId: string): Promise<{
    success: boolean;
    qualityRating?: string;
    messagingTier?: string;
    error?: string;
  }> {
    const integration = await storage.getWaCloudIntegration(tenantId);
    if (!integration?.accessToken) {
      return { success: false, error: "Требуется авторизация" };
    }
    
    try {
      const response = await fetch(
        `${META_GRAPH_API_URL}/${phoneNumberId}?fields=quality_rating,messaging_limit_tier,verified_name,code_verification_status`,
        { headers: this.getAuthHeaders(integration.accessToken) }
      );
      
      if (!response.ok) {
        return { success: false, error: "Ошибка получения статуса" };
      }
      
      const data = await response.json();
      
      const qualityRating = data.quality_rating?.toLowerCase() || "unknown";
      const messagingTier = data.messaging_limit_tier?.toLowerCase().replace("tier_", "tier_") || "tier_1";
      
      const phones = await storage.getWaCloudPhoneNumbers(tenantId);
      const phone = phones.find(p => p.phoneNumberId === phoneNumberId);
      if (phone) {
        await storage.updateWaCloudPhoneNumber(phone.id, {
          qualityRating,
          messagingTier,
          lastSyncAt: new Date(),
        });
      }
      
      return { success: true, qualityRating, messagingTier };
    } catch (error) {
      console.error("Sync phone status error:", error);
      return { success: false, error: "Ошибка сети" };
    }
  }

  async initializeWarmup(tenantId: string, integrationId: string): Promise<WaCloudWarmupStatus> {
    const existing = await storage.getWaCloudWarmupStatus(tenantId);
    if (existing) return existing;
    
    return storage.createWaCloudWarmupStatus({
      tenantId,
      integrationId,
      stage: "initial",
      currentDay: 1,
      dailyMessageLimit: 50,
      marketingEnabled: false,
      broadcastEnabled: false,
      recommendations: [
        "Отвечайте только заинтересованным клиентам",
        "Не запускайте рассылки первые 7 дней",
        "Используйте только сервисные шаблоны",
      ],
    });
  }

  async updateWarmupProgress(tenantId: string): Promise<void> {
    const warmup = await storage.getWaCloudWarmupStatus(tenantId);
    if (!warmup) return;
    
    const startDate = new Date(warmup.startedAt);
    const now = new Date();
    const daysDiff = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    
    let stage = warmup.stage;
    let dailyMessageLimit = warmup.dailyMessageLimit;
    let marketingEnabled = warmup.marketingEnabled;
    let broadcastEnabled = warmup.broadcastEnabled;
    let recommendations = warmup.recommendations || [];
    
    if (daysDiff >= 7) {
      stage = "full";
      dailyMessageLimit = 1000;
      marketingEnabled = true;
      broadcastEnabled = true;
      recommendations = ["Аккаунт прогрет. Все функции доступны."];
    } else if (daysDiff >= 3) {
      stage = "limited_marketing";
      dailyMessageLimit = 250;
      marketingEnabled = true;
      broadcastEnabled = false;
      recommendations = [
        "Маркетинговые шаблоны доступны",
        "Рассылки будут доступны через несколько дней",
      ];
    } else {
      stage = "utility_only";
      dailyMessageLimit = 100;
      marketingEnabled = false;
      broadcastEnabled = false;
      recommendations = [
        "Используйте только сервисные шаблоны",
        "Рекомендуем отвечать быстро для улучшения качества",
      ];
    }
    
    const lastReset = warmup.lastResetAt ? new Date(warmup.lastResetAt) : startDate;
    const hoursSinceReset = (now.getTime() - lastReset.getTime()) / (1000 * 60 * 60);
    
    const updates: Partial<typeof warmup> = {
      currentDay: daysDiff,
      stage,
      dailyMessageLimit,
      marketingEnabled,
      broadcastEnabled,
      recommendations,
    };
    
    if (hoursSinceReset >= 24) {
      updates.dailyMessagesSent = 0;
      updates.lastResetAt = now;
    }
    
    await storage.updateWaCloudWarmupStatus(tenantId, updates);
  }

  calculateRiskScore(integration: WaCloudIntegration, phones: WaCloudPhoneNumber[], warmup: WaCloudWarmupStatus | null): {
    score: "green" | "yellow" | "red";
    issues: string[];
    recommendations: string[];
  } {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let riskPoints = 0;
    
    if (integration.billingStatus !== "active") {
      issues.push("Биллинг не настроен");
      recommendations.push("Добавьте карту для оплаты в Meta Business Manager");
      riskPoints += 30;
    }
    
    for (const phone of phones) {
      if (phone.qualityRating === "red") {
        issues.push(`Низкое качество номера ${phone.displayPhoneNumber}`);
        recommendations.push("Уменьшите объёмы отправки и улучшите контент");
        riskPoints += 25;
      } else if (phone.qualityRating === "yellow") {
        issues.push(`Среднее качество номера ${phone.displayPhoneNumber}`);
        recommendations.push("Обратите внимание на качество сообщений");
        riskPoints += 10;
      }
      
      if (phone.businessStatus !== "verified") {
        issues.push("Бизнес не подтверждён");
        recommendations.push("Подтвердите бизнес в Meta Business Manager");
        riskPoints += 15;
      }
    }
    
    if (warmup && warmup.stage !== "full") {
      issues.push(`Прогрев аккаунта: день ${warmup.currentDay} из 7`);
      recommendations.push("Дождитесь окончания прогрева для полного доступа");
      riskPoints += 5;
    }
    
    const score = riskPoints >= 40 ? "red" : riskPoints >= 20 ? "yellow" : "green";
    
    return { score, issues, recommendations };
  }

  verifyWebhookSignature(payload: Buffer | string, signature: string, appSecret: string): boolean {
    try {
      const expectedSignature = crypto
        .createHmac("sha256", appSecret)
        .update(payload)
        .digest("hex");
      
      const expectedSigBuffer = Buffer.from(`sha256=${expectedSignature}`, "utf8");
      const receivedSigBuffer = Buffer.from(signature, "utf8");
      
      if (expectedSigBuffer.length !== receivedSigBuffer.length) {
        return false;
      }
      
      return crypto.timingSafeEqual(expectedSigBuffer, receivedSigBuffer);
    } catch (error) {
      console.error("Webhook signature verification error:", error);
      return false;
    }
  }

  async handleWebhookEvent(tenantId: string, event: MetaWebhookEvent): Promise<void> {
    if (!event.entry?.length) return;

    try {
      const { acceptInboundMetaWebhook } = await import("../../messaging/core");
      const result = await acceptInboundMetaWebhook(tenantId, event as any);

      if (result.stored.length > 0) {
        console.log(
          `[WA Cloud] Processed ${result.stored.length} message(s) for tenant ${tenantId}`
        );
      }
      if (result.duplicates.length > 0) {
        console.log(
          `[WA Cloud] Skipped ${result.duplicates.length} duplicate(s) for tenant ${tenantId}`
        );
      }
    } catch (err) {
      console.error("[WA Cloud] Messaging core error, falling back to log-only:", err);
      for (const entry of event.entry) {
        for (const change of entry.changes || []) {
          if (change.field === "messages") {
            for (const message of change.value.messages || []) {
              console.log(`[WA Cloud] Incoming message from ${message.from}: ${message.text?.body}`);
            }
            for (const status of change.value.statuses || []) {
              console.log(`[WA Cloud] Message ${status.id} status: ${status.status}`);
            }
          }
        }
      }
    }
  }

  private generateVerifyToken(): string {
    const crypto = require("crypto");
    return crypto.randomBytes(32).toString("hex");
  }

  getMetaBillingUrl(businessId: string): string {
    return `https://business.facebook.com/billing/${businessId}`;
  }

  getMetaBusinessVerificationUrl(businessId: string): string {
    return `https://business.facebook.com/settings/security/${businessId}`;
  }

  completeOnboarding(tenantId: string): Promise<WaCloudIntegration | undefined> {
    return storage.updateWaCloudIntegration(tenantId, {
      onboardingCompleted: true,
      onboardingStep: 6,
    });
  }
}

export const metaCloudService = new MetaCloudService();
