import { Router, Request, Response } from "express";
import crypto from "crypto";
import { pool } from "../db.js";
import { normalizeDomain, isValidDomain, isPlatformDomain, getDomainType } from "./normalizeDomain.js";
import { checkTxtRecord, checkARecord, getEdgeIp } from "./dns.js";
import { checkSsl } from "./sslChecker.js";

const router = Router();

function getTenantId(req: Request): string | null {
  const user = (req as any).user;
  return user?.tenantId || null;
}

function requireAuth(req: Request, res: Response): string | null {
  const tenantId = getTenantId(req);
  if (!tenantId) {
    res.status(401).json({ message: "Не авторизован" });
    return null;
  }
  return tenantId;
}

router.get("/api/domains", async (req: Request, res: Response) => {
  const tenantId = requireAuth(req, res);
  if (!tenantId) return;
  try {
    const { rows } = await pool.query(
      "SELECT * FROM domains WHERE tenant_id = $1 ORDER BY created_at DESC",
      [tenantId]
    );
    res.json(rows);
  } catch (err) {
    console.error("[Domains] List error:", err);
    res.status(500).json({ message: "Ошибка загрузки доменов" });
  }
});

router.post("/api/domains", async (req: Request, res: Response) => {
  const tenantId = requireAuth(req, res);
  if (!tenantId) return;
  try {
    const rawDomain = req.body.domain;
    if (!rawDomain || typeof rawDomain !== "string") {
      return res.status(400).json({ message: "Укажите домен" });
    }

    const domain = normalizeDomain(rawDomain);
    if (!isValidDomain(domain)) {
      return res.status(400).json({ message: "Некорректный домен" });
    }

    if (isPlatformDomain(domain)) {
      return res.status(400).json({ message: "Нельзя использовать домен платформы" });
    }

    const existing = await pool.query("SELECT id FROM domains WHERE domain = $1", [domain]);
    if (existing.rowCount && existing.rowCount > 0) {
      return res.status(409).json({ message: "Домен уже добавлен" });
    }

    const token = crypto.randomBytes(24).toString("base64url");
    const type = getDomainType(domain);
    const txtName = `_botfactory-verify.${domain}`;
    const txtValue = `botfactory-verify=${token}`;

    const { rows } = await pool.query(
      `INSERT INTO domains 
       (tenant_id, domain, type, status, verification_token, required_txt_name, required_txt_value, next_check_at)
       VALUES ($1, $2, $3, 'pending_txt', $4, $5, $6, NOW() + INTERVAL '30 seconds')
       RETURNING *`,
      [tenantId, domain, type, token, txtName, txtValue]
    );

    console.log(`[Domains] Added ${domain} for tenant ${tenantId}`);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error("[Domains] Add error:", err);
    res.status(500).json({ message: "Ошибка добавления домена" });
  }
});

router.post("/api/domains/:id/verify", async (req: Request, res: Response) => {
  const tenantId = requireAuth(req, res);
  if (!tenantId) return;
  try {
    const { rows } = await pool.query(
      "SELECT * FROM domains WHERE id = $1 AND tenant_id = $2",
      [req.params.id, tenantId]
    );
    if (!rows.length) return res.status(404).json({ message: "Домен не найден" });

    const d = rows[0];
    let txtOk = d.dns_txt_ok;
    let aOk = d.dns_a_ok;

    if (!txtOk) txtOk = await checkTxtRecord(d.domain, d.required_txt_value);
    if (txtOk) aOk = await checkARecord(d.domain);

    let newStatus: string;
    let errorReason: string | null = null;
    if (txtOk && aOk) {
      newStatus = "active";
    } else if (txtOk) {
      newStatus = "pending_dns";
    } else {
      newStatus = "pending_txt";
      errorReason = "TXT-запись не найдена. Убедитесь, что DNS-запись создана правильно и дождитесь обновления.";
    }

    const { rows: updated } = await pool.query(
      `UPDATE domains 
       SET dns_txt_ok=$1, dns_a_ok=$2, status=$3, error_reason=$4,
           last_check_at=NOW(), attempts=attempts+1, updated_at=NOW()
       WHERE id=$5 RETURNING *`,
      [txtOk, aOk, newStatus, errorReason, d.id]
    );

    console.log(`[Domains] Verify ${d.domain} => ${newStatus} txt=${txtOk} a=${aOk}`);
    res.json(updated[0]);
  } catch (err) {
    console.error("[Domains] Verify error:", err);
    res.status(500).json({ message: "Ошибка проверки" });
  }
});

router.post("/api/domains/:id/retry", async (req: Request, res: Response) => {
  const tenantId = requireAuth(req, res);
  if (!tenantId) return;
  try {
    const { rows } = await pool.query(
      `UPDATE domains 
       SET status='verifying', error_reason=NULL, attempts=0, 
           next_check_at=NOW(), updated_at=NOW()
       WHERE id=$1 AND tenant_id=$2 RETURNING *`,
      [req.params.id, tenantId]
    );
    if (!rows.length) return res.status(404).json({ message: "Домен не найден" });
    console.log(`[Domains] Retry ${rows[0].domain}`);
    res.json(rows[0]);
  } catch (err) {
    console.error("[Domains] Retry error:", err);
    res.status(500).json({ message: "Ошибка" });
  }
});

router.post("/api/domains/:id/check-ssl", async (req: Request, res: Response) => {
  const tenantId = requireAuth(req, res);
  if (!tenantId) return;
  try {
    const { rows } = await pool.query(
      "SELECT * FROM domains WHERE id = $1 AND tenant_id = $2",
      [req.params.id, tenantId]
    );
    if (!rows.length) return res.status(404).json({ message: "Домен не найден" });

    const d = rows[0];
    if (d.status !== "active") {
      return res.status(400).json({ message: "Домен ещё не верифицирован" });
    }

    const result = await checkSsl(d.domain);
    const { rows: updated } = await pool.query(
      `UPDATE domains 
       SET ssl_status=$1, ssl_last_check_at=NOW(), ssl_error_reason=$2, updated_at=NOW()
       WHERE id=$3 RETURNING *`,
      [result.ok ? "active" : "pending", result.error || null, d.id]
    );

    res.json(updated[0]);
  } catch (err) {
    console.error("[Domains] SSL check error:", err);
    res.status(500).json({ message: "Ошибка проверки SSL" });
  }
});

router.delete("/api/domains/:id", async (req: Request, res: Response) => {
  const tenantId = requireAuth(req, res);
  if (!tenantId) return;
  try {
    const { rowCount } = await pool.query(
      "DELETE FROM domains WHERE id = $1 AND tenant_id = $2",
      [req.params.id, tenantId]
    );
    if (!rowCount) return res.status(404).json({ message: "Домен не найден" });
    console.log(`[Domains] Deleted domain ${req.params.id}`);
    res.json({ ok: true });
  } catch (err) {
    console.error("[Domains] Delete error:", err);
    res.status(500).json({ message: "Ошибка удаления" });
  }
});

router.get("/api/domains/:id/instructions", async (req: Request, res: Response) => {
  const tenantId = requireAuth(req, res);
  if (!tenantId) return;
  try {
    const { rows } = await pool.query(
      "SELECT * FROM domains WHERE id = $1 AND tenant_id = $2",
      [req.params.id, tenantId]
    );
    if (!rows.length) return res.status(404).json({ message: "Домен не найден" });

    const d = rows[0];
    res.json({
      domain: d.domain,
      type: d.type,
      txtRecord: {
        name: d.required_txt_name,
        value: d.required_txt_value,
        type: "TXT",
      },
      aRecord: {
        name: d.domain,
        value: getEdgeIp(),
        type: "A",
      },
      status: d.status,
      dnsTxtOk: d.dns_txt_ok,
      dnsAOk: d.dns_a_ok,
    });
  } catch (err) {
    console.error("[Domains] Instructions error:", err);
    res.status(500).json({ message: "Ошибка" });
  }
});

export default router;
