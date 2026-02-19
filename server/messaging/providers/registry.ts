import type { NormalizedOutbound, ProviderSendResult, SendOutboundFn } from "../types";
import { sendOutbound as metaSendOutbound } from "./metaWhatsAppOutbound";
import { sendOutbound as wahaSendOutbound } from "./wahaWhatsAppAdapter";

const providerRegistry = new Map<string, SendOutboundFn>();

providerRegistry.set("whatsapp_cloud:meta", metaSendOutbound);
providerRegistry.set("whatsapp:waha", wahaSendOutbound);

export function registerProvider(channel: string, provider: string, fn: SendOutboundFn): void {
  providerRegistry.set(`${channel}:${provider}`, fn);
}

export function getSendOutbound(channel: string, provider: string): SendOutboundFn | null {
  return providerRegistry.get(`${channel}:${provider}`) || null;
}

export async function dispatchOutbound(req: NormalizedOutbound): Promise<ProviderSendResult> {
  const fn = getSendOutbound(req.channel, req.provider);
  if (!fn) {
    return {
      success: false,
      error: `No provider registered for ${req.channel}:${req.provider}`,
      errorCode: "NO_PROVIDER",
      retryable: false,
    };
  }
  return fn(req);
}
