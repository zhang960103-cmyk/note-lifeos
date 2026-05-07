import { useMemo, useState, useEffect } from "react";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { useAuth } from "@/hooks/useAuth";
import { useBudgets, useSubscriptions, useIous } from "@/hooks/useLocalData";
import { format, parseISO, subDays, startOfMonth, endOfMonth, isWithinInterval, addDays } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer } from "recharts";
import { Wallet, BookOpen, Trash2, Pencil, Check, X, Plus, CreditCard, Users, Target, RefreshCw, Bell } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getCurrencySymbol } from "@/lib/currencyUtils";
import type { BillingCycle } from "@/types/lifeOs";

const COLORS = ["hsl(39,58%,53%)", "hsl(0,65%,55%)", "hsl(142,60%,45%)", "hsl(210,60%,50%)", "hsl(280,55%,55%)", "hsl(30,50%,45%)"];
const EXPENSE_CATEGORIES = ["餐饮", "购物", "交通", "娱乐", "住房", "医疗", "学习", "旅行", "其他"];
const BILLING_LABELS: Record<BillingCycle, string> = { monthly: "月付", yearly: "年付", quarterly: "季付" };
type WealthTab = "records" | "budget" | "subscriptions" | "ious";

export default function WealthPage() {
  const { financeEntries, deleteFinanceEntry, updateFinanceEntry, energyLogs } = useLifeOs();
  const { user } = useAuth();
  const uid = user?.id || "guest";
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
  const [subNextDate, setSubNextDate] = useState(format(addDays(new Date(), 30), "yyyy-MM-dd"));

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
    if (!budgetCategory || !budgetLimit) return;
    addBudget({ category: budgetCategory, emoji: "💰", limit: Number(budgetLimit), period: "monthly" });
    setBudgetLimit(""); setShowBudgetForm(false);
  };
  const handleAddSub = () => {
    if (!subName || !subAmount) return;
    addSubscription({ name: subName, emoji: "📱", amount: Number(subAmount), billingCycle: subCycle, nextDate: subNextDate, category: "娱乐", active: true });
    setSubName(""); setSubAmount(""); setShowSubForm(false);
  };
  const handleAddIou = () => {
    if (!iouPerson || !iouAmount || !iouReason) return;
    addIou({ direction: iouDir, person: iouPerson, amount: Number(iouAmount), reason: iouReason, status: "pending" });
    setIouPerson(""); setIouAmount(""); setIouReason(""); setShowIouForm(false);
  };

  const TABS = [
    { key: "records" as WealthTab, icon: <Wallet size={12} />, label: "账单" },
    { key: "budget" as WealthTab, icon: <Target size={12} />, label: "预算" },
    { key: "subscriptions" as WealthTab, icon: <CreditCard size={12} />, label: "订阅" },
    { key: "ious" as WealthTab, icon: <Users size={12} />, label: "借还" },
  ];

  return (
    <div className="h-full overflow-y-auto max-w-[600px] mx-auto pb-4">
      <div className="px-4 py-4 flex items-center justify-between">
        <div>
          <h1 className="font-serif-sc text-lg text-foreground">财富</h1>
          <p className="text-[10px] text-muted-foreground">钱去哪了 · 欠了谁 · 订了什么</p>
        </div>
        {dueSoon.length > 0 && (
          <div className="flex items-center gap-1 text-[9px] text-los-orange bg-los-orange/10 px-2 py-1 rounded-full">
            <Bell size={10} /> {dueSoon.length}个订阅即将到期
          </div>
        )}
      </div>

      <div className="grid grid-cols-3 gap-2 px-4 mb-3">
        <div className="bg-card border border-border rounded-xl p-2.5 text-center">
          <div className="text-sm text-los-green font-mono-jb">{sym}{stats.income}</div>
          <div className="text-[8px] text-muted-foreground">本月收入</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-2.5 text-center">
          <div className="text-sm text-los-orange font-mono-jb">{sym}{stats.expense}</div>
          <div className="text-[8px] text-muted-foreground">本月支出</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-2.5 text-center">
          <div className={`text-sm font-mono-jb ${iouSummary.theyOwe >= iouSummary.iOwe ? "text-los-green" : "text-los-orange"}`}>
            {sym}{Math.abs(iouSummary.net)}
          </div>
          <div className="text-[8px] text-muted-foreground">{iouSummary.net > 0 ? "净欠我" : iouSummary.net < 0 ? "净欠人" : "借还平衡"}</div>
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
                  {k === "week" ? "本周" : k === "month" ? "本月" : "全部"}
                </button>
              ))}
            </div>

            {categoryData.length > 0 && (
              <div className="bg-card border border-border rounded-xl p-3 mb-3">
                <h2 className="text-[10px] text-muted-foreground mb-2">支出分布</h2>
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
              <h2 className="text-[10px] text-muted-foreground mb-2">流水记录</h2>
              {filtered.length === 0 ? (
                <div className="text-center py-6">
                  <p className="text-caption text-muted-foreground">还没有账单记录</p>
                  <p className="text-caption text-muted-foreground/60 mt-1 mb-3">在主页和导师说话，会自动记录</p>
                  <div className="flex gap-2 justify-center flex-wrap">
                    {["花了50块吃饭", "收到工资5000", "打车花了30"].map(eg => (
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
                          <button onClick={() => { updateFinanceEntry(f.id, { amount: Number(editAmount), note: editNote }); setEditingId(null); }} className="text-los-green"><Check size={12} /></button>
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
                <span className="text-xs text-primary font-serif-sc">{stats.net <= 0 ? "生存期" : stats.net < 5000 ? "积累期" : stats.net < 20000 ? "增长期" : "自由期"}</span>
              </div>
              <p className="text-xs text-foreground leading-[1.8]">
                {stats.net <= 0 ? "支出≥收入，优先「50-30-20法则」：50%必需、30%想要、20%储蓄" :
                 stats.net < 5000 ? "有储蓄是好的开始。建立3个月应急金，然后了解指数基金定投" :
                 stats.net < 20000 ? "有了积累，考虑被动收入：课程、内容、数字产品" :
                 "优化资产配置，让钱为你工作。关注被动收入是否覆盖支出"}
              </p>
            </div>
          </>
        )}

        {/* ── 预算 ── */}
        {tab === "budget" && (
          <>
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] text-muted-foreground">设置月度预算上限，实时追踪进度</p>
              <button onClick={() => setShowBudgetForm(v => !v)} className="flex items-center gap-1 text-[10px] text-primary bg-primary/10 px-2.5 py-1.5 rounded-lg">
                <Plus size={11} /> 新增预算
              </button>
            </div>

            {showBudgetForm && (
              <div className="bg-card border border-border rounded-xl p-4 mb-3">
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <label className="text-[9px] text-muted-foreground mb-1 block">类别</label>
                    <select value={budgetCategory} onChange={e => setBudgetCategory(e.target.value)}
                      className="w-full bg-muted border border-border rounded-lg px-2 py-2 text-xs text-foreground focus:outline-none">
                      {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-[9px] text-muted-foreground mb-1 block">月度上限（元）</label>
                    <input value={budgetLimit} onChange={e => setBudgetLimit(e.target.value)} type="number" placeholder="1000"
                      className="w-full bg-muted border border-border rounded-lg px-2 py-2 text-xs text-foreground focus:outline-none" />
                  </div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAddBudget} disabled={!budgetLimit} className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-xs disabled:opacity-30">保存</button>
                  <button onClick={() => setShowBudgetForm(false)} className="px-4 bg-muted text-muted-foreground py-2 rounded-lg text-xs">取消</button>
                </div>
              </div>
            )}

            {budgetUtil.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Target size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm">还没有预算</p>
                <p className="text-xs mt-1 opacity-60">设置后可以看到每个类别还剩多少</p>
              </div>
            ) : (
              <div className="space-y-3">
                {budgetUtil.map(b => (
                  <div key={b.id} className="bg-card border border-border rounded-xl p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-serif-sc text-foreground">{b.category}</span>
                        {b.status === "exceeded" && <span className="text-[9px] bg-destructive/20 text-destructive px-1.5 py-0.5 rounded-full">超支</span>}
                        {b.status === "warning" && <span className="text-[9px] bg-los-orange/20 text-los-orange px-1.5 py-0.5 rounded-full">接近上限</span>}
                      </div>
                      <button onClick={() => deleteBudget(b.id)} className="text-muted-foreground/40 hover:text-destructive"><Trash2 size={12} /></button>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1.5">
                      <span>已用 {sym}{b.spent}</span>
                      <span>上限 {sym}{b.limit} · 剩余 {sym}{Math.max(b.limit - b.spent, 0)}</span>
                    </div>
                    <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all" style={{
                        width: `${Math.min(b.pct, 100)}%`,
                        background: b.status === "exceeded" ? "hsl(0,65%,55%)" : b.status === "warning" ? "hsl(26,78%,57%)" : "hsl(142,60%,45%)"
                      }} />
                    </div>
                    <div className="text-right text-[9px] text-muted-foreground mt-1">{b.pct}% 已用</div>
                  </div>
                ))}
                <div className="bg-card border border-border rounded-xl p-3 text-xs">
                  <div className="flex justify-between"><span className="text-muted-foreground">预算总额</span><span className="font-mono-jb">{sym}{budgets.reduce((s, b) => s + b.limit, 0)}</span></div>
                  <div className="flex justify-between mt-1"><span className="text-muted-foreground">已支出</span><span className="font-mono-jb text-los-orange">{sym}{budgetUtil.reduce((s, b) => s + b.spent, 0)}</span></div>
                  <div className="flex justify-between mt-1"><span className="text-muted-foreground">剩余</span>
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
                <div className="text-[8px] text-muted-foreground">每月固定支出</div>
              </div>
              <div className="bg-card border border-border rounded-xl p-3 text-center">
                <div className="text-lg font-mono-jb text-foreground">{sym}{Math.round(subStats.yearlyTotal)}</div>
                <div className="text-[8px] text-muted-foreground">每年固定支出</div>
              </div>
            </div>

            {dueSoon.length > 0 && (
              <div className="bg-los-orange/10 border border-los-orange/30 rounded-xl p-3 mb-3">
                <p className="text-[10px] text-los-orange font-serif-sc mb-1">⏰ 7天内续费</p>
                {dueSoon.map(s => (
                  <div key={s.id} className="flex items-center justify-between text-xs py-0.5">
                    <span>{s.emoji} {s.name}</span>
                    <span className="font-mono-jb text-los-orange">{sym}{s.amount} · {s.nextDate}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] text-muted-foreground">{subStats.count} 个活跃订阅</span>
              <button onClick={() => setShowSubForm(v => !v)} className="flex items-center gap-1 text-[10px] text-primary bg-primary/10 px-2.5 py-1.5 rounded-lg">
                <Plus size={11} /> 添加订阅
              </button>
            </div>

            {showSubForm && (
              <div className="bg-card border border-border rounded-xl p-4 mb-3">
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div><label className="text-[9px] text-muted-foreground mb-1 block">名称</label>
                    <input value={subName} onChange={e => setSubName(e.target.value)} placeholder="Netflix" className="w-full bg-muted border border-border rounded-lg px-2 py-2 text-xs text-foreground focus:outline-none" /></div>
                  <div><label className="text-[9px] text-muted-foreground mb-1 block">金额（元）</label>
                    <input value={subAmount} onChange={e => setSubAmount(e.target.value)} type="number" placeholder="39" className="w-full bg-muted border border-border rounded-lg px-2 py-2 text-xs text-foreground focus:outline-none" /></div>
                  <div><label className="text-[9px] text-muted-foreground mb-1 block">付款周期</label>
                    <select value={subCycle} onChange={e => setSubCycle(e.target.value as BillingCycle)} className="w-full bg-muted border border-border rounded-lg px-2 py-2 text-xs text-foreground focus:outline-none">
                      {(["monthly", "yearly", "quarterly"] as BillingCycle[]).map(c => <option key={c} value={c}>{BILLING_LABELS[c]}</option>)}
                    </select></div>
                  <div><label className="text-[9px] text-muted-foreground mb-1 block">下次续费日</label>
                    <input value={subNextDate} onChange={e => setSubNextDate(e.target.value)} type="date" className="w-full bg-muted border border-border rounded-lg px-2 py-2 text-xs text-foreground focus:outline-none" /></div>
                </div>
                <div className="flex gap-2">
                  <button onClick={handleAddSub} disabled={!subName || !subAmount} className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-xs disabled:opacity-30">保存</button>
                  <button onClick={() => setShowSubForm(false)} className="px-4 bg-muted text-muted-foreground py-2 rounded-lg text-xs">取消</button>
                </div>
              </div>
            )}

            {subscriptions.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <CreditCard size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm text-muted-foreground">暂无订阅记录</p>
                  <p className="text-caption text-muted-foreground/60 mt-1">例如：Netflix 39元/月、健身房 199元/月</p>
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
                        <span className="text-[9px] text-muted-foreground">下次 {s.nextDate}</span>
                      </div>
                    </div>
                    <div className="flex gap-2 items-center">
                      <button onClick={() => renewSubscription(s.id)} className="text-muted-foreground hover:text-primary" title="标记已续费"><RefreshCw size={13} /></button>
                      <button onClick={() => toggleActive(s.id)} className={`text-[9px] px-2 py-1 rounded-full ${s.active ? "bg-los-green/20 text-los-green" : "bg-muted text-muted-foreground"}`}>{s.active ? "活跃" : "停用"}</button>
                      <button onClick={() => deleteSubscription(s.id)} className="text-muted-foreground/40 hover:text-destructive"><Trash2 size={12} /></button>
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
                <div className="text-[8px] text-muted-foreground">别人欠我</div>
              </div>
              <div className="bg-los-orange/10 border border-los-orange/30 rounded-xl p-3 text-center">
                <div className="text-lg font-mono-jb text-los-orange">{sym}{iouSummary.iOwe}</div>
                <div className="text-[8px] text-muted-foreground">我欠别人</div>
              </div>
            </div>

            <div className="flex items-center justify-between mb-3">
              <span className="text-[10px] text-muted-foreground">{iouSummary.pendingCount} 笔未结清</span>
              <button onClick={() => setShowIouForm(v => !v)} className="flex items-center gap-1 text-[10px] text-primary bg-primary/10 px-2.5 py-1.5 rounded-lg">
                <Plus size={11} /> 记一笔
              </button>
            </div>

            {showIouForm && (
              <div className="bg-card border border-border rounded-xl p-4 mb-3">
                <div className="flex gap-2 mb-3">
                  <button onClick={() => setIouDir("they_owe")} className={`flex-1 py-2 rounded-lg text-xs transition ${iouDir === "they_owe" ? "bg-los-green/20 text-los-green" : "bg-muted text-muted-foreground"}`}>别人欠我</button>
                  <button onClick={() => setIouDir("i_owe")} className={`flex-1 py-2 rounded-lg text-xs transition ${iouDir === "i_owe" ? "bg-los-orange/20 text-los-orange" : "bg-muted text-muted-foreground"}`}>我欠别人</button>
                </div>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div><label className="text-[9px] text-muted-foreground mb-1 block">对方</label>
                    <input value={iouPerson} onChange={e => setIouPerson(e.target.value)} placeholder="小明" className="w-full bg-muted border border-border rounded-lg px-2 py-2 text-xs text-foreground focus:outline-none" /></div>
                  <div><label className="text-[9px] text-muted-foreground mb-1 block">金额（元）</label>
                    <input value={iouAmount} onChange={e => setIouAmount(e.target.value)} type="number" placeholder="200" className="w-full bg-muted border border-border rounded-lg px-2 py-2 text-xs text-foreground focus:outline-none" /></div>
                </div>
                <div className="mb-2"><label className="text-[9px] text-muted-foreground mb-1 block">原因</label>
                  <input value={iouReason} onChange={e => setIouReason(e.target.value)} placeholder="上次聚餐AA" className="w-full bg-muted border border-border rounded-lg px-2 py-2 text-xs text-foreground focus:outline-none" /></div>
                <div className="flex gap-2">
                  <button onClick={handleAddIou} disabled={!iouPerson || !iouAmount || !iouReason} className="flex-1 bg-primary text-primary-foreground py-2 rounded-lg text-xs disabled:opacity-30">保存</button>
                  <button onClick={() => setShowIouForm(false)} className="px-4 bg-muted text-muted-foreground py-2 rounded-lg text-xs">取消</button>
                </div>
              </div>
            )}

            {ious.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Users size={32} className="mx-auto mb-3 opacity-30" />
                <p className="text-sm text-muted-foreground">暂无借还记录</p>
                  <p className="text-caption text-muted-foreground/60 mt-1">朋友请你吃饭帮垫款，点「记一笔」开始记录</p>
              </div>
            ) : (
              <div className="space-y-2">
                {ious.map(iou => (
                  <div key={iou.id} className={`bg-card border border-border rounded-xl p-3 ${iou.status === "paid" ? "opacity-50" : ""}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded-full font-mono-jb ${iou.direction === "they_owe" ? "bg-los-green/20 text-los-green" : "bg-los-orange/20 text-los-orange"}`}>
                          {iou.direction === "they_owe" ? "↑欠我" : "↓我欠"}
                        </span>
                        <span className="text-sm text-foreground">{iou.person}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-sm font-mono-jb ${iou.direction === "they_owe" ? "text-los-green" : "text-los-orange"}`}>{sym}{iou.amount}</span>
                        {iou.status === "pending" && (
                          <button onClick={() => markPaid(iou.id)} className="text-[9px] bg-primary/10 text-primary px-2 py-1 rounded-full"><Check size={10} className="inline mr-0.5" />还清</button>
                        )}
                        <button onClick={() => deleteIou(iou.id)} className="text-muted-foreground/40 hover:text-destructive"><Trash2 size={12} /></button>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{iou.reason} · {iou.createdAt.slice(0, 10)}</p>
                    {iou.status === "paid" && <span className="text-[9px] text-los-green">✓ 已结清</span>}
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
