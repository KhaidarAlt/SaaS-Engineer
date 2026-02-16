import type { Express, Request, Response } from "express";
import { db } from "./db";
import { eq, and, desc, sql, gte, lte } from "drizzle-orm";
import {
  aiSettings, aiConversations, aiMessages, handoverRules, knowledgeItems,
  trainingItems, aiAuditReports, aiSettingsHistory, products,
} from "@shared/schema";
import { generateAiResponse } from "./services/openai";

export function registerAiRopRoutes(
  app: Express,
  storage: any,
  pool: any,
  requireAuth: any,
  requireAiAccess: any
) {

  // ========================
  // 1. Goal & Readiness
  // ========================

  app.get("/api/ai-rop/settings", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const settings = await storage.getOrCreateAiSettings(tenantId);
      res.json(settings);
    } catch (error: any) {
      console.error("Ошибка получения настроек AI-РОП:", error);
      res.status(500).json({ message: "Ошибка получения настроек" });
    }
  });

  app.put("/api/ai-rop/settings", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const userId = req.user!.id;
      const current = await storage.getOrCreateAiSettings(tenantId);

      const settingsSnapshot: Record<string, unknown> = {
        enabled: current.enabled,
        language: current.language,
        tone: current.tone,
        goal: current.goal,
        temperature: current.temperature,
        typingDelay: current.typingDelay,
        workingHoursJson: current.workingHoursJson,
        fallbackHandoffText: current.fallbackHandoffText,
        systemPromptCustom: current.systemPromptCustom,
        isActive: current.isActive,
      };

      const newVersion = (current.versionNumber || 1) + 1;

      await db.insert(aiSettingsHistory).values({
        tenantId,
        versionNumber: current.versionNumber || 1,
        settingsSnapshot,
        changedBy: userId,
      });

      const [updated] = await db.update(aiSettings)
        .set({ ...req.body, versionNumber: newVersion, updatedAt: new Date() })
        .where(eq(aiSettings.tenantId, tenantId))
        .returning();

      res.json(updated);
    } catch (error: any) {
      console.error("Ошибка обновления настроек AI-РОП:", error);
      res.status(500).json({ message: "Ошибка обновления настроек" });
    }
  });

  app.get("/api/ai-rop/goal-readiness", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const settings = await storage.getOrCreateAiSettings(tenantId);
      const goal = settings.goal || "CLOSE_DEAL";

      const checks: Array<{ label: string; passed: boolean; detail?: string }> = [];
      let status: "READY" | "WARNING" | "BLOCKED" = "READY";
      let message = "Всё готово к работе";

      if (goal === "CLOSE_DEAL") {
        const kaspiResult = await pool.query(
          `SELECT * FROM kaspi_integrations WHERE tenant_id = $1 AND is_verified = true LIMIT 1`,
          [tenantId]
        );
        const kaspiOk = (kaspiResult.rows?.length || 0) > 0;
        checks.push({ label: "Kaspi интеграция активна", passed: kaspiOk, detail: kaspiOk ? "Подключено" : "Kaspi не подключён или не верифицирован" });

        const productsResult = await pool.query(
          `SELECT COUNT(*) as cnt FROM products WHERE tenant_id = $1 AND is_active = true`,
          [tenantId]
        );
        const productCount = parseInt(productsResult.rows[0]?.cnt || "0");
        checks.push({ label: "Товары в каталоге", passed: productCount > 0, detail: `${productCount} товаров` });

        if (!kaspiOk) status = "WARNING";
        if (productCount === 0) status = "BLOCKED";
      } else if (goal === "QUALIFY_HANDOVER") {
        const crmResult = await pool.query(
          `SELECT COUNT(*) as cnt FROM crm_integrations WHERE tenant_id = $1`,
          [tenantId]
        );
        const telegramResult = await pool.query(
          `SELECT COUNT(*) as cnt FROM telegram_integrations WHERE tenant_id = $1`,
          [tenantId]
        );
        const wahaResult = await pool.query(
          `SELECT COUNT(*) as cnt FROM waha_instances WHERE tenant_id = $1`,
          [tenantId]
        );
        const hasCrm = parseInt(crmResult.rows[0]?.cnt || "0") > 0;
        const hasTelegram = parseInt(telegramResult.rows[0]?.cnt || "0") > 0;
        const hasWaha = parseInt(wahaResult.rows[0]?.cnt || "0") > 0;
        const hasAnyChannel = hasCrm || hasTelegram || hasWaha;

        checks.push({ label: "CRM или канал подключён", passed: hasAnyChannel, detail: hasAnyChannel ? "Каналы настроены" : "Нет подключённых каналов для передачи" });

        if (!hasAnyChannel) status = "WARNING";
      } else if (goal === "CONSULT_MATCH") {
        const totalResult = await pool.query(
          `SELECT COUNT(*) as cnt FROM products WHERE tenant_id = $1 AND is_active = true`,
          [tenantId]
        );
        const withImagesResult = await pool.query(
          `SELECT COUNT(*) as cnt FROM products WHERE tenant_id = $1 AND is_active = true AND main_image_url IS NOT NULL`,
          [tenantId]
        );
        const withDescResult = await pool.query(
          `SELECT COUNT(*) as cnt FROM products WHERE tenant_id = $1 AND is_active = true AND description IS NOT NULL AND description != ''`,
          [tenantId]
        );
        const total = parseInt(totalResult.rows[0]?.cnt || "0");
        const withImages = parseInt(withImagesResult.rows[0]?.cnt || "0");
        const withDesc = parseInt(withDescResult.rows[0]?.cnt || "0");

        checks.push({ label: "Товары в каталоге", passed: total > 0, detail: `${total} товаров` });
        checks.push({ label: "Товары с изображениями", passed: withImages > 0, detail: `${withImages}/${total}` });
        checks.push({ label: "Товары с описаниями", passed: withDesc > 0, detail: `${withDesc}/${total}` });

        if (total === 0) status = "BLOCKED";
        else if (withImages < total / 2 || withDesc < total / 2) status = "WARNING";
      } else if (goal === "ORDER_NO_PAYMENT") {
        const productsResult = await pool.query(
          `SELECT COUNT(*) as cnt FROM products WHERE tenant_id = $1 AND is_active = true`,
          [tenantId]
        );
        const productCount = parseInt(productsResult.rows[0]?.cnt || "0");
        checks.push({ label: "Товары для заказа", passed: productCount > 0, detail: `${productCount} товаров` });

        if (productCount === 0) status = "BLOCKED";
      }

      if (status === "BLOCKED") message = "Есть блокирующие проблемы — AI не сможет работать корректно";
      else if (status === "WARNING") message = "Есть предупреждения, но AI может работать";

      res.json({ status, checks, message, goal });
    } catch (error: any) {
      console.error("Ошибка проверки готовности:", error);
      res.status(500).json({ message: "Ошибка проверки готовности" });
    }
  });

  // ========================
  // 2. Handover Rules CRUD
  // ========================

  app.get("/api/ai-rop/handover-rules", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const rules = await db.select().from(handoverRules)
        .where(eq(handoverRules.tenantId, tenantId))
        .orderBy(desc(handoverRules.createdAt));
      res.json(rules);
    } catch (error: any) {
      console.error("Ошибка получения правил передачи:", error);
      res.status(500).json({ message: "Ошибка получения правил передачи" });
    }
  });

  app.post("/api/ai-rop/handover-rules", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const [rule] = await db.insert(handoverRules)
        .values({ ...req.body, tenantId })
        .returning();
      res.json(rule);
    } catch (error: any) {
      console.error("Ошибка создания правила передачи:", error);
      res.status(500).json({ message: "Ошибка создания правила передачи" });
    }
  });

  app.put("/api/ai-rop/handover-rules/:id", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { id } = req.params;
      const [rule] = await db.update(handoverRules)
        .set({ ...req.body, updatedAt: new Date() })
        .where(and(eq(handoverRules.id, id), eq(handoverRules.tenantId, tenantId)))
        .returning();
      if (!rule) return res.status(404).json({ message: "Правило не найдено" });
      res.json(rule);
    } catch (error: any) {
      console.error("Ошибка обновления правила передачи:", error);
      res.status(500).json({ message: "Ошибка обновления правила передачи" });
    }
  });

  app.delete("/api/ai-rop/handover-rules/:id", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { id } = req.params;
      await db.delete(handoverRules)
        .where(and(eq(handoverRules.id, id), eq(handoverRules.tenantId, tenantId)));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Ошибка удаления правила передачи:", error);
      res.status(500).json({ message: "Ошибка удаления правила передачи" });
    }
  });

  // ========================
  // 3. Knowledge Items CRUD
  // ========================

  app.get("/api/ai-rop/knowledge-items", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const items = await db.select().from(knowledgeItems)
        .where(eq(knowledgeItems.tenantId, tenantId))
        .orderBy(desc(knowledgeItems.createdAt));
      res.json(items);
    } catch (error: any) {
      console.error("Ошибка получения базы знаний:", error);
      res.status(500).json({ message: "Ошибка получения базы знаний" });
    }
  });

  app.post("/api/ai-rop/knowledge-items", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const [item] = await db.insert(knowledgeItems)
        .values({ ...req.body, tenantId })
        .returning();
      res.json(item);
    } catch (error: any) {
      console.error("Ошибка создания записи базы знаний:", error);
      res.status(500).json({ message: "Ошибка создания записи базы знаний" });
    }
  });

  app.put("/api/ai-rop/knowledge-items/:id", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { id } = req.params;
      const [item] = await db.update(knowledgeItems)
        .set({ ...req.body, updatedAt: new Date() })
        .where(and(eq(knowledgeItems.id, id), eq(knowledgeItems.tenantId, tenantId)))
        .returning();
      if (!item) return res.status(404).json({ message: "Запись не найдена" });
      res.json(item);
    } catch (error: any) {
      console.error("Ошибка обновления записи базы знаний:", error);
      res.status(500).json({ message: "Ошибка обновления записи базы знаний" });
    }
  });

  app.delete("/api/ai-rop/knowledge-items/:id", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { id } = req.params;
      await db.delete(knowledgeItems)
        .where(and(eq(knowledgeItems.id, id), eq(knowledgeItems.tenantId, tenantId)));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Ошибка удаления записи базы знаний:", error);
      res.status(500).json({ message: "Ошибка удаления записи базы знаний" });
    }
  });

  // ========================
  // 4. Training Items
  // ========================

  app.get("/api/ai-rop/training-items", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
      const offset = parseInt(req.query.offset as string) || 0;

      const items = await db.select().from(trainingItems)
        .where(eq(trainingItems.tenantId, tenantId))
        .orderBy(desc(trainingItems.createdAt))
        .limit(limit)
        .offset(offset);

      const [{ cnt }] = await db.select({ cnt: sql<number>`count(*)` }).from(trainingItems)
        .where(eq(trainingItems.tenantId, tenantId));

      res.json({ items, total: Number(cnt), limit, offset });
    } catch (error: any) {
      console.error("Ошибка получения обучающих записей:", error);
      res.status(500).json({ message: "Ошибка получения обучающих записей" });
    }
  });

  app.post("/api/ai-rop/training-items", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { userMessage, aiOriginal, aiCorrected, stage, source } = req.body;
      const [item] = await db.insert(trainingItems)
        .values({ tenantId, userMessage, aiOriginal, aiCorrected, stage, source: source || "MANUAL" })
        .returning();
      res.json(item);
    } catch (error: any) {
      console.error("Ошибка создания обучающей записи:", error);
      res.status(500).json({ message: "Ошибка создания обучающей записи" });
    }
  });

  app.put("/api/ai-rop/training-items/:id/apply", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { id } = req.params;
      const [item] = await db.update(trainingItems)
        .set({ applied: true })
        .where(and(eq(trainingItems.id, id), eq(trainingItems.tenantId, tenantId)))
        .returning();
      if (!item) return res.status(404).json({ message: "Запись не найдена" });
      res.json(item);
    } catch (error: any) {
      console.error("Ошибка применения обучающей записи:", error);
      res.status(500).json({ message: "Ошибка применения обучающей записи" });
    }
  });

  app.delete("/api/ai-rop/training-items/:id", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { id } = req.params;
      await db.delete(trainingItems)
        .where(and(eq(trainingItems.id, id), eq(trainingItems.tenantId, tenantId)));
      res.json({ success: true });
    } catch (error: any) {
      console.error("Ошибка удаления обучающей записи:", error);
      res.status(500).json({ message: "Ошибка удаления обучающей записи" });
    }
  });

  // ========================
  // 5. Analytics / KPI
  // ========================

  app.get("/api/ai-rop/analytics/kpi", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const from = req.query.from ? new Date(req.query.from as string) : todayStart;
      const to = req.query.to ? new Date(req.query.to as string) : now;

      const result = await pool.query(`
        SELECT
          COUNT(*)::int AS total_dialogs,
          COUNT(*) FILTER (WHERE success = true)::int AS successful_dialogs,
          COUNT(*) FILTER (WHERE success = false)::int AS failed_dialogs,
          COUNT(*) FILTER (WHERE stage_exit = 'handover' OR status = 'handoff')::int AS handovers,
          COUNT(*) FILTER (WHERE blocker_flag = true)::int AS blocker_count
        FROM ai_conversations
        WHERE tenant_id = $1 AND created_at >= $2 AND created_at <= $3
      `, [tenantId, from.toISOString(), to.toISOString()]);

      const avgResult = await pool.query(`
        SELECT COALESCE(AVG(msg_count), 0)::float AS avg_dialog_length
        FROM (
          SELECT c.id, COUNT(m.id) AS msg_count
          FROM ai_conversations c
          LEFT JOIN ai_messages m ON m.conversation_id = c.id
          WHERE c.tenant_id = $1 AND c.created_at >= $2 AND c.created_at <= $3
          GROUP BY c.id
        ) sub
      `, [tenantId, from.toISOString(), to.toISOString()]);

      const kpi = result.rows[0] || {};
      kpi.avg_dialog_length = parseFloat(avgResult.rows[0]?.avg_dialog_length || "0");

      res.json(kpi);
    } catch (error: any) {
      console.error("Ошибка получения KPI:", error);
      res.status(500).json({ message: "Ошибка получения KPI" });
    }
  });

  app.get("/api/ai-rop/analytics/funnel", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const from = req.query.from ? new Date(req.query.from as string) : todayStart;
      const to = req.query.to ? new Date(req.query.to as string) : now;

      const stages = [
        "greeting", "need_detection", "product_offer", "objection_handling",
        "closing_attempt", "order_created", "payment", "handover",
      ];

      const result = await pool.query(`
        SELECT stage_label, COUNT(DISTINCT conversation_id)::int AS cnt
        FROM ai_messages m
        JOIN ai_conversations c ON c.id = m.conversation_id
        WHERE c.tenant_id = $1 AND m.created_at >= $2 AND m.created_at <= $3
          AND stage_label IS NOT NULL
        GROUP BY stage_label
      `, [tenantId, from.toISOString(), to.toISOString()]);

      const countMap: Record<string, number> = {};
      for (const row of result.rows) {
        countMap[row.stage_label] = row.cnt;
      }

      const funnel = stages.map((stage, i) => {
        const count = countMap[stage] || 0;
        const nextCount = i < stages.length - 1 ? (countMap[stages[i + 1]] || 0) : count;
        const dropOffRate = count > 0 ? Math.round(((count - nextCount) / count) * 100) : 0;
        return { stage, count, dropOffRate };
      });

      res.json(funnel);
    } catch (error: any) {
      console.error("Ошибка получения воронки:", error);
      res.status(500).json({ message: "Ошибка получения воронки" });
    }
  });

  // ========================
  // 6. AI Settings History / Versioning
  // ========================

  app.get("/api/ai-rop/settings-history", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const history = await db.select().from(aiSettingsHistory)
        .where(eq(aiSettingsHistory.tenantId, tenantId))
        .orderBy(desc(aiSettingsHistory.createdAt))
        .limit(10);
      res.json(history);
    } catch (error: any) {
      console.error("Ошибка получения истории настроек:", error);
      res.status(500).json({ message: "Ошибка получения истории настроек" });
    }
  });

  app.post("/api/ai-rop/settings-history/:id/rollback", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { id } = req.params;

      const [historyEntry] = await db.select().from(aiSettingsHistory)
        .where(and(eq(aiSettingsHistory.id, id), eq(aiSettingsHistory.tenantId, tenantId)));

      if (!historyEntry) return res.status(404).json({ message: "Версия не найдена" });

      const snapshot = historyEntry.settingsSnapshot as Record<string, any>;
      if (!snapshot) return res.status(400).json({ message: "Снимок настроек пуст" });

      const current = await storage.getOrCreateAiSettings(tenantId);
      const newVersion = (current.versionNumber || 1) + 1;

      await db.insert(aiSettingsHistory).values({
        tenantId,
        versionNumber: current.versionNumber || 1,
        settingsSnapshot: {
          enabled: current.enabled,
          language: current.language,
          tone: current.tone,
          goal: current.goal,
          temperature: current.temperature,
          typingDelay: current.typingDelay,
          workingHoursJson: current.workingHoursJson,
          fallbackHandoffText: current.fallbackHandoffText,
          systemPromptCustom: current.systemPromptCustom,
          isActive: current.isActive,
        },
        changedBy: req.user!.id,
        changeReason: `Откат к версии #${historyEntry.versionNumber}`,
      });

      const [updated] = await db.update(aiSettings)
        .set({
          enabled: snapshot.enabled ?? current.enabled,
          language: snapshot.language ?? current.language,
          tone: snapshot.tone ?? current.tone,
          goal: snapshot.goal ?? current.goal,
          temperature: snapshot.temperature ?? current.temperature,
          typingDelay: snapshot.typingDelay ?? current.typingDelay,
          workingHoursJson: snapshot.workingHoursJson ?? current.workingHoursJson,
          fallbackHandoffText: snapshot.fallbackHandoffText ?? current.fallbackHandoffText,
          systemPromptCustom: snapshot.systemPromptCustom ?? current.systemPromptCustom,
          isActive: snapshot.isActive ?? current.isActive,
          versionNumber: newVersion,
          updatedAt: new Date(),
        })
        .where(eq(aiSettings.tenantId, tenantId))
        .returning();

      res.json(updated);
    } catch (error: any) {
      console.error("Ошибка отката настроек:", error);
      res.status(500).json({ message: "Ошибка отката настроек" });
    }
  });

  // ========================
  // 7. AI Audit
  // ========================

  app.post("/api/ai-rop/audit/run", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const from = req.body.from ? new Date(req.body.from) : todayStart;
      const to = req.body.to ? new Date(req.body.to) : now;

      const stageExitResult = await pool.query(`
        SELECT stage_exit, COUNT(*)::int AS cnt
        FROM ai_conversations
        WHERE tenant_id = $1 AND created_at >= $2 AND created_at <= $3
          AND stage_exit IS NOT NULL
        GROUP BY stage_exit
        ORDER BY cnt DESC
      `, [tenantId, from.toISOString(), to.toISOString()]);

      const totalResult = await pool.query(`
        SELECT
          COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE success = true)::int AS successful,
          COUNT(*) FILTER (WHERE success = false)::int AS failed,
          COUNT(*) FILTER (WHERE blocker_flag = true)::int AS blockers
        FROM ai_conversations
        WHERE tenant_id = $1 AND created_at >= $2 AND created_at <= $3
      `, [tenantId, from.toISOString(), to.toISOString()]);

      const stats = totalResult.rows[0] || { total: 0, successful: 0, failed: 0, blockers: 0 };
      const stageExits = stageExitResult.rows;

      const recommendations: Array<{ problem: string; suggestion: string; estimatedImpact: string; type: string }> = [];

      if (stats.total > 0 && stats.failed / stats.total > 0.3) {
        recommendations.push({
          problem: `${Math.round((stats.failed / stats.total) * 100)}% диалогов завершаются неуспешно`,
          suggestion: "Проверьте базу знаний и добавьте ответы на частые вопросы клиентов",
          estimatedImpact: "Снижение неуспешных диалогов на 15-20%",
          type: "knowledge",
        });
      }

      if (stats.blockers > 0) {
        recommendations.push({
          problem: `Обнаружено ${stats.blockers} диалогов с блокировками`,
          suggestion: "Проанализируйте блокирующие сценарии и добавьте обработку в правила передачи",
          estimatedImpact: "Уменьшение потерянных клиентов",
          type: "handover",
        });
      }

      const topDropOff = stageExits.find((s: any) => s.stage_exit !== "order_created" && s.stage_exit !== "payment");
      if (topDropOff) {
        recommendations.push({
          problem: `Наибольший отток на этапе "${topDropOff.stage_exit}" (${topDropOff.cnt} диалогов)`,
          suggestion: "Улучшите скрипт продаж для этого этапа, добавьте обработку возражений",
          estimatedImpact: "Рост конверсии на 10-15%",
          type: "sales_script",
        });
      }

      const kiResult = await pool.query(`
        SELECT COUNT(*)::int AS cnt FROM knowledge_items WHERE tenant_id = $1 AND is_active = true
      `, [tenantId]);
      const knowledgeCount = kiResult.rows[0]?.cnt || 0;

      if (knowledgeCount < 5) {
        recommendations.push({
          problem: `В базе знаний всего ${knowledgeCount} записей`,
          suggestion: "Добавьте больше статей: информацию о доставке, оплате, гарантиях, частых вопросах",
          estimatedImpact: "Улучшение качества ответов AI на 20-30%",
          type: "knowledge",
        });
      }

      if (recommendations.length === 0) {
        recommendations.push({
          problem: "Серьёзных проблем не обнаружено",
          suggestion: "Продолжайте следить за аналитикой и регулярно обновлять базу знаний",
          estimatedImpact: "Поддержание текущего уровня качества",
          type: "general",
        });
      }

      const summaryJson = {
        totalDialogs: stats.total,
        successful: stats.successful,
        failed: stats.failed,
        blockers: stats.blockers,
        stageExits,
      };

      const [report] = await db.insert(aiAuditReports).values({
        tenantId,
        periodStart: from,
        periodEnd: to,
        summaryJson,
        recommendationsJson: recommendations,
      }).returning();

      res.json(report);
    } catch (error: any) {
      console.error("Ошибка запуска аудита:", error);
      res.status(500).json({ message: "Ошибка запуска аудита" });
    }
  });

  app.get("/api/ai-rop/audit/reports", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const reports = await db.select().from(aiAuditReports)
        .where(eq(aiAuditReports.tenantId, tenantId))
        .orderBy(desc(aiAuditReports.createdAt))
        .limit(20);
      res.json(reports);
    } catch (error: any) {
      console.error("Ошибка получения отчётов аудита:", error);
      res.status(500).json({ message: "Ошибка получения отчётов аудита" });
    }
  });

  // ========================
  // 8. Test Chat
  // ========================

  app.post("/api/ai-rop/test-chat", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { message, conversationId } = req.body;

      if (!message || typeof message !== "string") {
        return res.status(400).json({ message: "Сообщение обязательно" });
      }

      let convId = conversationId;

      if (!convId) {
        const [conv] = await db.insert(aiConversations).values({
          tenantId,
          channel: "sandbox",
          visitorId: `sandbox-${req.user!.id}`,
          status: "open",
        }).returning();
        convId = conv.id;
      }

      await db.insert(aiMessages).values({
        conversationId: convId,
        role: "user",
        content: message,
      });

      const history = await db.select().from(aiMessages)
        .where(eq(aiMessages.conversationId, convId))
        .orderBy(aiMessages.createdAt);

      const conversationHistory = history.map(m => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      }));

      const tenant = await storage.getTenant(tenantId);
      const tenantProducts = await storage.getProducts(tenantId);
      const settings = await storage.getOrCreateAiSettings(tenantId);

      const context = {
        storeName: tenant?.name || "Магазин",
        slug: tenant?.slug || "",
        storeDescription: tenant?.description || undefined,
        contactPhone: tenant?.contactPhone || undefined,
        tone: settings.tone || "friendly",
        aiLanguages: tenant?.aiLanguages || ["ru"],
        aiSystemPrompt: settings.systemPromptCustom || tenant?.aiSystemPrompt || undefined,
        products: tenantProducts.slice(0, 20).map((p: any) => ({
          name: p.name,
          price: parseFloat(p.price),
          description: p.description || undefined,
        })),
      };

      const aiResult = await generateAiResponse(message, conversationHistory.slice(0, -1), context);

      const stageLabel = detectStageFromContent(message, aiResult.content);

      const [aiMsg] = await db.insert(aiMessages).values({
        conversationId: convId,
        role: "assistant",
        content: aiResult.content,
        tagMatched: aiResult.matchedTag || null,
        stageLabel,
      }).returning();

      res.json({
        conversationId: convId,
        message: aiResult.content,
        matchedTag: aiResult.matchedTag,
        stageLabel,
        messageId: aiMsg.id,
      });
    } catch (error: any) {
      console.error("Ошибка тестового чата:", error);
      res.status(500).json({ message: "Ошибка AI-ответа" });
    }
  });

  // ========================
  // 9. Onboarding
  // ========================

  app.get("/api/ai-rop/onboarding/status", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const settings = await storage.getOrCreateAiSettings(tenantId);
      res.json({ completed: settings.onboardingCompleted, step: settings.onboardingStep });
    } catch (error: any) {
      console.error("Ошибка получения статуса онбординга:", error);
      res.status(500).json({ message: "Ошибка получения статуса онбординга" });
    }
  });

  app.post("/api/ai-rop/onboarding/complete", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const userId = req.user!.id;
      const { goal, tone, objections, handoverRules: hrRules, customToneText } = req.body;

      const current = await storage.getOrCreateAiSettings(tenantId);
      const newVersion = (current.versionNumber || 1) + 1;

      await db.insert(aiSettingsHistory).values({
        tenantId,
        versionNumber: current.versionNumber || 1,
        settingsSnapshot: {
          enabled: current.enabled,
          language: current.language,
          tone: current.tone,
          goal: current.goal,
          temperature: current.temperature,
          typingDelay: current.typingDelay,
          workingHoursJson: current.workingHoursJson,
          fallbackHandoffText: current.fallbackHandoffText,
          systemPromptCustom: current.systemPromptCustom,
          isActive: current.isActive,
        },
        changedBy: userId,
        changeReason: "Онбординг завершён",
      });

      const updateData: Record<string, any> = {
        goal,
        tone,
        objectionsJson: objections,
        onboardingCompleted: true,
        onboardingStep: 6,
        versionNumber: newVersion,
        updatedAt: new Date(),
      };
      if (tone === "custom" && customToneText) {
        updateData.systemPromptCustom = customToneText;
      }

      const [updated] = await db.update(aiSettings)
        .set(updateData)
        .where(eq(aiSettings.tenantId, tenantId))
        .returning();

      if (Array.isArray(hrRules)) {
        for (const rule of hrRules) {
          await db.insert(handoverRules).values({
            tenantId,
            ruleType: rule.ruleType,
            thresholdValue: rule.thresholdValue || null,
          });
        }
      }

      res.json(updated);
    } catch (error: any) {
      console.error("Ошибка завершения онбординга:", error);
      res.status(500).json({ message: "Ошибка завершения онбординга" });
    }
  });

  // ========================
  // 10. Catalog Summary
  // ========================

  app.get("/api/ai-rop/catalog-summary", requireAuth, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;

      const productsResult = await pool.query(
        `SELECT COUNT(*)::int as cnt FROM products WHERE tenant_id = $1`,
        [tenantId]
      );
      const categoriesResult = await pool.query(
        `SELECT COUNT(*)::int as cnt FROM categories WHERE tenant_id = $1`,
        [tenantId]
      );
      const avgPriceResult = await pool.query(
        `SELECT COALESCE(AVG(price::numeric), 0)::float as avg FROM products WHERE tenant_id = $1`,
        [tenantId]
      );
      const promoResult = await pool.query(
        `SELECT COUNT(*)::int as cnt FROM promotions WHERE tenant_id = $1 AND is_active = true`,
        [tenantId]
      );
      const kaspiResult = await pool.query(
        `SELECT COUNT(*)::int as cnt FROM kaspi_integrations WHERE tenant_id = $1 AND is_verified = true`,
        [tenantId]
      );

      res.json({
        productsCount: productsResult.rows[0]?.cnt || 0,
        categoriesCount: categoriesResult.rows[0]?.cnt || 0,
        avgPrice: parseFloat(avgPriceResult.rows[0]?.avg || "0"),
        promoZoneActive: (promoResult.rows[0]?.cnt || 0) > 0,
        paymentsReady: (kaspiResult.rows[0]?.cnt || 0) > 0,
      });
    } catch (error: any) {
      console.error("Ошибка получения сводки каталога:", error);
      res.status(500).json({ message: "Ошибка получения сводки каталога" });
    }
  });

  // ========================
  // 11. Analytics Summary & Dropoffs
  // ========================

  app.get("/api/ai-rop/analytics/summary", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const period = (req.query.period as string) || "30d";
      const now = new Date();
      let from: Date;

      switch (period) {
        case "today":
          from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case "7d":
          from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "90d":
          from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      const result = await pool.query(`
        SELECT
          COUNT(*)::int AS total_dialogs,
          COUNT(*) FILTER (WHERE success = true)::int AS successful_dialogs,
          COUNT(*) FILTER (WHERE success = false)::int AS failed_dialogs,
          COUNT(*) FILTER (WHERE stage_exit = 'handover' OR status = 'handoff')::int AS handover_count
        FROM ai_conversations
        WHERE tenant_id = $1 AND created_at >= $2 AND created_at <= $3
      `, [tenantId, from.toISOString(), now.toISOString()]);

      const avgResult = await pool.query(`
        SELECT COALESCE(AVG(msg_count), 0)::float AS avg_messages
        FROM (
          SELECT c.id, COUNT(m.id) AS msg_count
          FROM ai_conversations c
          LEFT JOIN ai_messages m ON m.conversation_id = c.id
          WHERE c.tenant_id = $1 AND c.created_at >= $2 AND c.created_at <= $3
          GROUP BY c.id
        ) sub
      `, [tenantId, from.toISOString(), now.toISOString()]);

      const row = result.rows[0] || {};
      const totalDialogs = row.total_dialogs || 0;
      const successfulDialogs = row.successful_dialogs || 0;
      const conversionRate = totalDialogs > 0 ? Math.round((successfulDialogs / totalDialogs) * 100) : 0;

      res.json({
        totalDialogs,
        successfulDialogs,
        failedDialogs: row.failed_dialogs || 0,
        handoverCount: row.handover_count || 0,
        conversionRate,
        avgMessagesPerDialog: parseFloat(avgResult.rows[0]?.avg_messages || "0"),
      });
    } catch (error: any) {
      console.error("Ошибка получения аналитики:", error);
      res.status(500).json({ message: "Ошибка получения аналитики" });
    }
  });

  app.get("/api/ai-rop/analytics/dropoffs", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const period = (req.query.period as string) || "30d";
      const now = new Date();
      let from: Date;

      switch (period) {
        case "today":
          from = new Date(now.getFullYear(), now.getMonth(), now.getDate());
          break;
        case "7d":
          from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case "90d":
          from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        default:
          from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      const totalResult = await pool.query(`
        SELECT COUNT(*)::int AS total
        FROM ai_conversations
        WHERE tenant_id = $1 AND created_at >= $2 AND created_at <= $3
          AND stage_exit IS NOT NULL
      `, [tenantId, from.toISOString(), now.toISOString()]);

      const total = totalResult.rows[0]?.total || 0;

      const stagesResult = await pool.query(`
        SELECT stage_exit AS stage, COUNT(*)::int AS count
        FROM ai_conversations
        WHERE tenant_id = $1 AND created_at >= $2 AND created_at <= $3
          AND stage_exit IS NOT NULL
        GROUP BY stage_exit
        ORDER BY count DESC
      `, [tenantId, from.toISOString(), now.toISOString()]);

      const dropoffs = stagesResult.rows.map((row: any) => ({
        stage: row.stage,
        count: row.count,
        percentage: total > 0 ? Math.round((row.count / total) * 100) : 0,
      }));

      res.json(dropoffs);
    } catch (error: any) {
      console.error("Ошибка получения дропоффов:", error);
      res.status(500).json({ message: "Ошибка получения дропоффов" });
    }
  });

  // ========================
  // 12. Recommendations
  // ========================

  app.post("/api/ai-rop/recommendations/apply", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const userId = req.user!.id;
      const { problem, suggestion, type } = req.body;

      const current = await storage.getOrCreateAiSettings(tenantId);
      const newVersion = (current.versionNumber || 1) + 1;

      await db.insert(aiSettingsHistory).values({
        tenantId,
        versionNumber: current.versionNumber || 1,
        settingsSnapshot: {
          enabled: current.enabled,
          language: current.language,
          tone: current.tone,
          goal: current.goal,
          temperature: current.temperature,
          typingDelay: current.typingDelay,
          workingHoursJson: current.workingHoursJson,
          fallbackHandoffText: current.fallbackHandoffText,
          systemPromptCustom: current.systemPromptCustom,
          isActive: current.isActive,
        },
        changedBy: userId,
        changeReason: `Рекомендация применена: ${problem}`,
      });

      await db.update(aiSettings)
        .set({ versionNumber: newVersion, updatedAt: new Date() })
        .where(eq(aiSettings.tenantId, tenantId));

      if (type === "knowledge") {
        console.log(`[AI-ROP] Recommendation applied (knowledge): ${suggestion} for tenant ${tenantId}`);
      } else if (type === "handover") {
        console.log(`[AI-ROP] Recommendation applied (handover): ${suggestion} for tenant ${tenantId}`);
      } else {
        console.log(`[AI-ROP] Recommendation applied (${type}): ${suggestion} for tenant ${tenantId}`);
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Ошибка применения рекомендации:", error);
      res.status(500).json({ message: "Ошибка применения рекомендации" });
    }
  });

  app.post("/api/ai-rop/recommendations/ignore", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      res.json({ success: true });
    } catch (error: any) {
      console.error("Ошибка игнорирования рекомендации:", error);
      res.status(500).json({ message: "Ошибка игнорирования рекомендации" });
    }
  });

  // ========================
  // 13. Test Chat Training
  // ========================

  app.post("/api/ai-rop/test-chat/train", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { messageId, action, correctedText } = req.body;

      if (action === "fix_only") {
        await db.update(aiMessages)
          .set({ content: correctedText })
          .where(eq(aiMessages.id, messageId));
      } else if (action === "train_future") {
        const [currentMsg] = await db.select().from(aiMessages)
          .where(eq(aiMessages.id, messageId));
        if (!currentMsg) return res.status(404).json({ message: "Сообщение не найдено" });

        const prevMessages = await db.select().from(aiMessages)
          .where(and(
            eq(aiMessages.conversationId, currentMsg.conversationId),
            eq(aiMessages.role, "user"),
          ))
          .orderBy(desc(aiMessages.createdAt))
          .limit(1);

        const userMessage = prevMessages[0]?.content || "";

        await db.insert(trainingItems).values({
          tenantId,
          userMessage,
          aiOriginal: currentMsg.content,
          aiCorrected: correctedText || currentMsg.content,
          source: "TEST_CHAT",
        });
      } else if (action === "add_knowledge") {
        await db.insert(knowledgeItems).values({
          tenantId,
          category: "general",
          question: "",
          answer: correctedText || "",
          source: "TEST_CHAT",
        });
      } else if (action === "anti_pattern") {
        const [currentMsg] = await db.select().from(aiMessages)
          .where(eq(aiMessages.id, messageId));
        if (!currentMsg) return res.status(404).json({ message: "Сообщение не найдено" });

        const prevMessages = await db.select().from(aiMessages)
          .where(and(
            eq(aiMessages.conversationId, currentMsg.conversationId),
            eq(aiMessages.role, "user"),
          ))
          .orderBy(desc(aiMessages.createdAt))
          .limit(1);

        const userMessage = prevMessages[0]?.content || "";

        await db.insert(trainingItems).values({
          tenantId,
          userMessage,
          aiOriginal: currentMsg.content,
          aiCorrected: correctedText || "",
          source: "ANTI_PATTERN",
        });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Ошибка обучения из тест-чата:", error);
      res.status(500).json({ message: "Ошибка обучения" });
    }
  });
}

function detectStageFromContent(userMessage: string, aiResponse: string): string | null {
  const lower = (userMessage + " " + aiResponse).toLowerCase();
  if (lower.includes("оплат") || lower.includes("kaspi") || lower.includes("каспи")) return "payment";
  if (lower.includes("заказ") && (lower.includes("оформ") || lower.includes("создан"))) return "order_created";
  if (lower.includes("возражен") || lower.includes("дорого") || lower.includes("сомнев")) return "objection_handling";
  if (lower.includes("закры") || lower.includes("купить") || lower.includes("оформить")) return "closing_attempt";
  if (lower.includes("товар") || lower.includes("предлож") || lower.includes("рекоменд")) return "product_offer";
  if (lower.includes("нужн") || lower.includes("ищу") || lower.includes("хочу") || lower.includes("подобр")) return "need_detection";
  if (lower.includes("привет") || lower.includes("здравств") || lower.includes("добрый")) return "greeting";
  if (lower.includes("менеджер") || lower.includes("оператор") || lower.includes("человек")) return "handover";
  return null;
}
