export type PeriodKey = "1d" | "7d" | "30d" | "90d" | "custom";
export type SourceFilter = "ALL" | "PRODUCTION" | "TESTING";
export type OutcomeType = "SUCCESS" | "FAILED" | "HANDOVER" | "ABANDONED" | "UNKNOWN";
export type FunnelStage = "GREETING" | "NEEDS" | "OFFER" | "OBJECTION" | "CLOSE" | "SUCCESS" | "HANDOVER" | "DROP";
export type ObjectionType = "PRICE" | "COMPARE" | "TRUST" | "DELIVERY" | "PAYMENT" | "STOCK" | "OTHER";
export type AuditSeverity = "LOW" | "MEDIUM" | "HIGH";
export type AuditFindingType = "BOTTLENECK" | "CONFIG_MISSING" | "TRIGGER_MISSING" | "KB_MISSING" | "HANDOVER_TOO_EARLY" | "PAYMENT_FRICTION" | "OBJECTION_WEAK" | "PRODUCT_MATCH_WEAK";

export interface KpiData {
  totalDialogs: number;
  successCount: number;
  successRate: number;
  handoverCount: number;
  handoverRate: number;
  abandonedCount: number;
  abandonedRate: number;
  failedCount: number;
  avgMessages: number;
  totalRevenue: number;
  revenuePerDialog: number;
}

export interface FunnelStageData {
  stage: FunnelStage;
  count: number;
  conversionFromPrev: number;
}

export interface BottleneckData {
  stage: string;
  count: number;
  rate: number;
  topReasons: { reason: string; count: number }[];
}

export interface ObjectionData {
  type: string;
  count: number;
  successRate: number;
  handoverRate: number;
}

export interface HandoverData {
  count: number;
  rate: number;
  reasons: { reason: string; count: number }[];
  tooEarlyRate: number;
}

export interface TriggerStat {
  id: string;
  name: string;
  fired: number;
  successRate: number;
}

export interface TriggerStatsData {
  topHelpful: TriggerStat[];
  topNoisy: TriggerStat[];
  totals: { fired: number; dialogsWithAnyTrigger: number };
}

export interface TrainingImpactData {
  triggersAdded: number;
  kbAdded: number;
  trainActions: number;
  periodSuccessRate: number;
  prevPeriodSuccessRate: number | null;
}

export interface LastAuditData {
  runId: string;
  finishedAt: string;
  dialogsAnalyzed: number;
  mainFinding: string | null;
}

export interface AnalyticsSummary {
  period: { from: string; to: string };
  kpis: KpiData;
  funnel: { stages: FunnelStageData[] };
  bottlenecks: BottleneckData[];
  objections: ObjectionData[];
  handover: HandoverData;
  triggers: TriggerStatsData;
  trainingImpact: TrainingImpactData;
  lastAudit: LastAuditData | null;
}

export interface DialogListItem {
  id: string;
  tenantId: string;
  source: string;
  channel: string;
  startedAt: string;
  lastMessageAt: string | null;
  messageCount: number;
  goal: string;
  status: string;
  outcome: string;
  dropoffStage: string | null;
  dropoffReason: string | null;
  handoverReason: string | null;
  leadCaptured: boolean;
  revenueAmount: string | null;
  stageReached: string;
  objections: string[];
  hasHandover: boolean;
  durationMins: number;
}

export interface DialogDetail {
  dialog: DialogListItem;
  messages: { id: string; role: string; content: string; createdAt: string; meta?: any }[];
  events: { id: string; eventType: string; eventValue: string | null; ts: string }[];
  stageTimeline: { stage: string; ts: string }[];
}

export interface AuditFinding {
  id: string;
  severity: AuditSeverity;
  type: AuditFindingType;
  title: string;
  details: string;
  suggestedFix?: { deepLink?: string; action?: string; payload?: any };
  evidence?: { count?: number; rate?: number; dialogIds?: string[] };
}

export interface AuditRun {
  id: string;
  status: string;
  periodStart: string;
  periodEnd: string;
  sourceFilter: string;
  dialogsAnalyzed: number;
  summary: any;
  recommendations: any[];
  createdAt: string;
  finishedAt: string | null;
  findings: AuditFinding[];
}

export const STAGE_LABELS: Record<string, string> = {
  GREETING: "Приветствие",
  NEEDS: "Потребности",
  OFFER: "Предложение",
  OBJECTION: "Возражения",
  CLOSE: "Закрытие",
  SUCCESS: "Успех",
  HANDOVER: "Передача",
  DROP: "Отвал",
};

export const OBJECTION_LABELS: Record<string, string> = {
  PRICE: "Цена",
  COMPARE: "Сравнение",
  TRUST: "Доверие",
  DELIVERY: "Доставка",
  PAYMENT: "Оплата",
  STOCK: "Наличие",
  OTHER: "Другое",
};

export const OUTCOME_LABELS: Record<string, string> = {
  SUCCESS: "Успех",
  FAILED: "Отказ",
  HANDOVER: "Передача",
  ABANDONED: "Потерян",
  UNKNOWN: "Неизвестно",
};

export const DROPOFF_REASON_LABELS: Record<string, string> = {
  NO_RESPONSE: "Нет ответа",
  PRICE: "Цена",
  TRUST: "Доверие",
  DELIVERY: "Доставка",
  PAYMENT_FRICTION: "Оплата",
  STOCK: "Наличие",
  OTHER: "Другое",
  UNKNOWN: "Неизвестно",
};

export const SEVERITY_LABELS: Record<string, string> = {
  HIGH: "Критично",
  MEDIUM: "Важно",
  LOW: "Совет",
};
