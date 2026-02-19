import { db } from "../../db";
import { eq, and } from "drizzle-orm";
import { waCloudIntegrations, waCloudPhoneNumbers } from "@shared/schema";

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

const META_GRAPH_API_URL = "https://graph.facebook.com/v18.0";

const NON_RETRYABLE_CODES = new Set([
  "OPT_OUT",
  "TEMPLATE_REQUIRED",
  "INVALID_RECIPIENT",
  "POLICY_BLOCKED",
  "BLOCKED_BY_USER",
  "131049", // re-engagement required
  "131026", // number not on whatsapp
  "100",    // invalid parameter
]);

function classifyError(errorCode: string | number | undefined, errorMessage?: string): { retryable: boolean; code: string } {
  const code = String(errorCode || "UNKNOWN");

  if (NON_RETRYABLE_CODES.has(code)) {
    return { retryable: false, code };
  }

  if (errorMessage?.includes("opt") || errorMessage?.includes("blocked")) {
    return { retryable: false, code: "BLOCKED_BY_USER" };
  }

  const numCode = Number(errorCode);
  if (numCode >= 500 || code === "TIMEOUT" || code === "NETWORK_ERROR") {
    return { retryable: true, code };
  }

  if (numCode >= 400 && numCode < 500) {
    return { retryable: false, code };
  }

  return { retryable: true, code };
}

async function getMetaCredentials(tenantId: string): Promise<{
  accessToken: string;
  phoneNumberId: string;
} | null> {
  const [integration] = await db
    .select()
    .from(waCloudIntegrations)
    .where(eq(waCloudIntegrations.tenantId, tenantId));

  if (!integration?.accessToken || integration.status !== "connected") {
    return null;
  }

  const phones = await db
    .select()
    .from(waCloudPhoneNumbers)
    .where(
      and(
        eq(waCloudPhoneNumbers.tenantId, tenantId),
        eq(waCloudPhoneNumbers.isDefault, true)
      )
    );

  const phone = phones[0];
  if (!phone?.phoneNumberId) {
    return null;
  }

  return {
    accessToken: integration.accessToken,
    phoneNumberId: phone.phoneNumberId,
  };
}

export async function sendOutbound(req: NormalizedOutbound): Promise<ProviderSendResult> {
  if (req.provider !== "meta" || req.channel !== "whatsapp_cloud") {
    return {
      success: false,
      error: `Unsupported provider/channel: ${req.provider}/${req.channel}`,
      errorCode: "UNSUPPORTED_CHANNEL",
      retryable: false,
    };
  }

  const creds = await getMetaCredentials(req.tenantId);
  if (!creds) {
    return {
      success: false,
      error: "Meta WhatsApp integration not configured or no default phone number",
      errorCode: "NO_INTEGRATION",
      retryable: false,
    };
  }

  const recipientPhone = req.toAddress.replace(/\D/g, "");

  let body: Record<string, unknown>;

  if (req.messageType === "template") {
    body = {
      messaging_product: "whatsapp",
      to: recipientPhone,
      type: "template",
      template: req.content.template || req.content,
    };
  } else {
    body = {
      messaging_product: "whatsapp",
      to: recipientPhone,
      type: "text",
      text: { body: req.content.text || "" },
    };
  }

  const startMs = Date.now();

  try {
    const response = await fetch(
      `${META_GRAPH_API_URL}/${creds.phoneNumberId}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${creds.accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(15000),
      }
    );

    if (!response.ok) {
      let errorData: any = {};
      try {
        errorData = await response.json();
      } catch {}

      const metaError = errorData?.error;
      const errCode = metaError?.code || metaError?.error_subcode || response.status;
      const classification = classifyError(errCode, metaError?.message);

      return {
        success: false,
        providerMessageId: undefined,
        error: metaError?.message || `HTTP ${response.status}`,
        errorCode: classification.code,
        retryable: classification.retryable,
      };
    }

    const data = await response.json();
    const providerMessageId = data?.messages?.[0]?.id;

    return {
      success: true,
      providerMessageId,
      retryable: false,
    };
  } catch (err: any) {
    if (err.name === "AbortError" || err.name === "TimeoutError") {
      return {
        success: false,
        error: "Request timed out",
        errorCode: "TIMEOUT",
        retryable: true,
      };
    }

    return {
      success: false,
      error: err.message || "Network error",
      errorCode: "NETWORK_ERROR",
      retryable: true,
    };
  }
}
