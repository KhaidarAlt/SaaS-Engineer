import { apiRequest } from "@/lib/queryClient";
import type { AnalyticsSummary, DialogListItem, DialogDetail, AuditRun } from "../types/analyticsTypes";

export const ANALYTICS_KEYS = {
  summary: (period: string, source: string) => ["/api/ai/analytics/summary", period, source] as const,
  dialogs: (period: string, source: string, filters?: string) => ["/api/ai/analytics/dialogs", period, source, filters] as const,
  dialogDetail: (id: string) => ["/api/ai/analytics/dialogs", id] as const,
  auditRun: (runId: string) => ["/api/ai/analytics/audit/run", runId] as const,
};

export async function fetchSummary(period: string, source: string, from?: string, to?: string): Promise<AnalyticsSummary> {
  const params = new URLSearchParams({ period, source });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  const res = await fetch(`/api/ai/analytics/summary?${params}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch analytics summary");
  return res.json();
}

export async function fetchDialogs(
  period: string,
  source: string,
  options?: { limit?: number; offset?: number; outcome?: string; goal?: string }
): Promise<{ dialogs: DialogListItem[]; total: number }> {
  const params = new URLSearchParams({ period, source });
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.offset) params.set("offset", String(options.offset));
  if (options?.outcome) params.set("outcome", options.outcome);
  if (options?.goal) params.set("goal", options.goal);
  const res = await fetch(`/api/ai/analytics/dialogs?${params}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch dialogs");
  return res.json();
}

export async function fetchDialogDetail(id: string): Promise<DialogDetail> {
  const res = await fetch(`/api/ai/analytics/dialogs/${id}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch dialog detail");
  return res.json();
}

export async function startAudit(period: string, source: string): Promise<{ runId: string }> {
  const res = await apiRequest("POST", "/api/ai/analytics/audit/run", { period, source });
  return res.json();
}

export async function fetchAuditRun(runId: string): Promise<AuditRun> {
  const res = await fetch(`/api/ai/analytics/audit/run/${runId}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch audit run");
  return res.json();
}
