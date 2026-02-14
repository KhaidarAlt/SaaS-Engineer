export type GoalType = "CLOSE_DEAL" | "QUALIFY_HANDOVER" | "CONSULT_MATCH" | "ORDER_NO_PAYMENT";
export type ReadinessStatus = "READY" | "WARNING" | "BLOCKED";
export type TonePreset = "short" | "friendly" | "premium" | "custom";
export type StageLabel = "greeting" | "need_detection" | "product_offer" | "objection_handling" | "closing_attempt" | "order_created" | "payment" | "handover";

export interface ReadinessCheck {
  label: string;
  passed: boolean;
  detail?: string;
}

export interface ReadinessResult {
  status: ReadinessStatus;
  checks: ReadinessCheck[];
  message: string;
  goal: GoalType;
}

export interface CatalogSummary {
  productsCount: number;
  categoriesCount: number;
  avgPrice: number;
  promoZoneActive: boolean;
  paymentsReady: boolean;
}

export interface AiRopSettings {
  id: string;
  tenantId: string;
  enabled: boolean;
  language: string;
  tone: string;
  goal: GoalType;
  temperature: string;
  typingDelay: number;
  versionNumber: number;
  isActive: boolean;
  onboardingCompleted: boolean;
  onboardingStep: number;
  objectionsJson: string[];
  salesBoostersJson: SalesBoosters | null;
  systemPromptCustom: string | null;
  fallbackHandoffText: string | null;
  workingHoursJson: { from: string; to: string; days: number[] } | null;
  createdAt: string;
  updatedAt: string;
}

export interface SalesBoosters {
  upsell: boolean;
  cheaperAlternative: boolean;
  scarcity: boolean;
  autoPromo: boolean;
}

export interface HandoverRule {
  id: string;
  tenantId: string;
  ruleType: string;
  thresholdValue: string | null;
  customRuleText: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface KnowledgeItem {
  id: string;
  tenantId: string;
  type: string;
  title: string;
  content: string;
  isActive: boolean;
  createdAt: string;
}

export interface TrainingItem {
  id: string;
  tenantId: string;
  userMessage: string;
  aiOriginal: string;
  aiCorrected: string;
  stage: string | null;
  createdAt: string;
}

export interface AnalyticsSummary {
  totalDialogs: number;
  successfulDialogs: number;
  failedDialogs: number;
  handoverCount: number;
  conversionRate: number;
  avgMessagesPerDialog: number;
}

export interface FunnelStage {
  stage: string;
  count: number;
  dropOffRate: number;
}

export interface DropoffReason {
  stage: string;
  count: number;
  percentage: number;
}

export interface AuditReport {
  id: string;
  tenantId: string;
  periodStart: string;
  periodEnd: string;
  summaryJson: {
    totalDialogs: number;
    successful: number;
    failed: number;
    blockers: number;
    stageExits: Array<{ stage_exit: string; cnt: number }>;
  };
  recommendationsJson: Recommendation[];
  createdAt: string;
}

export interface Recommendation {
  problem: string;
  suggestion: string;
  estimatedImpact: string;
  type: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  stageLabel?: string | null;
  createdAt: string;
}

export interface TestChatResponse {
  conversationId: string;
  message: string;
  matchedTag?: string | null;
  stageLabel?: string | null;
  messageId: string;
}

export interface VersionHistoryEntry {
  id: string;
  tenantId: string;
  versionNumber: number;
  settingsSnapshot: Record<string, unknown>;
  changeReason: string | null;
  changedBy: string | null;
  createdAt: string;
}

export interface OnboardingData {
  goal: GoalType;
  tone: TonePreset;
  objections: string[];
  handoverRules: Array<{ ruleType: string; thresholdValue?: string }>;
  customToneText?: string;
}

export const GOAL_LABELS: Record<GoalType, { title: string; description: string; icon: string }> = {
  CLOSE_DEAL: {
    title: "Закрывать сделки",
    description: "AI ведёт клиента до оплаты через Kaspi",
    icon: "target",
  },
  QUALIFY_HANDOVER: {
    title: "Квалификация + передача",
    description: "AI выявляет потребность и передаёт менеджеру",
    icon: "users",
  },
  CONSULT_MATCH: {
    title: "Консультация + подбор",
    description: "AI помогает выбрать товар из каталога",
    icon: "search",
  },
  ORDER_NO_PAYMENT: {
    title: "Заказ без оплаты",
    description: "AI оформляет заказ, оплата отдельно",
    icon: "shoppingCart",
  },
};

export const TONE_LABELS: Record<TonePreset, { title: string; example: string }> = {
  short: { title: "Кратко и по делу", example: "Да, есть в наличии. Цена 15 000 ₸. Оформить?" },
  friendly: { title: "Дружелюбно", example: "Привет! Отличный выбор — этот товар очень популярен. Могу рассказать подробнее?" },
  premium: { title: "Премиум-эксперт", example: "Добрый день. Рад помочь с выбором. Данная модель отличается высоким качеством материалов." },
  custom: { title: "Свой стиль", example: "" },
};

export const DEFAULT_OBJECTIONS = [
  "Дорого",
  "Подумаю",
  "Хочу дешевле",
  "Сравниваю с конкурентами",
  "Есть скидка?",
  "Не уверен в качестве",
];

export const HANDOVER_RULE_TYPES = [
  { value: "explicit_request", label: "Просит человека" },
  { value: "amount_threshold", label: "Сумма больше X", hasThreshold: true },
  { value: "unusual_question", label: "Нестандартный вопрос" },
  { value: "negative_sentiment", label: "Негатив / жалоба" },
  { value: "never", label: "Никогда (не передавать)", exclusive: true },
];

export const STAGE_LABELS: Record<string, string> = {
  greeting: "Приветствие",
  need_detection: "Выявление потребности",
  product_offer: "Предложение товара",
  objection_handling: "Работа с возражениями",
  closing_attempt: "Закрытие сделки",
  order_created: "Заказ создан",
  payment: "Оплата",
  handover: "Передача менеджеру",
};
