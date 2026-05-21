import { db } from "../db";
import { growthSyncRuns } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import { runWahaHistorySync } from "./wahaSyncProvider";
import { runMetaWarmAudienceBuilder } from "./metaWarmAudienceBuilder";

const INTERVAL_MS = 10_000;
const IDLE_INTERVAL_MS = 60_000;
const IDLE_THRESHOLD = 5;

let syncWorkerInterval: NodeJS.Timeout | null = null;
let syncStopped = true;
let syncEmptyTicks = 0;
let syncHadWork = false;
let syncRunId = 0;

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

    syncHadWork = true;

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

function makeSyncTick(runId: number) {
  const tick = async () => {
    if (syncStopped || runId !== syncRunId) return;
    syncHadWork = false;
    try {
      await processPendingSyncRuns();
    } catch (err) {
      console.error("[GrowthSyncWorker] Tick error:", err);
    }
    if (syncHadWork) {
      syncEmptyTicks = 0;
    } else {
      syncEmptyTicks++;
    }
    if (syncStopped || runId !== syncRunId) return;
    const delay = syncEmptyTicks >= IDLE_THRESHOLD ? IDLE_INTERVAL_MS : INTERVAL_MS;
    syncWorkerInterval = setTimeout(tick, delay);
  };
  return tick;
}

export function startGrowthSyncWorker() {
  if (!syncStopped) return;
  syncStopped = false;
  syncEmptyTicks = 0;
  const runId = ++syncRunId;
  syncWorkerInterval = setTimeout(makeSyncTick(runId), INTERVAL_MS);
  console.log(`[GrowthSyncWorker] Started (active=${INTERVAL_MS / 1000}s, idle=${IDLE_INTERVAL_MS / 1000}s after ${IDLE_THRESHOLD} empty ticks)`);
}

export function stopGrowthSyncWorker() {
  syncStopped = true;
  if (syncWorkerInterval) {
    clearTimeout(syncWorkerInterval);
    syncWorkerInterval = null;
  }
}
