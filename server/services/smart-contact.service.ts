import { db } from "../db";
import { 
  smartContacts, smartMessages, smartRateMetrics, smartContactSettings,
  SmartContact, SmartMessage, SmartRateMetric, SmartContactSettings,
  InsertSmartContact, InsertSmartMessage, InsertSmartContactSettings
} from "@shared/schema";
import { eq, and, desc, gte, lte, sql, isNull, or } from "drizzle-orm";
import OpenAI from "openai";

const openai = new OpenAI();

// Stop words that indicate client doesn't want messages
const STOP_WORDS = [
  'стоп', 'stop', 'отписаться', 'не пишите', 'не звоните', 
  'хватит', 'удалите', 'отстаньте', 'блок'
];

// Trigger types with Russian labels
export const TRIGGER_TYPES = {
  abandoned_cart: 'Брошенная корзина',
  unpaid_order: 'Неоплаченный заказ',
  reactivation: 'Реактивация после покупки',
  inactivity: 'Длительная неактивность',
  manual: 'Ручная отправка'
} as const;

type TriggerType = keyof typeof TRIGGER_TYPES;

interface HealthStatus {
  status: 'safe' | 'caution' | 'stop';
  message: string;
  replyRate: number;
  dailyLimit: number;
  sentToday: number;
}

export class SmartContactService {
  
  // ============ SETTINGS ============
  
  async getSettings(tenantId: string): Promise<SmartContactSettings | null> {
    const [settings] = await db
      .select()
      .from(smartContactSettings)
      .where(eq(smartContactSettings.tenantId, tenantId));
    return settings || null;
  }
  
  async updateSettings(tenantId: string, data: Partial<InsertSmartContactSettings>): Promise<SmartContactSettings> {
    const existing = await this.getSettings(tenantId);
    
    if (existing) {
      const [updated] = await db
        .update(smartContactSettings)
        .set({ ...data, updatedAt: new Date() })
        .where(eq(smartContactSettings.tenantId, tenantId))
        .returning();
      return updated;
    }
    
    const [created] = await db
      .insert(smartContactSettings)
      .values({ tenantId, ...data })
      .returning();
    return created;
  }
  
  // ============ CONTACTS ============
  
  async getContacts(tenantId: string, limit = 50, offset = 0): Promise<SmartContact[]> {
    return db
      .select()
      .from(smartContacts)
      .where(eq(smartContacts.tenantId, tenantId))
      .orderBy(desc(smartContacts.updatedAt))
      .limit(limit)
      .offset(offset);
  }
  
  async getEligibleContacts(tenantId: string, minHoursSinceReply = 24): Promise<SmartContact[]> {
    const cutoffTime = new Date(Date.now() - minHoursSinceReply * 60 * 60 * 1000);
    
    return db
      .select()
      .from(smartContacts)
      .where(
        and(
          eq(smartContacts.tenantId, tenantId),
          eq(smartContacts.hasDialogHistory, true),
          eq(smartContacts.doNotDisturb, false),
          eq(smartContacts.isBlocked, false),
          or(
            isNull(smartContacts.lastClientReplyAt),
            lte(smartContacts.lastClientReplyAt, cutoffTime)
          )
        )
      )
      .orderBy(desc(smartContacts.interactionScore));
  }
  
  async findOrCreateContact(tenantId: string, phone: string, name?: string): Promise<SmartContact> {
    const normalizedPhone = phone.replace(/\D/g, '');
    
    const [existing] = await db
      .select()
      .from(smartContacts)
      .where(
        and(
          eq(smartContacts.tenantId, tenantId),
          eq(smartContacts.phone, normalizedPhone)
        )
      );
    
    if (existing) return existing;
    
    const [created] = await db
      .insert(smartContacts)
      .values({
        tenantId,
        phone: normalizedPhone,
        name,
        hasDialogHistory: true
      })
      .returning();
    
    return created;
  }
  
  async updateContactOnReply(tenantId: string, phone: string, messageText: string): Promise<void> {
    const normalizedPhone = phone.replace(/\D/g, '');
    
    // Check for stop words
    const lowerMessage = messageText.toLowerCase();
    const hasStopWord = STOP_WORDS.some(word => lowerMessage.includes(word));
    
    await db
      .update(smartContacts)
      .set({
        hasDialogHistory: true,
        lastClientReplyAt: new Date(),
        totalRepliesReceived: sql`${smartContacts.totalRepliesReceived} + 1`,
        interactionScore: sql`LEAST(100, ${smartContacts.interactionScore} + 5)`,
        doNotDisturb: hasStopWord ? true : undefined,
        updatedAt: new Date()
      })
      .where(
        and(
          eq(smartContacts.tenantId, tenantId),
          eq(smartContacts.phone, normalizedPhone)
        )
      );
    
    // Cancel pending messages if reply received
    await db
      .update(smartMessages)
      .set({ status: 'cancelled' })
      .where(
        and(
          eq(smartMessages.tenantId, tenantId),
          sql`${smartMessages.contactId} IN (
            SELECT id FROM smart_contacts 
            WHERE tenant_id = ${tenantId} AND phone = ${normalizedPhone}
          )`,
          eq(smartMessages.status, 'pending')
        )
      );
  }
  
  // ============ MESSAGES ============
  
  async createMessage(data: InsertSmartMessage): Promise<SmartMessage> {
    const [message] = await db
      .insert(smartMessages)
      .values(data)
      .returning();
    return message;
  }
  
  async getMessages(tenantId: string, limit = 50): Promise<SmartMessage[]> {
    return db
      .select()
      .from(smartMessages)
      .where(eq(smartMessages.tenantId, tenantId))
      .orderBy(desc(smartMessages.createdAt))
      .limit(limit);
  }
  
  async getPendingMessages(tenantId: string): Promise<SmartMessage[]> {
    return db
      .select()
      .from(smartMessages)
      .where(
        and(
          eq(smartMessages.tenantId, tenantId),
          eq(smartMessages.status, 'pending')
        )
      )
      .orderBy(smartMessages.scheduledAt);
  }
  
  async updateMessageStatus(
    messageId: string, 
    status: string, 
    extra?: { wahaMessageId?: string; errorMessage?: string }
  ): Promise<void> {
    const updates: any = { status };
    
    if (status === 'sent') updates.sentAt = new Date();
    if (status === 'delivered') updates.deliveredAt = new Date();
    if (status === 'read') updates.readAt = new Date();
    if (extra?.wahaMessageId) updates.wahaMessageId = extra.wahaMessageId;
    if (extra?.errorMessage) updates.errorMessage = extra.errorMessage;
    
    await db
      .update(smartMessages)
      .set(updates)
      .where(eq(smartMessages.id, messageId));
  }
  
  // ============ RATE METRICS ============
  
  async getTodayMetrics(tenantId: string): Promise<SmartRateMetric | null> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const [metrics] = await db
      .select()
      .from(smartRateMetrics)
      .where(
        and(
          eq(smartRateMetrics.tenantId, tenantId),
          gte(smartRateMetrics.date, today)
        )
      );
    
    return metrics || null;
  }
  
  async updateMetrics(tenantId: string, action: 'sent' | 'delivered' | 'reply' | 'ignore' | 'error'): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    let metrics = await this.getTodayMetrics(tenantId);
    
    if (!metrics) {
      const [created] = await db
        .insert(smartRateMetrics)
        .values({ tenantId, date: today })
        .returning();
      metrics = created;
    }
    
    const updates: any = {};
    if (action === 'sent') updates.sentCount = sql`${smartRateMetrics.sentCount} + 1`;
    if (action === 'delivered') updates.deliveredCount = sql`${smartRateMetrics.deliveredCount} + 1`;
    if (action === 'reply') updates.replyCount = sql`${smartRateMetrics.replyCount} + 1`;
    if (action === 'ignore') updates.ignoreCount = sql`${smartRateMetrics.ignoreCount} + 1`;
    if (action === 'error') updates.errorCount = sql`${smartRateMetrics.errorCount} + 1`;
    
    await db
      .update(smartRateMetrics)
      .set(updates)
      .where(eq(smartRateMetrics.id, metrics.id));
    
    // Recalculate rates and limits
    await this.recalculateRates(tenantId);
  }
  
  async recalculateRates(tenantId: string): Promise<void> {
    const metrics = await this.getTodayMetrics(tenantId);
    if (!metrics || metrics.sentCount === 0) return;
    
    const replyRate = Math.round((metrics.replyCount / metrics.sentCount) * 100);
    const deliveryRate = Math.round((metrics.deliveredCount / metrics.sentCount) * 100);
    
    // Dynamic limit calculation
    let calculatedLimit = 100; // Base
    if (replyRate >= 30) calculatedLimit = 200;
    if (replyRate >= 50) calculatedLimit = 400;
    if (replyRate < 10) calculatedLimit = 50;
    if (metrics.errorCount > 10) calculatedLimit = Math.max(20, calculatedLimit - 100);
    
    // Hard cap
    calculatedLimit = Math.min(calculatedLimit, 1000);
    
    await db
      .update(smartRateMetrics)
      .set({ replyRate, deliveryRate, calculatedLimit })
      .where(eq(smartRateMetrics.id, metrics.id));
  }
  
  // ============ HEALTH STATUS ============
  
  async getHealthStatus(tenantId: string): Promise<HealthStatus> {
    const metrics = await this.getTodayMetrics(tenantId);
    const settings = await this.getSettings(tenantId);
    
    const sentToday = metrics?.sentCount || 0;
    const replyRate = metrics?.replyRate || 0;
    const dailyLimit = settings?.dailyMessageLimit || 100;
    
    let status: 'safe' | 'caution' | 'stop' = 'safe';
    let message = 'Система работает нормально';
    
    if (replyRate < 10 && sentToday > 20) {
      status = 'caution';
      message = 'Низкий процент ответов. Рекомендуется снизить объём';
    }
    
    if (replyRate < 5 && sentToday > 50) {
      status = 'stop';
      message = 'Критически низкий отклик. Отправка приостановлена';
    }
    
    if (metrics && metrics.errorCount > 10) {
      status = 'stop';
      message = 'Обнаружено много ошибок. Отправка приостановлена';
    }
    
    return { status, message, replyRate, dailyLimit, sentToday };
  }
  
  // ============ AI MESSAGE GENERATION ============
  
  async generateMessage(
    tenantId: string,
    triggerType: TriggerType,
    context: { 
      clientName?: string;
      productName?: string;
      orderNumber?: string;
      lastInteraction?: string;
    }
  ): Promise<string> {
    const triggerLabel = TRIGGER_TYPES[triggerType];
    
    const systemPrompt = `Ты — вежливый помощник магазина. Генерируй короткие (1-2 предложения) персонализированные сообщения для клиентов.
    
Правила:
- Пиши на русском языке
- Не используй эмодзи
- Задай вопрос, чтобы получить ответ
- Избегай давления на покупку
- Будь дружелюбным и естественным
- Каждое сообщение должно быть уникальным`;

    const userPrompt = `Сгенерируй сообщение для клиента.

Триггер: ${triggerLabel}
${context.clientName ? `Имя клиента: ${context.clientName}` : ''}
${context.productName ? `Товар: ${context.productName}` : ''}
${context.orderNumber ? `Номер заказа: ${context.orderNumber}` : ''}
${context.lastInteraction ? `Последнее взаимодействие: ${context.lastInteraction}` : ''}

Напиши только текст сообщения, без кавычек и пояснений.`;

    try {
      const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 150,
        temperature: 0.8
      });
      
      return response.choices[0]?.message?.content?.trim() || 
        'Здравствуйте! Хотели уточнить, всё ли в порядке с вашим заказом?';
    } catch (error) {
      console.error('AI generation error:', error);
      
      // Fallback messages
      const fallbacks: Record<TriggerType, string> = {
        abandoned_cart: 'Здравствуйте! Заметили, что в вашей корзине остались товары. Могу чем-то помочь?',
        unpaid_order: 'Добрый день! Ваш заказ ожидает оплаты. Возникли какие-то вопросы?',
        reactivation: 'Здравствуйте! Давно не виделись. Как вам понравился ваш предыдущий заказ?',
        inactivity: 'Привет! У нас появились новинки, которые могут вас заинтересовать. Показать?',
        manual: 'Здравствуйте! Чем могу помочь?'
      };
      
      return fallbacks[triggerType];
    }
  }
  
  // ============ QUIET HOURS CHECK ============
  
  async isQuietHours(tenantId: string): Promise<boolean> {
    const settings = await this.getSettings(tenantId);
    if (!settings) return false;
    
    const now = new Date();
    const currentHour = now.getHours();
    
    const start = settings.quietHoursStart;
    const end = settings.quietHoursEnd;
    
    // Handle overnight quiet hours (e.g., 22:00 - 09:00)
    if (start > end) {
      return currentHour >= start || currentHour < end;
    }
    
    return currentHour >= start && currentHour < end;
  }
  
  // ============ SEND MESSAGE VIA WAHA ============
  
  async sendViaWaha(
    tenantId: string,
    messageId: string,
    phone: string,
    text: string,
    wahaBaseUrl: string,
    wahaSession: string
  ): Promise<{ success: boolean; wahaMessageId?: string; error?: string }> {
    try {
      const response = await fetch(`${wahaBaseUrl}/api/sendText`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          session: wahaSession,
          chatId: `${phone}@c.us`,
          text
        })
      });
      
      if (!response.ok) {
        const error = await response.text();
        throw new Error(error);
      }
      
      const result = await response.json();
      
      await this.updateMessageStatus(messageId, 'sent', { 
        wahaMessageId: result.id 
      });
      await this.updateMetrics(tenantId, 'sent');
      
      // Update contact
      await db
        .update(smartContacts)
        .set({
          lastMessageSentAt: new Date(),
          totalMessagesSent: sql`${smartContacts.totalMessagesSent} + 1`
        })
        .where(
          and(
            eq(smartContacts.tenantId, tenantId),
            eq(smartContacts.phone, phone)
          )
        );
      
      return { success: true, wahaMessageId: result.id };
    } catch (error: any) {
      await this.updateMessageStatus(messageId, 'failed', { 
        errorMessage: error.message 
      });
      await this.updateMetrics(tenantId, 'error');
      
      return { success: false, error: error.message };
    }
  }
  
  // ============ STATS ============
  
  async getStats(tenantId: string): Promise<{
    totalContacts: number;
    eligibleContacts: number;
    messagesSentToday: number;
    replyRate: number;
    healthStatus: HealthStatus;
  }> {
    const [totalResult] = await db
      .select({ count: sql<number>`count(*)` })
      .from(smartContacts)
      .where(eq(smartContacts.tenantId, tenantId));
    
    const eligibleContacts = await this.getEligibleContacts(tenantId);
    const metrics = await this.getTodayMetrics(tenantId);
    const healthStatus = await this.getHealthStatus(tenantId);
    
    return {
      totalContacts: totalResult?.count || 0,
      eligibleContacts: eligibleContacts.length,
      messagesSentToday: metrics?.sentCount || 0,
      replyRate: metrics?.replyRate || 0,
      healthStatus
    };
  }
}

export const smartContactService = new SmartContactService();
