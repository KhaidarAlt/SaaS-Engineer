import { apiRequest } from "@/lib/queryClient";
import type { AiScore, ReadinessCheck, TestMode, FeedbackAction, StressTestRun } from "../types/testingTypes";

export const TESTING_KEYS = {
  score: ["/api/ai/testing/score"] as const,
  readiness: (goal?: string) => ["/api/ai/testing/readiness", goal] as const,
  stressRun: (runId: string) => ["/api/ai/testing/stress/run", runId] as const,
};

export async function fetchScore(): Promise<AiScore> {
  const res = await fetch("/api/ai/testing/score", { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch score");
  return res.json();
}

export async function recomputeScore(): Promise<AiScore> {
  const res = await apiRequest("POST", "/api/ai/testing/score/recompute");
  return res.json();
}

export async function fetchReadiness(goal?: string): Promise<ReadinessCheck> {
  const url = goal ? `/api/ai/testing/readiness?goal=${goal}` : "/api/ai/testing/readiness";
  const res = await fetch(url, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch readiness");
  return res.json();
}

export async function startSession(mode: TestMode, personaKey?: string): Promise<{ sessionId: string; messages?: Array<{ id: string; role: string; content: string; meta?: Record<string, unknown>; createdAt: string }> }> {
  const res = await apiRequest("POST", "/api/ai/testing/session/start", { mode, personaKey });
  return res.json();
}

export async function sendMessage(sessionId: string, userText: string): Promise<{ assistantMessage: { id: string; content: string; meta?: Record<string, unknown>; createdAt: string }; microEval: { score: number; positives: string[]; issues: string[]; suggestions: string[] } }> {
  const res = await apiRequest("POST", "/api/ai/testing/message/send", { sessionId, userText });
  return res.json();
}

export async function sendFeedback(messageId: string, action: FeedbackAction, editedText?: string): Promise<void> {
  await apiRequest("POST", "/api/ai/testing/message/feedback", { messageId, action, editedText });
}

export async function startSimulation(personaKey: string): Promise<{ sessionId: string; messages: Array<{ id: string; role: string; content: string; meta?: Record<string, unknown>; createdAt: string }> }> {
  const res = await apiRequest("POST", "/api/ai/testing/simulation/start", { personaKey });
  return res.json();
}

export async function nextSimulationMessage(sessionId: string): Promise<{ message: { id: string; role: string; content: string; meta?: Record<string, unknown>; createdAt: string } }> {
  const res = await apiRequest("POST", "/api/ai/testing/simulation/next", { sessionId });
  return res.json();
}

export async function startStressTest(scenarios?: string[]): Promise<{ runId: string }> {
  const res = await apiRequest("POST", "/api/ai/testing/stress/run", { scenarios });
  return res.json();
}

export async function fetchStressRun(runId: string): Promise<StressTestRun> {
  const res = await fetch(`/api/ai/testing/stress/run/${runId}`, { credentials: "include" });
  if (!res.ok) throw new Error("Failed to fetch stress run");
  return res.json();
}
