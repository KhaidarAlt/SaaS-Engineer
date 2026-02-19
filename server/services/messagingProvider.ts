import { db } from "../db";
import { eq, and } from "drizzle-orm";
import {
  growthContacts,
  waCloudIntegrations,
  wahaInstances,
  telegramIntegrations,
  instagramIntegrations,
} from "@shared/schema";
import { wahaService } from "./waha";
import { sendTelegramMessage } from "./telegram";
import { instagramService } from "./instagram/instagram.service";

type ChannelPolicy = "AUTO" | "PREFER_LAST" | "FORCE_WHATSAPP";

type ResolvedChannel =
  | { blocked: false; channel: string; provider: string; address: string }
  | { blocked: true; reason: string };

interface SendMessageParams {
  tenantId: string;
  channel: string;
  provider: string;
  to: string;
  text: string;
  meta?: Record<string, unknown>;
}

interface SendResult {
  providerMessageId?: string;
  status: "SENT" | "FAILED" | "NEEDS_ACTION";
  error?: string;
}

async function checkWhatsAppIntegration(tenantId: string): Promise<{ connected: boolean; provider?: string }> {
  const [metaIntegration] = await db
    .select()
    .from(waCloudIntegrations)
    .where(eq(waCloudIntegrations.tenantId, tenantId));

  if (metaIntegration && metaIntegration.status === "connected") {
    return { connected: true, provider: "META" };
  }

  const [wahaInstance] = await db
    .select()
    .from(wahaInstances)
    .where(and(eq(wahaInstances.tenantId, tenantId), eq(wahaInstances.isActive, true)));

  if (wahaInstance && (wahaInstance.status === "running" || wahaInstance.status === "connected")) {
    return { connected: true, provider: "WAHA" };
  }

  return { connected: false };
}

async function checkTelegramIntegration(tenantId: string): Promise<boolean> {
  const [integration] = await db
    .select()
    .from(telegramIntegrations)
    .where(eq(telegramIntegrations.tenantId, tenantId));

  return !!integration && integration.status === "connected";
}

async function checkInstagramIntegration(tenantId: string): Promise<boolean> {
  const [integration] = await db
    .select()
    .from(instagramIntegrations)
    .where(eq(instagramIntegrations.tenantId, tenantId));

  return !!integration && integration.status === "connected";
}

function getAddressForChannel(
  contact: { phone: string | null; telegramId: string | null; instagramId: string | null },
  channel: string,
): string | null {
  switch (channel) {
    case "WHATSAPP":
      return contact.phone;
    case "TELEGRAM":
      return contact.telegramId;
    case "INSTAGRAM":
      return contact.instagramId;
    default:
      return null;
  }
}

async function tryResolveChannel(
  tenantId: string,
  contact: { phone: string | null; telegramId: string | null; instagramId: string | null },
  channel: string,
): Promise<{ channel: string; provider: string; address: string } | null> {
  const address = getAddressForChannel(contact, channel);
  if (!address) return null;

  if (channel === "WHATSAPP") {
    const wa = await checkWhatsAppIntegration(tenantId);
    if (wa.connected) {
      return { channel: "WHATSAPP", provider: wa.provider!, address };
    }
    return null;
  }

  if (channel === "TELEGRAM") {
    const connected = await checkTelegramIntegration(tenantId);
    if (connected) {
      return { channel: "TELEGRAM", provider: "TELEGRAM", address };
    }
    return null;
  }

  if (channel === "INSTAGRAM") {
    const connected = await checkInstagramIntegration(tenantId);
    if (connected) {
      return { channel: "INSTAGRAM", provider: "INSTAGRAM", address };
    }
    return null;
  }

  return null;
}

async function resolveChannelForContact(
  tenantId: string,
  contactId: string,
  preferredPolicy: ChannelPolicy = "AUTO",
): Promise<ResolvedChannel> {
  const [contact] = await db
    .select()
    .from(growthContacts)
    .where(and(eq(growthContacts.id, contactId), eq(growthContacts.tenantId, tenantId)));

  if (!contact) {
    return { blocked: true, reason: "Контакт не найден" };
  }

  if (contact.optOut) {
    return { blocked: true, reason: "Контакт отписался" };
  }

  if (preferredPolicy === "FORCE_WHATSAPP") {
    if (!contact.phone) {
      return { blocked: true, reason: "Нет телефона для WhatsApp" };
    }
    const wa = await checkWhatsAppIntegration(tenantId);
    if (!wa.connected) {
      return { blocked: true, reason: "WhatsApp не подключен" };
    }
    return { blocked: false, channel: "WHATSAPP", provider: wa.provider!, address: contact.phone };
  }

  const channelsToTry: string[] = [];

  if (preferredPolicy === "PREFER_LAST" && contact.lastChannel) {
    const resolved = await tryResolveChannel(tenantId, contact, contact.lastChannel.toUpperCase());
    if (resolved) {
      return { blocked: false, ...resolved };
    }
    return { blocked: true, reason: `Последний канал ${contact.lastChannel} недоступен` };
  }

  if (contact.lastChannel) {
    channelsToTry.push(contact.lastChannel.toUpperCase());
  }
  if (contact.primaryChannel && !channelsToTry.includes(contact.primaryChannel.toUpperCase())) {
    channelsToTry.push(contact.primaryChannel.toUpperCase());
  }
  if (!channelsToTry.includes("WHATSAPP") && contact.phone) {
    channelsToTry.push("WHATSAPP");
  }
  if (!channelsToTry.includes("TELEGRAM") && contact.telegramId) {
    channelsToTry.push("TELEGRAM");
  }
  if (!channelsToTry.includes("INSTAGRAM") && contact.instagramId) {
    channelsToTry.push("INSTAGRAM");
  }

  for (const ch of channelsToTry) {
    const resolved = await tryResolveChannel(tenantId, contact, ch);
    if (resolved) {
      return { blocked: false, ...resolved };
    }
  }

  return { blocked: true, reason: "Нет доступных каналов для контакта" };
}

async function sendMessage(params: SendMessageParams): Promise<SendResult> {
  const { tenantId, channel, provider, to, text } = params;

  try {
    if (channel === "WHATSAPP" && provider === "META") {
      const { sendMessage: coreSendMessage } = await import("../messaging/core");
      const coreResult = await coreSendMessage({
        tenantId,
        channel: "whatsapp_cloud",
        provider: "meta",
        fromAddress: "",
        toAddress: to.replace(/\D/g, ""),
        messageType: "text",
        content: { text },
        meta: params.meta,
      });

      if (!coreResult.success) {
        return { status: "FAILED", error: coreResult.failReason || "Не удалось отправить" };
      }
      return { providerMessageId: coreResult.messageId, status: "SENT" };
    }

    if (channel === "WHATSAPP" && provider === "WAHA") {
      const [instance] = await db
        .select()
        .from(wahaInstances)
        .where(and(eq(wahaInstances.tenantId, tenantId), eq(wahaInstances.isActive, true)));

      if (!instance) {
        return { status: "FAILED", error: "WAHA инстанс не найден" };
      }

      const { sendMessage: coreSendMessage } = await import("../messaging/core");
      const coreResult = await coreSendMessage({
        tenantId,
        channel: "whatsapp",
        provider: "waha",
        fromAddress: instance.instanceName,
        toAddress: to.replace(/\D/g, ""),
        messageType: "text",
        content: { text, wahaSession: instance.instanceName },
        meta: params.meta,
      });

      if (!coreResult.success) {
        return { status: "FAILED", error: coreResult.failReason || "Не удалось отправить" };
      }
      return { providerMessageId: coreResult.messageId, status: "SENT" };
    }

    if (channel === "TELEGRAM") {
      const [integration] = await db
        .select()
        .from(telegramIntegrations)
        .where(eq(telegramIntegrations.tenantId, tenantId));

      if (!integration) {
        return { status: "FAILED", error: "Telegram интеграция не найдена" };
      }

      const result = await sendTelegramMessage({
        botToken: integration.botToken,
        chatId: to,
        message: text,
      });

      if (!result.success) {
        return { status: "FAILED", error: result.error };
      }
      return { status: "SENT" };
    }

    if (channel === "INSTAGRAM") {
      const [integration] = await db
        .select()
        .from(instagramIntegrations)
        .where(eq(instagramIntegrations.tenantId, tenantId));

      if (!integration) {
        return { status: "FAILED", error: "Instagram интеграция не найдена" };
      }

      const result = await instagramService.sendMessage(integration, to, text);
      if (!result.success) {
        return { status: "FAILED", error: result.error };
      }
      return { providerMessageId: result.messageId, status: "SENT" };
    }

    return { status: "FAILED", error: `Неизвестный канал: ${channel}/${provider}` };
  } catch (err: any) {
    console.error(`[MessagingProvider] sendMessage error:`, err);
    return { status: "FAILED", error: err.message || "Неизвестная ошибка" };
  }
}

export const messagingProvider = {
  resolveChannelForContact,
  sendMessage,
};
