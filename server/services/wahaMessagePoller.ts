import { wahaService } from "./waha";

const POLL_INTERVAL_MS = 5000;
const MAX_MESSAGES_PER_CHAT = 10;
const DISCOVERY_INTERVAL_TICKS = 12;
const ACTIVE_TTL_MS = 30 * 60 * 1000;

const processedMessageIds = new Set<string>();
const MAX_PROCESSED_IDS = 10000;
const MESSAGE_AGE_LIMIT_S = 300;

const activeChatIds = new Map<string, Map<string, number>>();

let storage: any = null;
let processMessageFn: ((instance: any, from: string, text: string) => Promise<void>) | null = null;
let intervalHandle: ReturnType<typeof setInterval> | null = null;
let isRunning = false;
let tickCounter = 0;
let initialWarmupDone = new Set<string>();

function cleanupProcessedIds() {
  if (processedMessageIds.size > MAX_PROCESSED_IDS) {
    const idsArray = Array.from(processedMessageIds);
    const toRemove = idsArray.slice(0, idsArray.length - MAX_PROCESSED_IDS / 2);
    toRemove.forEach(id => processedMessageIds.delete(id));
  }
}

function pruneInactiveChats() {
  const now = Date.now();
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

function markActive(tenantId: string, chatId: string) {
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
        }
      }
    } catch {}
  }
}

async function discoverNewChats(instance: any): Promise<void> {
  const sessionName = instance.instanceName;
  const tenantId = instance.tenantId;

  try {
    const chats = await wahaService.getChats(sessionName);
    if (!chats || chats.length === 0) return;

    const knownChatIds = await getKnownChatIds(tenantId);

    const newPersonalChats = chats.filter((chat: any) => {
      const chatId = chat.id?._serialized || chat.id;
      if (!chatId || typeof chatId !== "string") return false;
      if (!chatId.endsWith("@c.us")) return false;
      if (knownChatIds.has(chatId)) return false;
      return true;
    });

    if (newPersonalChats.length > 0) {
      console.log(`[WahaPoller] Discovery: found ${newPersonalChats.length} new chats for tenant ${tenantId.substring(0, 8)}`);
    }

    for (const chat of newPersonalChats) {
      const chatId = chat.id?._serialized || chat.id;
      markActive(tenantId, chatId);
    }

    if (!initialWarmupDone.has(`${tenantId}_${sessionName}`)) {
      initialWarmupDone.add(`${tenantId}_${sessionName}`);
      const allChatIds = [...knownChatIds];
      for (const chat of newPersonalChats) {
        const chatId = chat.id?._serialized || chat.id;
        if (!knownChatIds.has(chatId)) allChatIds.push(chatId);
      }
      await warmupChatIds(sessionName, allChatIds);
      console.log(`[WahaPoller] Initial warmup: ${allChatIds.length} chats, ${processedMessageIds.size} messages marked seen`);
    }
  } catch (err) {
    console.error(`[WahaPoller] Discovery error for ${sessionName}:`, err);
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
      foundNew = true;
      console.log(`[WahaPoller] New message: from=${from} text="${text.substring(0, 50)}" age=${Math.round(messageAge)}s`);

      if (processMessageFn) {
        processMessageFn(instance, from, text).catch(err => {
          console.error(`[WahaPoller] Error processing message from ${from}:`, err);
        });
      }
    }
  } catch {}
  return foundNew;
}

async function pollSessionMessages(instance: any) {
  const tenantId = instance.tenantId;

  try {
    const tenant = await storage.getTenant(tenantId);
    if (!tenant || !tenant.aiEnabled) return;

    const chatIds = await getKnownChatIds(tenantId);
    if (chatIds.size === 0) return;

    for (const chatId of chatIds) {
      const hasNew = await pollChatMessages(instance, chatId);
      if (hasNew) {
        markActive(tenantId, chatId);
      }
    }
  } catch (err) {
    console.error(`[WahaPoller] Error polling session ${instance.instanceName}:`, err);
  }
}

async function pollTick() {
  if (isRunning) return;
  isRunning = true;
  tickCounter++;

  try {
    const instances = await storage.getActiveWahaInstances?.();
    if (!instances || !Array.isArray(instances)) return;

    const runningInstances = instances.filter(
      (i: any) => i.isActive && i.status === "running"
    );

    const isDiscoveryTick = tickCounter % DISCOVERY_INTERVAL_TICKS === 1;

    for (const instance of runningInstances) {
      const key = `${instance.tenantId}_${instance.instanceName}`;

      if (!initialWarmupDone.has(key) || isDiscoveryTick) {
        await discoverNewChats(instance);
      }

      await pollSessionMessages(instance);
    }

    if (tickCounter % DISCOVERY_INTERVAL_TICKS === 0) {
      pruneInactiveChats();
    }

    cleanupProcessedIds();
  } catch (err) {
    console.error("[WahaPoller] Tick error:", err);
  } finally {
    isRunning = false;
  }
}

export function startWahaMessagePoller(
  storageInstance: any,
  processMessage: (instance: any, from: string, text: string) => Promise<void>
): void {
  if (intervalHandle) {
    console.log("[WahaPoller] Already running, skipping duplicate start");
    return;
  }

  storage = storageInstance;
  processMessageFn = processMessage;

  intervalHandle = setInterval(pollTick, POLL_INTERVAL_MS);
  console.log(`[WahaPoller] Started (every ${POLL_INTERVAL_MS / 1000}s, discovery every ${DISCOVERY_INTERVAL_TICKS * POLL_INTERVAL_MS / 1000}s)`);
}

export function stopWahaMessagePoller(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    isRunning = false;
    console.log("[WahaPoller] Stopped");
  }
}
