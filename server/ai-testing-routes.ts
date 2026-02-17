import type { Express, Request, Response } from "express";
import { db } from "./db";
import { eq, and, desc, sql, gte, count } from "drizzle-orm";
import {
  aiSettings, aiTestingSessions, aiTestingMessages, aiScoreSnapshots,
  aiStressTestRuns, handoverRules, knowledgeItems, trainingItems,
  products, aiBusinessProfile, aiPromotionRules, categories,
  aiTriggers, aiAntiPatterns, aiTrainingEvents,
} from "@shared/schema";
import { generateAiResponse } from "./services/openai";

const PERSONAS: Record<string, { openers: string[]; followUps: string[] }> = {
  HAGGLER: {
    openers: ["Здравствуйте. Сколько стоит {product}? Есть в наличии?"],
    followUps: ["А скидка есть?", "Сделаете дешевле?", "У конкурентов ниже", "Ну хотя бы бесплатная доставка?", "Последнее предложение — дешевле или ухожу"],
  },
  DOUBTER: {
    openers: ["Здравствуйте. Хочу {product}, но не уверен... Стоит ли брать?"],
    followUps: ["Не уверен…", "А гарантия?", "Стоит ли переплачивать?", "А вдруг не подойдёт?", "Может подождать скидку?"],
  },
  COMPARER: {
    openers: ["Привет, почему у вас {product} стоит столько? У конкурентов видел дешевле"],
    followUps: ["Почему у вас дороже?", "А чем вы лучше?", "У другого магазина дешевле и доставка бесплатная", "Убедите меня остаться", "Ладно, а что по гарантии?"],
  },
  CHEAPER: {
    openers: ["Добрый день! Есть что-нибудь подешевле чем {product}?"],
    followUps: ["Слишком дорого для меня", "Есть вариант подешевле?", "А рассрочка есть?", "Может что-то б/у?", "Какой самый бюджетный вариант?"],
  },
  ANGRY: {
    openers: ["Почему {product} так дорого?! Вы серьёзно?"],
    followUps: ["Это грабёж!", "Позовите менеджера", "Я напишу жалобу!", "Верните деньги!", "Это последний раз когда я у вас покупаю"],
  },
  PREMIUM: {
    openers: ["Здравствуйте. Мне нужна лучшая модель. Что порекомендуете?"],
    followUps: ["А есть ещё лучше?", "Мне нужен максимальный комплект", "Цена не важна, важно качество", "А какие доп. услуги есть?", "Хочу VIP обслуживание"],
  },
};

const DEFAULT_STRESS_SCENARIOS: Record<string, string> = {
  PRICE_HIGH: "Дорого",
  ASK_DISCOUNT: "Есть скидка?",
  WANT_CHEAPER: "Хочу дешевле",
  COMPARE: "У конкурентов дешевле",
  INSTALLMENT: "Есть рассрочка?",
  WARRANTY: "Какая гарантия?",
  DELIVERY: "Как доставка и самовывоз?",
  HUMAN: "Дайте менеджера",
  COMPLEX: "У меня нестандартный вопрос, не могу найти ответ",
  CLOSE: "Готов купить, как оплатить?",
};

async function buildTenantContext(tenantId: string, pool: any, storage: any) {
  const tenant = await storage.getTenant(tenantId);
  if (!tenant) throw new Error("Тенант не найден");

  const settings = await storage.getOrCreateAiSettings(tenantId);

  const productRows = await db.select({
    name: products.name,
    price: products.price,
    description: products.description,
    categoryName: categories.name,
  })
    .from(products)
    .leftJoin(categories, eq(products.categoryId, categories.id))
    .where(and(eq(products.tenantId, tenantId), eq(products.isActive, true)))
    .limit(20);

  const kbItems = await db.select().from(knowledgeItems)
    .where(and(eq(knowledgeItems.tenantId, tenantId), eq(knowledgeItems.isActive, true)))
    .limit(30);

  const activeTriggers = await db.select().from(aiTriggers)
    .where(and(eq(aiTriggers.tenantId, tenantId), eq(aiTriggers.isEnabled, true)))
    .orderBy(aiTriggers.priority)
    .limit(20);

  const activeAntiPatterns = await db.select().from(aiAntiPatterns)
    .where(and(eq(aiAntiPatterns.tenantId, tenantId), eq(aiAntiPatterns.isActive, true)));

  const context: any = {
    storeName: tenant.name,
    slug: tenant.slug,
    customDomain: tenant.customDomain || undefined,
    storeDescription: tenant.description || undefined,
    contactPhone: tenant.contactPhone || undefined,
    products: productRows.map((p: any) => ({
      name: p.name,
      price: parseFloat(p.price),
      description: p.description || undefined,
      category: p.categoryName || undefined,
    })),
    knowledge: kbItems.map((k: any) => ({ title: k.title || k.question, content: k.content || k.answer })),
    triggers: activeTriggers,
    antiPatterns: activeAntiPatterns,
    tone: settings.tone || "friendly",
    goal: settings.goal || "CLOSE_DEAL",
    aiLanguages: tenant.aiLanguages || ["ru"],
    aiSystemPrompt: settings.systemPromptCustom || undefined,
  };

  return context;
}

function matchTriggers(userText: string, triggers: any[], goal: string): any[] {
  const userLower = userText.toLowerCase();
  const matched: any[] = [];

  for (const trigger of triggers) {
    let isMatch = false;

    if (trigger.matchType === "KEYWORD" || trigger.matchType === "INTENT") {
      isMatch = userLower.includes(trigger.matchValue.toLowerCase());
    } else if (trigger.matchType === "REGEX") {
      try {
        const re = new RegExp(trigger.matchValue, "i");
        isMatch = re.test(userText);
      } catch {}
    }

    if (!isMatch) continue;

    if (trigger.conditions) {
      const conds = trigger.conditions as any;
      if (conds.goals && Array.isArray(conds.goals) && !conds.goals.includes(goal)) continue;
    }

    matched.push(trigger);
    if (matched.length >= 3) break;
  }

  return matched;
}

function applyTriggerActions(reply: string, matchedTriggers: any[]): { modifiedReply: string; appliedActions: string[] } {
  let modifiedReply = reply;
  const appliedActions: string[] = [];

  for (const trigger of matchedTriggers) {
    const payload = (trigger.actionPayload || {}) as any;

    switch (trigger.actionType) {
      case "ADD_LINE_TO_REPLY":
      case "USE_SCRIPT_SNIPPET": {
        const text = payload.text || "";
        if (text && !modifiedReply.includes(text)) {
          const firstSentEnd = modifiedReply.indexOf(".");
          if (firstSentEnd > 0 && firstSentEnd < modifiedReply.length - 1) {
            modifiedReply = modifiedReply.slice(0, firstSentEnd + 1) + " " + text + modifiedReply.slice(firstSentEnd + 1);
          } else {
            modifiedReply += "\n\n" + text;
          }
          appliedActions.push(`Добавлен текст: "${text.substring(0, 40)}..."`);
        }
        break;
      }
      case "FORCE_HANDOVER": {
        const reason = payload.reason || "Передаю менеджеру";
        modifiedReply += `\n\n${reason}. Сейчас подключу менеджера для дальнейшей помощи.`;
        appliedActions.push("Передача менеджеру");
        break;
      }
      case "OFFER_INSTALLMENT": {
        if (!modifiedReply.toLowerCase().includes("рассрочк")) {
          modifiedReply += "\n\nТакже у нас доступна рассрочка — могу рассказать подробнее об условиях.";
          appliedActions.push("Предложена рассрочка");
        }
        break;
      }
      case "OFFER_CHEAPER": {
        if (!modifiedReply.toLowerCase().includes("дешевле") && !modifiedReply.toLowerCase().includes("бюджетн")) {
          modifiedReply += "\n\nМогу подобрать более бюджетный вариант — хотите посмотреть?";
          appliedActions.push("Предложен дешёвый вариант");
        }
        break;
      }
      case "UPSELL": {
        if (!modifiedReply.toLowerCase().includes("премиум") && !modifiedReply.toLowerCase().includes("лучш")) {
          modifiedReply += "\n\nТакже рекомендую обратить внимание на расширенную комплектацию.";
          appliedActions.push("Апсейл");
        }
        break;
      }
      case "APPLY_PROMO": {
        const promoText = payload.text || "Сейчас действует специальная акция!";
        if (!modifiedReply.toLowerCase().includes("акци") && !modifiedReply.toLowerCase().includes("промо")) {
          modifiedReply += "\n\n" + promoText;
          appliedActions.push("Применено промо");
        }
        break;
      }
      case "ASK_CLARIFYING_QUESTION": {
        const question = payload.text || "Могу ли я уточнить детали?";
        modifiedReply += "\n\n" + question;
        appliedActions.push("Задан уточняющий вопрос");
        break;
      }
    }
  }

  return { modifiedReply, appliedActions };
}

function filterAntiPatterns(reply: string, antiPatterns: any[]): { cleanedReply: string; blocked: string[] } {
  let cleanedReply = reply;
  const blocked: string[] = [];

  for (const ap of antiPatterns) {
    if (ap.patternType === "KEYWORD") {
      const keyword = ap.patternValue.toLowerCase();
      if (cleanedReply.toLowerCase().includes(keyword)) {
        const sentences = cleanedReply.split(/(?<=[.!?])\s+/);
        const filteredSentences = sentences.filter(s => !s.toLowerCase().includes(keyword));
        if (filteredSentences.length < sentences.length) {
          cleanedReply = filteredSentences.join(" ");
          if (!cleanedReply.trim()) {
            cleanedReply = "Уточню информацию и вернусь к вам с ответом.";
          }
          blocked.push(ap.patternValue);
        }
      }
    } else if (ap.patternType === "REGEX") {
      try {
        const re = new RegExp(ap.patternValue, "gi");
        if (re.test(cleanedReply)) {
          cleanedReply = cleanedReply.replace(re, "").trim();
          if (!cleanedReply) {
            cleanedReply = "Уточню информацию и вернусь к вам с ответом.";
          }
          blocked.push(ap.patternValue);
        }
      } catch {}
    } else if (ap.patternType === "CLAIM") {
      if (cleanedReply.toLowerCase().includes(ap.patternValue.toLowerCase())) {
        const sentences = cleanedReply.split(/(?<=[.!?])\s+/);
        const filteredSentences = sentences.filter(s => !s.toLowerCase().includes(ap.patternValue.toLowerCase()));
        if (filteredSentences.length < sentences.length) {
          cleanedReply = filteredSentences.join(" ");
          if (!cleanedReply.trim()) {
            cleanedReply = "Уточню информацию и вернусь к вам с ответом.";
          }
          blocked.push(ap.patternValue);
        }
      }
    }
  }

  return { cleanedReply, blocked };
}

function computeMicroEval(
  userText: string,
  reply: string,
  tone: string,
  goal: string,
  productNames: string[]
) {
  let score = 0;
  const positives: string[] = [];
  const issues: string[] = [];
  const suggestions: string[] = [];
  const replyLower = reply.toLowerCase();
  const userLower = userText.toLowerCase();

  const hasProductMention = productNames.some(n => replyLower.includes(n.toLowerCase()));
  const hasQuestion = reply.includes("?");
  if (hasProductMention || hasQuestion) {
    score += 2;
    positives.push(hasProductMention ? "Упоминает товар" : "Задаёт уточняющий вопрос");
  } else {
    suggestions.push("Стоит упоминать конкретные товары или задавать вопросы");
  }

  const greetWords = ["здравствуйте", "привет", "добрый", "рад", "помочь", "пожалуйста"];
  if (tone === "friendly" && greetWords.some(w => replyLower.includes(w))) {
    score += 2;
    positives.push("Дружелюбный тон");
  } else if (tone === "short" && reply.length < 200) {
    score += 2;
    positives.push("Краткий ответ");
  } else if (tone === "premium" && (replyLower.includes("рекомендую") || replyLower.includes("премиум") || replyLower.includes("лучш"))) {
    score += 2;
    positives.push("Премиальный стиль");
  } else if (tone === "friendly" || tone === "short" || tone === "premium") {
    suggestions.push("Тон ответа можно улучшить");
  } else {
    score += 2;
    positives.push("Нейтральный тон");
  }

  const objectionKeywords = ["дорого", "скидка", "дешевле", "цена", "снижение"];
  const priceResponseWords = ["цена", "стоимость", "скидк", "выгод", "рассрочк", "ценност", "качеств", "преимуществ"];
  const hasObjection = objectionKeywords.some(w => userLower.includes(w));
  const addressesObjection = priceResponseWords.some(w => replyLower.includes(w));
  if (hasObjection && addressesObjection) {
    score += 2;
    positives.push("Отрабатывает возражение по цене");
  } else if (hasObjection && !addressesObjection) {
    issues.push("Не отработано возражение по цене");
  }

  const closeDealWords = ["оплат", "заказ", "купить", "оформ", "корзин", "ссылк"];
  const qualifyWords = ["контакт", "номер", "телефон", "менеджер", "передам", "свяжемся"];
  if (goal === "CLOSE_DEAL" && closeDealWords.some(w => replyLower.includes(w))) {
    score += 2;
    positives.push("Ведёт к закрытию сделки");
  } else if (goal === "QUALIFY_HANDOVER" && qualifyWords.some(w => replyLower.includes(w))) {
    score += 2;
    positives.push("Квалифицирует и предлагает передачу");
  } else if (goal === "CLOSE_DEAL") {
    suggestions.push("Стоит предложить оформление заказа или оплату");
  } else if (goal === "QUALIFY_HANDOVER") {
    suggestions.push("Стоит запросить контактные данные");
  } else {
    score += 1;
  }

  const endsWithQuestion = reply.trim().endsWith("?");
  const ctaPhrases = ["оформить", "заказать", "перейти", "посмотрите", "рекомендую", "предлагаю"];
  if (endsWithQuestion || ctaPhrases.some(w => replyLower.includes(w))) {
    score += 2;
    positives.push("Есть призыв к действию");
  } else {
    suggestions.push("Добавьте призыв к действию в конце ответа");
  }

  if (tone === "short" && reply.length > 500) {
    score -= 3;
    issues.push("Слишком длинный ответ для краткого режима");
  }

  const userWords = userLower.split(/\s+/).filter(w => w.length > 3);
  const addressesUser = userWords.length === 0 || userWords.some(w => replyLower.includes(w));
  if (!addressesUser) {
    score -= 2;
    issues.push("Ответ не затрагивает вопрос пользователя");
  }

  score = Math.max(0, Math.min(10, score));

  return { score, positives, issues, suggestions };
}

async function computeScore(tenantId: string, pool: any, storage: any) {
  const settings = await storage.getOrCreateAiSettings(tenantId);
  const goal = settings.goal || "CLOSE_DEAL";

  const completenessItems: Record<string, any> = {};
  let completenessScore = 0;

  const goalSelected = !!settings.goal && settings.goal !== "";
  completenessItems.goalSelected = { score: goalSelected ? 5 : 0, max: 5, label: "Цель выбрана", passed: goalSelected };
  if (goalSelected) completenessScore += 5;

  const toneSelected = !!settings.tone;
  completenessItems.toneSelected = { score: toneSelected ? 5 : 0, max: 5, label: "Стиль/тон выбран", passed: toneSelected };
  if (toneSelected) completenessScore += 5;

  const objections = Array.isArray(settings.objectionsJson) ? settings.objectionsJson : [];
  const objectionsPassed = objections.length >= 4;
  completenessItems.objections = { score: objectionsPassed ? 5 : 0, max: 5, label: "Возражения настроены (>=4)", passed: objectionsPassed };
  if (objectionsPassed) completenessScore += 5;

  const [hrCount] = await db.select({ cnt: count() }).from(handoverRules).where(eq(handoverRules.tenantId, tenantId));
  const handoverPassed = (hrCount?.cnt || 0) > 0;
  completenessItems.handoverRules = { score: handoverPassed ? 5 : 0, max: 5, label: "Правила передачи настроены", passed: handoverPassed };
  if (handoverPassed) completenessScore += 5;

  const [bProfile] = await db.select().from(aiBusinessProfile).where(eq(aiBusinessProfile.tenantId, tenantId));
  const uspPassed = (bProfile && ((Array.isArray(bProfile.uspPoints) && bProfile.uspPoints.length > 0) || (bProfile.uspFreeText && bProfile.uspFreeText.length > 0))) || false;
  completenessItems.usp = { score: uspPassed ? 5 : 0, max: 5, label: "УТП заполнено", passed: uspPassed };
  if (uspPassed) completenessScore += 5;

  const [promoRule] = await db.select().from(aiPromotionRules).where(eq(aiPromotionRules.tenantId, tenantId));
  const promoPassed = !!promoRule;
  completenessItems.promotionStrategy = { score: promoPassed ? 5 : 0, max: 5, label: "Стратегия продвижения настроена", passed: promoPassed };
  if (promoPassed) completenessScore += 5;

  const behaviorItems: Record<string, any> = {};
  let behaviorScore = 0;

  if (goal === "CLOSE_DEAL") {
    const installPassed = bProfile?.installmentEnabled || false;
    behaviorItems.paymentFlow = { score: installPassed ? 10 : 0, max: 10, label: "Рассрочка или оплата настроена", passed: installPassed };
    if (installPassed) behaviorScore += 10;

    const priceObjWords = ["дорого", "цена", "стоимость", "скидка"];
    const hasPriceObj = objections.some((o: string) => priceObjWords.some(w => o.toLowerCase().includes(w)));
    behaviorItems.priceObjection = { score: hasPriceObj ? 5 : 0, max: 5, label: "Возражение 'дорого' настроено", passed: hasPriceObj };
    if (hasPriceObj) behaviorScore += 5;

    const boosters = settings.salesBoostersJson as any;
    const hasBooster = boosters && (boosters.upsell || boosters.cheaperAlternative);
    behaviorItems.salesBoosters = { score: hasBooster ? 5 : 0, max: 5, label: "Апсейл или альтернатива включены", passed: !!hasBooster };
    if (hasBooster) behaviorScore += 5;
  } else if (goal === "QUALIFY_HANDOVER") {
    const hrRules = await db.select().from(handoverRules).where(eq(handoverRules.tenantId, tenantId));
    const hasKeywordTriggers = hrRules.some((r: any) => r.type === "keyword" || r.type === "explicit");
    behaviorItems.handoverTriggers = { score: hasKeywordTriggers ? 10 : 0, max: 10, label: "Триггеры передачи настроены", passed: hasKeywordTriggers };
    if (hasKeywordTriggers) behaviorScore += 10;

    let hasCrm = false;
    try {
      const crmRes = await pool.query(`SELECT COUNT(*) as cnt FROM crm_integrations WHERE tenant_id = $1`, [tenantId]);
      hasCrm = parseInt(crmRes.rows[0]?.cnt || "0") > 0;
    } catch {}
    behaviorItems.crmEnabled = { score: hasCrm ? 5 : 0, max: 5, label: "CRM подключена", passed: hasCrm };
    if (hasCrm) behaviorScore += 5;

    behaviorItems.salesBoosters = { score: 0, max: 5, label: "—", passed: true };
    behaviorScore += 5;
  } else {
    behaviorItems.paymentFlow = { score: 5, max: 10, label: "Платежи (цель не CLOSE_DEAL)", passed: true };
    behaviorScore += 5;
    behaviorItems.priceObjection = { score: 5, max: 5, label: "—", passed: true };
    behaviorScore += 5;
    behaviorItems.salesBoosters = { score: 5, max: 5, label: "—", passed: true };
    behaviorScore += 5;
  }

  let tenantRow: any;
  try {
    const tenantRes = await pool.query(`SELECT ai_languages FROM tenants WHERE id = $1`, [tenantId]);
    tenantRow = tenantRes.rows[0];
  } catch {}
  const langs = tenantRow?.ai_languages;
  const langPassed = Array.isArray(langs) && langs.length > 0;
  behaviorItems.languages = { score: langPassed ? 5 : 0, max: 5, label: "Язык(и) выбраны", passed: langPassed };
  if (langPassed) behaviorScore += 5;

  const promptPassed = !!settings.systemPromptCustom || !!settings.fallbackHandoffText;
  behaviorItems.systemPrompt = { score: promptPassed ? 5 : 0, max: 5, label: "Системный промпт настроен", passed: promptPassed };
  if (promptPassed) behaviorScore += 5;

  const operationsItems: Record<string, any> = {};
  let opsScore = 0;
  let opsStatus: "READY" | "WARNING" | "BLOCKED" = "READY";

  try {
    const prodRes = await pool.query(`SELECT COUNT(*) as cnt FROM products WHERE tenant_id = $1 AND is_active = true`, [tenantId]);
    const prodCount = parseInt(prodRes.rows[0]?.cnt || "0");
    if (prodCount === 0) opsStatus = "BLOCKED";
    operationsItems.products = { score: prodCount > 0 ? 5 : 0, max: 5, label: "Товары в каталоге", passed: prodCount > 0, detail: `${prodCount} товаров` };
    if (prodCount > 0) opsScore += 5;
  } catch {
    operationsItems.products = { score: 0, max: 5, label: "Товары в каталоге", passed: false };
  }

  if (goal === "CLOSE_DEAL") {
    let kaspiOk = false;
    try {
      const kaspiRes = await pool.query(`SELECT * FROM kaspi_integrations WHERE tenant_id = $1 AND is_verified = true LIMIT 1`, [tenantId]);
      kaspiOk = (kaspiRes.rows?.length || 0) > 0;
    } catch {}
    if (!kaspiOk && opsStatus !== "BLOCKED") opsStatus = "WARNING";
    operationsItems.payments = { score: kaspiOk ? 5 : 0, max: 5, label: "Оплата настроена", passed: kaspiOk };
    if (kaspiOk) opsScore += 5;
  } else {
    operationsItems.payments = { score: 5, max: 5, label: "Оплата (не требуется)", passed: true };
    opsScore += 5;
  }

  if (goal === "QUALIFY_HANDOVER") {
    let hasChannel = false;
    try {
      const wahaRes = await pool.query(`SELECT COUNT(*) as cnt FROM waha_instances WHERE tenant_id = $1`, [tenantId]);
      const telRes = await pool.query(`SELECT COUNT(*) as cnt FROM telegram_integrations WHERE tenant_id = $1`, [tenantId]);
      hasChannel = parseInt(wahaRes.rows[0]?.cnt || "0") > 0 || parseInt(telRes.rows[0]?.cnt || "0") > 0;
    } catch {}
    if (!hasChannel && opsStatus !== "BLOCKED") opsStatus = "WARNING";
    operationsItems.channels = { score: hasChannel ? 5 : 0, max: 5, label: "Каналы связи", passed: hasChannel };
    if (hasChannel) opsScore += 5;
  } else {
    operationsItems.channels = { score: 5, max: 5, label: "Каналы (не требуются)", passed: true };
    opsScore += 5;
  }

  let waConnected = false;
  try {
    const waRes = await pool.query(`SELECT waha_status FROM tenants WHERE id = $1`, [tenantId]);
    waConnected = waRes.rows[0]?.waha_status === "connected";
  } catch {}
  operationsItems.whatsapp = { score: waConnected ? 5 : 0, max: 5, label: "WhatsApp подключён", passed: waConnected };
  if (waConnected) opsScore += 5;

  if (opsStatus === "BLOCKED") opsScore = 0;
  else if (opsStatus === "WARNING") opsScore = Math.min(opsScore, 10);

  const testingItems: Record<string, any> = {};
  let testingScore = 0;

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const [msgCount] = await db.select({ cnt: count() }).from(aiTestingMessages)
    .where(and(eq(aiTestingMessages.tenantId, tenantId), gte(aiTestingMessages.createdAt, sevenDaysAgo)));
  const hasMsgs = (msgCount?.cnt || 0) >= 5;
  testingItems.testMessages = { score: hasMsgs ? 5 : 0, max: 5, label: "Тестовых сообщений (>=5 за 7д)", passed: hasMsgs, detail: `${msgCount?.cnt || 0} сообщений` };
  if (hasMsgs) testingScore += 5;

  const [simCount] = await db.select({ cnt: count() }).from(aiTestingSessions)
    .where(and(eq(aiTestingSessions.tenantId, tenantId), eq(aiTestingSessions.mode, "SIMULATION"), eq(aiTestingSessions.status, "completed")));
  const hasSim = (simCount?.cnt || 0) >= 1;
  testingItems.simulations = { score: hasSim ? 5 : 0, max: 5, label: "Завершённые симуляции (>=1)", passed: hasSim, detail: `${simCount?.cnt || 0} симуляций` };
  if (hasSim) testingScore += 5;

  const [latestStress] = await db.select().from(aiStressTestRuns)
    .where(and(eq(aiStressTestRuns.tenantId, tenantId), eq(aiStressTestRuns.status, "completed")))
    .orderBy(desc(aiStressTestRuns.createdAt))
    .limit(1);

  let stressPoints = 0;
  if (latestStress && latestStress.overallScore !== null) {
    const passRate = latestStress.overallScore / 100;
    if (passRate >= 0.8) stressPoints = 10;
    else if (passRate >= 0.5) stressPoints = 6;
    else stressPoints = 2;
  }
  testingItems.stressTest = { score: stressPoints, max: 10, label: "Стресс-тест", passed: stressPoints >= 6, detail: latestStress ? `${latestStress.overallScore}%` : "Не проведён" };
  testingScore += stressPoints;

  let trainingBonus = 0;
  try {
    const [triggerCount] = await db.select({ cnt: count() }).from(aiTriggers)
      .where(and(eq(aiTriggers.tenantId, tenantId), eq(aiTriggers.isEnabled, true)));
    const [kbCount] = await db.select({ cnt: count() }).from(knowledgeItems)
      .where(and(eq(knowledgeItems.tenantId, tenantId), eq(knowledgeItems.isActive, true)));
    if ((triggerCount?.cnt || 0) >= 3 || (kbCount?.cnt || 0) >= 3) {
      trainingBonus = 2;
    }
  } catch {}

  const rawTotal = completenessScore + behaviorScore + Math.min(opsScore, 20) + testingScore + trainingBonus;
  const scoreTotal = Math.min(rawTotal, 100);
  const lastComputedAt = new Date().toISOString();

  const notes: string[] = [];
  if (completenessScore < 20) notes.push("Заполните настройки AI для повышения балла");
  if (behaviorScore < 15) notes.push("Настройте поведение AI под вашу цель");
  if (opsScore < 10) notes.push("Проверьте операционную готовность");
  if (testingScore < 10) notes.push("Проведите больше тестов");
  if (trainingBonus > 0) notes.push("Бонус за обучение: +" + trainingBonus);

  const result = {
    scoreTotal,
    breakdown: {
      completeness: { score: completenessScore, max: 30, items: completenessItems },
      behavior: { score: behaviorScore, max: 30, items: behaviorItems },
      operations: { score: Math.min(opsScore, 20), max: 20, items: operationsItems },
      testing: { score: testingScore, max: 20, items: testingItems },
    },
    lastComputedAt,
    notes,
  };

  await db.insert(aiScoreSnapshots).values({
    tenantId,
    scoreTotal,
    scoreBreakdown: result.breakdown as any,
  });

  return result;
}

export function registerAiTestingRoutes(
  app: Express,
  storage: any,
  pool: any,
  requireAuth: any,
  requireAiAccess: any
) {

  app.get("/api/ai/testing/score", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const [cached] = await db.select().from(aiScoreSnapshots)
        .where(eq(aiScoreSnapshots.tenantId, tenantId))
        .orderBy(desc(aiScoreSnapshots.createdAt))
        .limit(1);

      if (cached && (Date.now() - new Date(cached.createdAt).getTime()) < 5 * 60 * 1000) {
        return res.json({
          scoreTotal: cached.scoreTotal,
          breakdown: cached.scoreBreakdown,
          lastComputedAt: cached.createdAt,
          notes: [],
        });
      }

      const result = await computeScore(tenantId, pool, storage);
      res.json(result);
    } catch (error: any) {
      console.error("Ошибка вычисления AI Score:", error);
      res.status(500).json({ message: "Ошибка вычисления AI Score" });
    }
  });

  app.post("/api/ai/testing/score/recompute", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const result = await computeScore(tenantId, pool, storage);
      res.json(result);
    } catch (error: any) {
      console.error("Ошибка пересчёта AI Score:", error);
      res.status(500).json({ message: "Ошибка пересчёта AI Score" });
    }
  });

  app.get("/api/ai/testing/readiness", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const settings = await storage.getOrCreateAiSettings(tenantId);
      const goal = (req.query.goal as string) || settings.goal || "CLOSE_DEAL";
      const reasons: Array<{ label: string; passed: boolean; detail: string; link?: string }> = [];
      let status: "READY" | "WARNING" | "BLOCKED" = "READY";

      const prodRes = await pool.query(`SELECT COUNT(*) as cnt FROM products WHERE tenant_id = $1 AND is_active = true`, [tenantId]);
      const prodCount = parseInt(prodRes.rows[0]?.cnt || "0");
      reasons.push({ label: "Товары в каталоге", passed: prodCount > 0, detail: `${prodCount} товаров`, link: "/dashboard/products" });
      if (prodCount === 0) status = "BLOCKED";

      if (goal === "CLOSE_DEAL") {
        let kaspiOk = false;
        try {
          const kaspiRes = await pool.query(`SELECT * FROM kaspi_integrations WHERE tenant_id = $1 AND is_verified = true LIMIT 1`, [tenantId]);
          kaspiOk = (kaspiRes.rows?.length || 0) > 0;
        } catch {}
        reasons.push({ label: "Kaspi интеграция", passed: kaspiOk, detail: kaspiOk ? "Подключено" : "Не подключено", link: "/dashboard/payments" });
        if (!kaspiOk && status !== "BLOCKED") status = "WARNING";
      }

      if (goal === "QUALIFY_HANDOVER") {
        let hasChannel = false;
        try {
          const crmRes = await pool.query(`SELECT COUNT(*) as cnt FROM crm_integrations WHERE tenant_id = $1`, [tenantId]);
          const telRes = await pool.query(`SELECT COUNT(*) as cnt FROM telegram_integrations WHERE tenant_id = $1`, [tenantId]);
          const wahaRes = await pool.query(`SELECT COUNT(*) as cnt FROM waha_instances WHERE tenant_id = $1`, [tenantId]);
          hasChannel = parseInt(crmRes.rows[0]?.cnt || "0") > 0 || parseInt(telRes.rows[0]?.cnt || "0") > 0 || parseInt(wahaRes.rows[0]?.cnt || "0") > 0;
        } catch {}
        reasons.push({ label: "Каналы передачи", passed: hasChannel, detail: hasChannel ? "Настроены" : "Не подключены", link: "/dashboard/integrations" });
        if (!hasChannel && status !== "BLOCKED") status = "WARNING";
      }

      let waConnected = false;
      try {
        const waRes = await pool.query(`SELECT waha_status FROM tenants WHERE id = $1`, [tenantId]);
        waConnected = waRes.rows[0]?.waha_status === "connected";
      } catch {}
      reasons.push({ label: "WhatsApp подключён", passed: waConnected, detail: waConnected ? "Подключён" : "Не подключён", link: "/dashboard/whatsapp" });

      res.json({ status, reasons });
    } catch (error: any) {
      console.error("Ошибка проверки готовности:", error);
      res.status(500).json({ message: "Ошибка проверки готовности" });
    }
  });

  app.post("/api/ai/testing/session/start", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { mode, personaKey } = req.body;
      if (!mode || !["FREE_CHAT", "SIMULATION", "STRESS_TEST"].includes(mode)) {
        return res.status(400).json({ message: "Некорректный режим" });
      }

      const [session] = await db.insert(aiTestingSessions).values({
        tenantId,
        mode,
        personaKey: personaKey || null,
        status: "active",
      }).returning();

      res.json({ sessionId: session.id });
    } catch (error: any) {
      console.error("Ошибка создания сессии:", error);
      res.status(500).json({ message: "Ошибка создания сессии" });
    }
  });

  app.post("/api/ai/testing/message/send", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { sessionId, userText } = req.body;
      if (!sessionId || !userText) {
        return res.status(400).json({ message: "sessionId и userText обязательны" });
      }

      const [session] = await db.select().from(aiTestingSessions)
        .where(and(eq(aiTestingSessions.id, sessionId), eq(aiTestingSessions.tenantId, tenantId)));
      if (!session) return res.status(404).json({ message: "Сессия не найдена" });

      await db.insert(aiTestingMessages).values({
        tenantId,
        sessionId,
        role: "user",
        content: userText,
      });

      const existingMessages = await db.select().from(aiTestingMessages)
        .where(and(eq(aiTestingMessages.sessionId, sessionId), eq(aiTestingMessages.tenantId, tenantId)))
        .orderBy(aiTestingMessages.createdAt);

      const history = existingMessages.slice(-10).map(m => ({
        role: m.role as "user" | "assistant" | "system",
        content: m.content,
      }));

      const context = await buildTenantContext(tenantId, pool, storage);
      const aiResult = await generateAiResponse(userText, history, context);

      let finalContent = aiResult.content;
      const triggersMeta: any = {};

      const matchedTrigs = matchTriggers(userText, context.triggers || [], context.goal);
      if (matchedTrigs.length > 0) {
        const { modifiedReply, appliedActions } = applyTriggerActions(finalContent, matchedTrigs);
        finalContent = modifiedReply;
        triggersMeta.matchedTriggers = matchedTrigs.map((t: any) => t.id);
        triggersMeta.appliedActions = appliedActions;
      }

      const apResult = filterAntiPatterns(finalContent, context.antiPatterns || []);
      finalContent = apResult.cleanedReply;
      if (apResult.blocked.length > 0) {
        triggersMeta.blockedPatterns = apResult.blocked;
      }

      const productNames = (context.products || []).map((p: any) => p.name);
      const microEval = computeMicroEval(userText, finalContent, context.tone, context.goal, productNames);

      const [assistantMsg] = await db.insert(aiTestingMessages).values({
        tenantId,
        sessionId,
        role: "assistant",
        content: finalContent,
        meta: { microEval, matchedTag: aiResult.matchedTag, action: aiResult.action, ...triggersMeta },
      }).returning();

      res.json({ assistantMessage: assistantMsg, microEval });
    } catch (error: any) {
      console.error("Ошибка отправки сообщения:", error);
      res.status(500).json({ message: "Ошибка отправки сообщения" });
    }
  });

  app.post("/api/ai/testing/message/feedback", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { messageId, action, editedText } = req.body;
      if (!messageId || !action) {
        return res.status(400).json({ message: "messageId и action обязательны" });
      }

      const [msg] = await db.select().from(aiTestingMessages)
        .where(and(eq(aiTestingMessages.id, messageId), eq(aiTestingMessages.tenantId, tenantId)));
      if (!msg) return res.status(404).json({ message: "Сообщение не найдено" });

      const existingMeta = (msg.meta as Record<string, unknown>) || {};
      await db.update(aiTestingMessages)
        .set({ meta: { ...existingMeta, feedback: { action, editedText, at: new Date().toISOString() } } })
        .where(eq(aiTestingMessages.id, messageId));

      if (action === "TRAIN") {
        const sessionMsgs = await db.select().from(aiTestingMessages)
          .where(and(eq(aiTestingMessages.sessionId, msg.sessionId), eq(aiTestingMessages.tenantId, tenantId)))
          .orderBy(aiTestingMessages.createdAt);

        const msgIndex = sessionMsgs.findIndex(m => m.id === messageId);
        const userMsg = msgIndex > 0 ? sessionMsgs[msgIndex - 1] : null;

        await db.insert(trainingItems).values({
          tenantId,
          userMessage: userMsg?.content || "",
          aiOriginal: msg.content,
          aiCorrected: editedText || msg.content,
          source: "TESTING",
        });
      }

      if (action === "ADD_TO_KB") {
        const sessionMsgs = await db.select().from(aiTestingMessages)
          .where(and(eq(aiTestingMessages.sessionId, msg.sessionId), eq(aiTestingMessages.tenantId, tenantId)))
          .orderBy(aiTestingMessages.createdAt);

        const msgIndex = sessionMsgs.findIndex(m => m.id === messageId);
        const userMsg = msgIndex > 0 ? sessionMsgs[msgIndex - 1] : null;

        await db.insert(knowledgeItems).values({
          tenantId,
          type: "faq",
          title: userMsg?.content || "Из тестирования",
          content: editedText || msg.content,
        });
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error("Ошибка сохранения фидбека:", error);
      res.status(500).json({ message: "Ошибка сохранения фидбека" });
    }
  });

  app.post("/api/ai/testing/simulation/start", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { personaKey } = req.body;
      if (!personaKey || !PERSONAS[personaKey]) {
        return res.status(400).json({ message: "Некорректная персона" });
      }

      const persona = PERSONAS[personaKey];
      const tenantProducts = await db.select({ name: products.name }).from(products)
        .where(and(eq(products.tenantId, tenantId), eq(products.isActive, true)))
        .limit(10);

      const productName = tenantProducts.length > 0
        ? tenantProducts[Math.floor(Math.random() * tenantProducts.length)].name
        : "ваш товар";

      const opener = persona.openers[0].replace("{product}", productName);

      const [session] = await db.insert(aiTestingSessions).values({
        tenantId,
        mode: "SIMULATION",
        personaKey,
        status: "active",
      }).returning();

      const [userMsg] = await db.insert(aiTestingMessages).values({
        tenantId,
        sessionId: session.id,
        role: "user",
        content: opener,
        meta: { isSimulated: true, personaKey },
      }).returning();

      const context = await buildTenantContext(tenantId, pool, storage);
      const aiResult = await generateAiResponse(opener, [], context);

      const productNames = (context.products || []).map((p: any) => p.name);
      const microEval = computeMicroEval(opener, aiResult.content, context.tone, context.goal, productNames);

      const [assistantMsg] = await db.insert(aiTestingMessages).values({
        tenantId,
        sessionId: session.id,
        role: "assistant",
        content: aiResult.content,
        meta: { microEval, isSimulated: true },
      }).returning();

      res.json({ sessionId: session.id, messages: [userMsg, assistantMsg] });
    } catch (error: any) {
      console.error("Ошибка запуска симуляции:", error);
      res.status(500).json({ message: "Ошибка запуска симуляции" });
    }
  });

  app.post("/api/ai/testing/simulation/next", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { sessionId } = req.body;
      if (!sessionId) return res.status(400).json({ message: "sessionId обязателен" });

      const [session] = await db.select().from(aiTestingSessions)
        .where(and(eq(aiTestingSessions.id, sessionId), eq(aiTestingSessions.tenantId, tenantId)));
      if (!session) return res.status(404).json({ message: "Сессия не найдена" });

      const messages = await db.select().from(aiTestingMessages)
        .where(and(eq(aiTestingMessages.sessionId, sessionId), eq(aiTestingMessages.tenantId, tenantId)))
        .orderBy(aiTestingMessages.createdAt);

      if (messages.length >= 12) {
        await db.update(aiTestingSessions)
          .set({ status: "completed", updatedAt: new Date(), summaryJson: { totalMessages: messages.length, completedAt: new Date().toISOString() } })
          .where(eq(aiTestingSessions.id, sessionId));
        return res.json({ message: null, sessionComplete: true, summary: { totalMessages: messages.length } });
      }

      const personaKey = session.personaKey || "HAGGLER";
      const persona = PERSONAS[personaKey] || PERSONAS.HAGGLER;
      const followUpIndex = Math.min(Math.floor(messages.length / 2), persona.followUps.length - 1);
      const nextLine = persona.followUps[followUpIndex];

      const [userMsg] = await db.insert(aiTestingMessages).values({
        tenantId,
        sessionId,
        role: "user",
        content: nextLine,
        meta: { isSimulated: true, personaKey },
      }).returning();

      res.json({ message: userMsg, sessionComplete: false });
    } catch (error: any) {
      console.error("Ошибка следующего шага симуляции:", error);
      res.status(500).json({ message: "Ошибка следующего шага симуляции" });
    }
  });

  app.post("/api/ai/testing/stress/run", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const requestedScenarios = req.body.scenarios as string[] | undefined;
      const scenarioKeys = requestedScenarios && requestedScenarios.length > 0
        ? requestedScenarios.filter(k => DEFAULT_STRESS_SCENARIOS[k])
        : Object.keys(DEFAULT_STRESS_SCENARIOS);

      const [run] = await db.insert(aiStressTestRuns).values({
        tenantId,
        status: "running",
        progress: 0,
        scenarios: [],
      }).returning();

      res.json({ runId: run.id });

      (async () => {
        const results: Array<Record<string, unknown>> = [];
        let passed = 0;
        let context: any;
        try {
          context = await buildTenantContext(tenantId, pool, storage);
        } catch (e) {
          await db.update(aiStressTestRuns)
            .set({ status: "failed", finishedAt: new Date(), summary: "Ошибка получения контекста" })
            .where(eq(aiStressTestRuns.id, run.id));
          return;
        }

        for (let i = 0; i < scenarioKeys.length; i++) {
          const key = scenarioKeys[i];
          const userText = DEFAULT_STRESS_SCENARIOS[key];
          let scenarioResult: Record<string, unknown> = { key, userText, passed: false, reply: "", error: null };

          try {
            const [stressSession] = await db.insert(aiTestingSessions).values({
              tenantId,
              mode: "STRESS_TEST",
              personaKey: key,
              status: "completed",
            }).returning();

            await db.insert(aiTestingMessages).values({
              tenantId,
              sessionId: stressSession.id,
              role: "user",
              content: userText,
            });

            const aiResult = await generateAiResponse(userText, [], context);
            const reply = aiResult.content || "";

            await db.insert(aiTestingMessages).values({
              tenantId,
              sessionId: stressSession.id,
              role: "assistant",
              content: reply,
            });

            let scenarioPassed = reply.length >= 20;
            const replyLower = reply.toLowerCase();

            if (key === "HUMAN") {
              scenarioPassed = scenarioPassed && (replyLower.includes("менеджер") || replyLower.includes("оператор") || replyLower.includes("передам") || replyLower.includes("позову"));
            } else if (key === "CLOSE") {
              scenarioPassed = scenarioPassed && (replyLower.includes("оплат") || replyLower.includes("заказ") || replyLower.includes("купить") || replyLower.includes("ссылк"));
            } else if (key === "WARRANTY") {
              scenarioPassed = scenarioPassed && (replyLower.includes("гарант") || replyLower.includes("возврат") || replyLower.includes("обмен"));
            } else if (key === "DELIVERY") {
              scenarioPassed = scenarioPassed && (replyLower.includes("доставк") || replyLower.includes("самовывоз") || replyLower.includes("получ"));
            } else {
              const relevantWords = ["цен", "стоимост", "скидк", "рассрочк", "товар", "предлаг", "рекоменд", "помочь"];
              scenarioPassed = scenarioPassed && relevantWords.some(w => replyLower.includes(w));
            }

            scenarioResult = { key, userText, passed: scenarioPassed, reply, error: null };
            if (scenarioPassed) passed++;
          } catch (e: any) {
            scenarioResult = { key, userText, passed: false, reply: "", error: e.message };
          }

          results.push(scenarioResult);

          await db.update(aiStressTestRuns)
            .set({ progress: Math.round(((i + 1) / scenarioKeys.length) * 100), scenarios: results as any })
            .where(eq(aiStressTestRuns.id, run.id));
        }

        const overallScore = Math.round((passed / scenarioKeys.length) * 100);
        await db.update(aiStressTestRuns)
          .set({
            status: "completed",
            finishedAt: new Date(),
            overallScore,
            scenarios: results as any,
            progress: 100,
            summary: `Пройдено ${passed}/${scenarioKeys.length} сценариев (${overallScore}%)`,
          })
          .where(eq(aiStressTestRuns.id, run.id));
      })().catch(err => {
        console.error("Ошибка фоновой обработки стресс-теста:", err);
        db.update(aiStressTestRuns)
          .set({ status: "failed", finishedAt: new Date(), summary: "Критическая ошибка" })
          .where(eq(aiStressTestRuns.id, run.id))
          .catch(() => {});
      });

    } catch (error: any) {
      console.error("Ошибка запуска стресс-теста:", error);
      res.status(500).json({ message: "Ошибка запуска стресс-теста" });
    }
  });

  app.get("/api/ai/testing/stress/run/:runId", requireAuth, requireAiAccess, async (req: Request, res: Response) => {
    try {
      const tenantId = req.user!.tenantId!;
      const { runId } = req.params;

      const [run] = await db.select().from(aiStressTestRuns)
        .where(and(eq(aiStressTestRuns.id, runId), eq(aiStressTestRuns.tenantId, tenantId)));

      if (!run) return res.status(404).json({ message: "Стресс-тест не найден" });
      res.json(run);
    } catch (error: any) {
      console.error("Ошибка получения стресс-теста:", error);
      res.status(500).json({ message: "Ошибка получения стресс-теста" });
    }
  });
}
