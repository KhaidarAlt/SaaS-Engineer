import { apiRequest } from "@/lib/queryClient";
import type { ChannelInfo, ChannelEvent, DisclaimerStatus, HealthCheckResult } from "../types/connectTypes";

export const CONNECT_KEYS = {
  channels: ["/api/ai-rop/connect/channels"],
  events: ["/api/ai-rop/connect/events"],
  disclaimerStatus: ["/api/ai-rop/connect/waha/disclaimer-status"],
};

export async function fetchChannels(): Promise<ChannelInfo[]> {
  const res = await fetch("/api/ai-rop/connect/channels", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch channels");
  return res.json();
}

export async function fetchEvents(limit = 10): Promise<ChannelEvent[]> {
  const res = await fetch(`/api/ai-rop/connect/events?limit=${limit}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch events");
  return res.json();
}

export async function fetchDisclaimerStatus(): Promise<DisclaimerStatus> {
  const res = await fetch("/api/ai-rop/connect/waha/disclaimer-status", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch disclaimer status");
  return res.json();
}

export async function acceptDisclaimer(version: string): Promise<void> {
  await apiRequest("POST", "/api/ai-rop/connect/waha/accept-disclaimer", { version });
}

export async function healthCheckAll(): Promise<HealthCheckResult> {
  const res = await apiRequest("POST", "/api/ai-rop/connect/health-check-all");
  return res.json();
}

export async function validateTelegramToken(botToken: string): Promise<{ success: boolean; botName?: string; error?: string }> {
  const res = await apiRequest("POST", "/api/ai-rop/connect/telegram/validate", { botToken });
  return res.json();
}

export async function connectTelegram(botToken: string): Promise<{ success: boolean; botUsername?: string; error?: string }> {
  const res = await apiRequest("POST", "/api/ai-rop/connect/telegram/connect", { botToken });
  return res.json();
}

export async function disconnectTelegram(): Promise<{ success: boolean }> {
  const res = await apiRequest("POST", "/api/ai-rop/connect/telegram/disconnect");
  return res.json();
}

export async function testTelegram(): Promise<{ success: boolean; botName?: string; error?: string }> {
  const res = await apiRequest("POST", "/api/ai-rop/connect/telegram/test");
  return res.json();
}

export async function toggleChannelAi(channelType: string, enabled: boolean): Promise<void> {
  await apiRequest("POST", "/api/ai-rop/connect/channel/ai-toggle", { channelType, enabled });
}
