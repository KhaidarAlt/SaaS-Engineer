import { wahaService } from "./waha";

const POLL_INTERVAL_MS = 5000;
const MAX_MESSAGES_PER_CHAT = 10;

const processedMessageIds = new Set<string>();
const MAX_PROCESSED_IDS = 10000;

const watchedChatIds = new Map<string, Set<string>>();

let storage: any = null;
let processMessageFn: ((instance: any, from: string, text: string) => Promise<void>) | null = null;
let intervalHandle: ReturnType<typeof setInterval> | null = null;

function cleanupProcessedIds() {
  if (processedMessageIds.size > MAX_PROCESSED_IDS) {
    const idsArray = Array.from(processedMessageIds);
    const toRemove = idsArray.slice(0, idsArray.length - MAX_PROCESSED_IDS / 2);
    toRemove.forEach(id => processedMessageIds.delete(id));
  }
}

export function addWatchedChatId(tenantId: string, chatId: string) {
  if (!watchedChatIds.has(tenantId)) {
    watchedChatIds.set(tenantId, new Set());
  }
  watchedChatIds.get(tenantId)!.add(chatId);
}

async function getKnownChatIds(tenantId: string): Promise<string[]> {
  const chatIds = new Set<string>();

  if (watchedChatIds.has(tenantId)) {
    watchedChatIds.get(tenantId)!.forEach(id => chatIds.add(id));
  }

  try {
    const conversations = await storage.getAiConversationsByTenant?.(tenantId);
    if (conversations && Array.isArray(conversations)) {
      for (const c of conversations) {
        if (c.channel === "whatsapp" && c.customerPhone) {
          const phone = c.customerPhone.replace(/[^0-9]/g, "");
          if (phone.length >= 10) {
            chatIds.add(`${phone}@c.us`);
          }
        }
      }
    }
  } catch {}

  try {
    const contacts = await storage.getGrowthContacts?.(tenantId);
    if (contacts && Array.isArray(contacts)) {
      for (const c of contacts) {
        if (c.phone) {
          const phone = c.phone.replace(/[^0-9]/g, "");
          if (phone.length >= 10) {
            chatIds.add(`${phone}@c.us`);
          }
        }
      }
    }
  } catch {}

  return [...chatIds];
}

async function pollSessionMessages(instance: any) {
  const sessionName = instance.instanceName;
  const tenantId = instance.tenantId;

  try {
    const tenant = await storage.getTenant(tenantId);
    if (!tenant || !tenant.aiEnabled) return;

    const chatIds = await getKnownChatIds(tenantId);

    for (const chatId of chatIds) {
      try {
        const messages = await wahaService.getChatMessages(sessionName, chatId, MAX_MESSAGES_PER_CHAT);
        if (!messages || messages.length === 0) continue;

        for (const msg of messages) {
          const msgId = msg.id?._serialized || msg.id?.id || `${msg.timestamp}_${msg.from}`;
          if (!msgId || processedMessageIds.has(msgId)) continue;
          if (msg.fromMe) {
            processedMessageIds.add(msgId);
            continue;
          }

          const messageAge = Date.now() / 1000 - (msg.timestamp || 0);
          if (messageAge > 120) {
            processedMessageIds.add(msgId);
            continue;
          }

          const from = msg.from;
          const text = msg.body;
          if (!from || !text) {
            processedMessageIds.add(msgId);
            continue;
          }

          processedMessageIds.add(msgId);
          console.log(`[WahaPoller] New message: from=${from} text="${text.substring(0, 50)}" age=${Math.round(messageAge)}s`);

          if (processMessageFn) {
            processMessageFn(instance, from, text).catch(err => {
              console.error(`[WahaPoller] Error processing message from ${from}:`, err);
            });
          }
        }
      } catch {}
    }
  } catch (err) {
    console.error(`[WahaPoller] Error polling session ${sessionName}:`, err);
  }
}

async function pollTick() {
  try {
    const instances = await storage.getActiveWahaInstances?.();
    if (!instances || !Array.isArray(instances)) return;

    const runningInstances = instances.filter(
      (i: any) => i.isActive && i.status === "running"
    );

    for (const instance of runningInstances) {
      await pollSessionMessages(instance);
    }

    cleanupProcessedIds();
  } catch (err) {
    console.error("[WahaPoller] Tick error:", err);
  }
}

export function startWahaMessagePoller(
  storageInstance: any,
  processMessage: (instance: any, from: string, text: string) => Promise<void>
): void {
  storage = storageInstance;
  processMessageFn = processMessage;

  intervalHandle = setInterval(pollTick, POLL_INTERVAL_MS);
  console.log(`[WahaPoller] Started (every ${POLL_INTERVAL_MS / 1000}s)`);
}

export function stopWahaMessagePoller(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log("[WahaPoller] Stopped");
  }
}
