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

    if (instances.length === 0) {
      throw new Error("No connected WAHA instances found");
    }

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

            const phone = chatId.replace("@c.us", "");
            if (!phone || phone.length < 7) continue;

            const displayName = chat.name || chat.pushName || null;
            const lastMessageAt = chat.lastMessage?.timestamp
              ? new Date(chat.lastMessage.timestamp * 1000)
              : null;
            const lastPreview = chat.lastMessage?.body?.substring(0, 200) || null;

            const existing = await db.select().from(growthContacts)
              .where(and(
                eq(growthContacts.tenantId, tenantId),
                eq(growthContacts.phone, phone),
              )).limit(1);

            if (existing.length > 0) {
              const updates: Record<string, any> = {
                updatedAt: new Date(),
                lastChannelProvider: "whatsapp:waha",
              };
              if (displayName && !existing[0].name) updates.name = displayName;
              if (lastMessageAt && (!existing[0].lastInboundAt || lastMessageAt > existing[0].lastInboundAt)) {
                updates.lastInboundAt = lastMessageAt;
              }
              if (lastPreview) updates.lastMessagePreview = lastPreview;
              if (!existing[0].source) updates.source = "waha_sync";

              await db.update(growthContacts).set(updates)
                .where(eq(growthContacts.id, existing[0].id));
              contactsUpserted++;
            } else {
              await db.insert(growthContacts).values({
                tenantId,
                phone,
                name: displayName,
                source: "waha_sync",
                firstSeenAt: lastMessageAt || new Date(),
                lastInboundAt: lastMessageAt,
                lastChannel: "whatsapp",
                primaryChannel: "whatsapp",
                lastChannelProvider: "whatsapp:waha",
                lastMessagePreview: lastPreview,
              });
              contactsUpserted++;
            }
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

    await db.update(growthSyncRuns).set({
      status: "SUCCESS",
      finishedAt: new Date(),
      statsJson: { chatsScanned, contactsUpserted, errors },
    }).where(eq(growthSyncRuns.id, syncRunId));

    console.log(`[WahaSync] Completed for tenant ${tenantId}: ${contactsUpserted} contacts from ${chatsScanned} chats`);
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
