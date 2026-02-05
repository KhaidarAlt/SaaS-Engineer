import crypto from "crypto";
import { storage } from "../../storage";
import type { WidgetIntegration, WidgetConversation, Tenant } from "@shared/schema";

export class WidgetService {
  generateWidgetKey(): string {
    return crypto.randomBytes(16).toString("hex");
  }

  async createWidget(
    tenantId: string,
    options?: {
      name?: string;
      primaryColor?: string;
      position?: string;
      welcomeMessage?: string;
      placeholder?: string;
      allowedDomains?: string[];
    }
  ): Promise<{ success: boolean; widget?: WidgetIntegration; error?: string }> {
    const existingWidget = await storage.getWidgetIntegration(tenantId);
    if (existingWidget) {
      return { success: false, error: "Виджет уже создан" };
    }

    const widgetKey = this.generateWidgetKey();

    const widget = await storage.createWidgetIntegration({
      tenantId,
      widgetKey,
      name: options?.name || "Виджет чата",
      primaryColor: options?.primaryColor || "#0ea5e9",
      position: options?.position || "bottom-right",
      welcomeMessage: options?.welcomeMessage || "Здравствуйте! Чем могу помочь?",
      placeholder: options?.placeholder || "Введите сообщение...",
      allowedDomains: options?.allowedDomains,
      isActive: true,
    });

    return { success: true, widget };
  }

  async updateWidget(
    tenantId: string,
    data: {
      name?: string;
      primaryColor?: string;
      position?: string;
      welcomeMessage?: string;
      placeholder?: string;
      allowedDomains?: string[];
      isActive?: boolean;
    }
  ): Promise<{ success: boolean; widget?: WidgetIntegration; error?: string }> {
    const existingWidget = await storage.getWidgetIntegration(tenantId);
    if (!existingWidget) {
      return { success: false, error: "Виджет не найден" };
    }

    const widget = await storage.updateWidgetIntegration(existingWidget.id, data);
    if (!widget) {
      return { success: false, error: "Ошибка обновления виджета" };
    }

    return { success: true, widget };
  }

  async deleteWidget(tenantId: string): Promise<{ success: boolean; error?: string }> {
    const widget = await storage.getWidgetIntegration(tenantId);
    if (!widget) {
      return { success: false, error: "Виджет не найден" };
    }

    await storage.deleteWidgetIntegration(tenantId);
    return { success: true };
  }

  async getWidgetByKey(widgetKey: string): Promise<WidgetIntegration | null> {
    const widget = await storage.getWidgetIntegrationByKey(widgetKey);
    return widget || null;
  }

  async getOrCreateConversation(
    widgetKey: string,
    sessionId: string
  ): Promise<{ success: boolean; conversation?: WidgetConversation; widget?: WidgetIntegration; error?: string }> {
    const widget = await storage.getWidgetIntegrationByKey(widgetKey);
    if (!widget) {
      return { success: false, error: "Виджет не найден" };
    }

    if (!widget.isActive) {
      return { success: false, error: "Виджет отключен" };
    }

    let conversation = await storage.getWidgetConversation(sessionId, widget.id);
    
    if (!conversation) {
      conversation = await storage.createWidgetConversation({
        tenantId: widget.tenantId,
        widgetId: widget.id,
        sessionId,
        status: "active",
      });
    }

    return { success: true, conversation, widget };
  }

  async sendMessage(
    conversationId: string,
    widgetKey: string,
    text: string
  ): Promise<{ success: boolean; reply?: string; error?: string }> {
    const widget = await storage.getWidgetIntegrationByKey(widgetKey);
    if (!widget || !widget.isActive) {
      return { success: false, error: "Виджет недоступен" };
    }

    const tenant = await storage.getTenant(widget.tenantId);
    if (!tenant) {
      return { success: false, error: "Тенант не найден" };
    }

    await storage.createWidgetMessage({
      tenantId: widget.tenantId,
      conversationId,
      role: "user",
      content: text,
    });

    const aiResponse = await this.generateAIResponse(text, tenant);

    await storage.createWidgetMessage({
      tenantId: widget.tenantId,
      conversationId,
      role: "assistant",
      content: aiResponse,
    });

    return { success: true, reply: aiResponse };
  }

  async getMessages(conversationId: string): Promise<Array<{ role: string; content: string; createdAt: Date }>> {
    const messages = await storage.getWidgetMessages(conversationId);
    return messages.map(m => ({
      role: m.role,
      content: m.content,
      createdAt: m.createdAt,
    }));
  }

  private async generateAIResponse(text: string, tenant: Tenant): Promise<string> {
    if (!tenant.aiEnabled) {
      return "Здравствуйте! К сожалению, AI-ассистент временно недоступен. Мы свяжемся с вами в ближайшее время.";
    }

    try {
      const { generateAIResponse } = await import("../openai");
      const response = await generateAIResponse(
        tenant.id,
        text,
        [],
        { phone: "widget" }
      );
      return response || "Спасибо за ваше сообщение! Мы скоро ответим.";
    } catch (error) {
      console.error("AI response generation error:", error);
      return "Спасибо за ваше сообщение! Мы скоро ответим.";
    }
  }

  generateEmbedScript(widgetKey: string, baseUrl: string): string {
    return `<!-- SmartCatalog Chat Widget -->
<script>
(function(w,d,s,o,f,js,fjs){
w['SmartCatalogWidget']=o;w[o]=w[o]||function(){(w[o].q=w[o].q||[]).push(arguments)};
js=d.createElement(s);fjs=d.getElementsByTagName(s)[0];
js.id=o;js.src=f;js.async=1;fjs.parentNode.insertBefore(js,fjs);
}(window,document,'script','scw','${baseUrl}/widget.js'));
scw('init', '${widgetKey}');
</script>`;
  }

  validateDomain(domain: string, allowedDomains: string[] | null): boolean {
    if (!allowedDomains || allowedDomains.length === 0) {
      return true;
    }

    const normalizedDomain = domain.toLowerCase().replace(/^www\./, "");
    
    return allowedDomains.some(allowed => {
      const normalizedAllowed = allowed.toLowerCase().replace(/^www\./, "");
      return normalizedDomain === normalizedAllowed || normalizedDomain.endsWith("." + normalizedAllowed);
    });
  }
}

export const widgetService = new WidgetService();
