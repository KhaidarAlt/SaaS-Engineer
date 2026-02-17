import { apiRequest } from "@/lib/queryClient";
import type {
  AiTrigger,
  KnowledgeItem,
  AiAntiPattern,
  AiTrainingEvent,
  QuickTrainRequest,
  QuickTrainResult,
  RecentTestMessage,
} from "../types/trainingTypes";

export const TRAINING_KEYS = {
  triggers: ["/api/ai/triggers"] as const,
  knowledge: ["/api/ai/knowledge"] as const,
  knowledgeByType: (type: string) => ["/api/ai/knowledge", type] as const,
  antiPatterns: ["/api/ai/anti-patterns"] as const,
  history: ["/api/ai/training/history"] as const,
  recentMessages: ["/api/ai/training/recent-messages"] as const,
};

export async function fetchTriggers(): Promise<AiTrigger[]> {
  const res = await fetch("/api/ai/triggers", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch triggers");
  return res.json();
}

export async function createTrigger(data: Partial<AiTrigger>): Promise<AiTrigger> {
  const res = await apiRequest("POST", "/api/ai/triggers", data);
  return res.json();
}

export async function updateTrigger(id: string, data: Partial<AiTrigger>): Promise<AiTrigger> {
  const res = await apiRequest("PUT", `/api/ai/triggers/${id}`, data);
  return res.json();
}

export async function deleteTrigger(id: string): Promise<void> {
  await apiRequest("DELETE", `/api/ai/triggers/${id}`);
}

export async function toggleTrigger(id: string): Promise<AiTrigger> {
  const res = await apiRequest("POST", `/api/ai/triggers/${id}/toggle`);
  return res.json();
}

export async function fetchKnowledge(type?: string): Promise<KnowledgeItem[]> {
  const url = type ? `/api/ai/knowledge?type=${type}` : "/api/ai/knowledge";
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch knowledge");
  return res.json();
}

export async function createKnowledge(data: Partial<KnowledgeItem>): Promise<KnowledgeItem> {
  const res = await apiRequest("POST", "/api/ai/knowledge", data);
  return res.json();
}

export async function updateKnowledge(id: string, data: Partial<KnowledgeItem>): Promise<KnowledgeItem> {
  const res = await apiRequest("PUT", `/api/ai/knowledge/${id}`, data);
  return res.json();
}

export async function deleteKnowledge(id: string): Promise<void> {
  await apiRequest("DELETE", `/api/ai/knowledge/${id}`);
}

export async function importFromCatalog(): Promise<{ imported: number; items: KnowledgeItem[] }> {
  const res = await apiRequest("POST", "/api/ai/knowledge/import-from-catalog");
  return res.json();
}

export async function fetchAntiPatterns(): Promise<AiAntiPattern[]> {
  const res = await fetch("/api/ai/anti-patterns", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch anti-patterns");
  return res.json();
}

export async function createAntiPattern(data: Partial<AiAntiPattern>): Promise<AiAntiPattern> {
  const res = await apiRequest("POST", "/api/ai/anti-patterns", data);
  return res.json();
}

export async function updateAntiPattern(id: string, data: Partial<AiAntiPattern>): Promise<AiAntiPattern> {
  const res = await apiRequest("PUT", `/api/ai/anti-patterns/${id}`, data);
  return res.json();
}

export async function deleteAntiPattern(id: string): Promise<void> {
  await apiRequest("DELETE", `/api/ai/anti-patterns/${id}`);
}

export async function toggleAntiPattern(id: string): Promise<AiAntiPattern> {
  const res = await apiRequest("POST", `/api/ai/anti-patterns/${id}/toggle`);
  return res.json();
}

export async function quickTrain(data: QuickTrainRequest): Promise<QuickTrainResult> {
  const res = await apiRequest("POST", "/api/ai/training/quick-train", data);
  return res.json();
}

export async function fetchHistory(limit = 50, offset = 0): Promise<AiTrainingEvent[]> {
  const res = await fetch(`/api/ai/training/history?limit=${limit}&offset=${offset}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch history");
  return res.json();
}

export async function fetchRecentMessages(limit = 20): Promise<RecentTestMessage[]> {
  const res = await fetch(`/api/ai/training/recent-messages?limit=${limit}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch recent messages");
  return res.json();
}
