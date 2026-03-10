import type { Express, Request, Response } from "express";
import { db } from "./db";
import { eq, and, desc, gte, lte, count, sql, inArray, isNull, or, ne } from "drizzle-orm";
import {
  aiDialogs, aiDialogEvents, aiAnalyticsAuditRuns, aiAuditFindings,
  aiTestingSessions, aiTestingMessages, aiTriggers, aiAntiPatterns,
  knowledgeItems, aiTrainingEvents, aiSettings, products, categories,
  tenants, orders, messagingMessages,
} from "@shared/schema";

const FUNNEL_STAGES = ["GREETING", "NEEDS", "OFFER", "OBJECTION", "CLOSE", "SUCCESS", "HANDOVER", "DROP"] as const;
type FunnelStage = typeof FUNNEL_STAGES[number];

const OBJECTION_KEYWORDS: Record<string, string[]> = {
  PRICE: ["дорого", "цена", "скидк", "дешевле", "дороговато", "сколько стоит", "почему так дорого", "слишком дорого", "не по карману"],
  COMPARE: ["конкурент", "у других", "сравниваю", "в другом месте", "на kaspi.kz", "на каспи"],
  TRUST: ["гарант", "оригинал", "поддел", "сертификат", "отзывы", "надежн", "проверен"],
  DELIVERY: ["доставка", "самовывоз", "когда привез", "срок", "как получить", "куда доставля", "привезти"],
  PAYMENT: ["оплата", "kaspi", "рассроч", "перевод", "каспи", "как оплатить", "способ оплат"],
  STOCK: ["в наличии", "есть?", "нет?", "под заказ", "когда будет", "закончил"],
};

const STAGE_KEYWORDS = {
  NEEDS: ["нужно", "ищу", "хочу", "подбер", "посоветуй", "какой", "какая",
    "подскажите", "расскажите", "интересует", "покажите", "есть ли", "какие есть",
    "выбираю", "присмотрел", "что у вас", "подобрать", "помогите выбрать", "мне нужн",
    "нужна", "нужен", "ищем", "хотим", "хотела бы", "можно ли", "а есть"],
  NEEDS_ASSISTANT: ["что ищете", "чем помочь", "какой размер", "что вас интересует",
    "могу предложить", "помогу подобрать", "какую модель", "что именно"],
  OFFER: ["₸", "тг", "тенге", "цена:", "стоит", "рекомендую", "предлагаю", "вариант",
    "руб", "стоимость", "артикул", "http", "https", "![", "botfactory.kz",
    "в наличии по цене", "по цене", "от ", " тенге", "catalog"],
  CLOSE: ["оформим", "оплатить", "оставьте номер", "подтвердите", "заказ", "оформля",
    "в корзину", "хочу заказать", "оформить заказ", "wa.me", "добавить в корзину",
    "перейдите по ссылке", "для оформления", "оформите"],
  HANDOVER: ["менеджер", "передаю", "подключу", "специалист", "оператор", "живой человек"],
  PAYMENT_OFFERED: ["ссылка", "kaspi pay", "оплатить", "оплата по", "ссылка на оплату",
    "kaspi.kz/pay", "оплатите по ссылке", "к оплате"],
  PAYMENT_CONFIRMED: ["оплатил", "оплатила", "готов оплатить", "оплачен",
    "перевел", "перевела", "скинул", "отправил", "отправила", "чек", "оплата прошла",
    "я оплатил", "я оплатила", "оплата произведена", "отправил оплату"],
  LEAD_CAPTURE: ["\\+7\\s?\\d{3}", "\\d{10,11}", "мой номер", "позвоните"],
  ORDER_CREATED: ["заказ оформлен", "заказ создан", "заказ принят", "заказ №", "новый заказ", "заказ получен"],
  SUCCESS_INTENT: ["беру", "давайте этот", "оформляем", "согласен", "хорошо, беру",
    "возьму", "заказываю", "да, хочу", "подходит", "устраивает", "буду брать",
    "да, заказываю", "мне подходит", "забираю", "хочу купить", "покупаю",
    "отлично, беру", "заверните", "давайте оформим"],
  REFUSAL: ["не надо", "передумал", "неинтересно", "отказ", "не буду", "не хочу", "не нужно", "отмена"],
};

function parsePeriod(period: string, from?: string, to?: string): { start: Date; end: Date } {
  const now = new Date();
  const end = to ? new Date(to) : now;
  let start: Date;
  switch (period) {
    case "1d": start = new Date(now.getTime() - 86400000); break;
    case "7d": start = new Date(now.getTime() - 7 * 86400000); break;
    case "30d": start = new Date(now.getTime() - 30 * 86400000); break;
    case "90d": start = new Date(now.getTime() - 90 * 86400000); break;
    case "custom": start = from ? new Date(from) : new Date(now.getTime() - 30 * 86400000); break;
    default: start = new Date(now.getTime() - 30 * 86400000);
  }
  return { start, end };
}

function detectStages(messages: { role: string; content: string }[]): FunnelStage[] {
  const stages: FunnelStage[] = [];
  const hasAssistant = messages.some(m => m.role === "assistant");
  if (hasAssistant) stages.push("GREETING");

  for (const msg of messages) {
    const lower = msg.content.toLowerCase();
    if (msg.role === "user" && STAGE_KEYWORDS.NEEDS.some(k => lower.includes(k)) && !stages.includes("NEEDS")) {
      stages.push("NEEDS");
    }
    if (msg.role === "assistant" && STAGE_KEYWORDS.NEEDS_ASSISTANT.some(k => lower.includes(k)) && !stages.includes("NEEDS")) {
      stages.push("NEEDS");
    }
    if (msg.role === "assistant" && STAGE_KEYWORDS.OFFER.some(k => lower.includes(k)) && !stages.includes("OFFER")) {
      stages.push("OFFER");
    }
    if (msg.role === "user") {
      for (const [type, keywords] of Object.entries(OBJECTION_KEYWORDS)) {
        if (keywords.some(k => lower.includes(k)) && !stages.includes("OBJECTION")) {
          stages.push("OBJECTION");
          break;
        }
      }
    }
    if (msg.role === "assistant" && STAGE_KEYWORDS.CLOSE.some(k => lower.includes(k)) && !stages.includes("CLOSE")) {
      stages.push("CLOSE");
    }
  }
  return stages;
}

function detectObjections(messages: { role: string; content: string }[]): string[] {
  const found: string[] = [];
  for (const msg of messages) {
    if (msg.role !== "user") continue;
    const lower = msg.content.toLowerCase();
    for (const [type, keywords] of Object.entries(OBJECTION_KEYWORDS)) {
      if (keywords.some(k => lower.includes(k)) && !found.includes(type)) {
        found.push(type);
      }
    }
  }
  return found;
}

function detectEvents(messages: { role: string; content: string }[]): { type: string; value?: string }[] {
  const events: { type: string; value?: string }[] = [];
  for (const msg of messages) {
    const lower = msg.content.toLowerCase();
    if (msg.role === "assistant") {
      if (STAGE_KEYWORDS.HANDOVER.some(k => lower.includes(k))) {
        events.push({ type: "HANDOVER_TRIGGERED" });
      }
      if (STAGE_KEYWORDS.PAYMENT_OFFERED.some(k => lower.includes(k))) {
        events.push({ type: "PAYMENT_OFFERED" });
      }
    }
    if (msg.role === "user") {
      if (STAGE_KEYWORDS.PAYMENT_CONFIRMED.some(k => lower.includes(k))) {
        events.push({ type: "PAYMENT_CONFIRMED" });
      }
      if (STAGE_KEYWORDS.SUCCESS_INTENT.some(k => lower.includes(k))) {
        events.push({ type: "PRODUCT_SELECTED" });
      }
      if (STAGE_KEYWORDS.LEAD_CAPTURE.some(k => {
        try { return new RegExp(k, "i").test(msg.content); } catch { return lower.includes(k); }
      })) {
        events.push({ type: "LEAD_CAPTURED" });
      }
    }
  }
  return events;
}

function computeOutcome(goal: string, stages: FunnelStage[], events: { type: string }[], messages: { role: string; content: string }[]): {
  outcome: string;
  successReason?: string;
  dropoffStage?: string;
  dropoffReason?: string;
} {
  const hasHandover = events.some(e => e.type === "HANDOVER_TRIGGERED");
  const hasPayment = events.some(e => e.type === "PAYMENT_CONFIRMED");
  const hasPaymentOffered = events.some(e => e.type === "PAYMENT_OFFERED");
  const hasLeadCaptured = events.some(e => e.type === "LEAD_CAPTURED");
  const hasProductSelected = events.some(e => e.type === "PRODUCT_SELECTED");
  const hasRefusal = messages.some(m => m.role === "user" && STAGE_KEYWORDS.REFUSAL.some(k => m.content.toLowerCase().includes(k)));

  const lastMsg = messages[messages.length - 1];
  const lastUserMsg = [...messages].reverse().find(m => m.role === "user");
  const lastAssistantMsg = [...messages].reverse().find(m => m.role === "assistant");
  const userDropped = lastMsg?.role === "assistant";

  let outcome = "UNKNOWN";
  let successReason: string | undefined;

  if (goal === "CLOSE_DEAL") {
    if (hasPayment) { outcome = "SUCCESS"; successReason = "PAYMENT_CONFIRMED"; }
    else if (hasProductSelected && hasPaymentOffered) { outcome = "SUCCESS"; successReason = "ORDER_PLACED"; }
    else if (hasHandover) { outcome = "HANDOVER"; }
    else if (hasRefusal) { outcome = "FAILED"; }
    else if (userDropped) { outcome = "ABANDONED"; }
  } else if (goal === "QUALIFY_HANDOVER") {
    if (hasHandover && hasLeadCaptured) { outcome = "SUCCESS"; successReason = "LEAD_CAPTURED"; }
    else if (hasHandover) { outcome = "HANDOVER"; }
    else if (hasRefusal) { outcome = "FAILED"; }
    else if (userDropped) { outcome = "ABANDONED"; }
  } else if (goal === "CONSULT_PICK") {
    if (hasProductSelected || hasLeadCaptured) { outcome = "SUCCESS"; successReason = "PRODUCT_SELECTED"; }
    else if (hasHandover) { outcome = "HANDOVER"; }
    else if (hasRefusal) { outcome = "FAILED"; }
    else if (userDropped) { outcome = "ABANDONED"; }
  } else if (goal === "ORDER_NO_PAY") {
    if (hasProductSelected) { outcome = "SUCCESS"; successReason = "ORDER_PLACED"; }
    else if (hasHandover) { outcome = "HANDOVER"; }
    else if (hasRefusal) { outcome = "FAILED"; }
    else if (userDropped) { outcome = "ABANDONED"; }
  }

  const dropoffStage = stages.length > 0 ? stages[stages.length - 1] : "GREETING";
  let dropoffReason: string | undefined;
  if (outcome === "ABANDONED" || outcome === "FAILED") {
    const objections = detectObjections(messages);
    if (objections.includes("PRICE")) dropoffReason = "PRICE";
    else if (objections.includes("TRUST")) dropoffReason = "TRUST";
    else if (objections.includes("DELIVERY")) dropoffReason = "DELIVERY";
    else if (objections.includes("PAYMENT")) dropoffReason = "PAYMENT_FRICTION";
    else if (objections.includes("STOCK")) dropoffReason = "STOCK";
    else if (hasRefusal) dropoffReason = "OTHER";
    else dropoffReason = "NO_RESPONSE";
  }

  return { outcome, successReason, dropoffStage: (outcome === "ABANDONED" || outcome === "FAILED") ? dropoffStage : undefined, dropoffReason };
}

async function deriveDialogsFromTesting(tenantId: string): Promise<number> {
  const sessions = await db.select().from(aiTestingSessions)
    .where(and(eq(aiTestingSessions.tenantId, tenantId), eq(aiTestingSessions.status, "completed")));

  if (sessions.length === 0) {
    const activeSessions = await db.select().from(aiTestingSessions)
      .where(eq(aiTestingSessions.tenantId, tenantId));
    sessions.push(...activeSessions);
  }

  const existingDialogIds = await db.select({ externalThreadId: aiDialogs.externalThreadId })
    .from(aiDialogs)
    .where(and(eq(aiDialogs.tenantId, tenantId), eq(aiDialogs.source, "TESTING")));
  const existingSet = new Set(existingDialogIds.map(d => d.externalThreadId));

  const [settingsRow] = await db.select().from(aiSettings).where(eq(aiSettings.tenantId, tenantId));
  const goal = settingsRow?.goal || "CLOSE_DEAL";

  let derived = 0;

  for (const session of sessions) {
    if (existingSet.has(session.id)) continue;

    const messages = await db.select().from(aiTestingMessages)
      .where(and(eq(aiTestingMessages.sessionId, session.id), eq(aiTestingMessages.tenantId, tenantId)))
      .orderBy(aiTestingMessages.createdAt);

    if (messages.length < 2) continue;

    const msgPairs = messages.map(m => ({ role: m.role, content: m.content }));
    const stages = detectStages(msgPairs);
    const events = detectEvents(msgPairs);
    const objections = detectObjections(msgPairs);
    const result = computeOutcome(goal, stages, events, msgPairs);

    const [dialog] = await db.insert(aiDialogs).values({
      tenantId,
      source: "TESTING",
      channel: "INTERNAL",
      externalThreadId: session.id,
      startedAt: messages[0].createdAt,
      lastMessageAt: messages[messages.length - 1].createdAt,
      messageCount: messages.length,
      goal,
      status: "CLOSED",
      outcome: result.outcome,
      successReason: result.successReason,
      dropoffStage: result.dropoffStage,
      dropoffReason: result.dropoffReason,
      handoverReason: events.some(e => e.type === "HANDOVER_TRIGGERED") ? "AI_TRIGGERED" : undefined,
      leadCaptured: events.some(e => e.type === "LEAD_CAPTURED"),
    }).returning();

    for (const stage of stages) {
      await db.insert(aiDialogEvents).values({
        tenantId,
        dialogId: dialog.id,
        eventType: "STAGE_ENTERED",
        eventValue: stage,
        ts: messages[0].createdAt,
      });
    }

    for (const obj of objections) {
      await db.insert(aiDialogEvents).values({
        tenantId,
        dialogId: dialog.id,
        eventType: "OBJECTION_DETECTED",
        eventValue: obj,
        ts: messages[0].createdAt,
      });
    }

    for (const ev of events) {
      await db.insert(aiDialogEvents).values({
        tenantId,
        dialogId: dialog.id,
        eventType: ev.type,
        eventValue: ev.value,
        ts: messages[0].createdAt,
      });
    }

    derived++;
  }

  return derived;
}

async function analyzeProductionDialogs(tenantId: string): Promise<number> {
  const [settingsRow] = await db.select().from(aiSettings).where(eq(aiSettings.tenantId, tenantId));
  const goal = settingsRow?.goal || "CLOSE_DEAL";

  const unanalyzedDialogs = await db.select().from(aiDialogs)
    .where(and(
      eq(aiDialogs.tenantId, tenantId),
      or(eq(aiDialogs.outcome, "UNKNOWN"), isNull(aiDialogs.outcome)),
      ne(aiDialogs.source, "TESTING"),
    ))
    .limit(100);

  if (unanalyzedDialogs.length === 0) return 0;

  const STALE_HOURS = 24;
  const staleThreshold = new Date(Date.now() - STALE_HOURS * 60 * 60 * 1000);

  let analyzed = 0;

  for (const dialog of unanalyzedDialogs) {
    const messages = await db.select({
      direction: messagingMessages.direction,
      content: messagingMessages.content,
      createdAt: messagingMessages.createdAt,
    }).from(messagingMessages)
      .where(eq(messagingMessages.dialogId, dialog.id))
      .orderBy(messagingMessages.createdAt);

    const msgPairs = messages.map(m => ({
      role: m.direction === "inbound" ? "user" : "assistant",
      content: (m.content as any)?.text || (m.content as any)?.body || JSON.stringify(m.content || {}),
    }));

    if (msgPairs.length < 2) {
      if (dialog.lastMessageAt && dialog.lastMessageAt < staleThreshold) {
        await db.update(aiDialogs).set({
          status: "CLOSED",
          outcome: "ABANDONED",
          dropoffStage: "GREETING",
          dropoffReason: "NO_RESPONSE",
          updatedAt: new Date(),
        }).where(eq(aiDialogs.id, dialog.id));
        analyzed++;
      }
      continue;
    }

    const stages = detectStages(msgPairs);
    const events = detectEvents(msgPairs);
    const objections = detectObjections(msgPairs);
    let result = computeOutcome(goal, stages, events, msgPairs);

    const contactPhone = (dialog.meta as any)?.contactPhone;
    if (contactPhone && result.outcome !== "SUCCESS") {
      const normalizedPhones = normalizePhoneVariants(contactPhone);

      const dialogStart = dialog.createdAt || new Date(0);
      const attributionWindow = new Date(dialogStart.getTime() + 7 * 24 * 60 * 60 * 1000);

      const matchingOrders = await db.select({
        id: orders.id,
        paymentStatus: orders.paymentStatus,
        total: orders.total,
        createdAt: orders.createdAt,
      }).from(orders)
        .where(and(
          eq(orders.tenantId, tenantId),
          or(...normalizedPhones.map(p => eq(orders.customerPhone, p))),
          gte(orders.createdAt, dialogStart),
          lte(orders.createdAt, attributionWindow),
        ))
        .limit(5);

      if (matchingOrders.length > 0) {
        const paidOrder = matchingOrders.find(o =>
          o.paymentStatus === "paid" || o.paymentStatus === "prepayment" ||
          o.paymentStatus === "installment" || o.paymentStatus === "credit" || o.paymentStatus === "kaspi_red"
        );
        if (paidOrder) {
          result = {
            outcome: "SUCCESS",
            successReason: "ORDER_PAID",
            dropoffStage: undefined,
            dropoffReason: undefined,
          };
          if (!stages.includes("CLOSE")) stages.push("CLOSE");
          if (!stages.includes("SUCCESS")) stages.push("SUCCESS");
        } else {
          result = {
            outcome: "SUCCESS",
            successReason: "ORDER_PLACED",
            dropoffStage: undefined,
            dropoffReason: undefined,
          };
          if (!stages.includes("CLOSE")) stages.push("CLOSE");
          if (!stages.includes("SUCCESS")) stages.push("SUCCESS");
        }
      }
    }

    const isStale = dialog.lastMessageAt && dialog.lastMessageAt < staleThreshold;
    const newStatus = (isStale || result.outcome === "SUCCESS" || result.outcome === "FAILED") ? "CLOSED" : dialog.status;

    const revenueAmount = result.outcome === "SUCCESS" && contactPhone ? await getOrderRevenue(tenantId, contactPhone, dialog.createdAt || new Date(0)) : undefined;

    await db.update(aiDialogs).set({
      status: newStatus,
      outcome: result.outcome,
      successReason: result.successReason,
      dropoffStage: result.dropoffStage,
      dropoffReason: result.dropoffReason,
      goal,
      revenueAmount: revenueAmount ? String(revenueAmount) : undefined,
      handoverReason: events.some(e => e.type === "HANDOVER_TRIGGERED") ? "AI_TRIGGERED" : undefined,
      leadCaptured: events.some(e => e.type === "LEAD_CAPTURED"),
      updatedAt: new Date(),
    }).where(eq(aiDialogs.id, dialog.id));

    const existingEvents = await db.select({ eventValue: aiDialogEvents.eventValue })
      .from(aiDialogEvents)
      .where(and(eq(aiDialogEvents.dialogId, dialog.id), eq(aiDialogEvents.eventType, "STAGE_ENTERED")));
    const existingStageSet = new Set(existingEvents.map(e => e.eventValue));

    for (const stage of stages) {
      if (!existingStageSet.has(stage)) {
        await db.insert(aiDialogEvents).values({
          tenantId,
          dialogId: dialog.id,
          eventType: "STAGE_ENTERED",
          eventValue: stage,
          ts: dialog.createdAt || new Date(),
        });
      }
    }

    for (const obj of objections) {
      await db.insert(aiDialogEvents).values({
        tenantId,
        dialogId: dialog.id,
        eventType: "OBJECTION_DETECTED",
        eventValue: obj,
        ts: dialog.createdAt || new Date(),
      }).onConflictDoNothing();
    }

    for (const ev of events) {
      await db.insert(aiDialogEvents).values({
        tenantId,
        dialogId: dialog.id,
        eventType: ev.type,
        eventValue: ev.value,
        ts: dialog.createdAt || new Date(),
      }).onConflictDoNothing();
    }

    analyzed++;
  }

  return analyzed;
}

function normalizePhoneVariants(phone: string): string[] {
  const digits = phone.replace(/\D/g, "");
  const variants: string[] = [phone];

  if (digits.length >= 10) {
    const last10 = digits.slice(-10);
    variants.push(`+7${last10}`);
    variants.push(`7${last10}`);
    variants.push(`8${last10}`);
    variants.push(last10);
  }

  return [...new Set(variants)];
}

async function getOrderRevenue(tenantId: string, contactPhone: string, dialogStart: Date): Promise<number> {
  const normalizedPhones = normalizePhoneVariants(contactPhone);
  const matchingOrders = await db.select({ total: orders.total })
    .from(orders)
    .where(and(
      eq(orders.tenantId, tenantId),
      or(...normalizedPhones.map(p => eq(orders.customerPhone, p))),
      gte(orders.createdAt, dialogStart),
      or(
        eq(orders.paymentStatus, "paid"),
        eq(orders.paymentStatus, "prepayment"),
        eq(orders.paymentStatus, "installment"),
        eq(orders.paymentStatus, "credit"),
        eq(orders.paymentStatus, "kaspi_red"),
      ),
    ));

  return matchingOrders.reduce((sum, o) => sum + (o.total ? parseFloat(o.total) : 0), 0);
}

const summaryCache = new Map<string, { data: any; ts: number }>();

async function computeSummary(tenantId: string, start: Date, end: Date, sourceFilter: string) {
  const cacheKey = `${tenantId}:${start.toISOString()}:${end.toISOString()}:${sourceFilter}`;
  const cached = summaryCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < 60000) return cached.data;

  await deriveDialogsFromTesting(tenantId);
  await analyzeProductionDialogs(tenantId);

  let dialogConditions = [
    eq(aiDialogs.tenantId, tenantId),
    gte(aiDialogs.startedAt, start),
    lte(aiDialogs.startedAt, end),
  ];
  if (sourceFilter !== "ALL") {
    dialogConditions.push(eq(aiDialogs.source, sourceFilter));
  }

  const dialogs = await db.select().from(aiDialogs)
    .where(and(...dialogConditions))
    .orderBy(desc(aiDialogs.startedAt));

  const total = dialogs.length;
  const successCount = dialogs.filter(d => d.outcome === "SUCCESS").length;
  const handoverCount = dialogs.filter(d => d.outcome === "HANDOVER").length;
  const abandonedCount = dialogs.filter(d => d.outcome === "ABANDONED").length;
  const failedCount = dialogs.filter(d => d.outcome === "FAILED").length;
  const avgMessages = total > 0 ? Math.round(dialogs.reduce((s, d) => s + d.messageCount, 0) / total) : 0;
  const totalRevenue = dialogs.reduce((s, d) => s + (d.revenueAmount ? parseFloat(d.revenueAmount) : 0), 0);

  const kpis = {
    totalDialogs: total,
    successCount,
    successRate: total > 0 ? Math.round((successCount / total) * 100) : 0,
    handoverCount,
    handoverRate: total > 0 ? Math.round((handoverCount / total) * 100) : 0,
    abandonedCount,
    abandonedRate: total > 0 ? Math.round((abandonedCount / total) * 100) : 0,
    failedCount,
    avgMessages,
    totalRevenue,
    revenuePerDialog: total > 0 ? Math.round(totalRevenue / total) : 0,
  };

  const dialogIds = dialogs.map(d => d.id);
  let allEvents: any[] = [];
  if (dialogIds.length > 0) {
    allEvents = await db.select().from(aiDialogEvents)
      .where(and(eq(aiDialogEvents.tenantId, tenantId), inArray(aiDialogEvents.dialogId, dialogIds)));
  }

  const stageEvents = allEvents.filter(e => e.eventType === "STAGE_ENTERED");
  const stageCounts: Record<string, number> = {};
  for (const stage of FUNNEL_STAGES) {
    const dialogsAtStage = new Set(stageEvents.filter(e => e.eventValue === stage).map(e => e.dialogId));
    stageCounts[stage] = dialogsAtStage.size;
  }

  const funnelStages = FUNNEL_STAGES.map((stage, i) => {
    const prev = i > 0 ? stageCounts[FUNNEL_STAGES[i - 1]] : total;
    return {
      stage,
      count: stageCounts[stage] || 0,
      conversionFromPrev: prev > 0 ? Math.round(((stageCounts[stage] || 0) / prev) * 100) : 0,
    };
  });

  const dropoffByStage: Record<string, number> = {};
  for (const d of dialogs) {
    if ((d.outcome === "ABANDONED" || d.outcome === "FAILED") && d.dropoffStage) {
      dropoffByStage[d.dropoffStage] = (dropoffByStage[d.dropoffStage] || 0) + 1;
    }
  }

  const minSample = total < 20 ? 2 : 10;
  const bottlenecks = Object.entries(dropoffByStage)
    .filter(([, cnt]) => cnt >= minSample)
    .map(([stage, cnt]) => {
      const enteredStage = stageCounts[stage] || total;
      const topReasons = dialogs
        .filter(d => d.dropoffStage === stage && d.dropoffReason)
        .reduce((acc, d) => { acc[d.dropoffReason!] = (acc[d.dropoffReason!] || 0) + 1; return acc; }, {} as Record<string, number>);
      return {
        stage,
        count: cnt,
        rate: enteredStage > 0 ? Math.round((cnt / enteredStage) * 100) : 0,
        topReasons: Object.entries(topReasons).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([reason, count]) => ({ reason, count })),
      };
    })
    .sort((a, b) => b.rate - a.rate)
    .slice(0, 3);

  const objectionEvents = allEvents.filter(e => e.eventType === "OBJECTION_DETECTED");
  const objectionsByType: Record<string, Set<string>> = {};
  for (const e of objectionEvents) {
    if (!objectionsByType[e.eventValue]) objectionsByType[e.eventValue] = new Set();
    objectionsByType[e.eventValue].add(e.dialogId);
  }
  const objections = Object.entries(objectionsByType).map(([type, dialogSet]) => {
    const dialogIdsForType = Array.from(dialogSet);
    const objDialogs = dialogs.filter(d => dialogIdsForType.includes(d.id));
    const objSuccess = objDialogs.filter(d => d.outcome === "SUCCESS").length;
    const objHandover = objDialogs.filter(d => d.outcome === "HANDOVER").length;
    return {
      type,
      count: dialogIdsForType.length,
      successRate: dialogIdsForType.length > 0 ? Math.round((objSuccess / dialogIdsForType.length) * 100) : 0,
      handoverRate: dialogIdsForType.length > 0 ? Math.round((objHandover / dialogIdsForType.length) * 100) : 0,
    };
  }).sort((a, b) => b.count - a.count);

  const handoverEvents = allEvents.filter(e => e.eventType === "HANDOVER_TRIGGERED");
  const handoverDialogIds = new Set(handoverEvents.map(e => e.dialogId));
  const handoverDialogs = dialogs.filter(d => handoverDialogIds.has(d.id));
  const handoverReasons: Record<string, number> = {};
  for (const d of handoverDialogs) {
    const r = d.handoverReason || "UNKNOWN";
    handoverReasons[r] = (handoverReasons[r] || 0) + 1;
  }
  const earlyHandovers = handoverDialogs.filter(d => {
    const dEvents = stageEvents.filter(e => e.dialogId === d.id);
    const hasOffer = dEvents.some(e => e.eventValue === "OFFER");
    return !hasOffer;
  });
  const tooEarlyRate = handoverDialogs.length > 0 ? Math.round((earlyHandovers.length / handoverDialogs.length) * 100) : 0;
  const handover = {
    count: handoverDialogs.length,
    rate: total > 0 ? Math.round((handoverDialogs.length / total) * 100) : 0,
    reasons: Object.entries(handoverReasons).sort((a, b) => b[1] - a[1]).map(([reason, count]) => ({ reason, count })),
    tooEarlyRate,
  };

  let triggerStats: any = { topHelpful: [], topNoisy: [], totals: { fired: 0, dialogsWithAnyTrigger: 0 } };
  try {
    const tenantTriggers = await db.select().from(aiTriggers)
      .where(eq(aiTriggers.tenantId, tenantId));

    const triggeredDialogs = dialogs.filter(d => d.meta && (d.meta as any).matchedTriggers);
    triggerStats.totals.dialogsWithAnyTrigger = triggeredDialogs.length;

    const triggerFireCounts: Record<string, { fired: number; success: number; name: string }> = {};
    for (const t of tenantTriggers) {
      triggerFireCounts[t.id] = { fired: 0, success: 0, name: t.matchValue };
    }
    for (const d of triggeredDialogs) {
      const trigs = ((d.meta as any)?.matchedTriggers || []) as string[];
      for (const tid of trigs) {
        if (triggerFireCounts[tid]) {
          triggerFireCounts[tid].fired++;
          if (d.outcome === "SUCCESS") triggerFireCounts[tid].success++;
        }
        triggerStats.totals.fired++;
      }
    }
    const triggerList = Object.entries(triggerFireCounts)
      .filter(([, v]) => v.fired > 0)
      .map(([id, v]) => ({ id, name: v.name, fired: v.fired, successRate: v.fired > 0 ? Math.round((v.success / v.fired) * 100) : 0 }));
    triggerStats.topHelpful = triggerList.filter(t => t.successRate >= 50).sort((a, b) => b.fired - a.fired).slice(0, 5);
    triggerStats.topNoisy = triggerList.filter(t => t.successRate < 30 && t.fired >= 2).sort((a, b) => a.successRate - b.successRate).slice(0, 5);
  } catch {}

  let trainingImpact: any = { triggersAdded: 0, kbAdded: 0, trainActions: 0, periodSuccessRate: kpis.successRate, prevPeriodSuccessRate: null };
  try {
    const periodLength = end.getTime() - start.getTime();
    const prevStart = new Date(start.getTime() - periodLength);
    const [trigCnt] = await db.select({ cnt: count() }).from(aiTrainingEvents)
      .where(and(eq(aiTrainingEvents.tenantId, tenantId), eq(aiTrainingEvents.eventType, "TRIGGER_CREATED"), gte(aiTrainingEvents.createdAt, start)));
    const [kbCnt] = await db.select({ cnt: count() }).from(aiTrainingEvents)
      .where(and(eq(aiTrainingEvents.tenantId, tenantId), eq(aiTrainingEvents.eventType, "KB_ADDED"), gte(aiTrainingEvents.createdAt, start)));
    const [trainCnt] = await db.select({ cnt: count() }).from(aiTrainingEvents)
      .where(and(eq(aiTrainingEvents.tenantId, tenantId), eq(aiTrainingEvents.eventType, "TRAIN_APPROVED"), gte(aiTrainingEvents.createdAt, start)));
    trainingImpact.triggersAdded = trigCnt?.cnt || 0;
    trainingImpact.kbAdded = kbCnt?.cnt || 0;
    trainingImpact.trainActions = trainCnt?.cnt || 0;

    const prevDialogs = await db.select().from(aiDialogs)
      .where(and(eq(aiDialogs.tenantId, tenantId), gte(aiDialogs.startedAt, prevStart), lte(aiDialogs.startedAt, start)));
    if (prevDialogs.length > 0) {
      const prevSuccess = prevDialogs.filter(d => d.outcome === "SUCCESS").length;
      trainingImpact.prevPeriodSuccessRate = Math.round((prevSuccess / prevDialogs.length) * 100);
    }
  } catch {}

  const [lastAuditRow] = await db.select().from(aiAnalyticsAuditRuns)
    .where(and(eq(aiAnalyticsAuditRuns.tenantId, tenantId), eq(aiAnalyticsAuditRuns.status, "DONE")))
    .orderBy(desc(aiAnalyticsAuditRuns.finishedAt))
    .limit(1);

  let lastAudit: any = null;
  if (lastAuditRow) {
    const [topFinding] = await db.select().from(aiAuditFindings)
      .where(and(eq(aiAuditFindings.auditRunId, lastAuditRow.id), eq(aiAuditFindings.severity, "HIGH")))
      .limit(1);
    lastAudit = {
      runId: lastAuditRow.id,
      finishedAt: lastAuditRow.finishedAt,
      dialogsAnalyzed: lastAuditRow.dialogsAnalyzed,
      mainFinding: topFinding?.title || null,
    };
  }

  const summary = {
    period: { from: start.toISOString(), to: end.toISOString() },
    kpis,
    funnel: { stages: funnelStages },
    bottlenecks,
    objections,
    handover,
    triggers: triggerStats,
    trainingImpact,
    lastAudit,
  };

  summaryCache.set(cacheKey, { data: summary, ts: Date.now() });
  return summary;
}

async function runAudit(tenantId: string, periodStart: Date, periodEnd: Date, sourceFilter: string, runId: string) {
  try {
    await deriveDialogsFromTesting(tenantId);

    let conditions = [
      eq(aiDialogs.tenantId, tenantId),
      gte(aiDialogs.startedAt, periodStart),
      lte(aiDialogs.startedAt, periodEnd),
    ];
    if (sourceFilter !== "ALL") conditions.push(eq(aiDialogs.source, sourceFilter));

    const dialogs = await db.select().from(aiDialogs)
      .where(and(...conditions))
      .orderBy(desc(aiDialogs.startedAt))
      .limit(200);

    const total = dialogs.length;
    const successCount = dialogs.filter(d => d.outcome === "SUCCESS").length;
    const successRate = total > 0 ? Math.round((successCount / total) * 100) : 0;

    const findings: { severity: string; type: string; title: string; details: string; suggestedFix?: any; evidence?: any }[] = [];

    if (total < 5) {
      findings.push({
        severity: "MEDIUM",
        type: "CONFIG_MISSING",
        title: "Мало данных для анализа",
        details: `Найдено всего ${total} диалогов. Запустите тестирование для получения данных.`,
        suggestedFix: { deepLink: "/dashboard/ai/rop/testing", action: "RUN_TEST" },
      });
    }

    if (total >= 5) {
      const abandonedDialogs = dialogs.filter(d => d.outcome === "ABANDONED");
      const abandonedRate = Math.round((abandonedDialogs.length / total) * 100);

      if (abandonedRate > 50) {
        findings.push({
          severity: "HIGH",
          type: "BOTTLENECK",
          title: "Высокий процент потерянных клиентов",
          details: `${abandonedRate}% диалогов заканчиваются без результата. Клиенты уходят, не получив достаточно информации.`,
          evidence: { count: abandonedDialogs.length, rate: abandonedRate, dialogIds: abandonedDialogs.slice(0, 5).map(d => d.id) },
          suggestedFix: { deepLink: "/dashboard/ai/rop/training?tab=knowledge", action: "ADD_KB" },
        });
      }

      const priceDropoffs = dialogs.filter(d => d.dropoffReason === "PRICE");
      if (priceDropoffs.length >= 3 && (priceDropoffs.length / total) > 0.2) {
        findings.push({
          severity: "HIGH",
          type: "OBJECTION_WEAK",
          title: "Низкая конверсия на этапе цены",
          details: `${priceDropoffs.length} клиентов ушли из-за цены. Рассмотрите рассрочку или скидки.`,
          evidence: { count: priceDropoffs.length, dialogIds: priceDropoffs.slice(0, 3).map(d => d.id) },
          suggestedFix: { deepLink: "/dashboard/ai/rop/strategy", action: "ENABLE_INSTALLMENTS" },
        });
      }

      const dialogIds = dialogs.map(d => d.id);
      const allEvents = dialogIds.length > 0 ? await db.select().from(aiDialogEvents)
        .where(and(eq(aiDialogEvents.tenantId, tenantId), inArray(aiDialogEvents.dialogId, dialogIds))) : [];

      const handoverEvents = allEvents.filter(e => e.eventType === "HANDOVER_TRIGGERED");
      const handoverDialogIds = new Set(handoverEvents.map(e => e.dialogId));
      const handoverDialogs = dialogs.filter(d => handoverDialogIds.has(d.id));
      const stageEvents = allEvents.filter(e => e.eventType === "STAGE_ENTERED");

      if (handoverDialogs.length >= 3) {
        const earlyHandovers = handoverDialogs.filter(d => {
          const dStages = stageEvents.filter(e => e.dialogId === d.id);
          return !dStages.some(e => e.eventValue === "OFFER");
        });
        if (earlyHandovers.length >= 2 && (earlyHandovers.length / handoverDialogs.length) > 0.2) {
          findings.push({
            severity: "MEDIUM",
            type: "HANDOVER_TOO_EARLY",
            title: "Часто передаёте менеджеру слишком рано",
            details: `${earlyHandovers.length} из ${handoverDialogs.length} передач произошли до предложения товара.`,
            evidence: { count: earlyHandovers.length, dialogIds: earlyHandovers.slice(0, 3).map(d => d.id) },
            suggestedFix: { deepLink: "/dashboard/ai/rop/strategy", action: "ADJUST_HANDOVER" },
          });
        }
      }

      const [kbCount] = await db.select({ cnt: count() }).from(knowledgeItems)
        .where(and(eq(knowledgeItems.tenantId, tenantId), eq(knowledgeItems.isActive, true)));
      if ((kbCount?.cnt || 0) < 3) {
        findings.push({
          severity: "MEDIUM",
          type: "KB_MISSING",
          title: "Мало записей в базе знаний",
          details: `Всего ${kbCount?.cnt || 0} активных записей. AI не имеет достаточной информации для качественных ответов.`,
          suggestedFix: { deepLink: "/dashboard/ai/rop/training?tab=knowledge", action: "IMPORT_CATALOG" },
        });
      }

      const [triggerCount] = await db.select({ cnt: count() }).from(aiTriggers)
        .where(and(eq(aiTriggers.tenantId, tenantId), eq(aiTriggers.isEnabled, true)));
      if ((triggerCount?.cnt || 0) === 0) {
        findings.push({
          severity: "LOW",
          type: "TRIGGER_MISSING",
          title: "Нет активных триггеров",
          details: "Триггеры помогают AI автоматически реагировать на ключевые ситуации. Создайте хотя бы 3 триггера.",
          suggestedFix: { deepLink: "/dashboard/ai/rop/training?tab=triggers", action: "CREATE_TRIGGER" },
        });
      }

      const trustDropoffs = dialogs.filter(d => d.dropoffReason === "TRUST");
      if (trustDropoffs.length >= 2) {
        const [warrantyKb] = await db.select({ cnt: count() }).from(knowledgeItems)
          .where(and(eq(knowledgeItems.tenantId, tenantId), eq(knowledgeItems.type, "WARRANTY")));
        if ((warrantyKb?.cnt || 0) === 0) {
          findings.push({
            severity: "MEDIUM",
            type: "KB_MISSING",
            title: "Нет информации о гарантии в базе знаний",
            details: `${trustDropoffs.length} клиентов ушли из-за недоверия, но информация о гарантии не добавлена.`,
            suggestedFix: { deepLink: "/dashboard/ai/rop/training?tab=knowledge", action: "ADD_KB", payload: { type: "WARRANTY" } },
          });
        }
      }
    }

    findings.sort((a, b) => {
      const sev = { HIGH: 3, MEDIUM: 2, LOW: 1 };
      return (sev[b.severity as keyof typeof sev] || 0) - (sev[a.severity as keyof typeof sev] || 0);
    });

    for (const f of findings) {
      await db.insert(aiAuditFindings).values({
        tenantId,
        auditRunId: runId,
        severity: f.severity,
        type: f.type,
        title: f.title,
        details: f.details,
        suggestedFix: f.suggestedFix as any,
        evidence: f.evidence as any,
      });
    }

    await db.update(aiAnalyticsAuditRuns)
      .set({
        status: "DONE",
        dialogsAnalyzed: total,
        summary: { successRate, total, findings: findings.length } as any,
        recommendations: findings.map(f => ({ title: f.title, severity: f.severity, type: f.type })) as any,
        finishedAt: new Date(),
      })
      .where(eq(aiAnalyticsAuditRuns.id, runId));

    summaryCache.delete(`${tenantId}`);
  } catch (error: any) {
    console.error("Audit error:", error);
    await db.update(aiAnalyticsAuditRuns)
      .set({ status: "FAILED" })
      .where(eq(aiAnalyticsAuditRuns.id, runId));
  }
}

export function registerAiAnalyticsRoutes(app: Express, requireAuth: any, requireAiAccess: any) {
  app.get("/api/ai/analytics/summary", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const period = (req.query.period as string) || "30d";
      const source = (req.query.source as string) || "ALL";
      const { start, end } = parsePeriod(period, req.query.from as string, req.query.to as string);
      const summary = await computeSummary(tenantId, start, end, source);
      res.json(summary);
    } catch (error: any) {
      console.error("Analytics summary error:", error);
      res.status(500).json({ message: "Ошибка получения аналитики" });
    }
  });

  app.get("/api/ai/analytics/dialogs", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const period = (req.query.period as string) || "30d";
      const source = (req.query.source as string) || "ALL";
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const offset = parseInt(req.query.offset as string) || 0;
      const outcome = req.query.outcome as string;
      const goal = req.query.goal as string;

      const { start, end } = parsePeriod(period, req.query.from as string, req.query.to as string);

      let conditions: any[] = [
        eq(aiDialogs.tenantId, tenantId),
        gte(aiDialogs.startedAt, start),
        lte(aiDialogs.startedAt, end),
      ];
      if (source !== "ALL") conditions.push(eq(aiDialogs.source, source));
      if (outcome) conditions.push(eq(aiDialogs.outcome, outcome));
      if (goal) conditions.push(eq(aiDialogs.goal, goal));

      const rows = await db.select().from(aiDialogs)
        .where(and(...conditions))
        .orderBy(desc(aiDialogs.startedAt))
        .limit(limit)
        .offset(offset);

      const [totalRow] = await db.select({ cnt: count() }).from(aiDialogs)
        .where(and(...conditions));

      const dialogIds = rows.map(r => r.id);
      let events: any[] = [];
      if (dialogIds.length > 0) {
        events = await db.select().from(aiDialogEvents)
          .where(and(eq(aiDialogEvents.tenantId, tenantId), inArray(aiDialogEvents.dialogId, dialogIds)));
      }

      const dialogsWithEvents = rows.map(d => {
        const dEvents = events.filter(e => e.dialogId === d.id);
        const stageReached = dEvents
          .filter(e => e.eventType === "STAGE_ENTERED")
          .map(e => e.eventValue)
          .pop() || "GREETING";
        const objectionChips = dEvents.filter(e => e.eventType === "OBJECTION_DETECTED").map(e => e.eventValue);
        const hasHandover = dEvents.some(e => e.eventType === "HANDOVER_TRIGGERED");
        const durationMs = d.lastMessageAt && d.startedAt
          ? new Date(d.lastMessageAt).getTime() - new Date(d.startedAt).getTime()
          : 0;
        return {
          ...d,
          stageReached,
          objections: objectionChips,
          hasHandover,
          durationMins: Math.round(durationMs / 60000),
        };
      });

      res.json({ dialogs: dialogsWithEvents, total: totalRow?.cnt || 0 });
    } catch (error: any) {
      console.error("Analytics dialogs error:", error);
      res.status(500).json({ message: "Ошибка получения диалогов" });
    }
  });

  app.get("/api/ai/analytics/dialogs/:id", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const dialogId = req.params.id;

      const [dialog] = await db.select().from(aiDialogs)
        .where(and(eq(aiDialogs.id, dialogId), eq(aiDialogs.tenantId, tenantId)));
      if (!dialog) return res.status(404).json({ message: "Диалог не найден" });

      const events = await db.select().from(aiDialogEvents)
        .where(and(eq(aiDialogEvents.dialogId, dialogId), eq(aiDialogEvents.tenantId, tenantId)))
        .orderBy(aiDialogEvents.ts);

      let messages: any[] = [];
      if (dialog.source === "TESTING" && dialog.externalThreadId) {
        messages = await db.select().from(aiTestingMessages)
          .where(and(eq(aiTestingMessages.sessionId, dialog.externalThreadId), eq(aiTestingMessages.tenantId, tenantId)))
          .orderBy(aiTestingMessages.createdAt);
      }

      const stageTimeline = events
        .filter(e => e.eventType === "STAGE_ENTERED")
        .map(e => ({ stage: e.eventValue, ts: e.ts }));

      res.json({ dialog, messages, events, stageTimeline });
    } catch (error: any) {
      console.error("Analytics dialog detail error:", error);
      res.status(500).json({ message: "Ошибка получения деталей диалога" });
    }
  });

  app.post("/api/ai/analytics/audit/run", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { period, source } = req.body;
      const periodStr = period || "30d";
      const sourceFilter = source || "ALL";
      const { start, end } = parsePeriod(periodStr);

      const [run] = await db.insert(aiAnalyticsAuditRuns).values({
        tenantId,
        periodStart: start,
        periodEnd: end,
        sourceFilter,
        status: "RUNNING",
      }).returning();

      runAudit(tenantId, start, end, sourceFilter, run.id).catch(err => console.error("Audit bg error:", err));

      res.json({ runId: run.id });
    } catch (error: any) {
      console.error("Audit start error:", error);
      res.status(500).json({ message: "Ошибка запуска аудита" });
    }
  });

  app.get("/api/ai/analytics/audit/run/:runId", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const runId = req.params.runId;

      const [run] = await db.select().from(aiAnalyticsAuditRuns)
        .where(and(eq(aiAnalyticsAuditRuns.id, runId), eq(aiAnalyticsAuditRuns.tenantId, tenantId)));
      if (!run) return res.status(404).json({ message: "Аудит не найден" });

      let findings: any[] = [];
      if (run.status === "DONE") {
        findings = await db.select().from(aiAuditFindings)
          .where(and(eq(aiAuditFindings.auditRunId, runId), eq(aiAuditFindings.tenantId, tenantId)))
          .orderBy(aiAuditFindings.createdAt);
      }

      res.json({ ...run, findings });
    } catch (error: any) {
      console.error("Audit status error:", error);
      res.status(500).json({ message: "Ошибка получения статуса аудита" });
    }
  });
}
