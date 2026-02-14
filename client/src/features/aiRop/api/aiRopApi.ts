import { apiRequest, queryClient } from "@/lib/queryClient";
import type {
  AiRopSettings, ReadinessResult, CatalogSummary,
  AnalyticsSummary, FunnelStage, DropoffReason,
  AuditReport, TestChatResponse, VersionHistoryEntry,
  HandoverRule, KnowledgeItem, TrainingItem, OnboardingData,
} from "../types/aiRopTypes";

export const AI_ROP_KEYS = {
  settings: ["/api/ai-rop/settings"] as const,
  readiness: (goal?: string) => ["/api/ai-rop/goal-readiness", goal] as const,
  catalogSummary: ["/api/ai-rop/catalog-summary"] as const,
  analytics: (period?: string) => ["/api/ai-rop/analytics/summary", period] as const,
  funnel: (period?: string) => ["/api/ai-rop/analytics/funnel", period] as const,
  dropoffs: (period?: string) => ["/api/ai-rop/analytics/dropoffs", period] as const,
  auditLatest: ["/api/ai-rop/audit/reports"] as const,
  handoverRules: ["/api/ai-rop/handover-rules"] as const,
  knowledgeItems: ["/api/ai-rop/knowledge-items"] as const,
  trainingItems: ["/api/ai-rop/training-items"] as const,
  settingsHistory: ["/api/ai-rop/settings-history"] as const,
  onboardingStatus: ["/api/ai-rop/onboarding/status"] as const,
};

export async function fetchSettings(): Promise<AiRopSettings> {
  const res = await fetch("/api/ai-rop/settings", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch settings");
  return res.json();
}

export async function saveSettings(data: Partial<AiRopSettings>): Promise<AiRopSettings> {
  const res = await apiRequest("PUT", "/api/ai-rop/settings", data);
  const result = await res.json();
  queryClient.invalidateQueries({ queryKey: AI_ROP_KEYS.settings });
  queryClient.invalidateQueries({ queryKey: ["/api/ai-rop/settings-history"] });
  return result;
}

export async function fetchOnboardingStatus(): Promise<{ completed: boolean; step: number }> {
  const res = await fetch("/api/ai-rop/onboarding/status", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch onboarding status");
  return res.json();
}

export async function completeOnboarding(data: OnboardingData): Promise<void> {
  await apiRequest("POST", "/api/ai-rop/onboarding/complete", data);
  queryClient.invalidateQueries({ queryKey: AI_ROP_KEYS.onboardingStatus });
  queryClient.invalidateQueries({ queryKey: AI_ROP_KEYS.settings });
}

export async function fetchCatalogSummary(): Promise<CatalogSummary> {
  const res = await fetch("/api/ai-rop/catalog-summary", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch catalog summary");
  return res.json();
}

export async function fetchReadiness(goal?: string): Promise<ReadinessResult> {
  const url = goal ? `/api/ai-rop/goal-readiness?goal=${goal}` : "/api/ai-rop/goal-readiness";
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch readiness");
  return res.json();
}

export async function fetchAnalyticsSummary(period?: string): Promise<AnalyticsSummary> {
  const params = period ? `?period=${period}` : "";
  const res = await fetch(`/api/ai-rop/analytics/summary${params}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch analytics");
  return res.json();
}

export async function fetchFunnel(period?: string): Promise<FunnelStage[]> {
  const params = period ? `?period=${period}` : "";
  const res = await fetch(`/api/ai-rop/analytics/funnel${params}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch funnel");
  return res.json();
}

export async function fetchDropoffs(period?: string): Promise<DropoffReason[]> {
  const params = period ? `?period=${period}` : "";
  const res = await fetch(`/api/ai-rop/analytics/dropoffs${params}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch dropoffs");
  return res.json();
}

export async function runAudit(from?: string, to?: string): Promise<AuditReport> {
  const res = await apiRequest("POST", "/api/ai-rop/audit/run", { from, to });
  const result = await res.json();
  queryClient.invalidateQueries({ queryKey: AI_ROP_KEYS.auditLatest });
  return result;
}

export async function sendTestMessage(message: string, conversationId?: string): Promise<TestChatResponse> {
  const res = await apiRequest("POST", "/api/ai-rop/test-chat", { message, conversationId });
  return res.json();
}

export async function trainFromMessage(data: {
  messageId: string;
  action: "fix_only" | "train_future" | "add_knowledge" | "anti_pattern";
  correctedText?: string;
}): Promise<void> {
  await apiRequest("POST", "/api/ai-rop/test-chat/train", data);
  queryClient.invalidateQueries({ queryKey: AI_ROP_KEYS.trainingItems });
}

export async function fetchVersionHistory(): Promise<VersionHistoryEntry[]> {
  const res = await fetch("/api/ai-rop/settings-history", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch version history");
  return res.json();
}

export async function rollbackToVersion(id: string): Promise<AiRopSettings> {
  const res = await apiRequest("POST", `/api/ai-rop/settings-history/${id}/rollback`);
  const result = await res.json();
  queryClient.invalidateQueries({ queryKey: AI_ROP_KEYS.settings });
  queryClient.invalidateQueries({ queryKey: AI_ROP_KEYS.settingsHistory });
  return result;
}

export async function applyRecommendation(recommendation: { problem: string; suggestion: string; type: string }): Promise<void> {
  await apiRequest("POST", "/api/ai-rop/recommendations/apply", recommendation);
  queryClient.invalidateQueries({ queryKey: AI_ROP_KEYS.settings });
  queryClient.invalidateQueries({ queryKey: AI_ROP_KEYS.settingsHistory });
}

export async function ignoreRecommendation(recommendation: { problem: string; type: string }): Promise<void> {
  await apiRequest("POST", "/api/ai-rop/recommendations/ignore", recommendation);
}
