export type ApplyMode = "FIX_ONLY" | "TRAIN_FUTURE" | "ADD_TO_KB" | "ANTI_PATTERN";

export type MatchType = "KEYWORD" | "REGEX" | "INTENT";

export type ActionType =
  | "ADD_LINE_TO_REPLY"
  | "FORCE_HANDOVER"
  | "OFFER_INSTALLMENT"
  | "OFFER_CHEAPER"
  | "UPSELL"
  | "APPLY_PROMO"
  | "ASK_CLARIFYING_QUESTION"
  | "USE_SCRIPT_SNIPPET";

export type KnowledgeType =
  | "DELIVERY"
  | "PAYMENT"
  | "INSTALLMENTS"
  | "WARRANTY"
  | "RETURNS"
  | "STORE_INFO"
  | "USP"
  | "BRAND"
  | "PRODUCT_RULE"
  | "OTHER";

export type PatternType = "KEYWORD" | "REGEX" | "CLAIM";

export type TrainingEventType =
  | "EDIT_REPLY"
  | "TRAIN_APPROVED"
  | "KB_ADDED"
  | "TRIGGER_CREATED"
  | "TRIGGER_UPDATED"
  | "ANTI_PATTERN_ADDED"
  | "IGNORE_SUGGESTION";

export type TrainingSubTab = "ai-coach" | "quick-train" | "triggers" | "knowledge" | "anti-patterns" | "history";

export interface AiLearningSuggestion {
  id: string;
  tenantId: string;
  topic: string;
  problemSummary: string;
  suggestedContent: string;
  status: "pending" | "approved" | "rejected";
  sourceDialogIds: string[] | null;
  potentialRevenueImpact: number | null;
  createdAt: string;
}

export interface AiTrigger {
  id: string;
  tenantId: string;
  isEnabled: boolean;
  priority: number;
  matchType: MatchType;
  matchValue: string;
  conditions: Record<string, unknown> | null;
  actionType: ActionType;
  actionPayload: Record<string, unknown> | null;
  createdAt: string;
  updatedAt: string;
}

export interface KnowledgeItem {
  id: string;
  tenantId: string;
  type: string;
  title: string;
  content: string;
  source: string | null;
  tags: string[] | null;
  isActive: boolean | null;
  createdAt: string;
  updatedAt: string;
}

export interface AiAntiPattern {
  id: string;
  tenantId: string;
  patternType: PatternType;
  patternValue: string;
  note: string | null;
  isActive: boolean;
  createdAt: string;
}

export interface AiTrainingEvent {
  id: string;
  tenantId: string;
  eventType: TrainingEventType;
  refId: string | null;
  context: Record<string, unknown> | null;
  createdAt: string;
}

export interface QuickTrainRequest {
  userText: string;
  assistantText: string;
  editedText: string;
  applyMode: ApplyMode;
  meta?: Record<string, unknown>;
}

export interface QuickTrainResult {
  ok: boolean;
  createdTriggerId?: string;
  createdKnowledgeId?: string;
  createdAntiPatternId?: string;
}

export interface RecentTestMessage {
  id: string;
  role: string;
  content: string;
  createdAt: string;
}

export const KNOWLEDGE_TYPE_LABELS: Record<string, string> = {
  DELIVERY: "Доставка",
  PAYMENT: "Оплата",
  INSTALLMENTS: "Рассрочка",
  WARRANTY: "Гарантия",
  RETURNS: "Возврат",
  STORE_INFO: "О магазине",
  USP: "УТП",
  BRAND: "Бренд",
  PRODUCT_RULE: "Правило товара",
  OTHER: "Другое",
};

export const ACTION_TYPE_LABELS: Record<string, string> = {
  ADD_LINE_TO_REPLY: "Добавить строку в ответ",
  FORCE_HANDOVER: "Передать менеджеру",
  OFFER_INSTALLMENT: "Предложить рассрочку",
  OFFER_CHEAPER: "Предложить дешевле",
  UPSELL: "Апсейл",
  APPLY_PROMO: "Применить промо",
  ASK_CLARIFYING_QUESTION: "Уточняющий вопрос",
  USE_SCRIPT_SNIPPET: "Скрипт ответа",
};

export const MATCH_TYPE_LABELS: Record<string, string> = {
  KEYWORD: "Ключевое слово",
  REGEX: "Регулярное выражение",
  INTENT: "Намерение",
};

export const EVENT_TYPE_LABELS: Record<string, string> = {
  EDIT_REPLY: "Правка ответа",
  TRAIN_APPROVED: "Обучение одобрено",
  KB_ADDED: "Добавлено в базу",
  TRIGGER_CREATED: "Создан триггер",
  TRIGGER_UPDATED: "Обновлён триггер",
  ANTI_PATTERN_ADDED: "Добавлен анти-паттерн",
  IGNORE_SUGGESTION: "Предложение отклонено",
};
