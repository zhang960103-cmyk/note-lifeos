/**
 * 离线操作队列 - 在网络恢复后自动重放失败的操作
 */

interface QueuedAction {
  id: string;
  type: string;
  payload: any;
  timestamp: number;
  retryCount: number;
}

const STORAGE_KEY = "los-offline-queue";
const MAX_RETRIES = 3;

function loadQueue(): QueuedAction[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveQueue(queue: QueuedAction[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue));
  } catch {}
}

export function enqueueOfflineAction(type: string, payload: any): void {
  const queue = loadQueue();
  queue.push({
    id: crypto.randomUUID(),
    type,
    payload,
    timestamp: Date.now(),
    retryCount: 0,
  });
  saveQueue(queue);
}

export function getQueueLength(): number {
  return loadQueue().length;
}

export function clearQueue(): void {
  localStorage.removeItem(STORAGE_KEY);
}

type ActionHandler = (payload: any) => Promise<void>;

const handlers: Record<string, ActionHandler> = {};

export function registerOfflineHandler(type: string, handler: ActionHandler): void {
  handlers[type] = handler;
}

export async function flushQueue(): Promise<{ success: number; failed: number }> {
  const queue = loadQueue();
  if (queue.length === 0) return { success: 0, failed: 0 };

  let success = 0;
  let failed = 0;
  const remaining: QueuedAction[] = [];

  for (const action of queue) {
    const handler = handlers[action.type];
    if (!handler) {
      console.warn(`[OfflineQueue] No handler for type: ${action.type}`);
      remaining.push(action);
      failed++;
      continue;
    }

    try {
      await handler(action.payload);
      success++;
    } catch {
      action.retryCount++;
      if (action.retryCount < MAX_RETRIES) {
        remaining.push(action);
      }
      failed++;
    }
  }

  saveQueue(remaining);
  return { success, failed };
}

// Auto-flush when coming back online
if (typeof window !== "undefined") {
  window.addEventListener("online", () => {
    console.info("[OfflineQueue] Network restored, flushing queue...");
    flushQueue().then(({ success, failed }) => {
      if (success > 0) console.info(`[OfflineQueue] Replayed ${success} actions (${failed} failed)`);
    });
  });
}
