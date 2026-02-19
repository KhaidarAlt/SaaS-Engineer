export interface NormalizedInboundMessage {
  channel: string;
  provider: string;
  direction: "inbound";
  fromAddress: string;
  toAddress: string;
  messageType: string;
  content: Record<string, unknown>;
  providerMessageId: string;
  providerTimestamp: Date;
  contactName?: string;
  meta?: Record<string, unknown>;
}

export interface NormalizedStatusUpdate {
  providerMessageId: string;
  status: string;
  recipientId: string;
  timestamp: Date;
  meta?: Record<string, unknown>;
}

export interface NormalizedOutbound {
  tenantId: string;
  channel: string;
  provider: string;
  toAddress: string;
  messageType: string;
  content: Record<string, unknown>;
}

export interface ProviderSendResult {
  success: boolean;
  providerMessageId?: string;
  error?: string;
  errorCode?: string;
  retryable: boolean;
}

export interface IngestResult {
  messages: NormalizedInboundMessage[];
  statuses: NormalizedStatusUpdate[];
  phoneNumberId: string;
}

export type SendOutboundFn = (req: NormalizedOutbound) => Promise<ProviderSendResult>;
