import crypto from "crypto";
import type {
  NormalizedInboundMessage,
  NormalizedStatusUpdate,
  IngestResult,
} from "../types";

export type { NormalizedInboundMessage, NormalizedStatusUpdate };

export interface MetaWebhookPayload {
  object?: string;
  entry?: Array<{
    id: string;
    changes?: Array<{
      value: {
        messaging_product: string;
        metadata: {
          display_phone_number: string;
          phone_number_id: string;
        };
        contacts?: Array<{
          profile: { name: string };
          wa_id: string;
        }>;
        messages?: Array<{
          from: string;
          id: string;
          timestamp: string;
          type: string;
          text?: { body: string };
          image?: { id: string; mime_type: string; sha256: string; caption?: string };
          video?: { id: string; mime_type: string; sha256: string; caption?: string };
          audio?: { id: string; mime_type: string; sha256: string };
          document?: { id: string; mime_type: string; sha256: string; filename?: string; caption?: string };
          location?: { latitude: number; longitude: number; name?: string; address?: string };
          contacts?: Array<Record<string, unknown>>;
          interactive?: Record<string, unknown>;
          reaction?: { message_id: string; emoji: string };
          sticker?: { id: string; mime_type: string; sha256: string };
          button?: { text: string; payload: string };
          context?: { from: string; id: string };
        }>;
        statuses?: Array<{
          id: string;
          status: string;
          timestamp: string;
          recipient_id: string;
          errors?: Array<{ code: number; title: string }>;
        }>;
      };
      field: string;
    }>;
  }>;
}

export type { IngestResult };

function extractContent(msg: MetaWebhookPayload["entry"][0]["changes"][0]["value"]["messages"][0]): {
  messageType: string;
  content: Record<string, unknown>;
} {
  switch (msg.type) {
    case "text":
      return { messageType: "text", content: { text: msg.text?.body || "" } };
    case "image":
      return {
        messageType: "image",
        content: {
          mediaId: msg.image?.id,
          mimeType: msg.image?.mime_type,
          sha256: msg.image?.sha256,
          caption: msg.image?.caption,
        },
      };
    case "video":
      return {
        messageType: "video",
        content: {
          mediaId: msg.video?.id,
          mimeType: msg.video?.mime_type,
          sha256: msg.video?.sha256,
          caption: msg.video?.caption,
        },
      };
    case "audio":
      return {
        messageType: "audio",
        content: {
          mediaId: msg.audio?.id,
          mimeType: msg.audio?.mime_type,
          sha256: msg.audio?.sha256,
        },
      };
    case "document":
      return {
        messageType: "document",
        content: {
          mediaId: msg.document?.id,
          mimeType: msg.document?.mime_type,
          sha256: msg.document?.sha256,
          filename: msg.document?.filename,
          caption: msg.document?.caption,
        },
      };
    case "location":
      return {
        messageType: "location",
        content: {
          latitude: msg.location?.latitude,
          longitude: msg.location?.longitude,
          name: msg.location?.name,
          address: msg.location?.address,
        },
      };
    case "contacts":
      return { messageType: "contacts", content: { contacts: msg.contacts } };
    case "interactive":
      return { messageType: "interactive", content: { interactive: msg.interactive } };
    case "reaction":
      return {
        messageType: "reaction",
        content: {
          targetMessageId: msg.reaction?.message_id,
          emoji: msg.reaction?.emoji,
        },
      };
    case "sticker":
      return {
        messageType: "sticker",
        content: {
          mediaId: msg.sticker?.id,
          mimeType: msg.sticker?.mime_type,
          sha256: msg.sticker?.sha256,
        },
      };
    case "button":
      return {
        messageType: "button",
        content: { text: msg.button?.text, payload: msg.button?.payload },
      };
    default:
      return { messageType: msg.type || "unknown", content: { raw: msg } };
  }
}

export function ingestWebhook(payload: MetaWebhookPayload): IngestResult[] {
  const results: IngestResult[] = [];

  if (!payload.entry?.length) return results;

  for (const entry of payload.entry) {
    for (const change of entry.changes || []) {
      if (change.field !== "messages") continue;

      const value = change.value;
      const phoneNumberId = value.metadata?.phone_number_id || "";
      const displayPhone = value.metadata?.display_phone_number || "";

      const contactMap = new Map<string, string>();
      for (const c of value.contacts || []) {
        contactMap.set(c.wa_id, c.profile?.name || "");
      }

      const messages: NormalizedInboundMessage[] = [];
      for (const msg of value.messages || []) {
        const { messageType, content } = extractContent(msg);

        if (msg.context) {
          (content as any).replyTo = {
            from: msg.context.from,
            messageId: msg.context.id,
          };
        }

        messages.push({
          channel: "whatsapp_cloud",
          provider: "meta",
          direction: "inbound",
          fromAddress: msg.from,
          toAddress: displayPhone,
          messageType,
          content,
          providerMessageId: msg.id,
          providerTimestamp: new Date(parseInt(msg.timestamp, 10) * 1000),
          contactName: contactMap.get(msg.from),
          meta: {
            phoneNumberId,
            entryId: entry.id,
          },
        });
      }

      const statuses: NormalizedStatusUpdate[] = [];
      for (const s of value.statuses || []) {
        statuses.push({
          providerMessageId: s.id,
          status: s.status,
          recipientId: s.recipient_id,
          timestamp: new Date(parseInt(s.timestamp, 10) * 1000),
          meta: s.errors?.length ? { errors: s.errors } : undefined,
        });
      }

      results.push({ messages, statuses, phoneNumberId });
    }
  }

  return results;
}

export function computeDedupKey(
  provider: string,
  providerMessageId: string
): string {
  return crypto
    .createHash("sha256")
    .update(`${provider}:${providerMessageId}`)
    .digest("hex");
}
