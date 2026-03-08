import { db } from "../db";
import { eq, and, lte, lt, sql, inArray } from "drizzle-orm";
import {
  messageOutbox,
  messagingMessages,
  messagingDeliveries,
} from "@shared/schema";
import { dispatchOutbound } from "./providers/registry";
import type { NormalizedOutbound } from "./types";

const BATCH_SIZE = 10;
const POLL_INTERVAL_MS = 3000;
const BACKOFF_SCHEDULE_MS = [
  5_000,        // 5 sec
  15_000,       // 15 sec
  30_000,       // 30 sec
  60_000,       // 1 min
  120_000,      // 2 min
];

let workerTimer: ReturnType<typeof setInterval> | null = null;

async function pickBatch(): Promise<
  Array<{
    outboxId: string;
    messageId: string;
    tenantId: string;
    attempts: number;
    maxAttempts: number;
    channel: string;
    provider: string;
    fromAddress: string;
    toAddress: string;
    messageType: string;
    content: Record<string, unknown>;
    meta: Record<string, unknown> | null;
  }>
> {
  const now = new Date();

  const rows = await db.execute(sql`
    UPDATE message_outbox
    SET status = 'PROCESSING',
        locked_at = ${now},
        locked_by = 'worker',
        updated_at = ${now}
    WHERE id IN (
      SELECT o.id FROM message_outbox o
      WHERE (o.status = 'PENDING' OR (o.status = 'RETRY' AND o.next_retry_at <= ${now}))
      ORDER BY o.created_at ASC
      LIMIT ${BATCH_SIZE}
      FOR UPDATE SKIP LOCKED
    )
    RETURNING
      id as "outboxId",
      message_id as "messageId",
      tenant_id as "tenantId",
      attempts,
      max_attempts as "maxAttempts"
  `);

  if (!rows.rows || rows.rows.length === 0) return [];

  const messageIds = rows.rows.map((r: any) => r.messageId);

  const messages = await db
    .select({
      id: messagingMessages.id,
      channel: messagingMessages.channel,
      provider: messagingMessages.provider,
      fromAddress: messagingMessages.fromAddress,
      toAddress: messagingMessages.toAddress,
      messageType: messagingMessages.messageType,
      content: messagingMessages.content,
      meta: messagingMessages.meta,
    })
    .from(messagingMessages)
    .where(inArray(messagingMessages.id, messageIds));

  const msgMap = new Map(messages.map((m) => [m.id, m]));

  return rows.rows.map((r: any) => {
    const m = msgMap.get(r.messageId);
    return {
      outboxId: r.outboxId,
      messageId: r.messageId,
      tenantId: r.tenantId,
      attempts: r.attempts,
      maxAttempts: r.maxAttempts,
      channel: m?.channel || "",
      provider: m?.provider || "",
      fromAddress: m?.fromAddress || "",
      toAddress: m?.toAddress || "",
      messageType: m?.messageType || "text",
      content: (m?.content as Record<string, unknown>) || {},
      meta: m?.meta as Record<string, unknown> | null,
    };
  });
}

async function processJob(job: Awaited<ReturnType<typeof pickBatch>>[0]): Promise<void> {
  const attemptNumber = job.attempts + 1;
  const startMs = Date.now();

  const outboundReq: NormalizedOutbound = {
    tenantId: job.tenantId,
    channel: job.channel,
    provider: job.provider,
    toAddress: job.toAddress,
    messageType: job.messageType,
    content: job.content,
  };

  const result = await dispatchOutbound(outboundReq);
  const durationMs = Date.now() - startMs;

  await db.insert(messagingDeliveries).values({
    outboxId: job.outboxId,
    messageId: job.messageId,
    tenantId: job.tenantId,
    attemptNumber,
    providerMessageId: result.providerMessageId,
    providerStatus: result.success ? "sent" : "failed",
    providerError: result.error,
    providerResponse: {
      errorCode: result.errorCode,
      retryable: result.retryable,
    },
    durationMs,
  });

  if (result.success) {
    await db
      .update(messageOutbox)
      .set({
        status: "SENT",
        attempts: attemptNumber,
        completedAt: new Date(),
        updatedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
      })
      .where(eq(messageOutbox.id, job.outboxId));

    await db
      .update(messagingMessages)
      .set({
        status: "sent",
        providerMessageId: result.providerMessageId,
      })
      .where(eq(messagingMessages.id, job.messageId));

    console.log(
      `[OutboxWorker] SENT message ${job.messageId} (attempt ${attemptNumber})`
    );
    return;
  }

  if (!result.retryable || attemptNumber >= job.maxAttempts) {
    await db
      .update(messageOutbox)
      .set({
        status: "FAILED",
        attempts: attemptNumber,
        failReason: result.error,
        failCode: result.errorCode,
        completedAt: new Date(),
        updatedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
      })
      .where(eq(messageOutbox.id, job.outboxId));

    await db
      .update(messagingMessages)
      .set({ status: "failed" })
      .where(eq(messagingMessages.id, job.messageId));

    console.log(
      `[OutboxWorker] FAILED message ${job.messageId} permanently: ${result.errorCode} — ${result.error}`
    );
    return;
  }

  const backoffIdx = Math.min(attemptNumber - 1, BACKOFF_SCHEDULE_MS.length - 1);
  const delayMs = BACKOFF_SCHEDULE_MS[backoffIdx];
  const nextRetryAt = new Date(Date.now() + delayMs);

  await db
    .update(messageOutbox)
    .set({
      status: "RETRY",
      attempts: attemptNumber,
      nextRetryAt,
      failReason: result.error,
      failCode: result.errorCode,
      updatedAt: new Date(),
      lockedAt: null,
      lockedBy: null,
    })
    .where(eq(messageOutbox.id, job.outboxId));

  console.log(
    `[OutboxWorker] RETRY scheduled for message ${job.messageId} (attempt ${attemptNumber}, next in ${Math.round(delayMs / 1000)}s): ${result.errorCode} — ${result.error}`
  );
}

async function tick(): Promise<void> {
  try {
    const batch = await pickBatch();
    if (batch.length === 0) return;

    for (const job of batch) {
      try {
        await processJob(job);
      } catch (err) {
        console.error(`[OutboxWorker] Error processing job ${job.outboxId}:`, err);
        const nextAttempt = job.attempts + 1;
        const errorMsg = err instanceof Error ? err.message : "Unknown error";

        if (nextAttempt >= job.maxAttempts) {
          await db
            .update(messageOutbox)
            .set({
              status: "FAILED",
              attempts: nextAttempt,
              failReason: errorMsg,
              failCode: "WORKER_ERROR",
              completedAt: new Date(),
              updatedAt: new Date(),
              lockedAt: null,
              lockedBy: null,
            })
            .where(eq(messageOutbox.id, job.outboxId))
            .catch((e) => console.error("[OutboxWorker] Failed to update outbox on error:", e));

          await db
            .update(messagingMessages)
            .set({ status: "failed" })
            .where(eq(messagingMessages.id, job.messageId))
            .catch(() => {});
        } else {
          const backoffIdx = Math.min(nextAttempt - 1, BACKOFF_SCHEDULE_MS.length - 1);
          const delayMs = BACKOFF_SCHEDULE_MS[backoffIdx];
          await db
            .update(messageOutbox)
            .set({
              status: "RETRY",
              attempts: nextAttempt,
              nextRetryAt: new Date(Date.now() + delayMs),
              failReason: errorMsg,
              failCode: "WORKER_ERROR",
              updatedAt: new Date(),
              lockedAt: null,
              lockedBy: null,
            })
            .where(eq(messageOutbox.id, job.outboxId))
            .catch((e) => console.error("[OutboxWorker] Failed to update outbox on error:", e));
        }
      }
    }
  } catch (err) {
    console.error("[OutboxWorker] Tick error:", err);
  }
}

export async function startOutboxWorker(): Promise<void> {
  if (workerTimer) return;

  try {
    const cleaned = await db
      .update(messageOutbox)
      .set({
        status: "FAILED",
        failReason: "Cleared stuck entry on startup",
        completedAt: new Date(),
        updatedAt: new Date(),
        lockedAt: null,
        lockedBy: null,
      })
      .where(
        and(
          inArray(messageOutbox.status, ["RETRY", "PROCESSING"]),
          lt(messageOutbox.updatedAt, new Date(Date.now() - 5 * 60 * 1000))
        )
      );
    console.log("[OutboxWorker] Cleaned stuck entries on startup");
  } catch (e) {
    console.error("[OutboxWorker] Failed to clean stuck entries:", e);
  }

  workerTimer = setInterval(tick, POLL_INTERVAL_MS);
  console.log(`[OutboxWorker] Started (every ${POLL_INTERVAL_MS / 1000}s)`);
}

export function stopOutboxWorker(): void {
  if (workerTimer) {
    clearInterval(workerTimer);
    workerTimer = null;
    console.log("[OutboxWorker] Stopped");
  }
}
