import { apiRequest } from "@/lib/queryClient";
import type {
  GrowthCampaign, GrowthSummary, EstimateResult, PreviewResult,
  CampaignAnalytics, QueueItem, GrowthSyncRun, GrowthSegment,
  GrowthScenarioTemplate, ProviderInfo, AudienceResult, CampaignHealth,
} from "../types/growthTypes";

export const GROWTH_KEYS = {
  summary: ["/api/ai-rop/growth/summary"],
  campaigns: ["/api/ai-rop/growth/campaigns"],
  campaign: (id: string) => ["/api/ai-rop/growth/campaigns", id],
  queue: (id: string) => ["/api/ai-rop/growth/campaigns", id, "queue"],
  analytics: (id: string) => ["/api/ai-rop/growth/campaigns", id, "analytics"],
  contacts: ["/api/ai-rop/growth/contacts"],
  syncRuns: ["/api/ai-rop/growth/sync"],
  syncLatest: ["/api/ai-rop/growth/sync/latest"],
  audience: ["/api/ai-rop/growth/audience"],
  segments: ["/api/ai-rop/growth/segments"],
  scenarioTemplates: ["/api/ai-rop/growth/scenario-templates"],
  providerInfo: ["/api/ai-rop/growth/provider-info"],
  campaignHealth: (id: string) => ["/api/ai-rop/growth/campaigns", id, "health"],
};

export async function fetchSummary(): Promise<GrowthSummary> {
  const res = await fetch("/api/ai-rop/growth/summary", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch summary");
  return res.json();
}

export async function fetchCampaigns(type?: string): Promise<GrowthCampaign[]> {
  const url = type ? `/api/ai-rop/growth/campaigns?type=${type}` : "/api/ai-rop/growth/campaigns";
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch campaigns");
  return res.json();
}

export async function fetchCampaign(id: string): Promise<GrowthCampaign> {
  const res = await fetch(`/api/ai-rop/growth/campaigns/${id}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch campaign");
  return res.json();
}

export async function createCampaign(data: Partial<GrowthCampaign>): Promise<GrowthCampaign> {
  const res = await apiRequest("POST", "/api/ai-rop/growth/campaigns", data);
  return res.json();
}

export async function updateCampaign(id: string, data: Partial<GrowthCampaign>): Promise<GrowthCampaign> {
  const res = await apiRequest("PUT", `/api/ai-rop/growth/campaigns/${id}`, data);
  return res.json();
}

export async function estimateCampaign(id: string): Promise<EstimateResult> {
  const res = await apiRequest("POST", `/api/ai-rop/growth/campaigns/${id}/estimate`);
  return res.json();
}

export async function previewCampaign(id: string): Promise<PreviewResult> {
  const res = await apiRequest("POST", `/api/ai-rop/growth/campaigns/${id}/preview`);
  return res.json();
}

export async function launchCampaign(id: string): Promise<{ success: boolean; queued: number; skipped: number }> {
  const res = await apiRequest("POST", `/api/ai-rop/growth/campaigns/${id}/launch`);
  return res.json();
}

export async function pauseCampaign(id: string): Promise<{ success: boolean }> {
  const res = await apiRequest("POST", `/api/ai-rop/growth/campaigns/${id}/pause`);
  return res.json();
}

export async function resumeCampaign(id: string): Promise<{ success: boolean }> {
  const res = await apiRequest("POST", `/api/ai-rop/growth/campaigns/${id}/resume`);
  return res.json();
}

export async function fetchQueue(id: string, limit = 50): Promise<{ items: QueueItem[]; total: number }> {
  const res = await fetch(`/api/ai-rop/growth/campaigns/${id}/queue?limit=${limit}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch queue");
  return res.json();
}

export async function fetchCampaignAnalytics(id: string): Promise<CampaignAnalytics> {
  const res = await fetch(`/api/ai-rop/growth/campaigns/${id}/analytics`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch analytics");
  return res.json();
}

export async function testSend(contactId: string, text: string, channelPolicy?: string): Promise<any> {
  const res = await apiRequest("POST", "/api/ai-rop/growth/test-send", { contactId, text, channelPolicy });
  return res.json();
}

export async function triggerSync(): Promise<GrowthSyncRun> {
  const res = await apiRequest("POST", "/api/ai-rop/growth/sync");
  return res.json();
}

export async function fetchSyncRuns(): Promise<GrowthSyncRun[]> {
  const res = await fetch("/api/ai-rop/growth/sync", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch sync runs");
  return res.json();
}

export async function fetchLatestSync(): Promise<GrowthSyncRun | null> {
  const res = await fetch("/api/ai-rop/growth/sync/latest", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch latest sync");
  return res.json();
}

export async function fetchAudience(params: Record<string, string> = {}): Promise<AudienceResult> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`/api/ai-rop/growth/audience?${qs}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch audience");
  return res.json();
}

export async function fetchSegments(): Promise<GrowthSegment[]> {
  const res = await fetch("/api/ai-rop/growth/segments", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch segments");
  return res.json();
}

export async function createSegment(name: string, rulesJson: Record<string, unknown>): Promise<GrowthSegment> {
  const res = await apiRequest("POST", "/api/ai-rop/growth/segments", { name, rulesJson });
  return res.json();
}

export async function deleteSegment(id: string): Promise<void> {
  await apiRequest("DELETE", `/api/ai-rop/growth/segments/${id}`);
}

export async function fetchScenarioTemplates(niche?: string): Promise<GrowthScenarioTemplate[]> {
  const qs = niche ? `?niche=${niche}` : "";
  const res = await fetch(`/api/ai-rop/growth/scenario-templates${qs}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch templates");
  return res.json();
}

export async function fetchProviderInfo(): Promise<ProviderInfo> {
  const res = await fetch("/api/ai-rop/growth/provider-info", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch provider info");
  return res.json();
}

export async function fetchCampaignHealth(id: string): Promise<CampaignHealth> {
  const res = await fetch(`/api/ai-rop/growth/campaigns/${id}/health`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch campaign health");
  return res.json();
}
