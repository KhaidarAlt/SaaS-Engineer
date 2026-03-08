import { db } from "../db";
import { eq, and, desc, sql, count } from "drizzle-orm";
import {
  messagingMessages,
  messagingDedup,
  messageOutbox,
  aiDialogs,
  smartContactSettings,
  type InsertMessagingMessage,
} from "@shared/schema";
import type { NormalizedInboundMessage, NormalizedStatusUpdate } from "./types";
import {
  ingestWebhook as ingestMetaWebhook,
  computeDedupKey,
  type MetaWebhookPayload,
} from "./providers/metaWhatsAppAdapter";
import {
  ingestWebhook as ingestWahaWebhook,
  computeDedupKey as wahaComputeDedupKey,
  type WahaWebhookPayload,
} from "./providers/wahaWhatsAppAdapter";

async function resolveDialog(
  tenantId: string,
  fromAddress: string,
  channel: string
): Promise<string> {
  const threadId = `${channel}:${fromAddress}`;

  const existing = await db
    .select({ id: aiDialogs.id, status: aiDialogs.status })
    .from(aiDialogs)
    .where(
      and(
        eq(aiDialogs.tenantId, tenantId),
        eq(aiDialogs.externalThreadId, threadId),
        eq(aiDialogs.status, "OPEN")
      )
    )
    .orderBy(desc(aiDialogs.createdAt))
    .limit(1);

  if (existing.length > 0) {
    return existing[0].id;
  }

  const sourceMap: Record<string, string> = {
    whatsapp_cloud: "WHATSAPP_CLOUD",
    whatsapp: "WHATSAPP",
  };

  const [newDialog] = await db
    .insert(aiDialogs)
    .values({
      tenantId,
      source: sourceMap[channel] || channel.toUpperCase(),
      channel: channel.toUpperCase(),
      externalThreadId: threadId,
      status: "OPEN",
      outcome: "UNKNOWN",
      goal: "CLOSE_DEAL",
      meta: { contactPhone: fromAddress },
    })
    .returning({ id: aiDialogs.id });

  return newDialog.id;
}

async function storeMessageAtomic(
  msg: InsertMessagingMessage,
  dedupKey: string
): Promise<string | null> {
  return await db.transaction(async (tx) => {
    const existing = await tx
      .select({ id: messagingDedup.id })
      .from(messagingDedup)
      .where(eq(messagingDedup.dedupKey, dedupKey))
      .limit(1);

    if (existing.length > 0) {
      return null;
    }

    const [inserted] = await tx
      .insert(messagingMessages)
      .values(msg)
      .returning({ id: messagingMessages.id });

    await tx.insert(messagingDedup).values({
      dedupKey,
      messageId: inserted.id,
    });

    return inserted.id;
  });
}

async function updateDialogActivity(dialogId: string): Promise<void> {
  const [result] = await db
    .select({ total: count() })
    .from(messagingMessages)
    .where(eq(messagingMessages.dialogId, dialogId));

  await db
    .update(aiDialogs)
    .set({
      lastMessageAt: new Date(),
      messageCount: result?.total ?? 0,
      updatedAt: new Date(),
    })
    .where(eq(aiDialogs.id, dialogId));
}

export interface ProcessedInboundResult {
  stored: Array<{
    messageId: string;
    dialogId: string;
    normalized: NormalizedInboundMessage;
  }>;
  duplicates: string[];
  statuses: NormalizedStatusUpdate[];
}

export async function acceptInboundMetaWebhook(
  tenantId: string,
  payload: MetaWebhookPayload
): Promise<ProcessedInboundResult> {
  const chunks = ingestMetaWebhook(payload);
  const result: ProcessedInboundResult = {
    stored: [],
    duplicates: [],
    statuses: [],
  };

  for (const chunk of chunks) {
    for (const msg of chunk.messages) {
      const dedupKey = computeDedupKey(msg.provider, msg.providerMessageId);

      const dialogId = await resolveDialog(
        tenantId,
        msg.fromAddress,
        msg.channel
      );

      const messageId = await storeMessageAtomic(
        {
          tenantId,
          dialogId,
          direction: msg.direction,
          channel: msg.channel,
          provider: msg.provider,
          fromAddress: msg.fromAddress,
          toAddress: msg.toAddress,
          messageType: msg.messageType,
          content: msg.content,
          providerMessageId: msg.providerMessageId,
          providerTimestamp: msg.providerTimestamp,
          status: "received",
          meta: msg.meta,
          receivedAt: new Date(),
        },
        dedupKey
      );

      if (messageId === null) {
        result.duplicates.push(msg.providerMessageId);
        console.log(
          `[Messaging] Duplicate skipped: ${msg.providerMessageId}`
        );
        continue;
      }

      await updateDialogActivity(dialogId);

      result.stored.push({ messageId, dialogId, normalized: msg });

      console.log(
        `[Messaging] Stored message ${messageId} from ${msg.fromAddress} → dialog ${dialogId}`
      );
    }

    result.statuses.push(...chunk.statuses);

    for (const s of chunk.statuses) {
      console.log(
        `[Messaging] Status update: ${s.providerMessageId} → ${s.status}`
      );
    }
  }

  return result;
}

export async function acceptInboundWahaWebhook(
  tenantId: string,
  payload: WahaWebhookPayload
): Promise<ProcessedInboundResult> {
  const chunk = ingestWahaWebhook(payload);
  return acceptInboundNormalized(tenantId, chunk.messages, chunk.statuses);
}

export async function acceptInboundNormalized(
  tenantId: string,
  messages: NormalizedInboundMessage[],
  statuses: NormalizedStatusUpdate[] = []
): Promise<ProcessedInboundResult> {
  const result: ProcessedInboundResult = {
    stored: [],
    duplicates: [],
    statuses: [],
  };

  for (const msg of messages) {
    const dedupKey = computeDedupKey(msg.provider, msg.providerMessageId);

    const dialogId = await resolveDialog(
      tenantId,
      msg.fromAddress,
      msg.channel
    );

    const messageId = await storeMessageAtomic(
      {
        tenantId,
        dialogId,
        direction: msg.direction,
        channel: msg.channel,
        provider: msg.provider,
        fromAddress: msg.fromAddress,
        toAddress: msg.toAddress,
        messageType: msg.messageType,
        content: msg.content,
        providerMessageId: msg.providerMessageId,
        providerTimestamp: msg.providerTimestamp,
        status: "received",
        meta: msg.meta,
        receivedAt: new Date(),
      },
      dedupKey
    );

    if (messageId === null) {
      result.duplicates.push(msg.providerMessageId);
      console.log(`[Messaging] Duplicate skipped: ${msg.providerMessageId}`);
      continue;
    }

    await updateDialogActivity(dialogId);
    result.stored.push({ messageId, dialogId, normalized: msg });
    console.log(
      `[Messaging] Stored message ${messageId} from ${msg.fromAddress} → dialog ${dialogId} (${msg.channel}/${msg.provider})`
    );
  }

  result.statuses.push(...statuses);
  for (const s of statuses) {
    console.log(`[Messaging] Status update: ${s.providerMessageId} → ${s.status}`);
  }

  return result;
}

// ============ OUTBOUND SENDING API ============

export interface SendMessageParams {
  tenantId: string;
  channel: string;
  provider: string;
  fromAddress: string;
  toAddress: string;
  messageType?: string;
  content: Record<string, unknown>;
  dialogId?: string;
  meta?: Record<string, unknown>;
  skipPolicyCheck?: boolean;
}

export interface SendMessageResult {
  success: boolean;
  messageId?: string;
  outboxId?: string;
  failReason?: string;
}

async function checkQuietHours(tenantId: string): Promise<boolean> {
  const [settings] = await db
    .select({
      quietHoursStart: smartContactSettings.quietHoursStart,
      quietHoursEnd: smartContactSettings.quietHoursEnd,
      enabled: smartContactSettings.enabled,
    })
    .from(smartContactSettings)
    .where(eq(smartContactSettings.tenantId, tenantId));

  if (!settings || !settings.enabled) {
    return false;
  }

  const now = new Date();
  const hour = now.getHours();
  const start = settings.quietHoursStart;
  const end = settings.quietHoursEnd;

  if (start > end) {
    return hour >= start || hour < end;
  }
  return hour >= start && hour < end;
}

async function checkOptOut(_tenantId: string, _toAddress: string): Promise<boolean> {
  return false;
}

export async function sendMessage(params: SendMessageParams): Promise<SendMessageResult> {
  const {
    tenantId,
    channel,
    provider,
    fromAddress,
    toAddress,
    messageType = "text",
    content,
    dialogId,
    meta,
    skipPolicyCheck = false,
  } = params;

  if (!skipPolicyCheck) {
    if (await checkOptOut(tenantId, toAddress)) {
      const [msg] = await db
        .insert(messagingMessages)
        .values({
          tenantId,
          dialogId,
          direction: "outbound",
          channel,
          provider,
          fromAddress,
          toAddress,
          messageType,
          content,
          status: "failed",
          meta: { ...meta, failReason: "OPT_OUT" },
          receivedAt: new Date(),
        })
        .returning({ id: messagingMessages.id });

      return { success: false, messageId: msg.id, failReason: "OPT_OUT" };
    }

    if (await checkQuietHours(tenantId)) {
      const [msg] = await db
        .insert(messagingMessages)
        .values({
          tenantId,
          dialogId,
          direction: "outbound",
          channel,
          provider,
          fromAddress,
          toAddress,
          messageType,
          content,
          status: "failed",
          meta: { ...meta, failReason: "QUIET_HOURS" },
          receivedAt: new Date(),
        })
        .returning({ id: messagingMessages.id });

      return { success: false, messageId: msg.id, failReason: "QUIET_HOURS" };
    }
  }

  return await db.transaction(async (tx) => {
    const [msg] = await tx
      .insert(messagingMessages)
      .values({
        tenantId,
        dialogId,
        direction: "outbound",
        channel,
        provider,
        fromAddress,
        toAddress,
        messageType,
        content,
        status: "queued",
        meta,
        receivedAt: new Date(),
      })
      .returning({ id: messagingMessages.id });

    const [outbox] = await tx
      .insert(messageOutbox)
      .values({
        messageId: msg.id,
        tenantId,
        status: "PENDING",
        attempts: 0,
        maxAttempts: 2,
      })
      .returning({ id: messageOutbox.id });

    console.log(
      `[Messaging] Enqueued outbound message ${msg.id} → outbox ${outbox.id} (${channel}/${provider} → ${toAddress})`
    );

    return { success: true, messageId: msg.id, outboxId: outbox.id };
  });
}
