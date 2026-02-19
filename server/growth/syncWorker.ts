import { db } from "../db";
import { growthSyncRuns } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { runWahaHistorySync } from "./wahaSyncProvider";
import { runMetaWarmAudienceBuilder } from "./metaWarmAudienceBuilder";

let syncWorkerInterval: NodeJS.Timeout | null = null;

async function processPendingSyncRuns() {
  try {
    const pendingRuns = await db.execute(sql`
      SELECT id, tenant_id, provider
      FROM growth_sync_runs
      WHERE status = 'PENDING'
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `);

    const rows = (pendingRuns as any).rows || pendingRuns;
    if (!rows || rows.length === 0) return;

    const run = rows[0];
    const tenantId = run.tenant_id;
    const syncRunId = run.id;
    const provider = run.provider;

    console.log(`[GrowthSyncWorker] Processing sync run ${syncRunId} for tenant ${tenantId} (${provider})`);

    if (provider === "waha_whatsapp") {
      await runWahaHistorySync(tenantId, syncRunId);
    } else if (provider === "meta_whatsapp") {
      await runMetaWarmAudienceBuilder(tenantId, syncRunId);
    } else {
      await db.update(growthSyncRuns).set({
        status: "FAILED",
        finishedAt: new Date(),
        error: `Unknown provider: ${provider}`,
      }).where(eq(growthSyncRuns.id, syncRunId));
    }
  } catch (err) {
    console.error("[GrowthSyncWorker] Error processing sync run:", err);
  }
}

export function startGrowthSyncWorker() {
  if (syncWorkerInterval) return;
  syncWorkerInterval = setInterval(processPendingSyncRuns, 10_000);
  console.log("[GrowthSyncWorker] Started (every 10s)");
}
