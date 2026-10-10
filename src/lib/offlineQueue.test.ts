import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearQueue, enqueueOfflineAction, flushQueue, getQueueLength, registerOfflineHandler } from "./offlineQueue";

beforeEach(() => localStorage.clear());

describe("offline queue", () => {
  it("replays payloads and removes successful actions", async () => {
    const handler = vi.fn().mockResolvedValue(undefined);
    registerOfflineHandler("test-success", handler);
    enqueueOfflineAction("test-success", { amount: 12 });
    expect(getQueueLength()).toBe(1);
    expect(await flushQueue()).toEqual({ success: 1, failed: 0 });
    expect(handler).toHaveBeenCalledWith({ amount: 12 });
    expect(getQueueLength()).toBe(0);
  });
  it("retains failures for retry and drops them after three attempts", async () => {
    const handler = vi.fn().mockRejectedValue(new Error("offline"));
    registerOfflineHandler("test-failure", handler);
    enqueueOfflineAction("test-failure", { id: "a" });
    for (let attempt = 1; attempt <= 3; attempt++) {
      expect(await flushQueue()).toEqual({ success: 0, failed: 1 });
      expect(getQueueLength()).toBe(attempt < 3 ? 1 : 0);
    }
    expect(handler).toHaveBeenCalledTimes(3);
  });
  it("preserves actions whose handler is not registered", async () => {
    enqueueOfflineAction("test-unregistered", {});
    expect(await flushQueue()).toEqual({ success: 0, failed: 1 });
    expect(getQueueLength()).toBe(1);
    clearQueue();
    expect(await flushQueue()).toEqual({ success: 0, failed: 0 });
  });
  it("recovers from malformed stored JSON", () => {
    localStorage.setItem("los-offline-queue", "{");
    expect(getQueueLength()).toBe(0);
    enqueueOfflineAction("test-success", {});
    expect(getQueueLength()).toBe(1);
  });
});
