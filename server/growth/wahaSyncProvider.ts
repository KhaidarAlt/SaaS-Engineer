import { db } from "../db";
import { growthContacts, growthSyncRuns, wahaInstances, aiRopChannels } from "@shared/schema";
import { eq, and, sql, inArray } from "drizzle-orm";
import { wahaService } from "../services/waha";

export async function runWahaHistorySync(tenantId: string, syncRunId: string) {
  await db.update(growthSyncRuns).set({
    status: "RUNNING",
    startedAt: new Date(),
  }).where(eq(growthSyncRuns.id, syncRunId));

  let chatsScanned = 0;
  let contactsUpserted = 0;
  let errors = 0;

  try {
    const instances = await db.select().from(wahaInstances)
      .where(and(eq(wahaInstances.tenantId, tenantId), inArray(wahaInstances.status, ["running", "CONNECTED"])));

    for (const instance of instances) {
      try {
        let chats = await wahaService.getChats(instance.instanceName);
        
        if (!Array.isArray(chats) || chats.length === 0) {
          console.log(`[WahaSync] getChats returned empty for ${instance.instanceName}, trying getContacts fallback`);
          const contacts = await wahaService.getContacts(instance.instanceName);
          if (Array.isArray(contacts) && contacts.length > 0) {
            chats = contacts.map((c: any) => ({
              id: c.id?._serialized || c.id || "",
              name: c.name || c.pushname || c.shortName || null,
              pushName: c.pushname || null,
            }));
          }
        }

        if (!Array.isArray(chats)) continue;

        for (const chat of chats) {
          try {
            const chatId = typeof chat.id === "string" ? chat.id : chat.id?._serialized || "";
            if (!chatId || !chatId.includes("@c.us")) continue;
            chatsScanned++;

            const phone = normalizePhone(chatId);
            if (!phone || phone.length < 7) continue;

            const displayName = chat.name || chat.pushName || null;
            const lastMessageAt = chat.lastMessage?.timestamp
              ? new Date(chat.lastMessage.timestamp * 1000)
              : null;
            const lastPreview = chat.lastMessage?.body?.substring(0, 200) || null;

            await upsertContact(tenantId, phone, {
              name: displayName,
              source: "waha_sync",
              lastInboundAt: lastMessageAt,
              lastChannel: "whatsapp",
              lastChannelProvider: "whatsapp:waha",
              lastMessagePreview: lastPreview,
              firstSeenAt: lastMessageAt || new Date(),
            });
            contactsUpserted++;
          } catch (chatErr) {
            errors++;
            console.error(`[WahaSync] Error processing chat:`, chatErr);
          }
        }
      } catch (instanceErr) {
        errors++;
        console.error(`[WahaSync] Error with instance ${instance.instanceName}:`, instanceErr);
      }
    }

    console.log(`[WahaSync] WAHA API phase done: ${chatsScanned} chats, ${contactsUpserted} contacts. Starting local DB sync...`);

    const dbResult = await syncFromLocalData(tenantId);
    contactsUpserted += dbResult.upserted;
    chatsScanned += dbResult.scanned;
    errors += dbResult.errors;

    await db.update(growthSyncRuns).set({
      status: "SUCCESS",
      finishedAt: new Date(),
      statsJson: { chatsScanned, contactsUpserted, errors },
    }).where(eq(growthSyncRuns.id, syncRunId));

    console.log(`[WahaSync] Completed for tenant ${tenantId}: ${contactsUpserted} contacts from ${chatsScanned} sources (errors: ${errors})`);
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

interface PhoneEntry {
  name: string | null;
  channel: string;
  success: boolean | null;
  convStatus: string;
  firstSeen: Date;
  lastSeen: Date;
  msgCount: number;
}

interface OrderEntry {
  name: string | null;
  hasOrder: boolean;
  isPaid: boolean;
  isCompleted: boolean;
  totalRevenue: number;
  orderCount: number;
  lastOrder: Date;
}

interface MsgEntry {
  inbound: number;
  outbound: number;
  lastInbound: Date | null;
  lastPreview: string | null;
}

async function syncFromLocalData(tenantId: string): Promise<{ scanned: number; upserted: number; errors: number }> {
  let scanned = 0;
  let upserted = 0;
  let errors = 0;

  console.log(`[WahaSync/DB] Starting local data sync for tenant ${tenantId}`);

  const phoneMap = new Map<string, PhoneEntry>();
  const orderMap = new Map<string, OrderEntry>();
  const msgMap = new Map<string, MsgEntry>();

  try {
    const convResult = await db.execute(sql`
      SELECT
        c.customer_phone AS phone,
        c.customer_name AS name,
        c.channel,
        c.success,
        c.status AS conv_status,
        MIN(c.created_at) AS first_seen,
        MAX(c.updated_at) AS last_seen,
        COUNT(m.id)::int AS msg_count
      FROM ai_conversations c
      LEFT JOIN ai_messages m ON m.conversation_id = c.id
      WHERE c.tenant_id = ${tenantId}
        AND c.customer_phone IS NOT NULL
        AND c.customer_phone != ''
        AND c.customer_phone NOT LIKE '%@g.us%'
        AND c.customer_phone != 'status@broadcast'
      GROUP BY c.customer_phone, c.customer_name, c.channel, c.success, c.status
    `);

    const convRows = (convResult as any).rows || convResult;
    console.log(`[WahaSync/DB] ai_conversations query: ${convRows.length} rows`);

    for (const row of convRows) {
      const phone = normalizePhone(String(row.phone));
      if (!phone || phone.length < 7) continue;
      scanned++;

      const existing = phoneMap.get(phone);
      if (!existing || (row.last_seen && new Date(row.last_seen) > existing.lastSeen)) {
        phoneMap.set(phone, {
          name: row.name || existing?.name || null,
          channel: row.channel || "whatsapp",
          success: row.success ?? existing?.success ?? null,
          convStatus: row.conv_status || existing?.convStatus || "open",
          firstSeen: existing ? new Date(Math.min(existing.firstSeen.getTime(), new Date(row.first_seen || Date.now()).getTime())) : new Date(row.first_seen || Date.now()),
          lastSeen: new Date(row.last_seen || Date.now()),
          msgCount: (existing?.msgCount || 0) + (row.msg_count || 0),
        });
      }
    }
  } catch (err) {
    errors++;
    console.error(`[WahaSync/DB] ai_conversations query FAILED:`, err);
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
        SUM(CASE WHEN status = 'completed' OR payment_status IN ('paid', 'prepayment', 'installment', 'credit', 'kaspi_red') THEN total::numeric ELSE 0 END) AS total_revenue
      FROM orders
      WHERE tenant_id = ${tenantId}
        AND customer_phone IS NOT NULL
        AND customer_phone != ''
      GROUP BY customer_phone
    `);

    const orderRows = (orderResult as any).rows || orderResult;
    console.log(`[WahaSync/DB] orders query: ${orderRows.length} rows`);

    for (const row of orderRows) {
      const phone = normalizePhone(String(row.phone));
      if (!phone || phone.length < 7) continue;

      const rowIsPaid = row.is_paid === true || row.is_paid === "true" || row.is_paid === "t";
      const rowIsCompleted = row.is_completed === true || row.is_completed === "true" || row.is_completed === "t";

      orderMap.set(phone, {
        name: row.name || null,
        hasOrder: true,
        isPaid: rowIsPaid,
        isCompleted: rowIsCompleted,
        totalRevenue: parseFloat(row.total_revenue) || 0,
        orderCount: row.order_count || 0,
        lastOrder: new Date(row.last_order),
      });

      if (!phoneMap.has(phone)) {
        scanned++;
        phoneMap.set(phone, {
          name: row.name || null,
          channel: "whatsapp",
          success: rowIsPaid || rowIsCompleted ? true : null,
          convStatus: "open",
          firstSeen: new Date(row.first_order || Date.now()),
          lastSeen: new Date(row.last_order || Date.now()),
          msgCount: 0,
        });
      }
    }
  } catch (err) {
    errors++;
    console.error(`[WahaSync/DB] orders query FAILED:`, err);
  }

  try {
    const msgResult = await db.execute(sql`
      SELECT
        sub.phone,
        sub.inbound_count,
        sub.outbound_count,
        sub.last_inbound
      FROM (
        SELECT
          CASE WHEN direction = 'inbound' THEN from_address ELSE to_address END AS phone,
          COUNT(*) FILTER (WHERE direction = 'inbound')::int AS inbound_count,
          COUNT(*) FILTER (WHERE direction = 'outbound')::int AS outbound_count,
          MAX(CASE WHEN direction = 'inbound' THEN received_at END) AS last_inbound
        FROM messaging_messages
        WHERE tenant_id = ${tenantId}
          AND channel IN ('whatsapp', 'whatsapp_cloud')
        GROUP BY phone
        HAVING COUNT(*) > 0
      ) sub
    `);

    const msgRows = (msgResult as any).rows || msgResult;
    console.log(`[WahaSync/DB] messaging_messages query: ${msgRows.length} rows`);

    for (const row of msgRows) {
      const phone = normalizePhone(String(row.phone));
      if (!phone || phone.length < 7) continue;
      msgMap.set(phone, {
        inbound: row.inbound_count || 0,
        outbound: row.outbound_count || 0,
        lastInbound: row.last_inbound ? new Date(row.last_inbound) : null,
        lastPreview: null,
      });
    }
  } catch (err) {
    errors++;
    console.error(`[WahaSync/DB] messaging_messages query FAILED:`, err);
  }

  console.log(`[WahaSync/DB] Data collected: ${phoneMap.size} unique phones, ${orderMap.size} with orders, ${msgMap.size} with messages`);

  for (const [phone, conv] of phoneMap) {
    try {
      const order = orderMap.get(phone);
      const msg = msgMap.get(phone);

      const tags: string[] = [];
      if (order?.hasOrder) tags.push("has_order");
      if (order?.isPaid || order?.isCompleted) tags.push("paid");
      if (conv.success) tags.push("successful");
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      if (conv.lastSeen > thirtyDaysAgo) tags.push("active");
      if (conv.convStatus === "handoff") tags.push("handoff");

      await upsertContact(tenantId, phone, {
        name: conv.name || order?.name || null,
        source: "db_sync",
        lastInboundAt: msg?.lastInbound || conv.lastSeen,
        lastChannel: "whatsapp",
        lastChannelProvider: "whatsapp:waha",
        lastMessagePreview: msg?.lastPreview || null,
        firstSeenAt: conv.firstSeen,
        inboundCount: msg?.inbound || 0,
        outboundCount: msg?.outbound || 0,
        tags,
        meta: order ? {
          orderCount: order.orderCount,
          totalRevenue: order.totalRevenue,
          isPaid: order.isPaid,
          isCompleted: order.isCompleted,
        } : undefined,
      });
      upserted++;
    } catch (err) {
      errors++;
      console.error(`[WahaSync/DB] Error upserting contact ${phone}:`, err);
    }
  }

  console.log(`[WahaSync/DB] Local sync done for tenant ${tenantId}: ${upserted} upserted from ${scanned} scanned (errors: ${errors})`);
  return { scanned, upserted, errors };
}

function normalizePhone(phone: string): string {
  let cleaned = phone.replace(/@c\.us$|@s\.whatsapp\.net$|@lid$/, "").replace(/[^0-9]/g, "");
  return cleaned;
}

async function upsertContact(tenantId: string, phone: string, data: {
  name?: string | null;
  source: string;
  lastInboundAt?: Date | null;
  lastChannel?: string;
  lastChannelProvider?: string;
  lastMessagePreview?: string | null;
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
    };
    if (data.lastChannelProvider) updates.lastChannelProvider = data.lastChannelProvider;
    if (data.name && !existing[0].name) updates.name = data.name;
    if (data.lastInboundAt && (!existing[0].lastInboundAt || data.lastInboundAt > existing[0].lastInboundAt)) {
      updates.lastInboundAt = data.lastInboundAt;
    }
    if (data.lastMessagePreview) updates.lastMessagePreview = data.lastMessagePreview;
    if (!existing[0].source) updates.source = data.source;
    if (data.inboundCount && data.inboundCount > (existing[0].inboundCount || 0)) {
      updates.inboundCount = data.inboundCount;
    }
    if (data.outboundCount && data.outboundCount > (existing[0].outboundCount || 0)) {
      updates.outboundCount = data.outboundCount;
    }
    if (data.tags && data.tags.length > 0) {
      const existingTags = existing[0].tags || [];
      const mergedTags = [...new Set([...existingTags, ...data.tags])];
      updates.tags = mergedTags;
    }
    if (data.meta) {
      updates.meta = { ...(existing[0].meta as Record<string, unknown> || {}), ...data.meta };
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
      lastMessagePreview: data.lastMessagePreview || null,
      inboundCount: data.inboundCount || 0,
      outboundCount: data.outboundCount || 0,
      tags: data.tags || [],
      meta: data.meta || {},
    });
  }
}
