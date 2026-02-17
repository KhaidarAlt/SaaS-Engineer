export type ChannelType = "WHATSAPP_META" | "WHATSAPP_WAHA" | "INSTAGRAM" | "TELEGRAM";

export type ChannelStatus = "NOT_CONNECTED" | "CONNECTING" | "CONNECTED" | "ERROR" | "NEEDS_ACTION";

export interface ChannelInfo {
  id?: string;
  channelType: ChannelType;
  status: ChannelStatus;
  isAiEnabled: boolean;
  displayName: string | null;
  lastError: string | null;
  lastCheckedAt?: string | null;
}

export interface ChannelEvent {
  id: string;
  tenantId: string;
  channelId: string | null;
  channelType: string;
  eventType: string;
  message: string | null;
  createdAt: string;
}

export interface DisclaimerStatus {
  accepted: boolean;
  acceptedAt: string | null;
  version: string | null;
}

export interface HealthCheckResult {
  results: Record<string, string>;
  checkedAt: string;
}

export const CHANNEL_LABELS: Record<ChannelType, string> = {
  WHATSAPP_META: "WhatsApp (Meta)",
  WHATSAPP_WAHA: "WhatsApp (WAHA)",
  INSTAGRAM: "Instagram Direct",
  TELEGRAM: "Telegram Bot",
};

export const STATUS_LABELS: Record<ChannelStatus, string> = {
  NOT_CONNECTED: "Не подключено",
  CONNECTING: "Подключение...",
  CONNECTED: "Подключено",
  ERROR: "Ошибка",
  NEEDS_ACTION: "Требуется действие",
};

export const STATUS_COLORS: Record<ChannelStatus, string> = {
  NOT_CONNECTED: "bg-muted text-muted-foreground",
  CONNECTING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  CONNECTED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  ERROR: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  NEEDS_ACTION: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
};

export const EVENT_TYPE_LABELS: Record<string, string> = {
  CONNECTED: "Подключено",
  DISCONNECTED: "Отключено",
  ERROR: "Ошибка",
  HEALTH_CHECK: "Проверено",
  DISCLAIMER_ACCEPTED: "Согласие принято",
  TEST_SENT: "Тест отправлен",
};
