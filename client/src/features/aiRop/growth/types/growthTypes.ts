export type CampaignType = "REACTIVATION" | "UPSELL" | "ABANDONED" | "REMINDER" | "NPS";
export type CampaignStatus = "DRAFT" | "READY" | "RUNNING" | "PAUSED" | "COMPLETED" | "FAILED";
export type ChannelPolicy = "AUTO" | "PREFER_LAST" | "FORCE_WHATSAPP";
export type QueueStatus = "PENDING" | "SENT" | "FAILED" | "SKIPPED" | "REPLIED" | "STOPPED";

export interface GrowthCampaign {
  id: string;
  tenantId: string;
  type: CampaignType;
  status: CampaignStatus;
  name: string;
  channelPolicy: ChannelPolicy;
  audienceRules: Record<string, unknown>;
  messageRules: Record<string, unknown>;
  scheduleRules: Record<string, unknown>;
  safetyRules: Record<string, unknown>;
  createdBy: string | null;
  totalQueued: number;
  totalSent: number;
  totalFailed: number;
  totalReplied: number;
  totalSkipped: number;
  createdAt: string;
  updatedAt: string;
}

export interface GrowthSummary {
  totalContacts: number;
  totalCampaigns: number;
  totalSent: number;
  totalReplied: number;
  replyRate: number;
  reactivationCandidates: number;
  recentCampaigns: GrowthCampaign[];
  recentEvents: GrowthEvent[];
}

export interface GrowthEvent {
  id: string;
  campaignId: string;
  contactId: string | null;
  eventType: string;
  meta: Record<string, unknown> | null;
  createdAt: string;
}

export interface QueueItem {
  id: string;
  contactId: string;
  resolvedChannel: string | null;
  status: QueueStatus;
  plannedAt: string;
  sentAt: string | null;
  error: string | null;
  contactName: string | null;
  contactPhone: string | null;
}

export interface EstimateResult {
  totalAudience: number;
  eligible: number;
  blocked: number;
  blockReasons: Record<string, number>;
  preview: Array<{
    contactId: string;
    name: string | null;
    channel: string;
    provider: string;
    address: string;
  }>;
}

export interface PreviewResult {
  totalAudience: number;
  recipients: Array<{
    contactId: string;
    name: string;
    phone: string | null;
    channel: string | null;
    provider: string | null;
    status: string;
    reason: string | null;
  }>;
  connectedChannels: string[];
  safetyRules: Record<string, unknown>;
  scheduleRules: Record<string, unknown>;
}

export interface CampaignAnalytics {
  campaign: {
    id: string; name: string; type: string; status: string;
    totalQueued: number; totalSent: number; totalFailed: number;
    totalReplied: number; totalSkipped: number;
  };
  eventCounts: Record<string, number>;
  recentEvents: GrowthEvent[];
}

export const CAMPAIGN_TYPE_LABELS: Record<CampaignType, string> = {
  REACTIVATION: "Реактивация",
  UPSELL: "Апселл",
  ABANDONED: "Брошенные",
  REMINDER: "Напоминания",
  NPS: "Отзывы",
};

export const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  DRAFT: "Черновик",
  READY: "Готова",
  RUNNING: "Запущена",
  PAUSED: "Пауза",
  COMPLETED: "Завершена",
  FAILED: "Ошибка",
};

export const CAMPAIGN_TYPE_DESCRIPTIONS: Record<CampaignType, string> = {
  REACTIVATION: "Вернуть клиентов, которые давно не писали",
  UPSELL: "Предложить дополнительные товары после заказа",
  ABANDONED: "Дожать клиентов с незавершёнными диалогами",
  REMINDER: "Напомнить о ценах, наличии, акциях",
  NPS: "Собрать отзывы и оценки после покупки",
};
