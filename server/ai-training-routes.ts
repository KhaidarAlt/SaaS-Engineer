import type { Express, Request, Response } from "express";
import { db } from "./db";
import { eq, and, desc, sql, count } from "drizzle-orm";
import {
  aiTriggers, aiAntiPatterns, aiTrainingEvents,
  knowledgeItems, trainingItems, products, categories,
  tenants, aiSettings, aiTestingMessages, discounts, promotions,
} from "@shared/schema";
import { generateAiResponse } from "./services/openai";
import OpenAI from "openai";

const openaiClient = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

function guessKnowledgeType(text: string): string {
  const lower = text.toLowerCase();
  if (lower.includes("доставк") || lower.includes("самовывоз")) return "DELIVERY";
  if (lower.includes("оплат") || lower.includes("kaspi") || lower.includes("каспи")) return "PAYMENT";
  if (lower.includes("рассрочк") || lower.includes("кредит")) return "INSTALLMENTS";
  if (lower.includes("гарант")) return "WARRANTY";
  if (lower.includes("возврат") || lower.includes("обмен")) return "RETURNS";
  if (lower.includes("магазин") || lower.includes("адрес") || lower.includes("контакт")) return "STORE_INFO";
  if (lower.includes("преимущ") || lower.includes("уникальн") || lower.includes("отличи")) return "USP";
  return "OTHER";
}

function extractKeyword(text: string): string {
  const words = text.toLowerCase().split(/\s+/).filter(w => w.length > 3);
  const common = ["здравствуйте", "привет", "добрый", "можно", "скажите", "подскажите", "пожалуйста"];
  const meaningful = words.filter(w => !common.includes(w));
  return meaningful[0] || words[0] || text.substring(0, 20);
}

export function registerAiTrainingRoutes(
  app: Express,
  storage: any,
  pool: any,
  requireAuth: any,
  requireAiAccess: any,
) {

  app.post("/api/ai/training/quick-train", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { userText, assistantText, editedText, applyMode, meta } = req.body;

      if (!userText || !assistantText || !editedText || !applyMode) {
        return res.status(400).json({ error: "Необходимы userText, assistantText, editedText и applyMode" });
      }

      const contextData: Record<string, unknown> = {
        userText,
        assistantText,
        editedText,
        applyMode,
        ...(meta || {}),
      };

      if (applyMode === "FIX_ONLY") {
        const [event] = await db.insert(aiTrainingEvents).values({
          tenantId,
          eventType: "EDIT_REPLY",
          context: contextData,
        }).returning();
        return res.json({ success: true, event });
      }

      if (applyMode === "TRAIN_FUTURE") {
        const keyword = extractKeyword(userText);
        const [trigger] = await db.insert(aiTriggers).values({
          tenantId,
          isEnabled: true,
          priority: 100,
          matchType: "KEYWORD",
          matchValue: keyword,
          actionType: "ADD_LINE_TO_REPLY",
          actionPayload: { text: editedText },
        }).returning();

        const [event] = await db.insert(aiTrainingEvents).values({
          tenantId,
          eventType: "TRAIN_APPROVED",
          refId: trigger.id,
          context: contextData,
        }).returning();

        return res.json({ success: true, event, createdTriggerId: trigger.id });
      }

      if (applyMode === "ADD_TO_KB") {
        const kbType = guessKnowledgeType(editedText);
        const [kbItem] = await db.insert(knowledgeItems).values({
          tenantId,
          type: kbType,
          title: userText.substring(0, 100),
          content: editedText,
          source: "TRAINING",
        }).returning();

        const [event] = await db.insert(aiTrainingEvents).values({
          tenantId,
          eventType: "KB_ADDED",
          refId: kbItem.id,
          context: contextData,
        }).returning();

        return res.json({ success: true, event, createdKnowledgeId: kbItem.id });
      }

      if (applyMode === "ANTI_PATTERN") {
        const patternValue = extractKeyword(assistantText);
        const [antiPattern] = await db.insert(aiAntiPatterns).values({
          tenantId,
          patternType: "KEYWORD",
          patternValue,
          note: `Auto: "${assistantText.substring(0, 100)}"`,
          isActive: true,
        }).returning();

        const [event] = await db.insert(aiTrainingEvents).values({
          tenantId,
          eventType: "ANTI_PATTERN_ADDED",
          refId: antiPattern.id,
          context: contextData,
        }).returning();

        return res.json({ success: true, event, createdAntiPatternId: antiPattern.id });
      }

      return res.status(400).json({ error: "Неизвестный applyMode" });
    } catch (error: any) {
      console.error("Ошибка quick-train:", error);
      res.status(500).json({ error: "Ошибка быстрого обучения" });
    }
  });

  app.get("/api/ai/triggers", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const rows = await db.select().from(aiTriggers)
        .where(eq(aiTriggers.tenantId, tenantId))
        .orderBy(aiTriggers.priority);
      res.json(rows);
    } catch (error: any) {
      console.error("Ошибка получения триггеров:", error);
      res.status(500).json({ error: "Ошибка получения триггеров" });
    }
  });

  app.post("/api/ai/triggers", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { isEnabled, priority, matchType, matchValue, conditions, actionType, actionPayload } = req.body;
      const [trigger] = await db.insert(aiTriggers).values({
        tenantId,
        isEnabled: isEnabled ?? true,
        priority: priority ?? 100,
        matchType,
        matchValue,
        conditions: conditions || null,
        actionType,
        actionPayload: actionPayload || {},
      }).returning();
      res.json(trigger);
    } catch (error: any) {
      console.error("Ошибка создания триггера:", error);
      res.status(500).json({ error: "Ошибка создания триггера" });
    }
  });

  app.put("/api/ai/triggers/:id", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { id } = req.params;

      const [existing] = await db.select().from(aiTriggers)
        .where(and(eq(aiTriggers.id, id), eq(aiTriggers.tenantId, tenantId)));
      if (!existing) {
        return res.status(404).json({ error: "Триггер не найден" });
      }

      const { isEnabled, priority, matchType, matchValue, conditions, actionType, actionPayload } = req.body;
      const [updated] = await db.update(aiTriggers).set({
        isEnabled,
        priority,
        matchType,
        matchValue,
        conditions,
        actionType,
        actionPayload,
        updatedAt: new Date(),
      }).where(and(eq(aiTriggers.id, id), eq(aiTriggers.tenantId, tenantId))).returning();
      res.json(updated);
    } catch (error: any) {
      console.error("Ошибка обновления триггера:", error);
      res.status(500).json({ error: "Ошибка обновления триггера" });
    }
  });

  app.delete("/api/ai/triggers/:id", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { id } = req.params;

      const [existing] = await db.select().from(aiTriggers)
        .where(and(eq(aiTriggers.id, id), eq(aiTriggers.tenantId, tenantId)));
      if (!existing) {
        return res.status(404).json({ error: "Триггер не найден" });
      }

      await db.delete(aiTriggers).where(and(eq(aiTriggers.id, id), eq(aiTriggers.tenantId, tenantId)));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Ошибка удаления триггера:", error);
      res.status(500).json({ error: "Ошибка удаления триггера" });
    }
  });

  app.post("/api/ai/triggers/:id/toggle", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { id } = req.params;

      const [existing] = await db.select().from(aiTriggers)
        .where(and(eq(aiTriggers.id, id), eq(aiTriggers.tenantId, tenantId)));
      if (!existing) {
        return res.status(404).json({ error: "Триггер не найден" });
      }

      const [updated] = await db.update(aiTriggers).set({
        isEnabled: !existing.isEnabled,
        updatedAt: new Date(),
      }).where(and(eq(aiTriggers.id, id), eq(aiTriggers.tenantId, tenantId))).returning();
      res.json(updated);
    } catch (error: any) {
      console.error("Ошибка переключения триггера:", error);
      res.status(500).json({ error: "Ошибка переключения триггера" });
    }
  });

  app.get("/api/ai/knowledge", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const typeFilter = req.query.type as string | undefined;

      let query;
      if (typeFilter) {
        query = db.select().from(knowledgeItems)
          .where(and(eq(knowledgeItems.tenantId, tenantId), eq(knowledgeItems.type, typeFilter)));
      } else {
        query = db.select().from(knowledgeItems)
          .where(eq(knowledgeItems.tenantId, tenantId));
      }
      const rows = await query;
      res.json(rows);
    } catch (error: any) {
      console.error("Ошибка получения базы знаний:", error);
      res.status(500).json({ error: "Ошибка получения базы знаний" });
    }
  });

  app.post("/api/ai/knowledge", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { type, title, content, source, tags } = req.body;
      const [item] = await db.insert(knowledgeItems).values({
        tenantId,
        type: type || "OTHER",
        title,
        content,
        source: source || "USER",
        tags: tags || null,
      }).returning();
      res.json(item);
    } catch (error: any) {
      console.error("Ошибка создания записи базы знаний:", error);
      res.status(500).json({ error: "Ошибка создания записи базы знаний" });
    }
  });

  app.put("/api/ai/knowledge/:id", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { id } = req.params;

      const [existing] = await db.select().from(knowledgeItems)
        .where(and(eq(knowledgeItems.id, id), eq(knowledgeItems.tenantId, tenantId)));
      if (!existing) {
        return res.status(404).json({ error: "Запись не найдена" });
      }

      const { type, title, content, source, tags, isActive } = req.body;
      const [updated] = await db.update(knowledgeItems).set({
        type,
        title,
        content,
        source,
        tags,
        isActive,
        updatedAt: new Date(),
      }).where(and(eq(knowledgeItems.id, id), eq(knowledgeItems.tenantId, tenantId))).returning();
      res.json(updated);
    } catch (error: any) {
      console.error("Ошибка обновления записи базы знаний:", error);
      res.status(500).json({ error: "Ошибка обновления записи базы знаний" });
    }
  });

  app.delete("/api/ai/knowledge/:id", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { id } = req.params;

      const [existing] = await db.select().from(knowledgeItems)
        .where(and(eq(knowledgeItems.id, id), eq(knowledgeItems.tenantId, tenantId)));
      if (!existing) {
        return res.status(404).json({ error: "Запись не найдена" });
      }

      await db.delete(knowledgeItems).where(and(eq(knowledgeItems.id, id), eq(knowledgeItems.tenantId, tenantId)));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Ошибка удаления записи базы знаний:", error);
      res.status(500).json({ error: "Ошибка удаления записи базы знаний" });
    }
  });

  app.post("/api/ai/knowledge/import-from-catalog", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const imported: any[] = [];

      const existingKb = await db.select().from(knowledgeItems)
        .where(eq(knowledgeItems.tenantId, tenantId));
      const existingTypes = new Set(existingKb.map(k => k.type));

      const [tenant] = await db.select().from(tenants)
        .where(eq(tenants.id, tenantId));

      if (tenant && !existingTypes.has("STORE_INFO")) {
        const parts: string[] = [];
        if (tenant.name) parts.push(`Магазин: ${tenant.name}`);
        if (tenant.address) parts.push(`Адрес: ${tenant.address}`);
        if (tenant.contactPhone) parts.push(`Телефон: ${tenant.contactPhone}`);
        if (tenant.description) parts.push(tenant.description);

        if (parts.length > 0) {
          const [item] = await db.insert(knowledgeItems).values({
            tenantId,
            type: "STORE_INFO",
            title: "Информация о магазине",
            content: parts.join("\n"),
            source: "IMPORT",
          }).returning();
          imported.push(item);
        }
      }

      if (!existingTypes.has("PAYMENT")) {
        const paymentContent = "Принимаем оплату: Kaspi перевод, наличные, Kaspi QR.";
        const [item] = await db.insert(knowledgeItems).values({
          tenantId,
          type: "PAYMENT",
          title: "Способы оплаты",
          content: paymentContent,
          source: "IMPORT",
        }).returning();
        imported.push(item);
      }

      if (!existingTypes.has("DELIVERY")) {
        const deliveryContent = "Доставка по городу и самовывоз. Уточняйте детали у менеджера.";
        const [item] = await db.insert(knowledgeItems).values({
          tenantId,
          type: "DELIVERY",
          title: "Доставка и самовывоз",
          content: deliveryContent,
          source: "IMPORT",
        }).returning();
        imported.push(item);
      }

      res.json({ imported: imported.length, items: imported });
    } catch (error: any) {
      console.error("Ошибка импорта из каталога:", error);
      res.status(500).json({ error: "Ошибка импорта из каталога" });
    }
  });

  app.get("/api/ai/anti-patterns", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const rows = await db.select().from(aiAntiPatterns)
        .where(eq(aiAntiPatterns.tenantId, tenantId));
      res.json(rows);
    } catch (error: any) {
      console.error("Ошибка получения анти-паттернов:", error);
      res.status(500).json({ error: "Ошибка получения анти-паттернов" });
    }
  });

  app.post("/api/ai/anti-patterns", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { patternType, patternValue, note, isActive } = req.body;
      const [item] = await db.insert(aiAntiPatterns).values({
        tenantId,
        patternType: patternType || "KEYWORD",
        patternValue,
        note: note || null,
        isActive: isActive ?? true,
      }).returning();
      res.json(item);
    } catch (error: any) {
      console.error("Ошибка создания анти-паттерна:", error);
      res.status(500).json({ error: "Ошибка создания анти-паттерна" });
    }
  });

  app.put("/api/ai/anti-patterns/:id", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { id } = req.params;

      const [existing] = await db.select().from(aiAntiPatterns)
        .where(and(eq(aiAntiPatterns.id, id), eq(aiAntiPatterns.tenantId, tenantId)));
      if (!existing) {
        return res.status(404).json({ error: "Анти-паттерн не найден" });
      }

      const { patternType, patternValue, note, isActive } = req.body;
      const [updated] = await db.update(aiAntiPatterns).set({
        patternType,
        patternValue,
        note,
        isActive,
      }).where(and(eq(aiAntiPatterns.id, id), eq(aiAntiPatterns.tenantId, tenantId))).returning();
      res.json(updated);
    } catch (error: any) {
      console.error("Ошибка обновления анти-паттерна:", error);
      res.status(500).json({ error: "Ошибка обновления анти-паттерна" });
    }
  });

  app.delete("/api/ai/anti-patterns/:id", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { id } = req.params;

      const [existing] = await db.select().from(aiAntiPatterns)
        .where(and(eq(aiAntiPatterns.id, id), eq(aiAntiPatterns.tenantId, tenantId)));
      if (!existing) {
        return res.status(404).json({ error: "Анти-паттерн не найден" });
      }

      await db.delete(aiAntiPatterns).where(and(eq(aiAntiPatterns.id, id), eq(aiAntiPatterns.tenantId, tenantId)));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Ошибка удаления анти-паттерна:", error);
      res.status(500).json({ error: "Ошибка удаления анти-паттерна" });
    }
  });

  app.post("/api/ai/anti-patterns/:id/toggle", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { id } = req.params;

      const [existing] = await db.select().from(aiAntiPatterns)
        .where(and(eq(aiAntiPatterns.id, id), eq(aiAntiPatterns.tenantId, tenantId)));
      if (!existing) {
        return res.status(404).json({ error: "Анти-паттерн не найден" });
      }

      const [updated] = await db.update(aiAntiPatterns).set({
        isActive: !existing.isActive,
      }).where(and(eq(aiAntiPatterns.id, id), eq(aiAntiPatterns.tenantId, tenantId))).returning();
      res.json(updated);
    } catch (error: any) {
      console.error("Ошибка переключения анти-паттерна:", error);
      res.status(500).json({ error: "Ошибка переключения анти-паттерна" });
    }
  });

  app.get("/api/ai/training/history", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const offset = parseInt(req.query.offset as string) || 0;

      const rows = await db.select().from(aiTrainingEvents)
        .where(eq(aiTrainingEvents.tenantId, tenantId))
        .orderBy(desc(aiTrainingEvents.createdAt))
        .limit(limit)
        .offset(offset);
      res.json(rows);
    } catch (error: any) {
      console.error("Ошибка получения истории обучения:", error);
      res.status(500).json({ error: "Ошибка получения истории обучения" });
    }
  });

  app.get("/api/ai/training/recent-messages", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);

      const rows = await db.select().from(aiTestingMessages)
        .where(eq(aiTestingMessages.tenantId, tenantId))
        .orderBy(desc(aiTestingMessages.createdAt))
        .limit(limit);
      res.json(rows);
    } catch (error: any) {
      console.error("Ошибка получения последних сообщений:", error);
      res.status(500).json({ error: "Ошибка получения последних сообщений" });
    }
  });

  app.post("/api/ai/training/preview-response", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { userText } = req.body;

      if (!userText || typeof userText !== "string" || !userText.trim()) {
        return res.status(400).json({ error: "Необходимо указать userText" });
      }

      const tenant = await storage.getTenant(tenantId);
      if (!tenant) return res.status(404).json({ error: "Тенант не найден" });

      const settings = await storage.getOrCreateAiSettings(tenantId);

      const productRows = await db.select({
        name: products.name,
        price: products.price,
        description: products.description,
        categoryName: categories.name,
      })
        .from(products)
        .leftJoin(categories, eq(products.categoryId, categories.id))
        .where(and(eq(products.tenantId, tenantId), eq(products.isActive, true)))
        .limit(20);

      const kbItems = await db.select().from(knowledgeItems)
        .where(and(eq(knowledgeItems.tenantId, tenantId), eq(knowledgeItems.isActive, true)))
        .limit(30);

      const activeTriggers = await db.select().from(aiTriggers)
        .where(and(eq(aiTriggers.tenantId, tenantId), eq(aiTriggers.isEnabled, true)))
        .orderBy(aiTriggers.priority)
        .limit(20);

      const activeAntiPatterns = await db.select().from(aiAntiPatterns)
        .where(and(eq(aiAntiPatterns.tenantId, tenantId), eq(aiAntiPatterns.isActive, true)));

      let paymentOptions: any = undefined;
      try {
        const kaspiRes = await pool.query(
          `SELECT status, kaspi_pay_link, auto_generate_invoice FROM kaspi_integrations WHERE tenant_id = $1 LIMIT 1`,
          [tenantId]
        );
        const kaspi = kaspiRes.rows?.[0];
        if (kaspi && (kaspi.status === "connected" || kaspi.kaspi_pay_link)) {
          paymentOptions = {
            kaspiEnabled: true,
            autoInvoice: kaspi.auto_generate_invoice || false,
            kaspiPayLink: kaspi.kaspi_pay_link || undefined,
          };
        }
      } catch {}

      const context: any = {
        storeName: tenant.name,
        slug: tenant.slug,
        customDomain: tenant.customDomain || undefined,
        storeDescription: tenant.description || undefined,
        contactPhone: tenant.contactPhone || undefined,
        products: productRows.map((p: any) => ({
          name: p.name,
          price: parseFloat(p.price),
          description: p.description || undefined,
          category: p.categoryName || undefined,
        })),
        knowledge: kbItems.map((k: any) => ({ title: k.title || k.question, content: k.content || k.answer })),
        triggers: activeTriggers,
        antiPatterns: activeAntiPatterns,
        tone: settings.tone || "friendly",
        goal: settings.goal || "CLOSE_DEAL",
        aiLanguages: tenant.aiLanguages || ["ru"],
        aiSystemPrompt: settings.systemPromptCustom || undefined,
        paymentOptions,
      };

      const aiResult = await generateAiResponse(userText.trim(), [], context);
      const currentResponse = aiResult.content;

      const activeDiscounts = await db.select().from(discounts)
        .where(and(eq(discounts.tenantId, tenantId), eq(discounts.isActive, true)))
        .limit(10);
      const activePromotions = await db.select().from(promotions)
        .where(and(eq(promotions.tenantId, tenantId), eq(promotions.isActive, true)))
        .limit(10);

      let installmentEnabled = false;
      try {
        const bpRes = await pool.query(
          `SELECT installment_enabled FROM business_profiles WHERE tenant_id = $1 LIMIT 1`,
          [tenantId]
        );
        installmentEnabled = bpRes.rows?.[0]?.installment_enabled === true;
      } catch {}

      const solutionHints: string[] = [];
      if (installmentEnabled) solutionHints.push("рассрочка");
      if (activeDiscounts.length > 0 || activePromotions.length > 0) solutionHints.push("скидки/акции");
      solutionHints.push("гарантии");

      const solutionsLine = solutionHints.length > 0
        ? `- Предлагает конкретные решения (${solutionHints.join(", ")})`
        : `- Предлагает конкретные решения (гарантии, удобство покупки)`;

      const improveCompletion = await openaiClient.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.7,
        max_tokens: 600,
        messages: [
          {
            role: "system",
            content: `Ты — эксперт по продажам и клиентскому сервису. Тебе дан вопрос клиента и текущий ответ AI-продавца магазина "${tenant.name}".

Твоя задача — написать УЛУЧШЕННЫЙ вариант ответа, который:
- Более убедительный и продающий
- Лучше обрабатывает возражения клиента
${solutionsLine}
- Задаёт уточняющий вопрос для продолжения диалога
- Сохраняет дружелюбный тон
- НЕ выдумывай акции, скидки, рассрочки или бонусы, которых нет — предлагай ТОЛЬКО реально существующие

Напиши ТОЛЬКО улучшенный ответ, без пояснений и комментариев.`,
          },
          {
            role: "user",
            content: `Вопрос клиента: "${userText.trim()}"

Текущий ответ AI: "${currentResponse}"

Напиши улучшенный вариант ответа:`,
          },
        ],
      });

      const improvedResponse = improveCompletion.choices[0]?.message?.content?.trim() || currentResponse;

      res.json({
        currentResponse,
        improvedResponse,
      });
    } catch (error: any) {
      console.error("Ошибка preview-response:", error);
      res.status(500).json({ error: "Ошибка генерации ответа" });
    }
  });

  app.post("/api/ai/training/regenerate-improved", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { userText, currentResponse } = req.body;

      if (!userText || !currentResponse) {
        return res.status(400).json({ error: "Необходимы userText и currentResponse" });
      }

      const tenant = await storage.getTenant(tenantId);
      if (!tenant) return res.status(404).json({ error: "Тенант не найден" });

      const completion = await openaiClient.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.9,
        max_tokens: 600,
        messages: [
          {
            role: "system",
            content: `Ты — эксперт по продажам и клиентскому сервису. Тебе дан вопрос клиента и текущий ответ AI-продавца магазина "${tenant.name}".

Твоя задача — написать ДРУГОЙ, АЛЬТЕРНАТИВНЫЙ улучшенный вариант ответа (не повторяй предыдущий), который:
- Более убедительный и продающий
- Использует другой подход к обработке возражения
- Предлагает конкретные решения
- Задаёт уточняющий вопрос
- Сохраняет дружелюбный тон

Напиши ТОЛЬКО улучшенный ответ, без пояснений.`,
          },
          {
            role: "user",
            content: `Вопрос клиента: "${userText}"

Текущий ответ AI: "${currentResponse}"

Напиши другой улучшенный вариант ответа:`,
          },
        ],
      });

      const improvedResponse = completion.choices[0]?.message?.content?.trim() || currentResponse;

      res.json({ improvedResponse });
    } catch (error: any) {
      console.error("Ошибка regenerate-improved:", error);
      res.status(500).json({ error: "Ошибка генерации ответа" });
    }
  });
}
