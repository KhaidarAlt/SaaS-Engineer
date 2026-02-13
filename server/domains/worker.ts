import { pool } from "../db.js";
import { checkTxtRecord, checkARecord } from "./dns.js";
import { checkSsl } from "./sslChecker.js";

const MAX_ATTEMPTS = 200;
const MAX_AGE_MS = 48 * 60 * 60 * 1000;

function backoffMs(attempts: number): number {
  const base = 30_000;
  const max = 30 * 60_000;
  return Math.min(base * Math.pow(1.5, Math.min(attempts, 20)), max);
}

let running = false;

export async function runDomainCheckCycle(): Promise<void> {
  if (running) return;
  running = true;
  try {
    const { rows } = await pool.query(
      `SELECT * FROM domains 
       WHERE status IN ('pending_txt','pending_dns','verifying') 
         AND (next_check_at IS NULL OR next_check_at <= NOW())
       ORDER BY next_check_at ASC NULLS FIRST
       LIMIT 20`
    );

    for (const d of rows) {
      try {
        await checkDomain(d);
      } catch (err) {
        console.error(`[DomainWorker] Error checking ${d.domain}:`, err);
      }
    }

    const { rows: sslRows } = await pool.query(
      `SELECT * FROM domains 
       WHERE status = 'active' AND ssl_status != 'active'
         AND (ssl_last_check_at IS NULL OR ssl_last_check_at < NOW() - INTERVAL '2 minutes')
       LIMIT 10`
    );

    for (const d of sslRows) {
      try {
        await checkDomainSsl(d);
      } catch (err) {
        console.error(`[DomainWorker] SSL check error for ${d.domain}:`, err);
      }
    }
  } catch (err) {
    console.error("[DomainWorker] Cycle error:", err);
  } finally {
    running = false;
  }
}

async function checkDomain(d: any): Promise<void> {
  const age = Date.now() - new Date(d.created_at).getTime();
  if (d.attempts >= MAX_ATTEMPTS || age > MAX_AGE_MS) {
    await pool.query(
      `UPDATE domains SET status='error', error_reason=$1, updated_at=NOW() WHERE id=$2`,
      ["Превышено время ожидания верификации. Нажмите «Повторить» для новой попытки.", d.id]
    );
    console.log(`[DomainWorker] ${d.domain} => error (timeout/max attempts)`);
    return;
  }

  let txtOk = d.dns_txt_ok;
  let aOk = d.dns_a_ok;

  if (!txtOk) {
    txtOk = await checkTxtRecord(d.domain, d.required_txt_value);
  }

  if (txtOk && !aOk) {
    aOk = await checkARecord(d.domain);
  }

  const newAttempts = d.attempts + 1;
  const nextCheck = new Date(Date.now() + backoffMs(newAttempts));

  let newStatus = d.status;
  let errorReason: string | null = null;

  if (txtOk && aOk) {
    newStatus = "active";
    errorReason = null;
  } else if (txtOk && !aOk) {
    newStatus = "pending_dns";
  } else {
    newStatus = "pending_txt";
  }

  await pool.query(
    `UPDATE domains 
     SET dns_txt_ok=$1, dns_a_ok=$2, status=$3, attempts=$4, 
         last_check_at=NOW(), next_check_at=$5, error_reason=$6, updated_at=NOW()
     WHERE id=$7`,
    [txtOk, aOk, newStatus, newAttempts, nextCheck, errorReason, d.id]
  );

  console.log(`[DomainWorker] ${d.domain} => status=${newStatus} txt=${txtOk} a=${aOk} attempt=${newAttempts}`);
}

async function checkDomainSsl(d: any): Promise<void> {
  const result = await checkSsl(d.domain);
  await pool.query(
    `UPDATE domains 
     SET ssl_status=$1, ssl_last_check_at=NOW(), ssl_error_reason=$2, updated_at=NOW()
     WHERE id=$3`,
    [result.ok ? "active" : "pending", result.error || null, d.id]
  );
  console.log(`[DomainWorker] SSL ${d.domain} => ${result.ok ? "active" : "pending"} ${result.error || ""}`);
}

let intervalId: ReturnType<typeof setInterval> | null = null;

export function startDomainWorker(): void {
  if (intervalId) return;
  console.log("[DomainWorker] Started (every 45s)");
  runDomainCheckCycle();
  intervalId = setInterval(runDomainCheckCycle, 45_000);
}

export function stopDomainWorker(): void {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
}
