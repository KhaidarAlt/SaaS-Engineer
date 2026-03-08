import { wahaService } from "./waha";

const POLL_INTERVAL_MS = 5000;
const DISCOVERY_INTERVAL_MS = 15000;
const MAX_MESSAGES_PER_CHAT = 5;
const ACTIVE_TTL_MS = 30 * 60 * 1000;
const DISCOVERY_CONCURRENCY = 20;

const processedMessageIds = new Set<string>();
const recentContentHashes = new Map<string, number>();
const MAX_PROCESSED_IDS = 10000;
const MESSAGE_AGE_LIMIT_S = 300;
const CONTENT_DEDUP_TTL_MS = 120000;

const activeChatIds = new Map<string, Map<string, number>>();
const scannedEmptyContacts = new Map<string, Set<string>>();

let storage: any = null;
let processMessageFn: ((instance: any, from: string, text: string) => Promise<void>) | null = null;
let pollIntervalHandle: ReturnType<typeof setInterval> | null = null;
let discoveryIntervalHandle: ReturnType<typeof setInterval> | null = null;
let isPollRunning = false;
let isDiscoveryRunning = false;
let initialWarmupDone = new Set<string>();
let fullScanDone = new Set<string>();

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

function cleanupProcessedIds() {
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
          if (msg.from && msg.body) {
            recentContentHashes.set(contentHash(msg.from, msg.body), Date.now());
          }
        }
      }
    } catch {}
  }
}

function processMessage(instance: any, msg: any): boolean {
  const msgId = msg.id?._serialized || msg.id?.id || `${msg.timestamp}_${msg.from}`;
  if (!msgId || processedMessageIds.has(msgId)) return false;
  if (msg.fromMe) {
    processedMessageIds.add(msgId);
    return false;
  }

  const messageAge = Date.now() / 1000 - (msg.timestamp || 0);
  if (messageAge > MESSAGE_AGE_LIMIT_S) {
    processedMessageIds.add(msgId);
    return false;
  }

  const from = msg.from;
  const text = msg.body;
  if (!from || !text) {
    processedMessageIds.add(msgId);
    return false;
  }

  processedMessageIds.add(msgId);

  if (isContentDuplicate(from, text)) {
    return false;
  }

  console.log(`[WahaPoller] New message: from=${from} text="${text.substring(0, 50)}" age=${Math.round(messageAge)}s`);

  if (processMessageFn) {
    processMessageFn(instance, from, text).catch(err => {
      console.error(`[WahaPoller] Error processing message from ${from}:`, err);
    });
  }
  return true;
}

async function pollChatMessages(instance: any, chatId: string, limit?: number): Promise<boolean> {
  let foundNew = false;
  try {
    const messages = await wahaService.getChatMessages(instance.instanceName, chatId, limit || MAX_MESSAGES_PER_CHAT);
    if (!messages || messages.length === 0) return false;

    for (const msg of messages) {
      if (processMessage(instance, msg)) {
        foundNew = true;
      }
    }
  } catch {}
  return foundNew;
}

// ─── FAST POLL LOOP: polls only known/active chats every 5s ───

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

      if (!initialWarmupDone.has(key)) continue;

      try {
        const tenant = await storage.getTenant(tenantId);
        if (!tenant || !tenant.aiEnabled) continue;

        const chatIds = await getKnownChatIds(tenantId);
        if (chatIds.size === 0) continue;

        for (const chatId of chatIds) {
          const hasNew = await pollChatMessages(instance, chatId);
          if (hasNew) {
            markActive(tenantId, chatId);
          }
        }
      } catch (err) {
        console.error(`[WahaPoller] Poll error for ${instance.instanceName}:`, err);
      }
    }

    cleanupProcessedIds();
  } catch (err) {
    console.error("[WahaPoller] Poll tick error:", err);
  } finally {
    isPollRunning = false;
  }
}

// ─── BACKGROUND DISCOVERY LOOP: finds new senders every 15s ───

async function discoveryTick() {
  if (isDiscoveryRunning) return;
  isDiscoveryRunning = true;

  try {
    const instances = await storage.getActiveWahaInstances?.();
    if (!instances || !Array.isArray(instances)) return;

    const runningInstances = instances.filter(
      (i: any) => i.isActive && i.status === "running"
    );

    for (const instance of runningInstances) {
      const sessionName = instance.instanceName;
      const tenantId = instance.tenantId;
      const key = `${tenantId}_${sessionName}`;

      try {
        const tenant = await storage.getTenant(tenantId);
        if (!tenant || !tenant.aiEnabled) continue;

        if (!initialWarmupDone.has(key)) {
          const knownList = [...(await getKnownChatIds(tenantId))];
          await warmupChatIds(sessionName, knownList);
          console.log(`[WahaPoller] Initial warmup: ${knownList.length} known chats, ${processedMessageIds.size} messages marked seen`);
          initialWarmupDone.add(key);
        }

        const knownChatIds = await getKnownChatIds(tenantId);

        if (!scannedEmptyContacts.has(key)) {
          scannedEmptyContacts.set(key, new Set());
        }
        const scannedEmpty = scannedEmptyContacts.get(key)!;

        let allContactIds: string[] = [];

        try {
          const contacts = await wahaService.getAllContacts(sessionName);
          if (contacts && contacts.length > 0) {
            allContactIds = contacts
              .filter(c => c.isUser && !c.isMe && !c.isGroup && c.id.endsWith("@c.us"))
              .map(c => c.id);
            console.log(`[WahaPoller] Discovery: ${allContactIds.length} personal contacts from ${contacts.length} total`);
          } else {
            console.log(`[WahaPoller] Contacts API returned empty`);
          }
        } catch (err: any) {
          console.log(`[WahaPoller] Contacts API failed: ${err?.message?.substring(0, 80)}`);
        }

        if (allContactIds.length === 0) continue;

        const newChatIds = allContactIds.filter(id => !knownChatIds.has(id) && !scannedEmpty.has(id));

        if (!fullScanDone.has(key)) {
          console.log(`[WahaPoller] First full scan: ${newChatIds.length} contacts to check`);
        }

        if (newChatIds.length === 0) {
          if (fullScanDone.has(key)) {
            scannedEmpty.clear();
            console.log(`[WahaPoller] Discovery: all contacts scanned, cleared cache for next cycle`);
          }
          continue;
        }

        let addedCount = 0;
        let checkedCount = 0;
        for (let i = 0; i < newChatIds.length; i += DISCOVERY_CONCURRENCY) {
          const batch = newChatIds.slice(i, i + DISCOVERY_CONCURRENCY);
          const results = await Promise.all(
            batch.map(async (chatId) => {
              const hasNew = await pollChatMessages(instance, chatId, 3);
              return { chatId, hasNew };
            })
          );
          checkedCount += batch.length;
          for (const { chatId, hasNew } of results) {
            if (hasNew) {
              markActive(tenantId, chatId);
              addedCount++;
            } else {
              scannedEmpty.add(chatId);
            }
          }
        }

        if (!fullScanDone.has(key)) {
          fullScanDone.add(key);
        }

        console.log(`[WahaPoller] Discovery complete: checked ${checkedCount}, found ${addedCount} active (${scannedEmpty.size} cached empty)`);
      } catch (err) {
        console.error(`[WahaPoller] Discovery error for ${sessionName}:`, err);
      }
    }

    pruneInactiveChats();
  } catch (err) {
    console.error("[WahaPoller] Discovery tick error:", err);
  } finally {
    isDiscoveryRunning = false;
  }
}

// ─── START / STOP ───

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

  pollIntervalHandle = setInterval(pollTick, POLL_INTERVAL_MS);
  discoveryIntervalHandle = setInterval(discoveryTick, DISCOVERY_INTERVAL_MS);

  setTimeout(discoveryTick, 2000);

  console.log(`[WahaPoller] Started (poll every ${POLL_INTERVAL_MS / 1000}s, discovery every ${DISCOVERY_INTERVAL_MS / 1000}s)`);
}

export function stopWahaMessagePoller(): void {
  if (pollIntervalHandle) {
    clearInterval(pollIntervalHandle);
    pollIntervalHandle = null;
  }
  if (discoveryIntervalHandle) {
    clearInterval(discoveryIntervalHandle);
    discoveryIntervalHandle = null;
  }
  isPollRunning = false;
  isDiscoveryRunning = false;
  console.log("[WahaPoller] Stopped");
}
