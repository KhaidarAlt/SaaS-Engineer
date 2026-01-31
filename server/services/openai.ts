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

interface Promotion {
  name: string;
  description?: string;
  discountPercent?: number;
  discountAmount?: number;
  startDate?: Date;
  endDate?: Date;
}

interface DiscountInfo {
  name: string;
  type: string;
  value: number;
  scope: string;
  categoryName?: string;
  productName?: string;
}

interface TenantContext {
  storeName: string;
  slug: string;
  storeDescription?: string;
  contactPhone?: string;
  products?: Array<{ name: string; price: number; description?: string; category?: string }>;
  promotions?: Promotion[];
  discounts?: DiscountInfo[];
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
  aiLanguages?: string[];
  aiSystemPrompt?: string;
}

interface AiResponseResult {
  content: string;
  matchedTag?: string;
  suggestedStage?: string;
  action?: string;
}

const HANDOFF_KEYWORDS = [
  "менеджер", "оператор", "человек", "живой", "позовите", "позови", 
  "переключите", "переключи", "передайте", "передай", "свяжите", 
  "консультант", "специалист", "поддержка", "помощь человека"
];

export async function generateAiResponse(
  userMessage: string,
  conversationHistory: ChatMessage[],
  context: TenantContext
): Promise<AiResponseResult> {
  const baseDomain = process.env.BASE_URL || 
    (process.env.NODE_ENV === 'production' ? 'https://botfactory.kz' : `https://${process.env.REPLIT_DEV_DOMAIN || 'localhost:5000'}`);
  const catalogUrl = `${baseDomain}/c/${context.slug}`;
  
  // Check for handoff request first
  if (isHandoffRequest(userMessage)) {
    return {
      content: `Конечно! Сейчас позову менеджера, он скоро подключится к нашему диалогу и поможет вам. Пожалуйста, подождите немного 🙏`,
      matchedTag: "handoff",
      action: "handoff",
    };
  }
  
  // Check tag rules
  const matchedTag = checkTagRules(userMessage, context.tagRules);
  
  if (matchedTag) {
    if (matchedTag.action === "send_catalog_link") {
      let response = matchedTag.responseTemplate || 
        `С удовольствием покажу наш каталог! 🛍️\n\n👉 **Каталог "${context.storeName}"**\n${catalogUrl}\n\nТам вы найдёте все товары с ценами и сможете оформить заказ.`;
      response = response.replace("{catalog_link}", catalogUrl);
      response = response.replace("{store_name}", context.storeName);
      return {
        content: response,
        matchedTag: matchedTag.tag,
        action: matchedTag.action,
      };
    }
    
    if (matchedTag.action === "handoff") {
      return {
        content: `Хорошо, сейчас позову менеджера! Он скоро подключится и поможет вам. Подождите, пожалуйста 🙏`,
        matchedTag: matchedTag.tag,
        action: "handoff",
      };
    }
  }
  
  const systemPrompt = buildSystemPrompt(context, catalogUrl, matchedTag);
  
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

function isHandoffRequest(message: string): boolean {
  const lowerMessage = message.toLowerCase();
  return HANDOFF_KEYWORDS.some(keyword => lowerMessage.includes(keyword));
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

function buildSystemPrompt(context: TenantContext, catalogUrl: string, matchedTag?: TagRule): string {
  let prompt = `Ты — профессиональный AI-продавец-консультант магазина "${context.storeName}".`;
  
  const languages = context.aiLanguages || ["ru", "kz", "en"];
  const langNames: Record<string, string> = { ru: "русском", kz: "казахском", en: "английском" };
  const supportedLangs = languages.map(l => langNames[l]).filter(Boolean).join(", ");
  const defaultLang = languages.includes("ru") ? "русском" : langNames[languages[0]] || "русском";
  
  prompt += `\n\n## ЯЗЫК ОБЩЕНИЯ — КРИТИЧЕСКИ ВАЖНО!
ВСЕГДА определяй язык клиента и ОТВЕЧАЙ НА ТОМ ЖЕ ЯЗЫКЕ.
Разрешённые языки: ${supportedLangs}. Язык по умолчанию: ${defaultLang}.

ПРАВИЛА:
1. Определи язык последнего сообщения клиента:
   - Казахский: буквы ә, і, ң, ғ, ү, ұ, қ, ө, һ или слова "Сәлем", "қанша", "қалай", "рахмет"
   - Русский: кириллица без казахских букв
   - Английский: латиница

2. Если определённый язык есть в списке разрешённых — отвечай на нём ПОЛНОСТЬЮ
3. Если язык НЕ в списке разрешённых — отвечай на ${defaultLang}
4. НИКОГДА не смешивай языки в одном ответе!`;
  
  if (context.storeDescription) {
    prompt += `\n\nО магазине: ${context.storeDescription}`;
  }
  
  prompt += `\n\n## ТВОЯ ГЛАВНАЯ ЗАДАЧА
Твоя цель — не просто отвечать на вопросы, а вести клиента к покупке через выявление потребностей.`;

  // Promotions section - IMPORTANT
  if (context.promotions && context.promotions.length > 0) {
    prompt += `\n\n## 🔥 АКТУАЛЬНЫЕ АКЦИИ (ОБЯЗАТЕЛЬНО УПОМИНАЙ!)`;
    context.promotions.forEach(promo => {
      prompt += `\n\n**${promo.name}**`;
      if (promo.description) {
        prompt += `\n${promo.description}`;
      }
      if (promo.discountPercent) {
        prompt += `\nСкидка: ${promo.discountPercent}%`;
      }
      if (promo.discountAmount) {
        prompt += `\nСкидка: ${promo.discountAmount.toLocaleString()} тг`;
      }
      if (promo.endDate) {
        const endDate = new Date(promo.endDate);
        prompt += `\nДействует до: ${endDate.toLocaleDateString('ru-RU')}`;
      }
    });
    prompt += `\n\nАКТИВНО предлагай акции клиентам! Это отличный повод для покупки.`;
  }

  // Discounts section - IMPORTANT
  if (context.discounts && context.discounts.length > 0) {
    prompt += `\n\n## 💰 СКИДКИ В МАГАЗИНЕ (ОБЯЗАТЕЛЬНО УПОМИНАЙ!)`;
    context.discounts.forEach(discount => {
      const valueText = discount.type === 'percent' 
        ? `${discount.value}%` 
        : `${discount.value.toLocaleString()} тг`;
      
      if (discount.scope === 'product' && discount.productName) {
        prompt += `\n- **${discount.name}**: скидка ${valueText} на товар "${discount.productName}"`;
      } else if (discount.scope === 'category' && discount.categoryName) {
        prompt += `\n- **${discount.name}**: скидка ${valueText} на всю категорию "${discount.categoryName}"`;
      } else {
        prompt += `\n- **${discount.name}**: скидка ${valueText}`;
      }
    });
    prompt += `\n\nПредлагай товары со скидками! Клиенты любят выгодные предложения.`;
  }

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
Когда клиент хочет посмотреть товары, выбрать или купить — ОБЯЗАТЕЛЬНО дай ссылку в таком формате:

👉 **Каталог "${context.storeName}"**
${catalogUrl}

Там все товары с ценами и можно оформить заказ!`;

  prompt += `\n\n## ПЕРЕДАЧА МЕНЕДЖЕРУ
Если клиент просит менеджера, оператора или живого человека — НЕ ГОВОРИ звонить по телефону!
Отвечай: "Конечно! Сейчас позову менеджера, он скоро подключится к нашему диалогу. Подождите, пожалуйста 🙏"`;

  if (context.tone === "formal") {
    prompt += `\n\n## СТИЛЬ ОБЩЕНИЯ
Общайся в формальном стиле, на "Вы", уважительно.`;
  } else if (context.tone === "casual") {
    prompt += `\n\n## СТИЛЬ ОБЩЕНИЯ
Общайся в непринуждённом дружеском стиле, можно на "ты".`;
  } else {
    prompt += `\n\n## СТИЛЬ ОБЩЕНИЯ
Общайся дружелюбно, вежливо, с энтузиазмом продавца. Используй эмодзи умеренно.`;
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
      prompt += `\n- Если не можешь ответить — предложи позвать менеджера (НЕ звонить по телефону!).`;
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
3. При запросе товаров — давай ССЫЛКУ НА КАТАЛОГ в красивом формате
4. АКТИВНО предлагай актуальные акции и скидки!
5. Отвечай кратко, по делу, максимум 2-3 предложения
6. Если клиент готов купить — направь в каталог
7. При просьбе о менеджере — НЕ говори звонить, скажи что позовёшь менеджера`;

  if (context.aiSystemPrompt) {
    prompt += `\n\n## ДОПОЛНИТЕЛЬНЫЕ ИНСТРУКЦИИ ОТ ВЛАДЕЛЬЦА
${context.aiSystemPrompt}`;
  }
  
  return prompt;
}

export function isOpenAiConfigured(): boolean {
  return !!(process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && process.env.AI_INTEGRATIONS_OPENAI_API_KEY);
}
