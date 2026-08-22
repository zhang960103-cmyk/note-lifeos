/**
 * localStorage-backed hooks for Budget, Subscription, IOU.
 * No Supabase migration needed – data lives on device.
 * userId is used as a namespace key so multi-account works.
 */
import { useState, useCallback, useMemo } from "react";
import { format, addMonths, addYears, addQuarters, parseISO, setDate, getDate, getDaysInMonth } from "date-fns";
import type { BudgetItem, SubscriptionItem, IouItem, BillingCycle } from "@/types/lifeOs";

// ─── helpers ──────────────────────────────────────────────────────────────────
function load<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; }
}
function save<T>(key: string, data: T[]) {
  localStorage.setItem(key, JSON.stringify(data));
}
function uid() { return crypto.randomUUID(); }

// ─── BUDGET ───────────────────────────────────────────────────────────────────
export function useBudgets(userId: string) {
  const KEY = `budgets_${userId}`;
  const [budgets, setBudgets] = useState<BudgetItem[]>(() => load<BudgetItem>(KEY));

  const addBudget = useCallback((b: Omit<BudgetItem, "id" | "createdAt">) => {
    const item: BudgetItem = { ...b, id: uid(), createdAt: new Date().toISOString() };
    setBudgets(prev => { const next = [item, ...prev]; save(KEY, next); return next; });
  }, [KEY]);

  const deleteBudget = useCallback((id: string) => {
    setBudgets(prev => { const next = prev.filter(b => b.id !== id); save(KEY, next); return next; });
  }, [KEY]);

  const updateBudget = useCallback((id: string, updates: Partial<BudgetItem>) => {
    setBudgets(prev => {
      const next = prev.map(b => b.id === id ? { ...b, ...updates } : b);
      save(KEY, next); return next;
    });
  }, [KEY]);

  return { budgets, addBudget, deleteBudget, updateBudget };
}

// ─── SUBSCRIPTION ─────────────────────────────────────────────────────────────
// anchorDay: 用户最初选定的账单日(1-31)。先按周期整月/整季/整年跳到下一个
// 周期，再把"日"强制对齐回 anchorDay(月底截断时钳到当月最后一天)——这样
// 无论 from 之前有没有被截断过，都不会继续往前漂移。
function nextBillingDate(from: string, cycle: BillingCycle, anchorDay: number): string {
  const d = parseISO(from);
  let next: Date;
  if (cycle === "monthly") next = addMonths(d, 1);
  else if (cycle === "yearly") next = addYears(d, 1);
  else next = addQuarters(d, 1);
  const clampedDay = Math.min(anchorDay, getDaysInMonth(next));
  return format(setDate(next, clampedDay), "yyyy-MM-dd");
}

export function useSubscriptions(userId: string) {
  const KEY = `subscriptions_${userId}`;
  const [subscriptions, setSubscriptions] = useState<SubscriptionItem[]>(() => load<SubscriptionItem>(KEY));

  const addSubscription = useCallback((s: Omit<SubscriptionItem, "id" | "createdAt">) => {
    // 记录下用户此刻选的账单日，作为以后每次续费的锚点
    const billingDay = s.billingDay ?? getDate(parseISO(s.nextDate));
    const item: SubscriptionItem = { ...s, billingDay, id: uid(), createdAt: new Date().toISOString() };
    setSubscriptions(prev => { const next = [item, ...prev]; save(KEY, next); return next; });
  }, [KEY]);

  const deleteSubscription = useCallback((id: string) => {
    setSubscriptions(prev => { const next = prev.filter(s => s.id !== id); save(KEY, next); return next; });
  }, [KEY]);

  const toggleActive = useCallback((id: string) => {
    setSubscriptions(prev => {
      const next = prev.map(s => s.id === id ? { ...s, active: !s.active } : s);
      save(KEY, next); return next;
    });
  }, [KEY]);

  const renewSubscription = useCallback((id: string) => {
    setSubscriptions(prev => {
      const next = prev.map(s => {
        if (s.id !== id) return s;
        const anchorDay = s.billingDay ?? getDate(parseISO(s.nextDate));
        return { ...s, billingDay: anchorDay, nextDate: nextBillingDate(s.nextDate, s.billingCycle, anchorDay) };
      });
      save(KEY, next); return next;
    });
  }, [KEY]);

  // Summary stats
  const stats = useMemo(() => {
    const active = subscriptions.filter(s => s.active);
    const monthlyTotal = active.reduce((sum, s) => {
      if (s.billingCycle === "monthly") return sum + s.amount;
      if (s.billingCycle === "yearly") return sum + s.amount / 12;
      return sum + s.amount / 3;
    }, 0);
    const yearlyTotal = monthlyTotal * 12;
    // Due in next 7 days
    const today = format(new Date(), "yyyy-MM-dd");
    const in7 = format(addMonths(new Date(), 0), "yyyy-MM-dd"); // placeholder
    const dueSoon = active.filter(s => {
      const diff = (parseISO(s.nextDate).getTime() - new Date().getTime()) / 86400000;
      return diff >= 0 && diff <= 7;
    });
    return { monthlyTotal, yearlyTotal, count: active.length, dueSoon };
  }, [subscriptions]);

  return { subscriptions, addSubscription, deleteSubscription, toggleActive, renewSubscription, stats };
}

// ─── IOU ──────────────────────────────────────────────────────────────────────
export function useIous(userId: string) {
  const KEY = `ious_${userId}`;
  const [ious, setIous] = useState<IouItem[]>(() => load<IouItem>(KEY));

  const addIou = useCallback((i: Omit<IouItem, "id" | "createdAt">) => {
    const item: IouItem = { ...i, id: uid(), createdAt: new Date().toISOString() };
    setIous(prev => { const next = [item, ...prev]; save(KEY, next); return next; });
  }, [KEY]);

  const deleteIou = useCallback((id: string) => {
    setIous(prev => { const next = prev.filter(i => i.id !== id); save(KEY, next); return next; });
  }, [KEY]);

  const markPaid = useCallback((id: string) => {
    setIous(prev => {
      const next = prev.map(i => i.id === id ? { ...i, status: "paid" as const } : i);
      save(KEY, next); return next;
    });
  }, [KEY]);

  const summary = useMemo(() => {
    const pending = ious.filter(i => i.status === "pending");
    const iOwe = pending.filter(i => i.direction === "i_owe").reduce((s, i) => s + i.amount, 0);
    const theyOwe = pending.filter(i => i.direction === "they_owe").reduce((s, i) => s + i.amount, 0);
    return { iOwe, theyOwe, net: theyOwe - iOwe, pendingCount: pending.length };
  }, [ious]);

  return { ious, addIou, deleteIou, markPaid, summary };
}
