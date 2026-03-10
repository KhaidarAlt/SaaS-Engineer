import { db } from "../db";
import { growthContacts } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";
import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

const MAX_CONTACTS_PER_RUN = 10;

interface AnalysisResult {
  dealStatus: "successful" | "in_progress" | "failed" | "abandoned" | "no_deal" | "personal";
  dealSummary: string;
  customerIntent: string | null;
  failureReason: string | null;
  commonQuestions: string[];
  successPatterns: string | null;
  analyzedAt: string;
}

export async function analyzeContacts(tenantId: string): Promise<number> {
  const contacts = await db.select().from(growthContacts)
    .where(and(
      eq(growthContacts.tenantId, tenantId),
      eq(growthContacts.optOut, false),
    ))
    .limit(100);

  let analyzed = 0;

  for (const contact of contacts) {
    if (analyzed >= MAX_CONTACTS_PER_RUN) break;

    const meta = (contact.meta || {}) as Record<string, any>;
    const existingAnalysis = meta.analysis as AnalysisResult | undefined;

    if (existingAnalysis?.analyzedAt) {
      const lastMsgResult = await db.execute(sql`
        SELECT MAX(received_at) AS last_msg
        FROM messaging_messages
        WHERE tenant_id = ${tenantId}
          AND (from_address = ${contact.phone} OR to_address = ${contact.phone})
      `);
      const lastMsg = ((lastMsgResult as any).rows || lastMsgResult)?.[0]?.last_msg;
      if (lastMsg && new Date(lastMsg) <= new Date(existingAnalysis.analyzedAt)) {
        continue;
      }
    }

    try {
      const result = await analyzeOneContact(tenantId, contact);
      if (result) {
        const updatedMeta = { ...meta, analysis: result };
        await db.update(growthContacts)
          .set({ meta: updatedMeta, updatedAt: new Date() })
          .where(eq(growthContacts.id, contact.id));
        analyzed++;
      }
    } catch (err) {
      console.error(`[Analyzer] Error analyzing ${contact.phone}:`, err);
    }
  }

  return analyzed;
}

async function analyzeOneContact(
  tenantId: string,
  contact: typeof growthContacts.$inferSelect,
): Promise<AnalysisResult | null> {
  const msgResult = await db.execute(sql`
    SELECT direction, from_address, to_address,
           content->>'text' AS body,
           received_at
    FROM messaging_messages
    WHERE tenant_id = ${tenantId}
      AND (from_address = ${contact.phone} OR to_address = ${contact.phone})
    ORDER BY received_at ASC
    LIMIT 100
  `);

  const messages = (msgResult as any).rows || msgResult;
  if (!messages || messages.length < 2) return null;

  const meta = (contact.meta || {}) as Record<string, any>;
  const isPaid = meta.isPaid === true;
  const hasAbandonedCart = meta.hasAbandonedCart === true;
  const tags = contact.tags || [];

  if (isPaid || tags.includes("paid")) {
    return {
      dealStatus: "successful",
      dealSummary: "Сделка завершена успешно — оплата подтверждена в CRM.",
      customerIntent: null,
      failureReason: null,
      commonQuestions: [],
      successPatterns: null,
      analyzedAt: new Date().toISOString(),
    };
  }

  const conversationText = messages
    .map((m: any) => {
      const dir = m.direction === "inbound" ? "Клиент" : "Бот/Менеджер";
      const body = (m.body || "").substring(0, 300);
      return `${dir}: ${body}`;
    })
    .filter((line: string) => line.length > 10)
    .join("\n");

  if (conversationText.length < 20) return null;

  const systemPrompt = `Ты анализируешь WhatsApp-переписку между клиентом и бизнесом. Определи статус диалога.

Верни ТОЛЬКО JSON без markdown:
{
  "dealStatus": "successful" | "in_progress" | "failed" | "abandoned" | "no_deal" | "personal",
  "dealSummary": "краткое описание диалога в 1-2 предложениях на русском",
  "customerIntent": "что хотел клиент" или null,
  "failureReason": "почему сделка не состоялась" или null,
  "commonQuestions": ["частые вопросы клиента"],
  "successPatterns": "что сработало в успешном диалоге" или null
}

Правила классификации:
- "successful" — клиент оплатил / подтвердил покупку / сделка закрыта
- "in_progress" — диалог продолжается, клиент заинтересован но пока не купил
- "failed" — клиент отказался / ушёл / диалог не завершился покупкой
- "abandoned" — клиент начал процесс покупки (спрашивал цену, добавлял в корзину) но бросил
- "no_deal" — разговор не о покупке (вопрос, жалоба, информация)
- "personal" — личная переписка, не деловая`;

  const userPrompt = `${hasAbandonedCart ? "ВНИМАНИЕ: У этого клиента есть неоплаченный заказ в CRM.\n\n" : ""}Переписка:\n${conversationText.substring(0, 3000)}`;

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: 0.3,
      max_tokens: 500,
    });

    const text = response.choices[0]?.message?.content?.trim() || "";
    const jsonStr = text.replace(/^```json?\s*/i, "").replace(/```\s*$/, "").trim();
    const parsed = JSON.parse(jsonStr);

    if (hasAbandonedCart && parsed.dealStatus !== "successful") {
      parsed.dealStatus = "abandoned";
    }

    return {
      dealStatus: parsed.dealStatus || "no_deal",
      dealSummary: parsed.dealSummary || "Анализ не дал результатов",
      customerIntent: parsed.customerIntent || null,
      failureReason: parsed.failureReason || null,
      commonQuestions: Array.isArray(parsed.commonQuestions) ? parsed.commonQuestions : [],
      successPatterns: parsed.successPatterns || null,
      analyzedAt: new Date().toISOString(),
    };
  } catch (err) {
    console.error(`[Analyzer] GPT error for ${contact.phone}:`, err);
    return null;
  }
}
