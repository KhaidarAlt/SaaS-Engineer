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
  customDomain?: string;
  domainVerified?: boolean;
  storeDescription?: string;
  contactPhone?: string;
  products?: Array<{ name: string; price: number; description?: string; category?: string; imageUrl?: string; productUrl?: string }>;
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
  paymentOptions?: {
    kaspiEnabled: boolean;
    autoInvoice: boolean;
    kaspiPayLink?: string;
  };
  categoryPriorities?: Array<{ categoryName: string; productName: string }>;
  crossSellMap?: Array<{ productName: string; relatedProducts: string[] }>;
  upsellMap?: Array<{ productName: string; upsellProductName: string }>;
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
  const platformDomain = process.env.PLATFORM_DOMAIN || "botfactory.kz";
  const catalogUrl = (context.customDomain && context.domainVerified)
    ? `https://${context.customDomain}`
    : `https://${context.slug}.${platformDomain}`;
  
  // Check for handoff request first
  if (isHandoffRequest(userMessage)) {
    return {
      content: `Конечно! Сейчас позову менеджера, он скоро подключится к нашему диалогу и поможет вам. Пожалуйста, подождите немного.`,
      matchedTag: "handoff",
      action: "handoff",
    };
  }
  
  // Check tag rules
  const matchedTag = checkTagRules(userMessage, context.tagRules);
  
  if (matchedTag) {
    if (matchedTag.action === "send_catalog_link") {
      let response = matchedTag.responseTemplate || 
        `С удовольствием покажу наш каталог!\n\nКаталог "${context.storeName}"\n${catalogUrl}\n\nТам вы найдёте все товары с ценами и сможете оформить заказ.`;
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
        content: `Хорошо, сейчас позову менеджера! Он скоро подключится и поможет вам. Подождите, пожалуйста.`,
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
    prompt += `\n\n## АКТУАЛЬНЫЕ АКЦИИ (ОБЯЗАТЕЛЬНО УПОМИНАЙ!)`;
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
    prompt += `\n\n## СКИДКИ В МАГАЗИНЕ (ОБЯЗАТЕЛЬНО УПОМИНАЙ!)`;
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

  if (context.bankProducts && context.bankProducts.length > 0) {
    const grouped: Record<string, Array<{productName: string; description?: string; conditions?: string}>> = {};
    context.bankProducts.forEach((bp: any) => {
      if (!grouped[bp.bankName]) grouped[bp.bankName] = [];
      grouped[bp.bankName].push(bp);
    });
    prompt += `\n\n## ДОСТУПНЫЕ РАССРОЧКИ И КРЕДИТНЫЕ ПРОДУКТЫ`;
    for (const [bank, prods] of Object.entries(grouped)) {
      prompt += `\n\n**${bank}**:`;
      prods.forEach(p => {
        prompt += `\n- ${p.productName}`;
        if (p.conditions) prompt += ` — ${p.conditions}`;
      });
    }
    prompt += `\n\nПри вопросах клиента о рассрочке, кредите или способах оплаты — предлагай эти варианты. НЕ выдумывай другие варианты рассрочек, которых нет в списке.`;
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

Каталог "${context.storeName}"
${catalogUrl}

Там все товары с ценами и можно оформить заказ!`;

  // Payment options section
  if (context.paymentOptions?.kaspiEnabled && context.paymentOptions?.kaspiPayLink) {
    prompt += `\n\n## СПОСОБЫ ОПЛАТЫ — КРИТИЧЕСКИ ВАЖНО!
У нас подключена оплата через Kaspi Pay. Ссылка для оплаты: ${context.paymentOptions.kaspiPayLink}

Когда клиент хочет оплатить заказ, просит счёт или ссылку на оплату:
1. СРАЗУ отправь ссылку на оплату: ${context.paymentOptions.kaspiPayLink}
2. Укажи сумму заказа, которую нужно ввести при оплате
3. Попроси указать номер заказа в комментарии к платежу
4. Попроси отправить скриншот чека после оплаты для подтверждения

Пример ответа:
"Вот ссылка для оплаты через Kaspi:
${context.paymentOptions.kaspiPayLink}

Сумма к оплате: [сумма] тг
В комментарии укажите номер заказа.
После оплаты отправьте мне скриншот чека — я передам его на проверку."

ВАЖНО: НЕ зови менеджера для оплаты! Ты САМИ даёшь ссылку. Менеджера зови ТОЛЬКО если клиент сам просит живого человека.`;
  } else if (context.paymentOptions?.kaspiEnabled) {
    prompt += `\n\n## СПОСОБЫ ОПЛАТЫ
У нас подключена оплата через Kaspi. Когда клиент спрашивает об оплате — скажи что оплата через Kaspi доступна и после оформления заказа будет предоставлена ссылка.`;
  }

  prompt += `\n\n## ПЕРЕДАЧА МЕНЕДЖЕРУ
Если клиент просит менеджера, оператора или живого человека — НЕ ГОВОРИ звонить по телефону!
Отвечай: "Конечно! Сейчас позову менеджера, он скоро подключится к нашему диалогу. Подождите, пожалуйста."`;

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
        if (p.imageUrl) {
          prompt += ` [фото: ${p.imageUrl}]`;
        }
        if (p.productUrl) {
          prompt += ` [ссылка: ${p.productUrl}]`;
        }
      });
    });

    prompt += `\n\n## ПРАВИЛО ОТОБРАЖЕНИЯ ТОВАРА
Если конкретный товар найден и соответствует запросу клиента, показывай его с изображением, ценой и ссылкой.
Формат ответа:
![Название товара](URL_фото)
**Название товара** — цена тг
Подробнее и заказать: ссылка_на_товар

Если у товара нет фото — показывай без изображения. Если нет ссылки — не добавляй ссылку.`;
  }
  
  if (context.categoryPriorities && context.categoryPriorities.length > 0) {
    prompt += `\n\n## ПРИОРИТЕТНЫЕ ТОВАРЫ ПО КАТЕГОРИЯМ`;
    context.categoryPriorities.forEach(cp => {
      prompt += `\n- Категория "${cp.categoryName}": приоритетный товар — "${cp.productName}"`;
    });
    prompt += `\n\nКогда клиент спрашивает общее (например "посоветуйте худи", "что есть из обуви?") — в первую очередь предлагай приоритетный товар этой категории. Но если клиент спрашивает конкретный товар — показывай именно его.`;
  }

  if (context.crossSellMap && context.crossSellMap.length > 0) {
    prompt += `\n\n## СОПУТСТВУЮЩИЕ ТОВАРЫ (допродажа)`;
    context.crossSellMap.forEach(cs => {
      prompt += `\n- К товару "${cs.productName}": ${cs.relatedProducts.map(r => `"${r}"`).join(", ")}`;
    });
    prompt += `\n\nКогда клиент выбрал/подтвердил основной товар — предложи ему сопутствующие товары из списка выше (максимум 2). Пример: "Часто берут вместе: 1) ... 2) ... Хотите добавить к заказу?"
Предлагай сопутствующие товары ОДИН раз. Если клиент отказался — не настаивай.`;
  }

  if (context.upsellMap && context.upsellMap.length > 0) {
    prompt += `\n\n## АПСЕЛЛ-ТОВАРЫ (более дорогая альтернатива)`;
    context.upsellMap.forEach(u => {
      prompt += `\n- К товару "${u.productName}" → апселл: "${u.upsellProductName}"`;
    });
    prompt += `\n\nКогда клиент интересуется товаром, у которого настроен апселл — мягко упомяни более дорогую альтернативу. Пример: "Кстати, у нас есть [апселл-товар] — он дороже, но [кратко преимущество]. Хотите узнать подробнее?"
Предлагай апселл ОДИН раз в начале диалога. Если клиент отказался или уже выбрал — не возвращайся к этому. Используй ТОЛЬКО настроенные апселл-товары, никогда не придумывай свои.`;
  }

  const hasPromosOrDiscounts = (context.promotions && context.promotions.length > 0) || (context.discounts && context.discounts.length > 0);

  prompt += `\n\n## ВАЖНЫЕ ПРАВИЛА
1. ВСЕГДА задавай уточняющие вопросы для выявления потребностей
2. НЕ просто отвечай — веди клиента к покупке
3. При запросе товаров — давай ССЫЛКУ НА КАТАЛОГ в красивом формате
4. Отвечай кратко, по делу, максимум 2-3 предложения
5. Если клиент готов купить — направь в каталог
6. При просьбе о менеджере — НЕ говори звонить, скажи что позовёшь менеджера`;
  if (hasPromosOrDiscounts) {
    prompt += `\n7. АКТИВНО предлагай актуальные акции и скидки!`;
  }
  prompt += `\n8. НЕ выдумывай акции, скидки, рассрочки или бонусы, которых нет в данных выше. Предлагай ТОЛЬКО то, что реально существует.`;

  if (context.aiSystemPrompt) {
    prompt += `\n\n## ДОПОЛНИТЕЛЬНЫЕ ИНСТРУКЦИИ ОТ ВЛАДЕЛЬЦА
${context.aiSystemPrompt}`;
  }
  
  return prompt;
}

export async function generateProductDescription(params: {
  name: string;
  category?: string;
  price?: string;
  attributes?: Record<string, string>;
  currentText?: string;
  style: string;
  options?: string[];
  action?: string;
}): Promise<{ description: string; bullets: string[] }> {
  const styleGuides: Record<string, string> = {
    selling: "Продающий стиль: 3–5 предложений, через выгоды для покупателя, 1–2 сценария применения, мягкий призыв к действию.",
    informative: "Информативный стиль: нейтрально и по делу, факты и назначение, без давления на покупку.",
    marketplace: "Стиль для маркетплейса: короткие абзацы, преимущества списком, практическая польза.",
    trustful: "Доверительный стиль: тон помощника, закрытие сомнений, спокойный язык.",
    short: "Короткий стиль: 2–3 строки, только ключевая польза.",
    expert: "Экспертный стиль: деловой тон, умеренные детали, акцент на надёжности.",
  };

  const styleInstruction = styleGuides[params.style] || styleGuides.selling;

  let optionsText = "";
  if (params.options && params.options.length > 0) {
    const optionLabels: Record<string, string> = {
      bullets: "Добавь преимущества списком",
      objections: "Закрой частые возражения покупателей",
      benefits: "Сделай упор на выгоды",
      scenarios: "Добавь сценарии использования",
      shorter: "Сделай текст короче",
    };
    optionsText = "\n\nДополнительные требования:\n" + params.options.map(o => `- ${optionLabels[o] || o}`).join("\n");
  }

  let actionInstruction = "";
  if (params.action === "improve" && params.currentText) {
    actionInstruction = `\n\nЗАДАЧА: Улучши существующий текст описания, сохранив его смысл, но сделав более привлекательным.\nТекущий текст: "${params.currentText}"`;
  } else if (params.action === "shorter" && params.currentText) {
    actionInstruction = `\n\nЗАДАЧА: Сократи текущее описание, оставив только самое важное.\nТекущий текст: "${params.currentText}"`;
  } else if (params.action === "more_selling" && params.currentText) {
    actionInstruction = `\n\nЗАДАЧА: Сделай текущее описание более продающим, добавь выгоды и призыв к действию.\nТекущий текст: "${params.currentText}"`;
  } else {
    actionInstruction = "\n\nЗАДАЧА: Сгенерируй новое описание товара.";
  }

  const systemPrompt = `Ты — универсальный генератор описаний для e-commerce.

АЛГОРИТМ:

ШАГ 1. Проанализируй поле "Название" и определи:
- тип товара/услуги
- назначение
- сферу применения
- кому это может быть полезно

ШАГ 2. Используй как контекст:
- Категория: ${params.category || "не указана"}
- Цена: ${params.price || "не указана"}
- Атрибуты: ${params.attributes ? JSON.stringify(params.attributes) : "не указаны"}

ШАГ 3. Сгенерируй описание в стиле:
${styleInstruction}

СТРОГИЕ ПРАВИЛА:
- опирайся на название как главный источник смысла
- не придумывай функции и характеристики, которых нет в данных
- не используй запрещённые обещания
- пиши простым понятным языком на русском
- без привязки к конкретному бренду или нише платформы
${optionsText}${actionInstruction}

ФОРМАТ ОТВЕТА — строго JSON:
{
  "description": "текст описания",
  "bullets": ["преимущество 1", "преимущество 2"]
}

Если опция "Добавь преимущества списком" не выбрана, верни bullets как пустой массив.`;

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: `Название товара: "${params.name}"` },
    ],
    temperature: 0.7,
    max_tokens: 1000,
    response_format: { type: "json_object" },
  });

  const content = response.choices[0]?.message?.content || '{"description":"","bullets":[]}';
  try {
    const parsed = JSON.parse(content);
    return {
      description: parsed.description || "",
      bullets: Array.isArray(parsed.bullets) ? parsed.bullets : [],
    };
  } catch {
    return { description: content, bullets: [] };
  }
}

export function isOpenAiConfigured(): boolean {
  return !!(process.env.AI_INTEGRATIONS_OPENAI_BASE_URL && process.env.AI_INTEGRATIONS_OPENAI_API_KEY);
}
