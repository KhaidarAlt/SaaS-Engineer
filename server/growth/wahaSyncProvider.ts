import { db } from "../db";
import { growthContacts, growthSyncRuns, wahaInstances, tenants, messagingMessages, messagingDedup } from "@shared/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { wahaService } from "../services/waha";
import { analyzeContacts } from "./conversationAnalyzer";

export async function runWahaHistorySync(tenantId: string, syncRunId: string) {
  await db.update(growthSyncRuns).set({
    status: "RUNNING",
    startedAt: new Date(),
  }).where(eq(growthSyncRuns.id, syncRunId));

  let chatsScanned = 0;
  let contactsUpserted = 0;
  let errors = 0;

  try {
    const [tenant] = await db.select().from(tenants).where(eq(tenants.id, tenantId)).limit(1);
    const tenantNotifPhone = tenant?.notificationPhone ? normalizePhone(tenant.notificationPhone) : null;

    const instances = await db.select().from(wahaInstances)
      .where(and(eq(wahaInstances.tenantId, tenantId), inArray(wahaInstances.status, ["running", "CONNECTED"])));

    const sessionName = instances[0]?.instanceName || null;

    const dbResult = await syncFromLocalData(tenantId, tenantNotifPhone);
    contactsUpserted += dbResult.upserted;
    chatsScanned += dbResult.scanned;
    errors += dbResult.errors;
    const validPhones = dbResult.validPhones;

    if (sessionName && validPhones.length > 0) {
      const pullResult = await pullWahaHistory(tenantId, sessionName, validPhones);
      console.log(`[WahaSync] WAHA history pull: ${pullResult.messagesStored} new messages for ${pullResult.contactsProcessed} contacts`);
    }

    const cleanResult = await cleanInvalidContacts(tenantId, validPhones);
    console.log(`[WahaSync] Cleaned ${cleanResult} invalid contacts`);

    let analyzed = 0;
    try {
      analyzed = await analyzeContacts(tenantId);
      console.log(`[WahaSync] GPT analyzed ${analyzed} contacts`);
    } catch (err) {
      console.error(`[WahaSync] GPT analysis error (non-fatal):`, err);
    }

    await db.update(growthSyncRuns).set({
      status: "SUCCESS",
      finishedAt: new Date(),
      statsJson: { chatsScanned, contactsUpserted, errors, analyzed, cleaned: cleanResult },
    }).where(eq(growthSyncRuns.id, syncRunId));

    console.log(`[WahaSync] Completed for tenant ${tenantId}: ${contactsUpserted} contacts, ${errors} errors, ${analyzed} analyzed`);
  } catch (err: any) {
    await db.update(growthSyncRuns).set({
      status: "FAILED",
      finishedAt: new Date(),
      error: err.message || String(err),
      statsJson: { chatsScanned, contactsUpserted, errors },
    }).where(eq(growthSyncRuns.id, syncRunId));

    console.error(`[WahaSync] Failed for tenant ${tenantId}:`, err);
  }
}

interface MsgContact {
  phone: string;
  inbound: number;
  outbound: number;
  totalMsgs: number;
  lastInbound: Date | null;
  lastOutbound: Date | null;
  firstMsg: Date;
  pushName: string | null;
}

interface OrderInfo {
  name: string | null;
  hasOrder: boolean;
  isPaid: boolean;
  isCompleted: boolean;
  hasAbandonedCart: boolean;
  totalRevenue: number;
  orderCount: number;
  lastOrder: Date;
}

async function syncFromLocalData(
  tenantId: string,
  tenantNotifPhone: string | null,
): Promise<{ scanned: number; upserted: number; errors: number; validPhones: string[] }> {
  let scanned = 0;
  let upserted = 0;
  let errors = 0;
  const validPhones: string[] = [];

  console.log(`[WahaSync/DB] Starting local data sync for tenant ${tenantId}`);

  const msgContacts = new Map<string, MsgContact>();
  const orderMap = new Map<string, OrderInfo>();

  try {
    const msgResult = await db.execute(sql`
      SELECT
        sub.phone,
        sub.inbound_count,
        sub.outbound_count,
        sub.total_msgs,
        sub.last_inbound,
        sub.last_outbound,
        sub.first_msg,
        sub.push_name
      FROM (
        SELECT
          CASE WHEN direction = 'inbound' THEN from_address ELSE to_address END AS phone,
          COUNT(*) FILTER (WHERE direction = 'inbound')::int AS inbound_count,
          COUNT(*) FILTER (WHERE direction = 'outbound')::int AS outbound_count,
          COUNT(*)::int AS total_msgs,
          MAX(CASE WHEN direction = 'inbound' THEN received_at END) AS last_inbound,
          MAX(CASE WHEN direction = 'outbound' THEN received_at END) AS last_outbound,
          MIN(received_at) AS first_msg,
          MAX(CASE WHEN direction = 'inbound' THEN
            COALESCE(
              meta->>'pushName',
              meta->>'senderName',
              meta->'key'->>'pushName'
            )
          END) AS push_name
        FROM messaging_messages
        WHERE tenant_id = ${tenantId}
          AND channel IN ('whatsapp', 'whatsapp_cloud')
          AND from_address NOT LIKE '%@g.us'
          AND to_address NOT LIKE '%@g.us'
          AND from_address NOT LIKE '%@newsletter'
          AND to_address NOT LIKE '%@newsletter'
          AND from_address NOT LIKE '%@lid'
          AND to_address NOT LIKE '%@lid'
          AND from_address != 'status@broadcast'
          AND to_address != 'status@broadcast'
        GROUP BY phone
        HAVING COUNT(*) >= 2
      ) sub
      WHERE sub.phone ~ '^[0-9]{10,12}$'
    `);

    const msgRows = (msgResult as any).rows || msgResult;
    console.log(`[WahaSync/DB] messaging_messages: ${msgRows.length} valid phone contacts with 2+ messages`);

    for (const row of msgRows) {
      const phone = normalizePhone(String(row.phone));
      if (!phone || phone.length < 10 || phone.length > 12) continue;
      if (tenantNotifPhone && phone === tenantNotifPhone) continue;

      const existing = msgContacts.get(phone);
      msgContacts.set(phone, {
        phone,
        inbound: (existing?.inbound || 0) + (row.inbound_count || 0),
        outbound: (existing?.outbound || 0) + (row.outbound_count || 0),
        totalMsgs: (existing?.totalMsgs || 0) + (row.total_msgs || 0),
        lastInbound: row.last_inbound ? new Date(row.last_inbound) : existing?.lastInbound || null,
        lastOutbound: row.last_outbound ? new Date(row.last_outbound) : existing?.lastOutbound || null,
        firstMsg: row.first_msg ? new Date(row.first_msg) : existing?.firstMsg || new Date(),
        pushName: row.push_name || existing?.pushName || null,
      });
      scanned++;
    }
  } catch (err) {
    errors++;
    console.error(`[WahaSync/DB] messaging_messages query FAILED:`, err);
  }

  try {
    const orderResult = await db.execute(sql`
      SELECT
        customer_phone AS phone,
        MAX(customer_name) AS name,
        COUNT(*)::int AS order_count,
        MIN(created_at) AS first_order,
        MAX(created_at) AS last_order,
        BOOL_OR(status = 'completed') AS is_completed,
        BOOL_OR(payment_status IN ('paid', 'prepayment', 'installment', 'credit', 'kaspi_red')) AS is_paid,
        BOOL_OR(status IN ('awaiting_payment', 'in_progress') AND payment_status = 'pending') AS has_abandoned_cart,
        SUM(CASE WHEN status = 'completed' OR payment_status IN ('paid', 'prepayment', 'installment', 'credit', 'kaspi_red') THEN total::numeric ELSE 0 END) AS total_revenue
      FROM orders
      WHERE tenant_id = ${tenantId}
        AND customer_phone IS NOT NULL
        AND customer_phone != ''
      GROUP BY customer_phone
    `);

    const orderRows = (orderResult as any).rows || orderResult;
    console.log(`[WahaSync/DB] orders query: ${orderRows.length} order groups`);

    for (const row of orderRows) {
      const phone = normalizePhone(String(row.phone));
      if (!phone || phone.length < 10) continue;

      const rowIsPaid = row.is_paid === true || row.is_paid === "true" || row.is_paid === "t";
      const rowIsCompleted = row.is_completed === true || row.is_completed === "true" || row.is_completed === "t";
      const rowHasAbandoned = row.has_abandoned_cart === true || row.has_abandoned_cart === "true" || row.has_abandoned_cart === "t";

      const existing = orderMap.get(phone);
      orderMap.set(phone, {
        name: row.name || existing?.name || null,
        hasOrder: true,
        isPaid: rowIsPaid || existing?.isPaid || false,
        isCompleted: rowIsCompleted || existing?.isCompleted || false,
        hasAbandonedCart: rowHasAbandoned || existing?.hasAbandonedCart || false,
        totalRevenue: (parseFloat(row.total_revenue) || 0) + (existing?.totalRevenue || 0),
        orderCount: (row.order_count || 0) + (existing?.orderCount || 0),
        lastOrder: new Date(row.last_order),
      });
    }
  } catch (err) {
    errors++;
    console.error(`[WahaSync/DB] orders query FAILED:`, err);
  }

  console.log(`[WahaSync/DB] Valid WhatsApp contacts: ${msgContacts.size}, Order groups: ${orderMap.size}`);

  for (const [phone, msg] of msgContacts) {
    try {
      const order = orderMap.get(phone);

      const tags: string[] = [];
      if (order?.hasOrder) tags.push("has_order");
      if (order?.isPaid || order?.isCompleted) tags.push("paid");
      if (order?.hasAbandonedCart && !order?.isPaid) tags.push("abandoned_cart");
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      const lastActivity = msg.lastInbound || msg.lastOutbound || msg.firstMsg;
      if (lastActivity > thirtyDaysAgo) tags.push("active");

      await upsertContact(tenantId, phone, {
        name: msg.pushName || order?.name || null,
        source: "whatsapp",
        lastInboundAt: msg.lastInbound,
        lastChannel: "whatsapp",
        lastChannelProvider: "whatsapp:waha",
        firstSeenAt: msg.firstMsg,
        inboundCount: msg.inbound,
        outboundCount: msg.outbound,
        tags,
        meta: order ? {
          orderCount: order.orderCount,
          totalRevenue: order.totalRevenue,
          isPaid: order.isPaid,
          isCompleted: order.isCompleted,
          hasAbandonedCart: order.hasAbandonedCart,
        } : undefined,
      });
      upserted++;
      validPhones.push(phone);
    } catch (err) {
      errors++;
      console.error(`[WahaSync/DB] Error upserting ${phone}:`, err);
    }
  }

  console.log(`[WahaSync/DB] Done: ${upserted} upserted from ${scanned} scanned (errors: ${errors})`);
  return { scanned, upserted, errors, validPhones };
}

async function pullWahaHistory(
  tenantId: string,
  sessionName: string,
  validPhones: string[],
): Promise<{ contactsProcessed: number; messagesStored: number }> {
  let contactsProcessed = 0;
  let messagesStored = 0;

  for (const phone of validPhones) {
    try {
      const chatId = `${phone}@c.us`;
      const messages = await wahaService.getMessages(sessionName, chatId, 50);
      if (!Array.isArray(messages) || messages.length === 0) continue;
      contactsProcessed++;

      for (const msg of messages) {
        try {
          const wahaId = msg.id?._serialized || msg.id?.id || msg.id;
          if (!wahaId) continue;

          const dedupKey = `waha:${tenantId}:${wahaId}`;
          const [existing] = await db.select({ id: messagingDedup.id })
            .from(messagingDedup)
            .where(eq(messagingDedup.dedupKey, dedupKey))
            .limit(1);

          if (existing) continue;

          const isFromMe = msg.fromMe === true || msg.from === chatId.replace("@c.us", "") || msg._data?.id?.fromMe;
          const direction = isFromMe ? "outbound" : "inbound";
          const body = msg.body || msg.text || msg._data?.body || "";
          if (!body && !msg.hasMedia) continue;

          const timestamp = msg.timestamp ? new Date(msg.timestamp * 1000) : new Date();

          const [inserted] = await db.insert(messagingMessages).values({
            tenantId,
            direction,
            channel: "whatsapp",
            provider: "waha",
            fromAddress: direction === "inbound" ? phone : sessionName,
            toAddress: direction === "inbound" ? sessionName : phone,
            messageType: msg.type === "chat" ? "text" : (msg.type || "text"),
            content: { text: body },
            providerMessageId: wahaId,
            providerTimestamp: timestamp,
            status: "processed",
            meta: {
              pushName: msg._data?.notifyName || msg.notifyName || null,
              pulledFromWaha: true,
            },
            receivedAt: timestamp,
          }).returning({ id: messagingMessages.id });

          if (inserted) {
            await db.insert(messagingDedup).values({
              dedupKey,
              messageId: inserted.id,
            }).onConflictDoNothing();
            messagesStored++;
          }
        } catch (msgErr) {
          // skip individual message errors silently
        }
      }
    } catch (contactErr) {
      console.error(`[WahaSync/Pull] Error pulling history for ${phone}:`, contactErr);
    }
  }

  return { contactsProcessed, messagesStored };
}

async function cleanInvalidContacts(tenantId: string, validPhones: string[]): Promise<number> {
  if (validPhones.length === 0) return 0;

  try {
    const result = await db.execute(sql`
      DELETE FROM growth_contacts
      WHERE tenant_id = ${tenantId}
        AND phone NOT IN (${sql.join(validPhones.map(p => sql`${p}`), sql`, `)})
    `);
    return (result as any).rowCount || 0;
  } catch (err) {
    console.error(`[WahaSync] Error cleaning invalid contacts:`, err);
    return 0;
  }
}

export function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/@c\.us$|@s\.whatsapp\.net$|@lid$/, "").replace(/[^0-9]/g, "");
  if (cleaned.length === 11 && cleaned.startsWith("8")) {
    cleaned = "7" + cleaned.substring(1);
  }
  return cleaned;
}

async function upsertContact(tenantId: string, phone: string, data: {
  name?: string | null;
  source: string;
  lastInboundAt?: Date | null;
  lastChannel?: string;
  lastChannelProvider?: string;
  firstSeenAt?: Date;
  inboundCount?: number;
  outboundCount?: number;
  tags?: string[];
  meta?: Record<string, unknown>;
}) {
  const existing = await db.select().from(growthContacts)
    .where(and(
      eq(growthContacts.tenantId, tenantId),
      eq(growthContacts.phone, phone),
    )).limit(1);

  if (existing.length > 0) {
    const updates: Record<string, any> = {
      updatedAt: new Date(),
      source: data.source,
    };
    if (data.lastChannelProvider) updates.lastChannelProvider = data.lastChannelProvider;
    if (data.name) updates.name = data.name;
    if (data.lastInboundAt) updates.lastInboundAt = data.lastInboundAt;
    if (data.inboundCount !== undefined) updates.inboundCount = data.inboundCount;
    if (data.outboundCount !== undefined) updates.outboundCount = data.outboundCount;
    if (data.tags) {
      updates.tags = data.tags;
    }
    if (data.meta) {
      const existingMeta = existing[0].meta as Record<string, unknown> || {};
      const analysis = existingMeta.analysis;
      updates.meta = { ...data.meta, ...(analysis ? { analysis } : {}) };
    }

    await db.update(growthContacts).set(updates)
      .where(eq(growthContacts.id, existing[0].id));
  } else {
    await db.insert(growthContacts).values({
      tenantId,
      phone,
      name: data.name || null,
      source: data.source,
      firstSeenAt: data.firstSeenAt || new Date(),
      lastInboundAt: data.lastInboundAt || null,
      lastChannel: data.lastChannel || "whatsapp",
      primaryChannel: data.lastChannel || "whatsapp",
      lastChannelProvider: data.lastChannelProvider || "whatsapp:waha",
      inboundCount: data.inboundCount || 0,
      outboundCount: data.outboundCount || 0,
      tags: data.tags || [],
      meta: data.meta || {},
    });
  }
}
