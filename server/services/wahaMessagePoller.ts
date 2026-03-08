import { wahaService } from "./waha";

const FALLBACK_POLL_INTERVAL_MS = 10000;
const MAX_MESSAGES_PER_CHAT = 5;
const ACTIVE_TTL_MS = 30 * 60 * 1000;

const processedMessageIds = new Set<string>();
const recentContentHashes = new Map<string, number>();
const MAX_PROCESSED_IDS = 10000;
const MESSAGE_AGE_LIMIT_S = 300;
const CONTENT_DEDUP_TTL_MS = 120000;

const activeChatIds = new Map<string, Map<string, number>>();

let storage: any = null;
let processMessageFn: ((instance: any, from: string, text: string) => Promise<void>) | null = null;
let pollIntervalHandle: ReturnType<typeof setInterval> | null = null;
let isPollRunning = false;
let initialWarmupDone = new Set<string>();

function contentHash(from: string, text: string): string {
  return `${from}::${text.trim().substring(0, 100)}`;
}

function isContentDuplicate(from: string, text: string): boolean {
  const hash = contentHash(from, text);
  const now = Date.now();
  const lastSeen = recentContentHashes.get(hash);
  if (lastSeen && now - lastSeen < CONTENT_DEDUP_TTL_MS) {
    return true;
  }
  recentContentHashes.set(hash, now);
  return false;
}

function cleanupState() {
  if (processedMessageIds.size > MAX_PROCESSED_IDS) {
    const idsArray = Array.from(processedMessageIds);
    const toRemove = idsArray.slice(0, idsArray.length - MAX_PROCESSED_IDS / 2);
    toRemove.forEach(id => processedMessageIds.delete(id));
  }
  const now = Date.now();
  for (const [hash, ts] of recentContentHashes) {
    if (now - ts > CONTENT_DEDUP_TTL_MS * 2) {
      recentContentHashes.delete(hash);
    }
  }
  for (const [tenantId, chatMap] of activeChatIds) {
    for (const [chatId, lastActive] of chatMap) {
      if (now - lastActive > ACTIVE_TTL_MS) {
        chatMap.delete(chatId);
      }
    }
    if (chatMap.size === 0) activeChatIds.delete(tenantId);
  }
}

export function addWatchedChatId(tenantId: string, chatId: string) {
  if (!activeChatIds.has(tenantId)) {
    activeChatIds.set(tenantId, new Map());
  }
  activeChatIds.get(tenantId)!.set(chatId, Date.now());
}

async function getKnownChatIds(tenantId: string): Promise<Set<string>> {
  const chatIds = new Set<string>();

  if (activeChatIds.has(tenantId)) {
    activeChatIds.get(tenantId)!.forEach((_, id) => chatIds.add(id));
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

  return chatIds;
}

async function warmupChatIds(sessionName: string, chatIds: string[]) {
  for (const chatId of chatIds) {
    try {
      const messages = await wahaService.getChatMessages(sessionName, chatId, MAX_MESSAGES_PER_CHAT);
      if (messages && messages.length > 0) {
        for (const msg of messages) {
          const msgId = msg.id?._serialized || msg.id?.id || `${msg.timestamp}_${msg.from}`;
          if (msgId) processedMessageIds.add(msgId);
          if (msg.from && msg.body) {
            recentContentHashes.set(contentHash(msg.from, msg.body), Date.now());
          }
        }
      }
    } catch {}
  }
}

async function pollChatMessages(instance: any, chatId: string): Promise<boolean> {
  let foundNew = false;
  try {
    const messages = await wahaService.getChatMessages(instance.instanceName, chatId, MAX_MESSAGES_PER_CHAT);
    if (!messages || messages.length === 0) return false;

    for (const msg of messages) {
      const msgId = msg.id?._serialized || msg.id?.id || `${msg.timestamp}_${msg.from}`;
      if (!msgId || processedMessageIds.has(msgId)) continue;
      if (msg.fromMe) {
        processedMessageIds.add(msgId);
        continue;
      }

      const messageAge = Date.now() / 1000 - (msg.timestamp || 0);
      if (messageAge > MESSAGE_AGE_LIMIT_S) {
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

      if (isContentDuplicate(from, text)) {
        continue;
      }

      foundNew = true;
      console.log(`[WahaPoller] Fallback: detected message from=${from} text="${text.substring(0, 50)}" age=${Math.round(messageAge)}s (webhook-only processing)`);
    }
  } catch {}
  return foundNew;
}

async function pollTick() {
  if (isPollRunning) return;
  isPollRunning = true;

  try {
    const instances = await storage.getActiveWahaInstances?.();
    if (!instances || !Array.isArray(instances)) return;

    const runningInstances = instances.filter(
      (i: any) => i.isActive && i.status === "running"
    );

    for (const instance of runningInstances) {
      const tenantId = instance.tenantId;
      const key = `${tenantId}_${instance.instanceName}`;

      if (!initialWarmupDone.has(key)) {
        try {
          const tenant = await storage.getTenant(tenantId);
          if (!tenant || !tenant.aiEnabled) continue;
          const knownList = [...(await getKnownChatIds(tenantId))];
          await warmupChatIds(instance.instanceName, knownList);
          console.log(`[WahaPoller] Warmup: ${knownList.length} known chats, ${processedMessageIds.size} messages marked seen`);
          initialWarmupDone.add(key);
        } catch (err) {
          console.error(`[WahaPoller] Warmup error:`, err);
        }
        continue;
      }

      try {
        const tenant = await storage.getTenant(tenantId);
        if (!tenant || !tenant.aiEnabled) continue;

        const chatIds = await getKnownChatIds(tenantId);
        if (chatIds.size === 0) continue;

        for (const chatId of chatIds) {
          const hasNew = await pollChatMessages(instance, chatId);
          if (hasNew) {
            addWatchedChatId(tenantId, chatId);
          }
        }
      } catch (err) {
        console.error(`[WahaPoller] Poll error for ${instance.instanceName}:`, err);
      }
    }

    cleanupState();
  } catch (err) {
    console.error("[WahaPoller] Poll tick error:", err);
  } finally {
    isPollRunning = false;
  }
}

export function startWahaMessagePoller(
  storageInstance: any,
  processMessage: (instance: any, from: string, text: string) => Promise<void>
): void {
  if (pollIntervalHandle) {
    console.log("[WahaPoller] Already running, skipping duplicate start");
    return;
  }

  storage = storageInstance;
  processMessageFn = processMessage;

  pollIntervalHandle = setInterval(pollTick, FALLBACK_POLL_INTERVAL_MS);
  setTimeout(pollTick, 3000);

  console.log(`[WahaPoller] Started as fallback (every ${FALLBACK_POLL_INTERVAL_MS / 1000}s, webhooks are primary)`);
}

export function stopWahaMessagePoller(): void {
  if (pollIntervalHandle) {
    clearInterval(pollIntervalHandle);
    pollIntervalHandle = null;
  }
  isPollRunning = false;
  console.log("[WahaPoller] Stopped");
}
