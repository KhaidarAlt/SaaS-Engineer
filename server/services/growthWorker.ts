import { db } from "../db";
import { eq, and, lte, sql } from "drizzle-orm";
import { growthQueue, growthCampaigns, growthEvents } from "@shared/schema";
import { messagingProvider } from "./messagingProvider";

const INTERVAL_MS = 10_000;
const IDLE_INTERVAL_MS = 60_000;
const IDLE_THRESHOLD = 5;
const BATCH_SIZE = 10;

let running = false;
let emptyTicks = 0;
let hadWork = false;

function computeNextQuietEnd(quietStart: number, quietEnd: number): Date {
  const now = new Date();
  const next = new Date(now);
  next.setMinutes(0, 0, 0);
  next.setHours(quietEnd);
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }
  return next;
}

function isInQuietHours(currentHour: number, quietStart: number, quietEnd: number): boolean {
  if (quietStart < quietEnd) {
    return currentHour >= quietStart && currentHour < quietEnd;
  }
  return currentHour >= quietStart || currentHour < quietEnd;
}

async function processQueue() {
  if (running) return;
  running = true;

  try {
    const now = new Date();

    const pending = await db.select().from(growthQueue)
      .where(and(
        eq(growthQueue.status, "PENDING"),
        lte(growthQueue.plannedAt, now),
      ))
      .limit(BATCH_SIZE);

    if (pending.length === 0) {
      running = false;
      return;
    }

    hadWork = true;

    for (const item of pending) {
      try {
        const [campaign] = await db.select().from(growthCampaigns)
          .where(and(
            eq(growthCampaigns.id, item.campaignId),
            eq(growthCampaigns.tenantId, item.tenantId),
          ));

        if (!campaign || campaign.status !== "RUNNING") {
          await db.update(growthQueue).set({ status: "SKIPPED", error: "Кампания не активна" })
            .where(eq(growthQueue.id, item.id));

          if (campaign) {
            await db.update(growthCampaigns).set({
              totalSkipped: sql`${growthCampaigns.totalSkipped} + 1`,
              updatedAt: new Date(),
            }).where(eq(growthCampaigns.id, campaign.id));
          }
          continue;
        }

        const scheduleRules = (campaign.scheduleRules as any) || {};
        const quietStart = scheduleRules.quietHoursStart ?? 22;
        const quietEnd = scheduleRules.quietHoursEnd ?? 8;
        const currentHour = now.getHours();

        if (isInQuietHours(currentHour, quietStart, quietEnd)) {
          const nextWindow = computeNextQuietEnd(quietStart, quietEnd);
          await db.update(growthQueue).set({ plannedAt: nextWindow })
            .where(eq(growthQueue.id, item.id));
          continue;
        }

        const dailyCap = scheduleRules.dailyCap ?? 100;
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const [sentToday] = await db.select({ count: sql<number>`count(*)` })
          .from(growthQueue)
          .where(and(
            eq(growthQueue.tenantId, item.tenantId),
            eq(growthQueue.campaignId, item.campaignId),
            eq(growthQueue.status, "SENT"),
            sql`${growthQueue.sentAt} >= ${today}`,
          ));

        if ((sentToday?.count ?? 0) >= dailyCap) {
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          tomorrow.setHours(quietEnd, 0, 0, 0);
          await db.update(growthQueue).set({ plannedAt: tomorrow })
            .where(eq(growthQueue.id, item.id));
          continue;
        }

        const [failedToday] = await db.select({ count: sql<number>`count(*)` })
          .from(growthQueue)
          .where(and(
            eq(growthQueue.tenantId, item.tenantId),
            eq(growthQueue.campaignId, item.campaignId),
            eq(growthQueue.status, "FAILED"),
            sql`${growthQueue.sentAt} >= ${today} OR ${growthQueue.createdAt} >= ${today}`,
          ));
        const totalProcessedToday = (sentToday?.count ?? 0) + (failedToday?.count ?? 0);
        const failRate = totalProcessedToday > 0 ? (failedToday?.count ?? 0) / totalProcessedToday : 0;
        if (failRate > 0.3 && totalProcessedToday >= 5) {
          console.log(`[GrowthWorker] Circuit breaker: auto-pausing campaign ${campaign.id} (fail rate ${Math.round(failRate * 100)}%)`);
          await db.update(growthCampaigns).set({
            status: "PAUSED",
            updatedAt: new Date(),
          }).where(eq(growthCampaigns.id, campaign.id));
          await db.insert(growthEvents).values({
            tenantId: item.tenantId,
            campaignId: item.campaignId,
            eventType: "AUTO_PAUSED",
            meta: { reason: `Высокий процент ошибок: ${Math.round(failRate * 100)}%`, failRate },
          });
          continue;
        }

        const safetyRules = (campaign.safetyRules as any) || {};
        if (safetyRules.respectOptOut !== false) {
          const { growthContacts } = await import("@shared/schema");
          const [contact] = await db.select().from(growthContacts)
            .where(and(
              eq(growthContacts.id, item.contactId),
              eq(growthContacts.tenantId, item.tenantId),
            ));
          if (contact?.optOut) {
            await db.update(growthQueue).set({ status: "SKIPPED", error: "Контакт отписался" })
              .where(eq(growthQueue.id, item.id));
            await db.update(growthCampaigns).set({
              totalSkipped: sql`${growthCampaigns.totalSkipped} + 1`,
              updatedAt: new Date(),
            }).where(eq(growthCampaigns.id, item.campaignId));
            continue;
          }
        }

        const payload = (item.payload as any) || {};
        const result = await messagingProvider.sendMessage({
          tenantId: item.tenantId,
          channel: payload.channel || item.resolvedChannel || "WHATSAPP",
          provider: payload.provider || "WAHA",
          to: payload.address || "",
          text: payload.text || "",
          meta: { campaignId: item.campaignId, contactId: item.contactId },
        });

        if (result.status === "SENT") {
          await db.update(growthQueue).set({
            status: "SENT", sentAt: new Date(),
          }).where(eq(growthQueue.id, item.id));

          await db.update(growthCampaigns).set({
            totalSent: sql`${growthCampaigns.totalSent} + 1`,
            updatedAt: new Date(),
          }).where(eq(growthCampaigns.id, item.campaignId));

          await db.insert(growthEvents).values({
            tenantId: item.tenantId,
            campaignId: item.campaignId,
            contactId: item.contactId,
            eventType: "SENT",
            meta: { providerMessageId: result.providerMessageId },
          });
        } else if (result.status === "NEEDS_ACTION") {
          await db.update(growthQueue).set({
            status: "SKIPPED", error: result.error || "Требуется действие",
          }).where(eq(growthQueue.id, item.id));

          await db.update(growthCampaigns).set({
            totalSkipped: sql`${growthCampaigns.totalSkipped} + 1`,
            updatedAt: new Date(),
          }).where(eq(growthCampaigns.id, item.campaignId));

          await db.insert(growthEvents).values({
            tenantId: item.tenantId,
            campaignId: item.campaignId,
            contactId: item.contactId,
            eventType: "SKIPPED",
            meta: { reason: result.error },
          });
        } else {
          await db.update(growthQueue).set({
            status: "FAILED", error: result.error || "Ошибка отправки",
          }).where(eq(growthQueue.id, item.id));

          await db.update(growthCampaigns).set({
            totalFailed: sql`${growthCampaigns.totalFailed} + 1`,
            updatedAt: new Date(),
          }).where(eq(growthCampaigns.id, item.campaignId));

          await db.insert(growthEvents).values({
            tenantId: item.tenantId,
            campaignId: item.campaignId,
            contactId: item.contactId,
            eventType: "FAILED",
            meta: { error: result.error },
          });
        }

      } catch (err) {
        console.error(`[GrowthWorker] Error processing queue item ${item.id}:`, err);
        await db.update(growthQueue).set({
          status: "FAILED", error: String(err),
        }).where(eq(growthQueue.id, item.id));
      }
    }

    const runningCampaigns = await db.select({ id: growthCampaigns.id })
      .from(growthCampaigns)
      .where(eq(growthCampaigns.status, "RUNNING"));

    for (const campaign of runningCampaigns) {
      const [pendingCount] = await db.select({ count: sql<number>`count(*)` })
        .from(growthQueue)
        .where(and(
          eq(growthQueue.campaignId, campaign.id),
          eq(growthQueue.status, "PENDING"),
        ));

      if ((pendingCount?.count ?? 0) === 0) {
        await db.update(growthCampaigns).set({
          status: "COMPLETED", updatedAt: new Date(),
        }).where(eq(growthCampaigns.id, campaign.id));
      }
    }
  } catch (err) {
    console.error("[GrowthWorker] Fatal error:", err);
  } finally {
    running = false;
  }
}

let intervalId: ReturnType<typeof setTimeout> | null = null;
let stopped = true;
let growthRunId = 0;

function makeTick(runId: number) {
  const tick = async () => {
    if (stopped || runId !== growthRunId) return;
    hadWork = false;
    try {
      await processQueue();
    } catch (err) {
      console.error("[GrowthWorker] Tick error:", err);
    }
    if (hadWork) {
      emptyTicks = 0;
    } else {
      emptyTicks++;
    }
    if (stopped || runId !== growthRunId) return;
    const delay = emptyTicks >= IDLE_THRESHOLD ? IDLE_INTERVAL_MS : INTERVAL_MS;
    intervalId = setTimeout(tick, delay);
  };
  return tick;
}

export function startGrowthWorker() {
  if (!stopped) return;
  stopped = false;
  emptyTicks = 0;
  const runId = ++growthRunId;
  intervalId = setTimeout(makeTick(runId), INTERVAL_MS);
  console.log(`[GrowthWorker] Started (active=${INTERVAL_MS / 1000}s, idle=${IDLE_INTERVAL_MS / 1000}s after ${IDLE_THRESHOLD} empty ticks)`);
}

export function stopGrowthWorker() {
  stopped = true;
  if (intervalId) {
    clearTimeout(intervalId);
    intervalId = null;
    console.log("[GrowthWorker] Stopped");
  }
}
