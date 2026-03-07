import crypto from "crypto";
import type {
  NormalizedInboundMessage,
  NormalizedStatusUpdate,
  NormalizedOutbound,
  ProviderSendResult,
  IngestResult,
} from "../types";

export { computeDedupKey };

export interface WahaWebhookPayload {
  event: string;
  session: string;
  payload: {
    id?: string;
    from?: string;
    to?: string;
    fromMe?: boolean;
    body?: string;
    timestamp?: number;
    type?: string;
    hasMedia?: boolean;
    mediaUrl?: string;
    mimetype?: string;
    filename?: string;
    caption?: string;
    location?: {
      latitude: number;
      longitude: number;
      description?: string;
    };
    vCards?: string[];
    ack?: number;
    ackName?: string;
    _data?: Record<string, unknown>;
  };
}

function extractContent(payload: WahaWebhookPayload["payload"]): {
  messageType: string;
  content: Record<string, unknown>;
} {
  if (payload.hasMedia && payload.mediaUrl) {
    const mime = payload.mimetype || "";
    if (mime.startsWith("image/")) {
      return {
        messageType: "image",
        content: {
          url: payload.mediaUrl,
          mimeType: mime,
          caption: payload.caption,
        },
      };
    }
    if (mime.startsWith("video/")) {
      return {
        messageType: "video",
        content: {
          url: payload.mediaUrl,
          mimeType: mime,
          caption: payload.caption,
        },
      };
    }
    if (mime.startsWith("audio/")) {
      return {
        messageType: "audio",
        content: { url: payload.mediaUrl, mimeType: mime },
      };
    }
    return {
      messageType: "document",
      content: {
        url: payload.mediaUrl,
        mimeType: mime,
        filename: payload.filename,
        caption: payload.caption,
      },
    };
  }

  if (payload.location) {
    return {
      messageType: "location",
      content: {
        latitude: payload.location.latitude,
        longitude: payload.location.longitude,
        name: payload.location.description,
      },
    };
  }

  if (payload.vCards?.length) {
    return {
      messageType: "contacts",
      content: { contacts: payload.vCards },
    };
  }

  return {
    messageType: "text",
    content: { text: payload.body || "" },
  };
}

function normalizePhone(raw: string): string {
  return raw.replace(/@c\.us$/, "").replace(/@s\.whatsapp\.net$/, "");
}

function computeDedupKey(provider: string, providerMessageId: string): string {
  return crypto
    .createHash("sha256")
    .update(`${provider}:${providerMessageId}`)
    .digest("hex");
}

export function ingestWebhook(raw: WahaWebhookPayload): IngestResult {
  const result: IngestResult = {
    messages: [],
    statuses: [],
    phoneNumberId: raw.session,
  };

  const p = raw.payload;
  if (!p) return result;

  if (raw.event === "message" && p.from && !p.fromMe && p.id) {
    const { messageType, content } = extractContent(p);
    const fromPhone = normalizePhone(p.from);
    const toPhone = p.to ? normalizePhone(p.to) : raw.session;

    result.messages.push({
      channel: "whatsapp",
      provider: "waha",
      direction: "inbound",
      fromAddress: fromPhone,
      toAddress: toPhone,
      messageType,
      content,
      providerMessageId: p.id,
      providerTimestamp: p.timestamp
        ? new Date(p.timestamp * 1000)
        : new Date(),
      meta: { session: raw.session },
    });
  }

  if (raw.event === "message.ack" && p.id && p.ack !== undefined) {
    const statusMap: Record<number, string> = {
      0: "pending",
      1: "sent",
      2: "delivered",
      3: "read",
      4: "played",
    };
    result.statuses.push({
      providerMessageId: p.id,
      status: statusMap[p.ack] || "unknown",
      recipientId: p.to ? normalizePhone(p.to) : "",
      timestamp: new Date(),
    });
  }

  return result;
}

const WAHA_BASE_URL = process.env.WAHA_BASE_URL || "https://waha.botfactory.kz";
const WAHA_API_KEY = process.env.WAHA_API_KEY || "";

export async function sendTypingStatus(sessionName: string, chatId: string): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (WAHA_API_KEY) headers["X-Api-Key"] = WAHA_API_KEY;

  try {
    await fetch(`${WAHA_BASE_URL}/api/startTyping`, {
      method: "POST",
      headers,
      body: JSON.stringify({ session: sessionName, chatId }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    // Non-critical — silently ignore typing indicator failures
  }
}

export async function stopTypingStatus(sessionName: string, chatId: string): Promise<void> {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (WAHA_API_KEY) headers["X-Api-Key"] = WAHA_API_KEY;

  try {
    await fetch(`${WAHA_BASE_URL}/api/stopTyping`, {
      method: "POST",
      headers,
      body: JSON.stringify({ session: sessionName, chatId }),
      signal: AbortSignal.timeout(5000),
    });
  } catch (err) {
    // Non-critical
  }
}

export async function sendOutbound(req: NormalizedOutbound): Promise<ProviderSendResult> {
  if (req.provider !== "waha" || req.channel !== "whatsapp") {
    return {
      success: false,
      error: `Unsupported provider/channel: ${req.provider}/${req.channel}`,
      errorCode: "UNSUPPORTED_CHANNEL",
      retryable: false,
    };
  }

  const sessionName = (req.content as any).wahaSession;
  if (!sessionName) {
    return {
      success: false,
      error: "Missing wahaSession in content.wahaSession",
      errorCode: "NO_SESSION",
      retryable: false,
    };
  }

  let recipientPhone = req.toAddress.replace(/\D/g, "");
  if (recipientPhone.length === 11 && recipientPhone.startsWith("8")) {
    recipientPhone = "7" + recipientPhone.slice(1);
  }
  const chatId = `${recipientPhone}@c.us`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (WAHA_API_KEY) {
    headers["X-Api-Key"] = WAHA_API_KEY;
  }

  try {
    if (req.messageType === "image" && req.content.url) {
      const response = await fetch(`${WAHA_BASE_URL}/api/sendImage`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          session: sessionName,
          chatId,
          file: { url: req.content.url },
          caption: req.content.caption || undefined,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        const errText = await response.text().catch(() => "");
        return classifyWahaError(response.status, errText);
      }

      const data = await response.json();
      return { success: true, providerMessageId: data?.id, retryable: false };
    }

    const textBody = (req.content.text as string) || "";
    const response = await fetch(`${WAHA_BASE_URL}/api/sendText`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        session: sessionName,
        chatId,
        text: textBody,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      return classifyWahaError(response.status, errText);
    }

    const data = await response.json();
    return { success: true, providerMessageId: data?.id, retryable: false };
  } catch (err: any) {
    if (err.name === "AbortError" || err.name === "TimeoutError") {
      return { success: false, error: "Request timed out", errorCode: "TIMEOUT", retryable: true };
    }
    return { success: false, error: err.message || "Network error", errorCode: "NETWORK_ERROR", retryable: true };
  }
}

function classifyWahaError(status: number, body: string): ProviderSendResult {
  if (status >= 500) {
    return { success: false, error: `WAHA ${status}: ${body}`, errorCode: String(status), retryable: true };
  }
  if (body.includes("not found") || body.includes("not running")) {
    return { success: false, error: `WAHA session error: ${body}`, errorCode: "SESSION_NOT_FOUND", retryable: false };
  }
  return { success: false, error: `WAHA ${status}: ${body}`, errorCode: String(status), retryable: status >= 500 };
}
