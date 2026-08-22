import { useMemo, useState, useEffect } from "react";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { useAuth } from "@/hooks/useAuth";
import { useBudgets, useSubscriptions, useIous } from "@/hooks/useLocalData";
import { format, parseISO, subDays, startOfMonth, endOfMonth, isWithinInterval, addMonths, addYears, addQuarters } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Wallet, BookOpen, Trash2, Pencil, Check, X, Plus, CreditCard, Users, Target, RefreshCw, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrencySymbol } from "@/lib/currencyUtils";
import type { BillingCycle } from "@/types/lifeOs";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

const COLORS = ["hsl(39,58%,53%)", "hsl(0,65%,55%)", "hsl(142,60%,45%)", "hsl(210,60%,50%)", "hsl(280,55%,55%)", "hsl(30,50%,45%)"];
const EXPENSE_CATEGORIES = ["餐饮", "购物", "交通", "娱乐", "住房", "医疗", "学习", "旅行", "其他"];
type WealthTab = "records" | "budget" | "subscriptions" | "ious";

// 金额校验：拒绝空值/非数字/负数/无穷大，避免 Number("") / Number("abc") 产出
// NaN 被悄悄存进账本、预算或订阅里，后面所有求和/百分比计算全部变成 NaN。
function parsePositiveAmount(raw: string): number | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function defaultNextDateFor(cycle: BillingCycle): string {
  const now = new Date();
  if (cycle === "monthly") return format(addMonths(now, 1), "yyyy-MM-dd");
  if (cycle === "yearly") return format(addYears(now, 1), "yyyy-MM-dd");
  return format(addQuarters(now, 1), "yyyy-MM-dd");
}

export default function WealthPage() {
  const { t } = useLanguage();
  const { financeEntries, deleteFinanceEntry, updateFinanceEntry, energyLogs } = useLifeOs();
  const { user } = useAuth();
  const uid = user?.id || "guest";
  const BILLING_LABELS: Record<BillingCycle, string> = {
    monthly: t("wealth.billing_monthly"),
    yearly: t("wealth.billing_yearly"),
    quarterly: t("wealth.billing_quarterly"),
  };
  const [tab, setTab] = useState<WealthTab>("records");
  const [period, setPeriod] = useState<"week" | "month" | "all">("month");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editNote, setEditNote] = useState("");
  const [currency, setCurrency] = useState("CNY");
  const sym = getCurrencySymbol(currency);

  const { budgets, addBudget, deleteBudget } = useBudgets(uid);
  const { subscriptions, addSubscription, deleteSubscription, toggleActive, renewSubscription, stats: subStats } = useSubscriptions(uid);
  const { ious, addIou, deleteIou, markPaid, summary: iouSummary } = useIous(uid);

  const [showBudgetForm, setShowBudgetForm] = useState(false);
  const [budgetCategory, setBudgetCategory] = useState("餐饮");
  const [budgetLimit, setBudgetLimit] = useState("");

  const [showSubForm, setShowSubForm] = useState(false);
  const [subName, setSubName] = useState("");
  const [subAmount, setSubAmount] = useState("");
  const [subCycle, setSubCycle] = useState<BillingCycle>("monthly");
  const [subNextDate, setSubNextDate] = useState(defaultNextDateFor("monthly"));
  // 用户手动改过续费日之后，就不再跟着付款周期自动改写它了
  const [subNextDateTouched, setSubNextDateTouched] = useState(false);

  // 之前这里无论选月付/年付/季付，默认续费日都写死"30天后"——选了年付
  // 却显示一个月内就要续费，明显不对。现在跟着周期联动，除非用户自己改过。
  useEffect(() => {
    if (!subNextDateTouched) setSubNextDate(defaultNextDateFor(subCycle));
  }, [subCycle, subNextDateTouched]);

  const [showIouForm, setShowIouForm] = useState(false);
  const [iouDir, setIouDir] = useState<"i_owe" | "they_owe">("they_owe");
  const [iouPerson, setIouPerson] = useState("");
  const [iouAmount, setIouAmount] = useState("");
  const [iouReason, setIouReason] = useState("");

  useEffect(() => {
    if (!user || !supabase) return;
    supabase.from("profiles").select("currency").eq("id", user.id).single()
      .then(({ data }) => { if (data?.currency) setCurrency(data.currency); });
  }, [user]);

  const filtered = useMemo(() => {
    const now = new Date();
    if (period === "week") return financeEntries.filter(e => parseISO(e.date) >= subDays(now, 7));
    if (period === "month") return financeEntries.filter(e => isWithinInterval(parseISO(e.date), { start: startOfMonth(now), end: endOfMonth(now) }));
    return financeEntries;
  }, [financeEntries, period]);

  const stats = useMemo(() => {
    const income = filtered.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0);
    const expense = filtered.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0);
    return { income, expense, net: income - expense };
  }, [filtered]);

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.filter(e => e.type === "expense").forEach(e => { const k = e.category || "其他"; map[k] = (map[k] || 0) + e.amount; });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [filtered]);

  const budgetUtil = useMemo(() => {
    const now = new Date();
    const monthExp: Record<string, number> = {};
    financeEntries.filter(e => e.type === "expense" && isWithinInterval(parseISO(e.date), { start: startOfMonth(now), end: endOfMonth(now) }))
      .forEach(e => { const k = e.category || "其他"; monthExp[k] = (monthExp[k] || 0) + e.amount; });
    return budgets.map(b => {
      const spent = monthExp[b.category] || 0;
      const pct = b.limit > 0 ? Math.round((spent / b.limit) * 100) : 0;
      return { ...b, spent, pct, status: pct >= 100 ? "exceeded" : pct >= 80 ? "warning" : "ok" };
    });
  }, [budgets, financeEntries]);

  const dueSoon = useMemo(() =>
    subscriptions.filter(s => { if (!s.active) return false; const diff = (parseISO(s.nextDate).getTime() - Date.now()) / 86400000; return diff >= 0 && diff <= 7; }),
    [subscriptions]);

  const handleAddBudget = () => {
    const limit = parsePositiveAmount(budgetLimit);
    if (!budgetCategory || limit === null) {
      toast.error(t("wealth.err_budget_invalid"), { id: "budget-invalid" });
      return;
    }
    addBudget({ category: budgetCategory, emoji: "💰", limit, period: "monthly" });
    setBudgetLimit(""); setShowBudgetForm(false);
  };
  const handleAddSub = () => {
    const amount = parsePositiveAmount(subAmount);
    if (!subName.trim() || amount === null) {
      toast.error(t("wealth.err_sub_invalid"), { id: "sub-invalid" });
      return;
    }
    addSubscription({ name: subName.trim(), emoji: "📱", amount, billingCycle: subCycle, nextDate: subNextDate, category: "娱乐", active: true });
    setSubName(""); setSubAmount(""); setSubNextDateTouched(false); setSubNextDate(defaultNextDateFor("monthly")); setSubCycle("monthly"); setShowSubForm(false);
  };
  const handleAddIou = () => {
    const amount = parsePositiveAmount(iouAmount);
    if (!iouPerson.trim() || amount === null || !iouReason.trim()) {
      toast.error(t("wealth.err_iou_invalid"), { id: "iou-invalid" });
      return;
    }
    addIou({ direction: iouDir, person: iouPerson.trim(), amount, reason: iouReason.trim(), status: "pending" });
    setIouPerson(""); setIouAmount(""); setIouReason(""); setShowIouForm(false);
  };

  const TABS = [
    { key: "records" as WealthTab, icon: <Wallet size={12} />, label: t("wealth.tab_bills") },
    { key: "budget" as WealthTab, icon: <Target size={12} />, label: t("wealth.tab_budget") },
    { key: "subscriptions" as WealthTab, icon: <CreditCard size={12} />, label: t("wealth.tab_subscriptions") },
    { key: "ious" as WealthTab, icon: <Users size={12} />, label: t("wealth.tab_ious") },
  ];

  return (
    <div className="h-full overflow-y-auto max-w-[600px] mx-auto pb-4">
      <div className="px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-serif-sc text-lg text-foreground">{t("wealth.title")}</h1>
          <p className="text-[10px] text-muted-foreground">{t("wealth.header_subtitle")}</p>
        </div>
        {dueSoon.length > 0 && (
          <div className="flex items-center gap-1 text-[9px] text-los-orange bg-los-orange/10 px-2 py-1 rounded-full">
            <Bell size={10} /> {t("wealth.subs_due_soon", { count: dueSoon.length })}
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 px-4 mb-3">
        <div className="bg-card border border-border rounded-xl p-2.5 text-center">
          <div className="text-sm text-los-green font-mono-jb">{sym}{stats.income}</div>
          <div className="text-[8px] text-muted-foreground">{t("wealth.income_this_month")}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-2.5 text-center">
          <div className="text-sm text-los-orange font-mono-jb">{sym}{stats.expense}</div>
          <div className="text-[8px] text-muted-foreground">{t("wealth.expense_this_month")}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-2.5 text-center">
          <div className={`text-sm font-mono-jb ${iouSummary.theyOwe >= iouSummary.iOwe ? "text-los-green" : "text-los-orange"}`}>
            {sym}{Math.abs(iouSummary.net)}
          </div>
          <div className="text-[8px] text-muted-foreground">{iouSummary.net > 0 ? t("wealth.net_owed_to_me") : iouSummary.net < 0 ? t("wealth.net_i_owe") : t("wealth.net_balanced")}</div>
        </div>
      </div>

      <div className="flex gap-1 px-4 mb-4">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1 text-[11px] py-1.5 rounded-lg transition ${tab === t.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      <div className="px-4">

        {/* ── 账单 ── */}
        {tab === "records" && (
          <>
            <div className="flex gap-1 mb-3">
              {(["week", "month", "all"] as const).map(k => (
                <button key={k} onClick={() => setPeriod(k)}
                  className={`text-xs px-3 py-1 rounded-full transition ${period === k ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  {k === "week" ? t("wealth.week") : k === "month" ? t("wealth.month") : t("wealth.all")}
                </button>
              ))}
            </div>

            {categoryData.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-3 mb-3">
                <h2 className="text-[10px] text-muted-foreground mb-2">{t("wealth.expense_category")}</h2>
                <div className="flex gap-3 items-center">
                  <div className="w-[80px] h-[80px] flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={categoryData} dataKey="value" cx="50%" cy="50%" outerRadius={38} innerRadius={20}>
                          {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-1">
                    {categoryData.slice(0, 4).map((c, i) => (
                      <div key={c.name} className="flex items-center gap-1.5 text-[9px]">
                        <span className="w-1.5 h-1.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                        <span className="text-muted-foreground flex-1">{c.name}</span>
                        <span className="font-mono-jb text-foreground">{sym}{c.value}</span>
                        <span className="text-muted-foreground/60">{Math.round(c.value / (stats.expense || 1) * 100)}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            <div className="bg-card border border-border rounded-xl p-3 mb-4">
              <h2 className="text-[10px] text-muted-foreground mb-2">{t("wealth.records")}</h2>
              {filtered.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-caption text-muted-foreground">{t("wealth.no_bill_records")}</p>
                  <p className="text-caption text-muted-foreground/60 mt-1 mb-3">{t("wealth.no_records")}</p>
                  <div className="flex gap-2 justify-center flex-wrap">
                    {[t("wealth.eg_expense_meal"), t("wealth.eg_income_salary"), t("wealth.eg_expense_taxi")].map(eg => (
                      <span key={eg} className="text-caption bg-surface-2 border border-border px-2.5 py-1 rounded-full text-muted-foreground">
                        「{eg}」
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {filtered.slice(0, 30).map(f => (
                    <div key={f.id} className="flex items-center gap-2 text-xs group">
                      {editingId === f.id ? (
                        <>
                          <input value={editAmount} onChange={e => setEditAmount(e.target.value)} type="number" className="w-16 bg-muted border border-border rounded px-1 py-0.5 text-xs font-mono-jb text-foreground" />
                          <input value={editNote} onChange={e => setEditNote(e.target.value)} className="flex-1 bg-muted border border-border rounded px-1 py-0.5 text-xs text-foreground" />
                          <button onClick={() => {
                            const amount = parsePositiveAmount(editAmount);
                            if (amount === null) { toast.error(t("wealth.err_amount_invalid"), { id: "edit-amount-invalid" }); return; }
                            updateFinanceEntry(f.id, { amount, note: editNote });
                            setEditingId(null);
                          }} className="text-los-green"><Check size={12} /></button>
                          <button onClick={() => setEditingId(null)} className="text-muted-foreground"><X size={12} /></button>
                        </>
                      ) : (
                        <>
                          <span className={f.type === "income" ? "text-los-green" : "text-los-orange"}>{f.type === "income" ? "↑" : "↓"}</span>
                          <span className="text-muted-foreground flex-1 truncate">{f.category}{f.note ? ` · ${f.note}` : ""}</span>
                          <span className={`font-mono-jb ${f.type === "income" ? "text-los-green" : "text-los-orange"}`}>{f.type === "income" ? "+" : "-"}{sym}{f.amount}</span>
                          <span className="text-[8px] text-muted-foreground/60">{f.date.slice(5)}</span>
                          <div className="hidden group-hover:flex gap-1">
                            <button onClick={() => { setEditingId(f.id); setEditAmount(String(f.amount)); setEditNote(f.note || ""); }} className="text-muted-foreground hover:text-foreground"><Pencil size={10} /></button>
                            <button onClick={() => deleteFinanceEntry(f.id)} className="text-muted-foreground hover:text-destructive"><Trash2 size={10} /></button>
                          </div>
                        </>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="bg-card border border-primary/20 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen size={14} className="text-primary" />
                <span className="text-xs text-primary font-serif-sc">{stats.net <= 0 ? t("wealth.stage_survival") : stats.net < 5000 ? t("wealth.stage_accumulation") : stats.net < 20000 ? t("wealth.stage_growth") : t("wealth.stage_freedom")}</span>
              </div>
              <p className="text-xs text-foreground leading-[1.8]">
                {stats.net <= 0 ? t("wealth.advice_survival") :
                 stats.net < 5000 ? t("wealth.advice_accumulation") :
                 stats.net < 20000 ? t("wealth.advice_growth") :
                 t("wealth.advice_freedom")}
              </p>
            </div>
          </>
        )}

        {/* ── 预算 ── */}
        {tab === "budget" && (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] text-muted-foreground">{t("wealth.budget_desc")}</p>
              <button onClick={() => setShowBudgetForm(v => !v)} className="flex items-center gap-1 text-[10px] text-primary bg-primary/10 px-2.5 py-1.5 rounded-lg">
                <Plus size={11} /> {t("wealth.add_budget")}
              </button>
            </div>

            {showBudgetForm && (
              <div className="bg-card border border-border rounded-xl p-4 mb-3">
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="text-[9px] text-muted-foreground mb-1 block">{t("wealth.category")}</label>
                    <select value={budgetCategory} onChange={e => setBudgetCategory(e.target.value)}
                      className="w-full bg-muted border border-border rounded-lg px-2 py-2 text-xs text-foreground focus:outline-none">
                      {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground mb-1 block">{t("wealth.budget_limit_label")}</label>
                    <input value={budgetLimit} onChange={e => setBudgetLimit(e.target.value)} type="number" placeholder="1000"
                      className="w-full bg-muted border border-border rounded-lg px-2 py-2 text-xs text-foreground focus:outline-none" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAddBudget} disabled={parsePositiveAmount(budgetLimit) === null} className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-xs disabled:opacity-30">{t("wealth.save")}</button>
                  <button onClick={() => setShowBudgetForm(false)} className="px-4 bg-muted text-muted-foreground py-2 rounded-lg text-xs">{t("wealth.cancel")}</button>
                </div>
              </div>
            )}

            {budgetUtil.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Target size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">{t("wealth.no_budgets")}</p>
                <p className="text-xs mt-1 opacity-60">{t("wealth.no_budgets_desc")}</p>
              </div>
            ) : (
              <div className="space-y-3">
                {budgetUtil.map(b => (
                  <div key={b.id} className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-serif-sc text-foreground">{b.category}</span>
                        {b.status === "exceeded" && <span className="text-[9px] bg-destructive/20 text-destructive px-1.5 py-0.5 rounded-full">{t("wealth.exceeded")}</span>}
                        {b.status === "warning" && <span className="text-[9px] bg-los-orange/20 text-los-orange px-1.5 py-0.5 rounded-full">{t("wealth.near_limit")}</span>}
                      </div>
                      <button onClick={() => deleteBudget(b.id)} className="text-muted-foreground/40 hover:text-destructive"><Trash2 size={12} /></button>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1.5">
                      <span>{t("wealth.used")} {sym}{b.spent}</span>
                      <span>{t("wealth.limit_label")} {sym}{b.limit} · {t("wealth.remaining")} {sym}{Math.max(b.limit - b.spent, 0)}</span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{
                        width: `${Math.min(b.pct, 100)}%`,
                        background: b.status === "exceeded" ? "hsl(0,65%,55%)" : b.status === "warning" ? "hsl(26,78%,57%)" : "hsl(142,60%,45%)"
                      }} />
                    </div>
                    <div className="text-right text-[9px] text-muted-foreground mt-1">{b.pct}% {t("wealth.used")}</div>
                  </div>
                ))}
                <div className="bg-card border border-border rounded-xl p-3 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">{t("wealth.budget_total")}</span><span className="font-mono-jb">{sym}{budgets.reduce((s, b) => s + b.limit, 0)}</span></div>
                  <div className="flex justify-between mt-1"><span className="text-muted-foreground">{t("wealth.spent_label")}</span><span className="font-mono-jb text-los-orange">{sym}{budgetUtil.reduce((s, b) => s + b.spent, 0)}</span></div>
                  <div className="flex justify-between mt-1"><span className="text-muted-foreground">{t("wealth.remaining")}</span>
                    <span className={`font-mono-jb ${budgets.reduce((s, b) => s + b.limit, 0) >= budgetUtil.reduce((s, b) => s + b.spent, 0) ? "text-los-green" : "text-destructive"}`}>
                      {sym}{budgets.reduce((s, b) => s + b.limit, 0) - budgetUtil.reduce((s, b) => s + b.spent, 0)}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        {/* ── 订阅 ── */}
        {tab === "subscriptions" && (
          <>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-card border border-border rounded-xl p-3 text-center">
                <div className="text-lg font-mono-jb text-foreground">{sym}{Math.round(subStats.monthlyTotal)}</div>
                <div className="text-[8px] text-muted-foreground">{t("wealth.monthly_fixed_expense")}</div>
              </div>
              <div className="bg-card border border-border rounded-xl p-3 text-center">
                <div className="text-lg font-mono-jb text-foreground">{sym}{Math.round(subStats.yearlyTotal)}</div>
                <div className="text-[8px] text-muted-foreground">{t("wealth.yearly_fixed_expense")}</div>
              </div>
            </div>

            {dueSoon.length > 0 && (
              <div className="bg-los-orange/10 border border-los-orange/30 rounded-xl p-3 mb-3">
                <p className="text-[10px] text-los-orange font-serif-sc mb-1">{t("wealth.renew_within_7days")}</p>
                {dueSoon.map(s => (
                  <div key={s.id} className="flex items-center justify-between text-xs py-0.5">
                    <span>{s.emoji} {s.name}</span>
                    <span className="font-mono-jb text-los-orange">{sym}{s.amount} · {s.nextDate}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] text-muted-foreground">{t("wealth.active_subs_count", { count: subStats.count })}</span>
              <button onClick={() => setShowSubForm(v => !v)} className="flex items-center gap-1 text-[10px] text-primary bg-primary/10 px-2.5 py-1.5 rounded-lg">
                <Plus size={11} /> {t("wealth.add_subscription")}
              </button>
            </div>

            {showSubForm && (
              <div className="bg-card border border-border rounded-xl p-4 mb-3">
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div><label className="text-[9px] text-muted-foreground mb-1 block">{t("wealth.name_label")}</label>
                    <input value={subName} onChange={e => setSubName(e.target.value)} placeholder="Netflix" className="w-full bg-muted border border-border rounded-lg px-2 py-2 text-xs text-foreground focus:outline-none" /></div>
                  <div><label className="text-[9px] text-muted-foreground mb-1 block">{t("wealth.amount_label")}</label>
                    <input value={subAmount} onChange={e => setSubAmount(e.target.value)} type="number" placeholder="39" className="w-full bg-muted border border-border rounded-lg px-2 py-2 text-xs text-foreground focus:outline-none" /></div>
                  <div><label className="text-[9px] text-muted-foreground mb-1 block">{t("wealth.billing_cycle_label")}</label>
                    <select value={subCycle} onChange={e => setSubCycle(e.target.value as BillingCycle)} className="w-full bg-muted border border-border rounded-lg px-2 py-2 text-xs text-foreground focus:outline-none">
                      {(["monthly", "yearly", "quarterly"] as BillingCycle[]).map(c => <option key={c} value={c}>{BILLING_LABELS[c]}</option>)}
                    </select></div>
                  <div><label className="text-[9px] text-muted-foreground mb-1 block">{t("wealth.next_renewal_label")}</label>
                    <input value={subNextDate} onChange={e => { setSubNextDate(e.target.value); setSubNextDateTouched(true); }} type="date" className="w-full bg-muted border border-border rounded-lg px-2 py-2 text-xs text-foreground focus:outline-none" /></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAddSub} disabled={!subName.trim() || parsePositiveAmount(subAmount) === null} className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-xs disabled:opacity-30">{t("wealth.save")}</button>
                  <button onClick={() => setShowSubForm(false)} className="px-4 bg-muted text-muted-foreground py-2 rounded-lg text-xs">{t("wealth.cancel")}</button>
                </div>
              </div>
            )}

            {subscriptions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CreditCard size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm text-muted-foreground">{t("wealth.no_subs")}</p>
                  <p className="text-caption text-muted-foreground/60 mt-1">{t("wealth.no_subs_example")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {subscriptions.map(s => (
                  <div key={s.id} className={`bg-card border border-border rounded-xl p-3 flex items-center gap-3 ${!s.active ? "opacity-50" : ""}`}>
                    <span className="text-xl">{s.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-foreground">{s.name}</span>
                        <span className="text-[9px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{BILLING_LABELS[s.billingCycle]}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] font-mono-jb text-primary">{sym}{s.amount}</span>
                        <span className="text-[9px] text-muted-foreground">{t("wealth.next_label")} {s.nextDate}</span>
                      </div>
                    </div>
                    <div className="flex gap-1 items-center">
                      <button onClick={() => renewSubscription(s.id)} className="text-muted-foreground hover:text-primary p-2 -m-1" title={t("wealth.mark_renewed")}><RefreshCw size={13} /></button>
                      <button onClick={() => toggleActive(s.id)} className={`text-[9px] px-2 py-1 rounded-full ${s.active ? "bg-los-green/20 text-los-green" : "bg-muted text-muted-foreground"}`}>{s.active ? t("wealth.active_status") : t("wealth.inactive_status")}</button>
                      <button
                        onClick={() => { if (confirm(t("wealth.confirm_delete_sub", { name: s.name }))) deleteSubscription(s.id); }}
                        className="text-muted-foreground/40 hover:text-destructive p-2 -m-1" title={t("wealth.delete_label")}>
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── 借还 ── */}
        {tab === "ious" && (
          <>
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-los-green/10 border border-los-green/30 rounded-xl p-3 text-center">
                <div className="text-lg font-mono-jb text-los-green">{sym}{iouSummary.theyOwe}</div>
                <div className="text-[8px] text-muted-foreground">{t("wealth.they_owe_me")}</div>
              </div>
              <div className="bg-los-orange/10 border border-los-orange/30 rounded-xl p-3 text-center">
                <div className="text-lg font-mono-jb text-los-orange">{sym}{iouSummary.iOwe}</div>
                <div className="text-[8px] text-muted-foreground">{t("wealth.i_owe_them")}</div>
              </div>
            </div>

            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] text-muted-foreground">{t("wealth.pending_count", { count: iouSummary.pendingCount })}</span>
              <button onClick={() => setShowIouForm(v => !v)} className="flex items-center gap-1 text-[10px] text-primary bg-primary/10 px-2.5 py-1.5 rounded-lg">
                <Plus size={11} /> {t("wealth.add_record")}
              </button>
            </div>

            {showIouForm && (
              <div className="bg-card border border-border rounded-xl p-4 mb-3">
                <div className="flex gap-2 mb-3">
                  <button onClick={() => setIouDir("they_owe")} className={`flex-1 py-2 rounded-lg text-xs transition ${iouDir === "they_owe" ? "bg-los-green/20 text-los-green" : "bg-muted text-muted-foreground"}`}>{t("wealth.they_owe_me")}</button>
                  <button onClick={() => setIouDir("i_owe")} className={`flex-1 py-2 rounded-lg text-xs transition ${iouDir === "i_owe" ? "bg-los-orange/20 text-los-orange" : "bg-muted text-muted-foreground"}`}>{t("wealth.i_owe_them")}</button>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div><label className="text-[9px] text-muted-foreground mb-1 block">{t("wealth.person_label")}</label>
                    <input value={iouPerson} onChange={e => setIouPerson(e.target.value)} placeholder={t("wealth.person_placeholder")} className="w-full bg-muted border border-border rounded-lg px-2 py-2 text-xs text-foreground focus:outline-none" /></div>
                  <div><label className="text-[9px] text-muted-foreground mb-1 block">{t("wealth.amount_label")}</label>
                    <input value={iouAmount} onChange={e => setIouAmount(e.target.value)} type="number" placeholder="200" className="w-full bg-muted border border-border rounded-lg px-2 py-2 text-xs text-foreground focus:outline-none" /></div>
                </div>
                <div className="mb-2"><label className="text-[9px] text-muted-foreground mb-1 block">{t("wealth.reason_label")}</label>
                  <input value={iouReason} onChange={e => setIouReason(e.target.value)} placeholder={t("wealth.reason_placeholder")} className="w-full bg-muted border border-border rounded-lg px-2 py-2 text-xs text-foreground focus:outline-none" /></div>
                <div className="flex gap-2">
                  <button onClick={handleAddIou} disabled={!iouPerson.trim() || parsePositiveAmount(iouAmount) === null || !iouReason.trim()} className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-xs disabled:opacity-30">{t("wealth.save")}</button>
                  <button onClick={() => setShowIouForm(false)} className="px-4 bg-muted text-muted-foreground py-2 rounded-lg text-xs">{t("wealth.cancel")}</button>
                </div>
              </div>
            )}

            {ious.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm text-muted-foreground">{t("wealth.no_ious")}</p>
                  <p className="text-caption text-muted-foreground/60 mt-1">{t("wealth.no_ious_desc")}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {ious.map(iou => (
                  <div key={iou.id} className={`bg-card border border-border rounded-xl p-3 ${iou.status === "paid" ? "opacity-50" : ""}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-mono-jb ${iou.direction === "they_owe" ? "bg-los-green/20 text-los-green" : "bg-los-orange/20 text-los-orange"}`}>
                          {iou.direction === "they_owe" ? t("wealth.badge_they_owe") : t("wealth.badge_i_owe")}
                        </span>
                        <span className="text-sm text-foreground">{iou.person}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-mono-jb ${iou.direction === "they_owe" ? "text-los-green" : "text-los-orange"}`}>{sym}{iou.amount}</span>
                        {iou.status === "pending" && (
                          <button onClick={() => markPaid(iou.id)} className="text-[9px] bg-primary/10 text-primary px-2 py-1 rounded-full"><Check size={10} className="inline mr-0.5" />{t("wealth.mark_paid")}</button>
                        )}
                        <button onClick={() => deleteIou(iou.id)} className="text-muted-foreground/40 hover:text-destructive"><Trash2 size={12} /></button>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{iou.reason} · {iou.createdAt.slice(0, 10)}</p>
                    {iou.status === "paid" && <span className="text-[9px] text-los-green">{t("wealth.paid_status")}</span>}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

      </div>
    </div>
  );
}
