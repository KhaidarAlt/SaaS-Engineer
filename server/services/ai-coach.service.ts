import OpenAI from "openai";
import { db } from "../db";
import { eq, and, desc, sql, inArray, notInArray } from "drizzle-orm";
import {
  messagingMessages,
  aiDialogs,
  aiLearningSuggestions,
} from "@shared/schema";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

interface SuggestionFromAI {
  topic: string;
  problem_summary: string;
  suggested_content: string;
  potential_revenue_impact: number;
  source_dialog_ids: string[];
}

export async function analyzeDialogs(tenantId: string) {
  const failedDialogs = await db
    .select({
      id: aiDialogs.id,
      outcome: aiDialogs.outcome,
      dropoffReason: aiDialogs.dropoffReason,
      dropoffStage: aiDialogs.dropoffStage,
      messageCount: aiDialogs.messageCount,
    })
    .from(aiDialogs)
    .where(
      and(
        eq(aiDialogs.tenantId, tenantId),
        notInArray(aiDialogs.outcome, ["SUCCESS"]),
      )
    )
    .orderBy(desc(aiDialogs.createdAt))
    .limit(30);

  const dialogIds = failedDialogs.map((d) => d.id);

  if (dialogIds.length === 0) {
    return { suggestions: 0, message: "Нет диалогов для анализа" };
  }

  const messages = await db
    .select({
      id: messagingMessages.id,
      dialogId: messagingMessages.dialogId,
      direction: messagingMessages.direction,
      content: messagingMessages.content,
      createdAt: messagingMessages.createdAt,
    })
    .from(messagingMessages)
    .where(
      and(
        eq(messagingMessages.tenantId, tenantId),
        inArray(messagingMessages.dialogId, dialogIds),
      )
    )
    .orderBy(desc(messagingMessages.createdAt))
    .limit(100);

  if (messages.length === 0) {
    return { suggestions: 0, message: "Нет сообщений для анализа" };
  }

  const dialogMap: Record<string, { outcome: string; dropoffReason: string | null; messages: typeof messages }> = {};
  for (const d of failedDialogs) {
    dialogMap[d.id] = { outcome: d.outcome, dropoffReason: d.dropoffReason, messages: [] };
  }
  for (const m of messages) {
    if (m.dialogId && dialogMap[m.dialogId]) {
      dialogMap[m.dialogId].messages.push(m);
    }
  }

  const chatLogsSummary = Object.entries(dialogMap)
    .filter(([, v]) => v.messages.length > 0)
    .slice(0, 15)
    .map(([dialogId, data]) => {
      const msgs = data.messages
        .sort((a, b) => (a.createdAt?.getTime() || 0) - (b.createdAt?.getTime() || 0))
        .map((m) => {
          const role = m.direction === "inbound" ? "Клиент" : "Бот";
          const text = typeof m.content === "object" && m.content !== null ? (m.content as any).text || JSON.stringify(m.content) : String(m.content || "");
          return `${role}: ${text.slice(0, 300)}`;
        })
        .join("\n");
      return `--- Диалог ${dialogId} (результат: ${data.outcome}, причина: ${data.dropoffReason || "неизвестна"}) ---\n${msgs}`;
    })
    .join("\n\n");

  const systemPrompt = `You are a Business Analyst for botfactory.kz. Analyze these chat logs from unsuccessful or incomplete sales dialogs. Identify 3 recurring customer questions that the bot couldn't answer or answered poorly. For each, suggest a clear, professional knowledge base article in Russian language.

Output a JSON object with key "suggestions" containing an array:
{
  "suggestions": [
    {
      "topic": "Short title in Russian",
      "problem_summary": "Why this is a knowledge gap, in Russian",
      "suggested_content": "Full article text for the knowledge base, in Russian, 2-5 paragraphs",
      "potential_revenue_impact": 15000,
      "source_dialog_ids": ["dialog_id_1", "dialog_id_2"]
    }
  ]
}

Rules:
- Write all text in Russian
- potential_revenue_impact is an estimate in KZT of how much revenue this knowledge gap costs per month
- source_dialog_ids should reference actual dialog IDs from the logs
- Make suggested_content detailed enough to be a standalone knowledge base article
- Focus on the most impactful gaps first
- Always return exactly the JSON format above`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: chatLogsSummary },
    ],
    temperature: 0.3,
    response_format: { type: "json_object" },
  });

  const raw = response.choices[0]?.message?.content || "{}";
  let suggestions: SuggestionFromAI[] = [];
  try {
    const parsed = JSON.parse(raw);
    const arr = Array.isArray(parsed) ? parsed : (parsed.suggestions || parsed.items || parsed.recommendations || []);
    suggestions = arr.filter((s: any) =>
      typeof s.topic === "string" &&
      typeof s.problem_summary === "string" &&
      typeof s.suggested_content === "string"
    );
  } catch {
    return { suggestions: 0, message: "Не удалось разобрать ответ AI" };
  }

  const existingTopics = await db
    .select({ topic: aiLearningSuggestions.topic })
    .from(aiLearningSuggestions)
    .where(
      and(
        eq(aiLearningSuggestions.tenantId, tenantId),
        eq(aiLearningSuggestions.status, "pending"),
      )
    );
  const existingSet = new Set(existingTopics.map((t) => t.topic.toLowerCase()));

  let inserted = 0;
  for (const s of suggestions) {
    if (existingSet.has(s.topic.toLowerCase())) continue;
    await db.insert(aiLearningSuggestions).values({
      tenantId,
      topic: s.topic,
      problemSummary: s.problem_summary,
      suggestedContent: s.suggested_content,
      status: "pending",
      sourceDialogIds: s.source_dialog_ids || [],
      potentialRevenueImpact: s.potential_revenue_impact || 0,
    });
    inserted++;
  }

  return { suggestions: inserted, message: `Создано ${inserted} рекомендаций` };
}
