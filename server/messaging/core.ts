import { db } from "../db";
import { eq, and, desc, sql, count } from "drizzle-orm";
import {
  messagingMessages,
  messagingDedup,
  aiDialogs,
  type InsertMessagingMessage,
} from "@shared/schema";
import {
  ingestWebhook,
  computeDedupKey,
  type MetaWebhookPayload,
  type NormalizedInboundMessage,
  type NormalizedStatusUpdate,
} from "./providers/metaWhatsAppAdapter";

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

  const [newDialog] = await db
    .insert(aiDialogs)
    .values({
      tenantId,
      source: "WHATSAPP_CLOUD",
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
  const chunks = ingestWebhook(payload);
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
