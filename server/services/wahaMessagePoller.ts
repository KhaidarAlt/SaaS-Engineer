import { wahaService } from "./waha";

const POLL_INTERVAL_MS = 5000;
const MAX_MESSAGES_PER_CHAT = 10;
const DISCOVERY_INTERVAL_TICKS = 6;
const ACTIVE_TTL_MS = 30 * 60 * 1000;
const DISCOVERY_CONCURRENCY = 10;

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

async function discoverContacts(instance: any): Promise<void> {
  const sessionName = instance.instanceName;
  const tenantId = instance.tenantId;
  const key = `${tenantId}_${sessionName}`;

  try {
    const contacts = await wahaService.getAllContacts(sessionName);
    if (!contacts || contacts.length === 0) return;

    const personalChatIds = contacts
      .filter(c => c.isUser && !c.isMe && !c.isGroup && c.id.endsWith("@c.us"))
      .map(c => c.id);

    const knownChatIds = await getKnownChatIds(tenantId);
    const newChatIds = personalChatIds.filter(id => !knownChatIds.has(id));

    if (!initialWarmupDone.has(key)) {
      initialWarmupDone.add(key);
      const knownList = [...knownChatIds];
      await warmupChatIds(sessionName, knownList);
      console.log(`[WahaPoller] Initial warmup: ${knownList.length} known chats, ${processedMessageIds.size} messages marked seen`);
    }

    if (newChatIds.length === 0) return;

    let addedCount = 0;
    for (let i = 0; i < newChatIds.length; i += DISCOVERY_CONCURRENCY) {
      const batch = newChatIds.slice(i, i + DISCOVERY_CONCURRENCY);
      const results = await Promise.all(
        batch.map(async (chatId) => {
          const hasNew = await pollChatMessages(instance, chatId);
          return { chatId, hasNew };
        })
      );
      for (const { chatId, hasNew } of results) {
        if (hasNew) {
          markActive(tenantId, chatId);
          addedCount++;
        }
      }
    }

    if (addedCount > 0) {
      console.log(`[WahaPoller] Discovery: ${addedCount} active chats found out of ${newChatIds.length} new contacts for tenant ${tenantId.substring(0, 8)}`);
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
        await discoverContacts(instance);
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
