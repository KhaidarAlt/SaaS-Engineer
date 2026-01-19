import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface TenantContext {
  storeName: string;
  storeDescription?: string;
  products?: Array<{ name: string; price: number; description?: string }>;
  policies?: string;
  faq?: Array<{ question: string; answer: string }>;
  tone?: string;
}

export async function generateAiResponse(
  userMessage: string,
  conversationHistory: ChatMessage[],
  context: TenantContext
): Promise<string> {
  const systemPrompt = buildSystemPrompt(context);
  
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory,
    { role: "user", content: userMessage },
  ];

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.7,
      max_tokens: 500,
    });

    return response.choices[0]?.message?.content || "Извините, не удалось сгенерировать ответ.";
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw new Error("Ошибка при обращении к AI сервису");
  }
}

function buildSystemPrompt(context: TenantContext): string {
  let prompt = `Ты — дружелюбный AI-ассистент магазина "${context.storeName}".`;
  
  if (context.storeDescription) {
    prompt += ` О магазине: ${context.storeDescription}`;
  }
  
  prompt += `\n\nТвоя задача — помогать покупателям с вопросами о товарах, консультировать по ассортименту и помогать с оформлением заказов.`;
  
  if (context.tone === "formal") {
    prompt += `\n\nОбщайся в формальном стиле, на "Вы".`;
  } else if (context.tone === "casual") {
    prompt += `\n\nОбщайся в непринуждённом стиле, можно на "ты".`;
  } else {
    prompt += `\n\nОбщайся дружелюбно и вежливо.`;
  }
  
  if (context.policies) {
    prompt += `\n\nПолитики магазина:\n${context.policies}`;
  }
  
  if (context.faq && context.faq.length > 0) {
    prompt += `\n\nЧасто задаваемые вопросы:`;
    context.faq.forEach(item => {
      prompt += `\nВ: ${item.question}\nО: ${item.answer}`;
    });
  }
  
  if (context.products && context.products.length > 0) {
    prompt += `\n\nНекоторые товары в наличии:`;
    context.products.slice(0, 10).forEach(p => {
      prompt += `\n- ${p.name}: ${p.price.toLocaleString()} тг`;
      if (p.description) {
        prompt += ` (${p.description})`;
      }
    });
  }
  
  prompt += `\n\nОтвечай кратко и по существу. Если не знаешь ответа на вопрос, вежливо предложи связаться с менеджером.`;
  
  return prompt;
}

export function isOpenAiConfigured(): boolean {
  return !!(process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && process.env.AI_INTEGRATIONS_OPENAI_API_KEY);
}
