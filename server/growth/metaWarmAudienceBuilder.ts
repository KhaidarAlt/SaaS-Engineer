import { db } from "../db";
import { growthContacts, growthSyncRuns, messagingMessages, aiDialogs } from "@shared/schema";
import { eq, and, sql, count, max, min } from "drizzle-orm";

export async function runMetaWarmAudienceBuilder(tenantId: string, syncRunId: string) {
  await db.update(growthSyncRuns).set({
    status: "RUNNING",
    startedAt: new Date(),
  }).where(eq(growthSyncRuns.id, syncRunId));

  let messagesScanned = 0;
  let contactsUpserted = 0;
  let errors = 0;

  try {
    const contactStats = await db.execute(sql`
      SELECT
        COALESCE(
          CASE WHEN direction = 'inbound' THEN from_address ELSE to_address END,
          ''
        ) AS phone,
        COUNT(*) FILTER (WHERE direction = 'inbound') AS inbound_count,
        COUNT(*) FILTER (WHERE direction = 'outbound') AS outbound_count,
        COUNT(*) AS total_messages,
        MIN(received_at) AS first_seen,
        MAX(received_at) AS last_seen,
        MAX(CASE WHEN direction = 'inbound' THEN received_at END) AS last_inbound,
        MAX(CASE WHEN direction = 'outbound' THEN received_at END) AS last_outbound
      FROM messaging_messages
      WHERE tenant_id = ${tenantId}
        AND (channel = 'whatsapp_cloud' OR (channel = 'whatsapp' AND provider = 'meta'))
        AND COALESCE(
          CASE WHEN direction = 'inbound' THEN from_address ELSE to_address END,
          ''
        ) != ''
      GROUP BY phone
      HAVING COUNT(*) > 0
    `);

    const rows = (contactStats as any).rows || contactStats;
    messagesScanned = rows.length;

    for (const row of rows) {
      try {
        const phone = String(row.phone).replace(/[^0-9+]/g, "");
        if (!phone || phone.length < 7) continue;

        const lastPreviewResult = await db.execute(sql`
          SELECT content->>'text' AS preview
          FROM messaging_messages
          WHERE tenant_id = ${tenantId}
            AND (channel = 'whatsapp_cloud' OR (channel = 'whatsapp' AND provider = 'meta'))
            AND direction = 'inbound'
            AND (from_address = ${phone} OR from_address = ${row.phone})
          ORDER BY received_at DESC
          LIMIT 1
        `);
        const lastPreview = ((lastPreviewResult as any).rows?.[0]?.preview || "")?.substring(0, 200) || null;

        const dialogResult = await db.execute(sql`
          SELECT id FROM ai_dialogs
          WHERE tenant_id = ${tenantId}
            AND contact_phone = ${phone}
          ORDER BY created_at DESC
          LIMIT 1
        `);
        const lastDialogId = (dialogResult as any).rows?.[0]?.id || null;

        const existing = await db.select().from(growthContacts)
          .where(and(
            eq(growthContacts.tenantId, tenantId),
            eq(growthContacts.phone, phone),
          )).limit(1);

        if (existing.length > 0) {
          const updates: Record<string, any> = {
            updatedAt: new Date(),
            inboundCount: Number(row.inbound_count) || 0,
            outboundCount: Number(row.outbound_count) || 0,
            lastChannelProvider: "whatsapp_cloud:meta",
          };
          if (row.last_inbound) updates.lastInboundAt = new Date(row.last_inbound);
          if (row.last_outbound) updates.lastOutboundAt = new Date(row.last_outbound);
          if (row.first_seen && !existing[0].firstSeenAt) updates.firstSeenAt = new Date(row.first_seen);
          if (lastPreview) updates.lastMessagePreview = lastPreview;
          if (lastDialogId) updates.lastDialogId = lastDialogId;
          if (!existing[0].source) updates.source = "meta_warm";

          await db.update(growthContacts).set(updates)
            .where(eq(growthContacts.id, existing[0].id));
          contactsUpserted++;
        } else {
          await db.insert(growthContacts).values({
            tenantId,
            phone,
            source: "meta_warm",
            firstSeenAt: row.first_seen ? new Date(row.first_seen) : new Date(),
            lastInboundAt: row.last_inbound ? new Date(row.last_inbound) : null,
            lastOutboundAt: row.last_outbound ? new Date(row.last_outbound) : null,
            lastDialogId,
            inboundCount: Number(row.inbound_count) || 0,
            outboundCount: Number(row.outbound_count) || 0,
            lastMessagePreview: lastPreview,
            lastChannel: "whatsapp_cloud",
            primaryChannel: "whatsapp_cloud",
            lastChannelProvider: "whatsapp_cloud:meta",
          });
          contactsUpserted++;
        }
      } catch (rowErr) {
        errors++;
        console.error(`[MetaWarm] Error processing contact:`, rowErr);
      }
    }

    await db.update(growthSyncRuns).set({
      status: "SUCCESS",
      finishedAt: new Date(),
      statsJson: { messagesScanned, contactsUpserted, errors },
    }).where(eq(growthSyncRuns.id, syncRunId));

    console.log(`[MetaWarm] Completed for tenant ${tenantId}: ${contactsUpserted} contacts from ${messagesScanned} unique phones`);
  } catch (err: any) {
    await db.update(growthSyncRuns).set({
      status: "FAILED",
      finishedAt: new Date(),
      error: err.message || String(err),
      statsJson: { messagesScanned, contactsUpserted, errors },
    }).where(eq(growthSyncRuns.id, syncRunId));

    console.error(`[MetaWarm] Failed for tenant ${tenantId}:`, err);
  }
}
