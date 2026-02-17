import type { Express, Request, Response } from "express";
import { db } from "./db";
import { eq, and, sql, desc, gte, lte, count, inArray } from "drizzle-orm";
import {
  growthCampaigns, growthContacts, growthQueue, growthEvents,
  insertGrowthCampaignSchema, insertGrowthContactSchema,
} from "@shared/schema";
import { messagingProvider } from "./services/messagingProvider";

export function registerGrowthRoutes(
  app: Express,
  storage: any,
  requireAuth: any,
  requireAiAccess: any
) {

  app.get("/api/ai-rop/growth/summary", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;

      const [contactsResult, campaignsResult, eventsResult] = await Promise.all([
        db.select({ count: count() }).from(growthContacts).where(eq(growthContacts.tenantId, tenantId)),
        db.select().from(growthCampaigns).where(eq(growthCampaigns.tenantId, tenantId)).orderBy(desc(growthCampaigns.createdAt)).limit(10),
        db.select().from(growthEvents).where(eq(growthEvents.tenantId, tenantId)).orderBy(desc(growthEvents.createdAt)).limit(20),
      ]);

      const totalContacts = contactsResult[0]?.count ?? 0;
      const campaigns = campaignsResult;
      const totalSent = campaigns.reduce((s, c) => s + c.totalSent, 0);
      const totalReplied = campaigns.reduce((s, c) => s + c.totalReplied, 0);
      const replyRate = totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0;

      const inactiveThreshold = new Date();
      inactiveThreshold.setDate(inactiveThreshold.getDate() - 14);
      const [candidatesResult] = await db.select({ count: count() }).from(growthContacts)
        .where(and(
          eq(growthContacts.tenantId, tenantId),
          eq(growthContacts.optOut, false),
          lte(growthContacts.lastInboundAt, inactiveThreshold),
        ));

      const reactivationCandidates = candidatesResult?.count ?? 0;

      const recentEvents = eventsResult.map(e => ({
        id: e.id,
        campaignId: e.campaignId,
        contactId: e.contactId,
        eventType: e.eventType,
        meta: e.meta,
        createdAt: e.createdAt,
      }));

      res.json({
        totalContacts,
        totalCampaigns: campaigns.length,
        totalSent,
        totalReplied,
        replyRate,
        reactivationCandidates,
        recentCampaigns: campaigns.map(c => ({
          id: c.id, name: c.name, type: c.type, status: c.status,
          totalQueued: c.totalQueued, totalSent: c.totalSent, totalReplied: c.totalReplied,
          createdAt: c.createdAt,
        })),
        recentEvents,
      });
    } catch (error) {
      console.error("Growth summary error:", error);
      res.status(500).json({ error: "Ошибка загрузки данных роста" });
    }
  });

  app.get("/api/ai-rop/growth/campaigns", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const type = req.query.type as string | undefined;

      let query = db.select().from(growthCampaigns)
        .where(type
          ? and(eq(growthCampaigns.tenantId, tenantId), eq(growthCampaigns.type, type))
          : eq(growthCampaigns.tenantId, tenantId)
        )
        .orderBy(desc(growthCampaigns.createdAt));

      const campaigns = await query;
      res.json(campaigns);
    } catch (error) {
      console.error("Growth campaigns list error:", error);
      res.status(500).json({ error: "Ошибка загрузки кампаний" });
    }
  });

  app.post("/api/ai-rop/growth/campaigns", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const userId = req.user!.id!;
      const body = req.body;

      const [campaign] = await db.insert(growthCampaigns).values({
        tenantId,
        type: body.type || "REACTIVATION",
        name: body.name || "Новая кампания",
        status: "DRAFT",
        channelPolicy: body.channelPolicy || "AUTO",
        audienceRules: body.audienceRules || {},
        messageRules: body.messageRules || {},
        scheduleRules: body.scheduleRules || { quietHoursStart: 22, quietHoursEnd: 8, timezone: "Asia/Almaty", dailyCap: 100 },
        safetyRules: body.safetyRules || { requirePriorInbound: true, respectOptOut: true },
        createdBy: userId,
      }).returning();

      res.json(campaign);
    } catch (error) {
      console.error("Growth campaign create error:", error);
      res.status(500).json({ error: "Ошибка создания кампании" });
    }
  });

  app.put("/api/ai-rop/growth/campaigns/:id", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { id } = req.params;
      const body = req.body;

      const [existing] = await db.select().from(growthCampaigns)
        .where(and(eq(growthCampaigns.id, id), eq(growthCampaigns.tenantId, tenantId)));
      if (!existing) return res.status(404).json({ error: "Кампания не найдена" });
      if (existing.status === "RUNNING") return res.status(400).json({ error: "Нельзя редактировать запущенную кампанию" });

      const updateData: any = { updatedAt: new Date() };
      if (body.name !== undefined) updateData.name = body.name;
      if (body.channelPolicy !== undefined) updateData.channelPolicy = body.channelPolicy;
      if (body.audienceRules !== undefined) updateData.audienceRules = body.audienceRules;
      if (body.messageRules !== undefined) updateData.messageRules = body.messageRules;
      if (body.scheduleRules !== undefined) updateData.scheduleRules = body.scheduleRules;
      if (body.safetyRules !== undefined) updateData.safetyRules = body.safetyRules;
      if (body.status !== undefined) updateData.status = body.status;

      const [updated] = await db.update(growthCampaigns)
        .set(updateData)
        .where(and(eq(growthCampaigns.id, id), eq(growthCampaigns.tenantId, tenantId)))
        .returning();

      res.json(updated);
    } catch (error) {
      console.error("Growth campaign update error:", error);
      res.status(500).json({ error: "Ошибка обновления кампании" });
    }
  });

  app.get("/api/ai-rop/growth/campaigns/:id", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { id } = req.params;

      const [campaign] = await db.select().from(growthCampaigns)
        .where(and(eq(growthCampaigns.id, id), eq(growthCampaigns.tenantId, tenantId)));
      if (!campaign) return res.status(404).json({ error: "Кампания не найдена" });

      res.json(campaign);
    } catch (error) {
      console.error("Growth campaign detail error:", error);
      res.status(500).json({ error: "Ошибка загрузки кампании" });
    }
  });

  app.post("/api/ai-rop/growth/campaigns/:id/estimate", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { id } = req.params;

      const [campaign] = await db.select().from(growthCampaigns)
        .where(and(eq(growthCampaigns.id, id), eq(growthCampaigns.tenantId, tenantId)));
      if (!campaign) return res.status(404).json({ error: "Кампания не найдена" });

      const audience = await buildAudience(tenantId, campaign);
      const resolvedRecipients = [];
      let blocked = 0;
      const blockReasons: Record<string, number> = {};

      for (const contact of audience) {
        const resolution = await messagingProvider.resolveChannelForContact(
          tenantId, contact.id, campaign.channelPolicy
        );
        if (resolution.blocked) {
          blocked++;
          const reason = resolution.reason || "Неизвестная причина";
          blockReasons[reason] = (blockReasons[reason] || 0) + 1;
        } else {
          resolvedRecipients.push({
            contactId: contact.id,
            name: contact.name,
            channel: resolution.channel,
            provider: resolution.provider,
            address: resolution.address,
          });
        }
      }

      res.json({
        totalAudience: audience.length,
        eligible: resolvedRecipients.length,
        blocked,
        blockReasons,
        preview: resolvedRecipients.slice(0, 20),
      });
    } catch (error) {
      console.error("Growth estimate error:", error);
      res.status(500).json({ error: "Ошибка оценки аудитории" });
    }
  });

  app.post("/api/ai-rop/growth/campaigns/:id/preview", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { id } = req.params;

      const [campaign] = await db.select().from(growthCampaigns)
        .where(and(eq(growthCampaigns.id, id), eq(growthCampaigns.tenantId, tenantId)));
      if (!campaign) return res.status(404).json({ error: "Кампания не найдена" });

      const audience = await buildAudience(tenantId, campaign);
      const recipients: any[] = [];

      for (const contact of audience.slice(0, 20)) {
        const resolution = await messagingProvider.resolveChannelForContact(
          tenantId, contact.id, campaign.channelPolicy
        );
        recipients.push({
          contactId: contact.id,
          name: contact.name || contact.phone || "—",
          phone: contact.phone,
          channel: resolution.blocked ? null : resolution.channel,
          provider: resolution.blocked ? null : resolution.provider,
          status: resolution.blocked ? "SKIPPED" : "READY",
          reason: resolution.blocked ? resolution.reason : null,
        });
      }

      const connectedChannels = await getConnectedChannels(tenantId);

      res.json({
        totalAudience: audience.length,
        recipients,
        connectedChannels,
        safetyRules: campaign.safetyRules,
        scheduleRules: campaign.scheduleRules,
      });
    } catch (error) {
      console.error("Growth preview error:", error);
      res.status(500).json({ error: "Ошибка предпросмотра" });
    }
  });

  app.post("/api/ai-rop/growth/campaigns/:id/launch", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { id } = req.params;

      const [campaign] = await db.select().from(growthCampaigns)
        .where(and(eq(growthCampaigns.id, id), eq(growthCampaigns.tenantId, tenantId)));
      if (!campaign) return res.status(404).json({ error: "Кампания не найдена" });
      if (campaign.status !== "DRAFT" && campaign.status !== "READY")
        return res.status(400).json({ error: "Кампания не может быть запущена из текущего статуса" });

      const audience = await buildAudience(tenantId, campaign);
      const messageTemplate = (campaign.messageRules as any)?.text || "Здравствуйте, {name}!";
      const now = new Date();
      let queued = 0;
      let skipped = 0;

      for (const contact of audience) {
        const resolution = await messagingProvider.resolveChannelForContact(
          tenantId, contact.id, campaign.channelPolicy
        );

        if (resolution.blocked) {
          skipped++;
          await db.insert(growthEvents).values({
            tenantId, campaignId: id, contactId: contact.id,
            eventType: "SKIPPED", meta: { reason: resolution.reason },
          });
          continue;
        }

        const renderedText = renderMessage(messageTemplate, contact);

        await db.insert(growthQueue).values({
          tenantId, campaignId: id, contactId: contact.id,
          resolvedChannel: resolution.channel,
          status: "PENDING",
          plannedAt: now,
          payload: {
            text: renderedText,
            channel: resolution.channel,
            provider: resolution.provider,
            address: resolution.address,
          },
        });

        await db.insert(growthEvents).values({
          tenantId, campaignId: id, contactId: contact.id,
          eventType: "QUEUED",
        });
        queued++;
      }

      await db.update(growthCampaigns).set({
        status: "RUNNING",
        totalQueued: queued,
        totalSkipped: skipped,
        updatedAt: new Date(),
      }).where(eq(growthCampaigns.id, id));

      res.json({ success: true, queued, skipped, total: audience.length });
    } catch (error) {
      console.error("Growth launch error:", error);
      res.status(500).json({ error: "Ошибка запуска кампании" });
    }
  });

  app.post("/api/ai-rop/growth/campaigns/:id/pause", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { id } = req.params;

      const [campaign] = await db.select().from(growthCampaigns)
        .where(and(eq(growthCampaigns.id, id), eq(growthCampaigns.tenantId, tenantId)));
      if (!campaign) return res.status(404).json({ error: "Кампания не найдена" });
      if (campaign.status !== "RUNNING") return res.status(400).json({ error: "Кампания не запущена" });

      await db.update(growthCampaigns).set({ status: "PAUSED", updatedAt: new Date() })
        .where(eq(growthCampaigns.id, id));

      res.json({ success: true });
    } catch (error) {
      console.error("Growth pause error:", error);
      res.status(500).json({ error: "Ошибка паузы кампании" });
    }
  });

  app.post("/api/ai-rop/growth/campaigns/:id/resume", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { id } = req.params;

      const [campaign] = await db.select().from(growthCampaigns)
        .where(and(eq(growthCampaigns.id, id), eq(growthCampaigns.tenantId, tenantId)));
      if (!campaign) return res.status(404).json({ error: "Кампания не найдена" });
      if (campaign.status !== "PAUSED") return res.status(400).json({ error: "Кампания не на паузе" });

      await db.update(growthCampaigns).set({ status: "RUNNING", updatedAt: new Date() })
        .where(eq(growthCampaigns.id, id));

      res.json({ success: true });
    } catch (error) {
      console.error("Growth resume error:", error);
      res.status(500).json({ error: "Ошибка возобновления кампании" });
    }
  });

  app.get("/api/ai-rop/growth/campaigns/:id/queue", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { id } = req.params;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const offset = parseInt(req.query.offset as string) || 0;

      const items = await db.select({
        id: growthQueue.id,
        contactId: growthQueue.contactId,
        resolvedChannel: growthQueue.resolvedChannel,
        status: growthQueue.status,
        plannedAt: growthQueue.plannedAt,
        sentAt: growthQueue.sentAt,
        error: growthQueue.error,
        contactName: growthContacts.name,
        contactPhone: growthContacts.phone,
      })
        .from(growthQueue)
        .leftJoin(growthContacts, eq(growthQueue.contactId, growthContacts.id))
        .where(and(eq(growthQueue.tenantId, tenantId), eq(growthQueue.campaignId, id)))
        .orderBy(desc(growthQueue.createdAt))
        .limit(limit)
        .offset(offset);

      const [totalResult] = await db.select({ count: count() }).from(growthQueue)
        .where(and(eq(growthQueue.tenantId, tenantId), eq(growthQueue.campaignId, id)));

      res.json({ items, total: totalResult?.count ?? 0 });
    } catch (error) {
      console.error("Growth queue error:", error);
      res.status(500).json({ error: "Ошибка загрузки очереди" });
    }
  });

  app.get("/api/ai-rop/growth/campaigns/:id/analytics", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { id } = req.params;

      const [campaign] = await db.select().from(growthCampaigns)
        .where(and(eq(growthCampaigns.id, id), eq(growthCampaigns.tenantId, tenantId)));
      if (!campaign) return res.status(404).json({ error: "Кампания не найдена" });

      const events = await db.select().from(growthEvents)
        .where(and(eq(growthEvents.tenantId, tenantId), eq(growthEvents.campaignId, id)))
        .orderBy(desc(growthEvents.createdAt))
        .limit(100);

      const eventCounts: Record<string, number> = {};
      for (const e of events) {
        eventCounts[e.eventType] = (eventCounts[e.eventType] || 0) + 1;
      }

      res.json({
        campaign: {
          id: campaign.id, name: campaign.name, type: campaign.type, status: campaign.status,
          totalQueued: campaign.totalQueued, totalSent: campaign.totalSent,
          totalFailed: campaign.totalFailed, totalReplied: campaign.totalReplied,
          totalSkipped: campaign.totalSkipped,
        },
        eventCounts,
        recentEvents: events.slice(0, 20),
      });
    } catch (error) {
      console.error("Growth analytics error:", error);
      res.status(500).json({ error: "Ошибка аналитики" });
    }
  });

  app.post("/api/ai-rop/growth/test-send", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { contactId, text, channelPolicy } = req.body;

      if (!contactId || !text) {
        return res.status(400).json({ error: "contactId и text обязательны" });
      }

      const resolution = await messagingProvider.resolveChannelForContact(
        tenantId, contactId, channelPolicy || "AUTO"
      );

      if (resolution.blocked) {
        return res.json({ success: false, reason: resolution.reason });
      }

      const result = await messagingProvider.sendMessage({
        tenantId,
        channel: resolution.channel!,
        provider: resolution.provider!,
        to: resolution.address!,
        text,
        meta: { isTest: true },
      });

      res.json({ success: result.status === "SENT", ...result });
    } catch (error) {
      console.error("Growth test-send error:", error);
      res.status(500).json({ error: "Ошибка тестовой отправки" });
    }
  });

  app.get("/api/ai-rop/growth/contacts", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
      const offset = parseInt(req.query.offset as string) || 0;

      const contacts = await db.select().from(growthContacts)
        .where(eq(growthContacts.tenantId, tenantId))
        .orderBy(desc(growthContacts.updatedAt))
        .limit(limit).offset(offset);

      const [totalResult] = await db.select({ count: count() }).from(growthContacts)
        .where(eq(growthContacts.tenantId, tenantId));

      res.json({ contacts, total: totalResult?.count ?? 0 });
    } catch (error) {
      console.error("Growth contacts error:", error);
      res.status(500).json({ error: "Ошибка загрузки контактов" });
    }
  });
}

function renderMessage(template: string, contact: any): string {
  return template
    .replace(/\{name\}/g, contact.name || "")
    .replace(/\{phone\}/g, contact.phone || "")
    .replace(/\{last_product\}/g, (contact.meta as any)?.lastProduct || "")
    .replace(/\{category_interest\}/g, (contact.meta as any)?.categoryInterest || "")
    .replace(/\{discount\}/g, (contact.meta as any)?.discount || "")
    .replace(/\{installment\}/g, (contact.meta as any)?.installment || "");
}

async function buildAudience(tenantId: string, campaign: any): Promise<any[]> {
  const rules = (campaign.audienceRules || {}) as any;
  const safety = (campaign.safetyRules || {}) as any;

  let conditions = [eq(growthContacts.tenantId, tenantId)];

  if (safety.respectOptOut !== false) {
    conditions.push(eq(growthContacts.optOut, false));
  }

  if (safety.requirePriorInbound !== false && rules.minLastInboundDays !== 0) {
    conditions.push(sql`${growthContacts.lastInboundAt} IS NOT NULL`);
  }

  if (rules.inactiveDays) {
    const threshold = new Date();
    threshold.setDate(threshold.getDate() - rules.inactiveDays);
    conditions.push(lte(growthContacts.lastInboundAt, threshold));
  }

  if (rules.tags && rules.tags.length > 0) {
    conditions.push(sql`${growthContacts.tags} && ARRAY[${sql.join(rules.tags.map((t: string) => sql`${t}`), sql`, `)}]::text[]`);
  }

  if (rules.excludeTags && rules.excludeTags.length > 0) {
    conditions.push(sql`NOT (${growthContacts.tags} && ARRAY[${sql.join(rules.excludeTags.map((t: string) => sql`${t}`), sql`, `)}]::text[])`);
  }

  const audience = await db.select().from(growthContacts)
    .where(and(...conditions))
    .limit(rules.maxAudience || 1000);

  return audience;
}

async function getConnectedChannels(tenantId: string): Promise<string[]> {
  const channels: string[] = [];
  try {
    const { waCloudIntegrations, wahaInstances, telegramIntegrations, instagramIntegrations } = await import("@shared/schema");

    const [waMeta] = await db.select().from(waCloudIntegrations).where(eq(waCloudIntegrations.tenantId, tenantId)).limit(1);
    if (waMeta?.status === "connected") channels.push("WHATSAPP_META");

    const wahaList = await db.select().from(wahaInstances).where(eq(wahaInstances.tenantId, tenantId));
    if (wahaList.some((w: any) => w.status === "running")) channels.push("WHATSAPP_WAHA");

    const [tg] = await db.select().from(telegramIntegrations).where(eq(telegramIntegrations.tenantId, tenantId)).limit(1);
    if (tg?.status === "connected") channels.push("TELEGRAM");

    const [ig] = await db.select().from(instagramIntegrations).where(eq(instagramIntegrations.tenantId, tenantId)).limit(1);
    if (ig?.status === "connected") channels.push("INSTAGRAM");
  } catch (e) {
    console.error("getConnectedChannels error:", e);
  }
  return channels;
}
