import OpenAI from "openai";

const openai = new OpenAI({
  baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
});

interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface SalesStage {
  stage: string;
  goal: string;
  questions: string[];
  transitionCriteria: string[];
}

interface TagRule {
  tag: string;
  displayName: string;
  keywords: string[];
  action: string;
  responseTemplate?: string;
}

interface TenantContext {
  storeName: string;
  slug: string;
  storeDescription?: string;
  products?: Array<{ name: string; price: number; description?: string; category?: string }>;
  policies?: {
    answerOnlyFromData?: boolean;
    offerHandoffIfNoAnswer?: boolean;
    neverInventPrices?: boolean;
    followSalesScript?: boolean;
    boundariesText?: string;
  };
  faq?: Array<{ question: string; answer: string }>;
  knowledge?: Array<{ title: string; content: string }>;
  salesScript?: {
    stages: SalesStage[];
    forbiddenPhrases?: string[];
  };
  tagRules?: TagRule[];
  tone?: string;
  currentStage?: string;
}

interface AiResponseResult {
  content: string;
  matchedTag?: string;
  suggestedStage?: string;
  action?: string;
}

export async function generateAiResponse(
  userMessage: string,
  conversationHistory: ChatMessage[],
  context: TenantContext
): Promise<AiResponseResult> {
  const matchedTag = checkTagRules(userMessage, context.tagRules);
  
  if (matchedTag && matchedTag.action === "send_catalog_link") {
    const catalogUrl = `https://${process.env.REPLIT_DEV_DOMAIN || 'app.replit.dev'}/catalog/${context.slug}`;
    let response = matchedTag.responseTemplate || `Вот ссылка на наш каталог: ${catalogUrl}`;
    response = response.replace("{catalog_link}", catalogUrl);
    return {
      content: response,
      matchedTag: matchedTag.tag,
      action: matchedTag.action,
    };
  }
  
  const systemPrompt = buildSystemPrompt(context, matchedTag);
  
  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    ...conversationHistory.slice(-10),
    { role: "user", content: userMessage },
  ];

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages,
      temperature: 0.7,
      max_tokens: 600,
    });

    const content = response.choices[0]?.message?.content || "Извините, не удалось сгенерировать ответ.";
    
    return {
      content,
      matchedTag: matchedTag?.tag,
      suggestedStage: detectSuggestedStage(content, context.salesScript?.stages),
    };
  } catch (error) {
    console.error("OpenAI API error:", error);
    throw new Error("Ошибка при обращении к AI сервису");
  }
}

function checkTagRules(message: string, tagRules?: TagRule[]): TagRule | undefined {
  if (!tagRules || tagRules.length === 0) return undefined;
  
  const lowerMessage = message.toLowerCase();
  
  const sortedRules = [...tagRules].sort((a, b) => (b.keywords?.length || 0) - (a.keywords?.length || 0));
  
  for (const rule of sortedRules) {
    if (!rule.keywords) continue;
    for (const keyword of rule.keywords) {
      if (lowerMessage.includes(keyword.toLowerCase())) {
        return rule;
      }
    }
  }
  
  return undefined;
}

function detectSuggestedStage(response: string, stages?: SalesStage[]): string | undefined {
  if (!stages || stages.length === 0) return undefined;
  return undefined;
}

function buildSystemPrompt(context: TenantContext, matchedTag?: TagRule): string {
  const catalogUrl = `https://${process.env.REPLIT_DEV_DOMAIN || 'app.replit.dev'}/catalog/${context.slug}`;
  
  let prompt = `Ты — профессиональный AI-продавец-консультант магазина "${context.storeName}".`;
  
  if (context.storeDescription) {
    prompt += ` О магазине: ${context.storeDescription}`;
  }
  
  prompt += `\n\n## ТВОЯ ГЛАВНАЯ ЗАДАЧА
Твоя цель — не просто отвечать на вопросы, а вести клиента к покупке через выявление потребностей.`;

  if (context.salesScript?.stages && context.salesScript.stages.length > 0) {
    prompt += `\n\n## СКРИПТ ПРОДАЖ - СЛЕДУЙ ЭТИМ ЭТАПАМ`;
    context.salesScript.stages.forEach((stage, index) => {
      prompt += `\n\n### Этап ${index + 1}: ${stage.stage}`;
      prompt += `\nЦель: ${stage.goal}`;
      if (stage.questions && stage.questions.length > 0) {
        prompt += `\nВопросы для выявления потребностей:`;
        stage.questions.forEach(q => {
          prompt += `\n- ${q}`;
        });
      }
      if (stage.transitionCriteria && stage.transitionCriteria.length > 0) {
        prompt += `\nПереход к следующему этапу когда:`;
        stage.transitionCriteria.forEach(c => {
          prompt += `\n- ${c}`;
        });
      }
    });
    
    if (context.salesScript.forbiddenPhrases && context.salesScript.forbiddenPhrases.length > 0) {
      prompt += `\n\n## ЗАПРЕЩЁННЫЕ ФРАЗЫ (никогда не используй):`;
      context.salesScript.forbiddenPhrases.forEach(phrase => {
        prompt += `\n- "${phrase}"`;
      });
    }
  } else {
    prompt += `\n\n## БАЗОВЫЙ СКРИПТ ПРОДАЖ
1. ПРИВЕТСТВИЕ: Тепло поприветствуй и предложи помощь
2. ВЫЯВЛЕНИЕ ПОТРЕБНОСТЕЙ: Задавай уточняющие вопросы - что ищет, для кого, какой бюджет, какие предпочтения
3. ПРЕЗЕНТАЦИЯ: Предложи подходящие товары из каталога с пояснением почему они подходят
4. РАБОТА С ВОЗРАЖЕНИЯМИ: Если есть сомнения - отвечай на них
5. ЗАКРЫТИЕ: Предложи оформить заказ или дай ссылку на каталог`;
  }

  prompt += `\n\n## ССЫЛКА НА КАТАЛОГ
Каталог магазина: ${catalogUrl}
Когда клиент хочет посмотреть товары, выбрать или купить — ОБЯЗАТЕЛЬНО дай ссылку на каталог.`;

  if (context.tone === "formal") {
    prompt += `\n\n## СТИЛЬ ОБЩЕНИЯ
Общайся в формальном стиле, на "Вы", уважительно.`;
  } else if (context.tone === "casual") {
    prompt += `\n\n## СТИЛЬ ОБЩЕНИЯ
Общайся в непринуждённом дружеском стиле, можно на "ты".`;
  } else {
    prompt += `\n\n## СТИЛЬ ОБЩЕНИЯ
Общайся дружелюбно, вежливо, с энтузиазмом продавца.`;
  }

  if (context.policies) {
    prompt += `\n\n## ПРАВИЛА РАБОТЫ`;
    if (context.policies.answerOnlyFromData) {
      prompt += `\n- Отвечай ТОЛЬКО на основе информации о товарах и магазине. Не придумывай.`;
    }
    if (context.policies.neverInventPrices) {
      prompt += `\n- НИКОГДА не придумывай цены. Если не знаешь цену — предложи посмотреть в каталоге.`;
    }
    if (context.policies.offerHandoffIfNoAnswer) {
      prompt += `\n- Если не можешь ответить — предложи связаться с менеджером.`;
    }
    if (context.policies.boundariesText) {
      prompt += `\n- ${context.policies.boundariesText}`;
    }
  }

  if (matchedTag) {
    prompt += `\n\n## ОБНАРУЖЕН ТЕГ: ${matchedTag.displayName}`;
    if (matchedTag.responseTemplate) {
      prompt += `\nИспользуй этот шаблон ответа: ${matchedTag.responseTemplate}`;
    }
    if (matchedTag.action === "handoff") {
      prompt += `\nПредложи связаться с менеджером для этого вопроса.`;
    }
  }
  
  if (context.knowledge && context.knowledge.length > 0) {
    prompt += `\n\n## БАЗА ЗНАНИЙ`;
    context.knowledge.slice(0, 5).forEach(article => {
      prompt += `\n\n### ${article.title}\n${article.content}`;
    });
  }
  
  if (context.faq && context.faq.length > 0) {
    prompt += `\n\n## ЧАСТЫЕ ВОПРОСЫ`;
    context.faq.slice(0, 10).forEach(item => {
      prompt += `\nВ: ${item.question}\nО: ${item.answer}`;
    });
  }
  
  if (context.products && context.products.length > 0) {
    prompt += `\n\n## ТОВАРЫ В НАЛИЧИИ`;
    const categories = new Map<string, typeof context.products>();
    context.products.forEach(p => {
      const cat = p.category || "Другое";
      if (!categories.has(cat)) categories.set(cat, []);
      categories.get(cat)!.push(p);
    });
    
    categories.forEach((products, category) => {
      prompt += `\n\n${category}:`;
      products.slice(0, 5).forEach(p => {
        prompt += `\n- ${p.name}: ${p.price.toLocaleString()} тг`;
        if (p.description) {
          prompt += ` (${p.description.substring(0, 100)})`;
        }
      });
    });
  }
  
  prompt += `\n\n## ВАЖНЫЕ ПРАВИЛА
1. ВСЕГДА задавай уточняющие вопросы для выявления потребностей
2. НЕ просто отвечай — веди клиента к покупке
3. При запросе товаров — давай ССЫЛКУ НА КАТАЛОГ: ${catalogUrl}
4. Отвечай кратко, по делу, максимум 2-3 предложения
5. Если клиент готов купить — направь в каталог для оформления заказа`;
  
  return prompt;
}

export function isOpenAiConfigured(): boolean {
  return !!(process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && process.env.AI_INTEGRATIONS_OPENAI_API_KEY);
}
