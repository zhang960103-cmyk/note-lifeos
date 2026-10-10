import { act, cleanup, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useBudgets, useIous, useSubscriptions } from "./useLocalData";
import { useProjects } from "./useProjects";
import type { BillingCycle } from "@/types/lifeOs";

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 0, 15, 12));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe("local financial hooks", () => {
  it("persists budget changes without leaking into another account", () => {
    const { result, unmount } = renderHook(() => useBudgets("alice"));
    act(() => result.current.addBudget({ category: "餐饮", emoji: "🍜", limit: 100, period: "monthly" }));
    const id = result.current.budgets[0].id;
    act(() => result.current.updateBudget(id, { limit: 200 }));
    unmount();
    const restored = renderHook(() => useBudgets("alice"));
    expect(restored.result.current.budgets[0].limit).toBe(200);
    expect(renderHook(() => useBudgets("bob")).result.current.budgets).toEqual([]);
    act(() => restored.result.current.deleteBudget(id));
    expect(JSON.parse(localStorage.getItem("budgets_alice")!)).toEqual([]);
  });
  it("recovers from malformed budget storage", () => {
    localStorage.setItem("budgets_alice", "{");
    expect(renderHook(() => useBudgets("alice")).result.current.budgets).toEqual([]);
  });
  it("normalizes billing cycles and excludes inactive subscriptions", () => {
    const { result } = renderHook(() => useSubscriptions("alice"));
    act(() => {
      for (const [billingCycle, amount] of [["monthly", 10], ["quarterly", 60], ["yearly", 120]] as [BillingCycle, number][]) {
        result.current.addSubscription({ name: billingCycle, emoji: "", amount, billingCycle, nextDate: "2026-01-31", category: "", active: true });
      }
    });
    expect(result.current.stats).toMatchObject({ monthlyTotal: 40, yearlyTotal: 480, count: 3 });
    act(() => result.current.toggleActive(result.current.subscriptions[0].id));
    expect(result.current.stats).toMatchObject({ monthlyTotal: 30, yearlyTotal: 360, count: 2 });
  });
  it("restores the billing anchor after February clamps January 31", () => {
    const { result } = renderHook(() => useSubscriptions("alice"));
    act(() => result.current.addSubscription({ name: "monthly", emoji: "", amount: 10, billingCycle: "monthly", nextDate: "2026-01-31", category: "", active: true }));
    const id = result.current.subscriptions[0].id;
    act(() => result.current.renewSubscription(id));
    expect(result.current.subscriptions[0].nextDate).toBe("2026-02-28");
    act(() => result.current.renewSubscription(id));
    expect(result.current.subscriptions[0].nextDate).toBe("2026-03-31");
    expect(JSON.parse(localStorage.getItem("subscriptions_alice")!)[0].billingDay).toBe(31);
  });
  it("calculates net outstanding IOUs and removes paid amounts", () => {
    const { result } = renderHook(() => useIous("alice"));
    act(() => {
      result.current.addIou({ direction: "i_owe", person: "A", amount: 40, reason: "", status: "pending" });
      result.current.addIou({ direction: "they_owe", person: "B", amount: 100, reason: "", status: "pending" });
      result.current.addIou({ direction: "they_owe", person: "C", amount: 999, reason: "", status: "paid" });
    });
    expect(result.current.summary).toEqual({ iOwe: 40, theyOwe: 100, net: 60, pendingCount: 2 });
    act(() => result.current.markPaid(result.current.ious.find(i => i.person === "B")!.id));
    expect(result.current.summary).toEqual({ iOwe: 40, theyOwe: 0, net: -40, pendingCount: 1 });
  });
});

describe("projects", () => {
  it("persists creation, updates, archive and deletion in its account namespace", () => {
    const { result } = renderHook(() => useProjects("alice"));
    act(() => result.current.addProject("  Study  ", "📚"));
    const id = result.current.projects[0].id;
    expect(result.current.activeProjects[0].name).toBe("Study");
    act(() => result.current.updateProject(id, { description: "Read books" }));
    act(() => result.current.archiveProject(id));
    expect(result.current.activeProjects).toEqual([]);
    expect(result.current.archivedProjects[0].description).toBe("Read books");
    expect(renderHook(() => useProjects("bob")).result.current.projects).toEqual([]);
    act(() => result.current.deleteProject(id));
    expect(JSON.parse(localStorage.getItem("projects_alice")!)).toEqual([]);
  });
});
