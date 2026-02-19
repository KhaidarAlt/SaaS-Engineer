export type TestMode = "FREE_CHAT" | "SIMULATION" | "STRESS_TEST";

export type FeedbackAction = "APPROVE" | "IMPROVE" | "TRAIN" | "FIX_ONLY" | "ADD_TO_KB" | "ANTI_PATTERN";

export interface ScoreBreakdownCategory {
  score: number;
  max: number;
  items: Record<string, { score: number; max: number; label: string; passed: boolean }>;
}

export interface ScoreBreakdown {
  completeness: ScoreBreakdownCategory;
  behavior: ScoreBreakdownCategory;
  operations: ScoreBreakdownCategory;
  testing: ScoreBreakdownCategory;
}

export interface AiScore {
  scoreTotal: number;
  breakdown: ScoreBreakdown;
  lastComputedAt: string;
  notes: string[];
}

export interface ReadinessCheck {
  status: "READY" | "WARNING" | "BLOCKED";
  reasons: Array<{ label: string; passed: boolean; detail?: string; link?: string }>;
}

export interface MicroEvaluation {
  score: number;
  positives: string[];
  issues: string[];
  suggestions: string[];
}

export interface TestingMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  meta?: {
    microEval?: MicroEvaluation;
    isSimulated?: boolean;
    scenarioKey?: string;
    feedback?: FeedbackAction;
    [key: string]: unknown;
  };
  createdAt: string;
}

export interface TestingSession {
  id: string;
  mode: TestMode;
  personaKey?: string;
  status: "active" | "completed" | "aborted";
  messages: TestingMessage[];
  summaryJson?: Record<string, unknown>;
  createdAt: string;
}

export interface PersonaConfig {
  key: string;
  name: string;
  description: string;
  icon: string;
  openers: string[];
  objections: string[];
}

export const PERSONAS: PersonaConfig[] = [
  {
    key: "HAGGLER",
    name: "Торгуется",
    description: "Хочет скидку, торгуется за цену",
    icon: "HandCoins",
    openers: ["Сколько стоит?", "А скидка есть?"],
    objections: ["Сделаете дешевле?", "У конкурентов ниже"],
  },
  {
    key: "DOUBTER",
    name: "Сомневается",
    description: "Не уверен, задаёт много вопросов",
    icon: "HelpCircle",
    openers: ["А это точно качественный товар?", "Не уверен, стоит ли брать..."],
    objections: ["А гарантия?", "Стоит ли переплачивать?"],
  },
  {
    key: "COMPARER",
    name: "Сравнивает",
    description: "Сравнивает с конкурентами",
    icon: "Scale",
    openers: ["Почему у вас дороже?", "У конкурентов видел дешевле"],
    objections: ["Почему у вас дороже чем X?", "В другом магазине лучше условия"],
  },
  {
    key: "CHEAPER",
    name: "Хочет дешевле",
    description: "Ищет бюджетный вариант",
    icon: "PiggyBank",
    openers: ["Есть что-нибудь подешевле?", "Какой самый дешёвый вариант?"],
    objections: ["Слишком дорого для меня", "Есть вариант подешевле?"],
  },
  {
    key: "ANGRY",
    name: "Агрессивный",
    description: "Недоволен, агрессивно общается",
    icon: "Flame",
    openers: ["Почему так дорого?!", "Вы вообще отвечаете нормально?"],
    objections: ["Это грабёж!", "Позовите менеджера, вы некомпетентны"],
  },
  {
    key: "PREMIUM",
    name: "Премиум",
    description: "Хочет лучшее, не экономит",
    icon: "Crown",
    openers: ["Нужна лучшая модель", "Что порекомендуете из премиум?"],
    objections: ["А есть ещё лучше?", "Мне нужен максимальный комплект"],
  },
];

export interface ScenarioResult {
  scenarioKey: string;
  label: string;
  userText: string;
  assistantText: string;
  pass: boolean;
  issues: string[];
  suggestions: string[];
  failureReason?: string | null;
  expectedBehavior?: string;
}

export interface StressTestRun {
  id: string;
  status: "running" | "completed" | "failed";
  progress: number;
  scenarios: ScenarioResult[];
  overallScore: number | null;
  summary: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export const STRESS_SCENARIOS = [
  { key: "PRICE_HIGH", label: "Дорого", userText: "Дорого" },
  { key: "ASK_DISCOUNT", label: "Скидка", userText: "Есть скидка?" },
  { key: "WANT_CHEAPER", label: "Дешевле", userText: "Хочу дешевле" },
  { key: "COMPARE", label: "Конкуренты", userText: "У конкурентов дешевле" },
  { key: "INSTALLMENT", label: "Рассрочка", userText: "Есть рассрочка?" },
  { key: "WARRANTY", label: "Гарантия", userText: "Какая гарантия?" },
  { key: "DELIVERY", label: "Доставка", userText: "Как доставка и самовывоз?" },
  { key: "HUMAN", label: "Менеджер", userText: "Дайте менеджера" },
  { key: "COMPLEX", label: "Сложный", userText: "У меня нестандартный вопрос, не могу найти ответ" },
  { key: "CLOSE", label: "Покупка", userText: "Готов купить, как оплатить?" },
] as const;
