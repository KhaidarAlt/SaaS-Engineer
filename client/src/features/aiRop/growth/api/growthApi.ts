import { apiRequest } from "@/lib/queryClient";
import type { GrowthCampaign, GrowthSummary, EstimateResult, PreviewResult, CampaignAnalytics, QueueItem } from "../types/growthTypes";

export const GROWTH_KEYS = {
  summary: ["/api/ai-rop/growth/summary"],
  campaigns: ["/api/ai-rop/growth/campaigns"],
  campaign: (id: string) => ["/api/ai-rop/growth/campaigns", id],
  queue: (id: string) => ["/api/ai-rop/growth/campaigns", id, "queue"],
  analytics: (id: string) => ["/api/ai-rop/growth/campaigns", id, "analytics"],
  contacts: ["/api/ai-rop/growth/contacts"],
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
