import { useMemo, useState, useEffect } from "react";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { format, parseISO, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, TrendingDown, Wallet, BookOpen, Trash2, Pencil, Check, X, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { getCurrencySymbol, formatMoney } from "@/lib/currencyUtils";

const COLORS = ["hsl(39,58%,53%)", "hsl(0,65%,55%)", "hsl(142,60%,45%)", "hsl(210,60%,50%)", "hsl(280,55%,55%)", "hsl(30,50%,45%)"];

const FINANCE_TIPS_ZH = [
  { level: "生存期", condition: (net: number) => net <= 0, tip: "你的支出≥收入，优先用「50-30-20法则」分配：50%必需、30%想要、20%储蓄", resource: "📚《小狗钱钱》— 最简单的理财入门" },
  { level: "积累期", condition: (net: number) => net > 0 && net < 5000, tip: "有储蓄是好的开始。下一步：建立3个月应急金，然后了解指数基金定投", resource: "📚《穷爸爸富爸爸》— 理解资产和负债的区别" },
  { level: "增长期", condition: (net: number) => net >= 5000 && net < 20000, tip: "你已经有了一定积累。考虑建立被动收入渠道：课程、内容、数字产品", resource: "📚《纳瓦尔宝典》— 用杠杆和复利实现财务自由" },
  { level: "自由期", condition: (net: number) => net >= 20000, tip: "优化资产配置，让钱为你工作。关注被动收入是否覆盖生活支出", resource: "📚《穷查理宝典》— 查理·芒格的多元思维模型" },
];

const FINANCE_TIPS_EN = [
  { level: "Survival", condition: (net: number) => net <= 0, tip: "Expenses ≥ income. Use the 50-30-20 rule: 50% needs, 30% wants, 20% savings", resource: "📚 The Richest Man in Babylon — Simple wealth principles" },
  { level: "Accumulation", condition: (net: number) => net > 0 && net < 5000, tip: "Saving is a great start. Next: build a 3-month emergency fund, then explore index investing", resource: "📚 Rich Dad Poor Dad — Assets vs liabilities" },
  { level: "Growth", condition: (net: number) => net >= 5000 && net < 20000, tip: "Good accumulation. Consider passive income streams: courses, content, digital products", resource: "📚 The Almanack of Naval Ravikant — Leverage and compounding" },
  { level: "Freedom", condition: (net: number) => net >= 20000, tip: "Optimize asset allocation. Focus on whether passive income covers expenses", resource: "📚 Poor Charlie's Almanack — Multi-disciplinary thinking" },
];

const WealthPage = () => {
  const { financeEntries, monthFinanceStats, deleteFinanceEntry, updateFinanceEntry, energyLogs } = useLifeOs();
  const { t, lang } = useLanguage();
  const { user } = useAuth();
  const [period, setPeriod] = useState<"week" | "month" | "all">("month");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editNote, setEditNote] = useState("");
  const [currency, setCurrency] = useState("CNY");

  // Load user currency preference
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("currency").eq("id", user.id).single()
      .then(({ data }) => { if (data?.currency) setCurrency(data.currency); });
  }, [user]);

  const sym = getCurrencySymbol(currency);
  const tips = lang === "zh" ? FINANCE_TIPS_ZH : FINANCE_TIPS_EN;

  const filtered = useMemo(() => {
    const now = new Date();
    if (period === "week") {
      const cutoff = subDays(now, 7);
      return financeEntries.filter(e => parseISO(e.date) >= cutoff);
    }
    if (period === "month") {
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      return financeEntries.filter(e => {
        const d = parseISO(e.date);
        return isWithinInterval(d, { start, end });
      });
    }
    return financeEntries;
  }, [financeEntries, period]);

  const stats = useMemo(() => {
    const income = filtered.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0);
    const expense = filtered.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0);
    return { income, expense, net: income - expense, count: filtered.length };
  }, [filtered]);

  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.filter(e => e.type === "expense").forEach(e => {
      const key = e.category || (lang === "zh" ? "其他" : "Other");
      map[key] = (map[key] || 0) + e.amount;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [filtered, lang]);

  const dailyTrend = useMemo(() => {
    const now = new Date();
    const days = period === "week" ? 7 : period === "month" ? 30 : 90;
    const cutoff = subDays(now, days);
    const interval = eachDayOfInterval({ start: cutoff, end: now });
    return interval.map(day => {
      const dateStr = format(day, "yyyy-MM-dd");
      const dayEntries = financeEntries.filter(e => e.date === dateStr);
      const inc = dayEntries.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0);
      const exp = dayEntries.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0);
      return { date: format(day, "M/d"), income: inc, expense: exp, net: inc - exp };
    }).filter(d => d.income > 0 || d.expense > 0);
  }, [financeEntries, period]);

  const incomeData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.filter(e => e.type === "income").forEach(e => {
      const key = e.category || (lang === "zh" ? "其他" : "Other");
      map[key] = (map[key] || 0) + e.amount;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]).map(([name, value]) => ({ name, value }));
  }, [filtered, lang]);

  const currentTip = useMemo(() => {
    for (const tip of tips) {
      if (tip.condition(stats.net)) return tip;
    }
    return tips[0];
  }, [stats.net, tips]);

  const passiveRatio = useMemo(() => {
    const passiveKeywords = ["被动收入", "投资", "分红", "版税", "租金", "passive", "investment", "dividend", "royalty", "rental"];
    const passive = filtered.filter(e => e.type === "income" && passiveKeywords.some(k => e.category?.includes(k) || e.note?.includes(k)));
    if (stats.income === 0) return 0;
    return Math.round((passive.reduce((s, e) => s + e.amount, 0) / stats.income) * 100);
  }, [filtered, stats.income]);

  const energyIncomeCorrelation = useMemo(() => {
    if (energyLogs.length === 0 || financeEntries.length === 0) return null;
    const byLevel: Record<string, { income: number; days: Set<string> }> = {
      '高': { income: 0, days: new Set() },
      '中': { income: 0, days: new Set() },
      '低': { income: 0, days: new Set() },
    };
    energyLogs.forEach(log => {
      const date = format(new Date(log.timestamp), 'yyyy-MM-dd');
      if (byLevel[log.level]) byLevel[log.level].days.add(date);
    });
    financeEntries.filter(e => e.type === 'income').forEach(entry => {
      for (const [level, data] of Object.entries(byLevel)) {
        if (data.days.has(entry.date)) byLevel[level].income += entry.amount;
      }
    });
    return Object.entries(byLevel)
      .filter(([, d]) => d.days.size > 0)
      .map(([level, d]) => ({ level, avgIncome: Math.round(d.income / d.days.size), days: d.days.size }));
  }, [energyLogs, financeEntries]);

  const periodLabels: Record<string, string> = {
    week: t("wealth.week"),
    month: t("wealth.month"),
    all: t("wealth.all"),
  };

  return (
    <div className="h-full overflow-y-auto px-4 max-w-[600px] mx-auto pb-4">
      <div className="py-4">
        <h1 className="font-serif-sc text-lg text-foreground">{t("wealth.title")}</h1>
        <p className="text-[10px] text-muted-foreground">{t("wealth.subtitle")}</p>
      </div>

      {/* Period selector */}
      <div className="flex gap-1 mb-4">
        {(["week", "month", "all"] as const).map(key => (
          <button key={key} onClick={() => setPeriod(key)}
            className={`text-xs px-3 py-1 rounded-full transition ${period === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
            {periodLabels[key]}
          </button>
        ))}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <TrendingUp size={14} className="text-los-green mx-auto mb-1" />
          <div className="text-lg text-los-green font-mono-jb">{sym}{stats.income}</div>
          <div className="text-[8px] text-muted-foreground">{t("wealth.income")}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <TrendingDown size={14} className="text-los-orange mx-auto mb-1" />
          <div className="text-lg text-los-orange font-mono-jb">{sym}{stats.expense}</div>
          <div className="text-[8px] text-muted-foreground">{t("wealth.expense")}</div>
        </div>
        <div className="bg-card border border-border rounded-xl p-3 text-center">
          <Wallet size={14} className="text-primary mx-auto mb-1" />
          <div className={`text-lg font-mono-jb ${stats.net >= 0 ? "text-los-green" : "text-los-orange"}`}>
            {sym}{stats.net}
          </div>
          <div className="text-[8px] text-muted-foreground">{t("wealth.net")}</div>
        </div>
      </div>

      {/* Passive income indicator */}
      <div className="bg-card border border-border rounded-xl p-3 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-muted-foreground">{t("wealth.passive_ratio")}</span>
          <span className="text-xs text-primary font-mono-jb">{passiveRatio}%</span>
        </div>
        <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${Math.min(passiveRatio, 100)}%` }} />
        </div>
        <p className="text-[9px] text-muted-foreground mt-1.5">
          {passiveRatio === 0 ? t("wealth.passive_none") :
           passiveRatio < 30 ? t("wealth.passive_low") :
           passiveRatio < 70 ? t("wealth.passive_mid") : t("wealth.passive_high")}
        </p>
      </div>

      {/* Daily trend chart */}
      {dailyTrend.length > 1 && (
        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <h2 className="text-xs text-muted-foreground font-mono-jb mb-3">{t("wealth.trend")}</h2>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={dailyTrend}>
              <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} axisLine={false} tickLine={false} width={30} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11, color: "hsl(var(--foreground))" }} />
              <Bar dataKey="income" fill="hsl(142,60%,45%)" radius={[2, 2, 0, 0]} />
              <Bar dataKey="expense" fill="hsl(0,65%,55%)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Category breakdown */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {categoryData.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-3">
            <h2 className="text-[10px] text-muted-foreground mb-2">{t("wealth.expense_category")}</h2>
            <ResponsiveContainer width="100%" height={100}>
              <PieChart>
                <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={40} innerRadius={20}>
                  {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "none", borderRadius: 8, fontSize: 10, color: "hsl(var(--foreground))" }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-0.5 mt-1">
              {categoryData.slice(0, 4).map((c, i) => (
                <div key={c.name} className="flex items-center gap-1 text-[9px]">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-muted-foreground flex-1">{c.name}</span>
                  <span className="text-foreground font-mono-jb">{sym}{c.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {incomeData.length > 0 && (
          <div className="bg-card border border-border rounded-xl p-3">
            <h2 className="text-[10px] text-muted-foreground mb-2">{t("wealth.income_source")}</h2>
            <ResponsiveContainer width="100%" height={100}>
              <PieChart>
                <Pie data={incomeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={40} innerRadius={20}>
                  {incomeData.map((_, i) => <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "none", borderRadius: 8, fontSize: 10, color: "hsl(var(--foreground))" }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-0.5 mt-1">
              {incomeData.slice(0, 4).map((c, i) => (
                <div key={c.name} className="flex items-center gap-1 text-[9px]">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: COLORS[(i + 2) % COLORS.length] }} />
                  <span className="text-muted-foreground flex-1">{c.name}</span>
                  <span className="text-foreground font-mono-jb">{sym}{c.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recent transactions */}
      <div className="bg-card border border-border rounded-xl p-3 mb-4">
        <h2 className="text-[10px] text-muted-foreground mb-2">{t("wealth.records")}</h2>
        {filtered.length === 0 ? (
          <p className="text-[10px] text-muted-foreground/60 text-center py-4">
            {t("wealth.no_records")}<br />{t("wealth.no_records_example")}
          </p>
        ) : (
          <div className="space-y-1.5">
            {filtered.slice(0, 20).map(f => (
              <div key={f.id} className="flex items-center gap-2 text-xs group">
                {editingId === f.id ? (
                  <>
                    <span className={f.type === "income" ? "text-los-green" : "text-los-orange"}>
                      {f.type === "income" ? "↑" : "↓"}
                    </span>
                    <input value={editAmount} onChange={e => setEditAmount(e.target.value)}
                      className="w-16 bg-muted border border-border rounded px-1 py-0.5 text-xs font-mono-jb text-foreground" type="number" />
                    <input value={editNote} onChange={e => setEditNote(e.target.value)}
                      className="flex-1 bg-muted border border-border rounded px-1 py-0.5 text-xs text-foreground" placeholder="..." />
                    <button onClick={() => { updateFinanceEntry(f.id, { amount: Number(editAmount), note: editNote }); setEditingId(null); }} className="text-los-green"><Check size={12} /></button>
                    <button onClick={() => setEditingId(null)} className="text-muted-foreground"><X size={12} /></button>
                  </>
                ) : (
                  <>
                    <span className={f.type === "income" ? "text-los-green" : "text-los-orange"}>
                      {f.type === "income" ? "↑" : "↓"}
                    </span>
                    <span className="text-muted-foreground flex-1 truncate">{f.category} {f.note && `· ${f.note}`}</span>
                    <span className={`font-mono-jb ${f.type === "income" ? "text-los-green" : "text-los-orange"}`}>
                      {f.type === "income" ? "+" : "-"}{sym}{f.amount}
                    </span>
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

      {/* Energy × Income Correlation */}
      {energyIncomeCorrelation && energyIncomeCorrelation.length > 0 && (
        <div className="bg-card border border-border rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Zap size={14} className="text-primary" />
            <span className="text-xs text-muted-foreground font-mono-jb">{t("wealth.energy_income")}</span>
          </div>
          <div className="space-y-2">
            {energyIncomeCorrelation.map(d => (
              <div key={d.level} className="flex items-center gap-3">
                <span className="text-sm w-6">{d.level === '高' ? '🔥' : d.level === '中' ? '⚡' : '🔋'}</span>
                <span className="text-[10px] text-muted-foreground w-12">{d.level}</span>
                <div className="flex-1 h-4 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all"
                    style={{ width: `${Math.min((d.avgIncome / Math.max(...energyIncomeCorrelation.map(x => x.avgIncome), 1)) * 100, 100)}%` }} />
                </div>
                <span className="text-xs font-mono-jb text-foreground w-20 text-right">{sym}{d.avgIncome}/{lang === "zh" ? "天" : "d"}</span>
              </div>
            ))}
          </div>
          <p className="text-[9px] text-muted-foreground mt-2">
            {t("wealth.energy_days", { days: energyIncomeCorrelation.reduce((s, d) => s + d.days, 0) })}
          </p>
        </div>
      )}

      {/* Financial literacy tip */}
      <div className="bg-card border border-primary/20 rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen size={14} className="text-primary" />
          <span className="text-xs text-primary font-serif-sc">{t("wealth.wisdom_title")} · {currentTip.level}</span>
        </div>
        <p className="text-xs text-foreground leading-[1.8] mb-2">{currentTip.tip}</p>
        <p className="text-[10px] text-muted-foreground leading-[1.6]">{currentTip.resource}</p>
      </div>

      {/* Wealth mindset */}
      <div className="bg-card border border-border rounded-xl p-4 mb-8">
        <h2 className="text-xs text-muted-foreground font-mono-jb mb-3">💡 {t("wealth.wisdom_checklist")}</h2>
        <div className="space-y-2 text-[11px] text-foreground leading-[1.8]">
          <p>• <strong className="text-primary">{t("wealth.asset_vs_liability")}</strong>：{t("wealth.asset_vs_liability_desc")}</p>
          <p>• <strong className="text-primary">{t("wealth.active_vs_passive")}</strong>：{t("wealth.active_vs_passive_desc")}</p>
          <p>• <strong className="text-primary">{t("wealth.time_vs_system")}</strong>：{t("wealth.time_vs_system_desc")}</p>
          <p>• <strong className="text-primary">{t("wealth.consume_vs_invest")}</strong>：{t("wealth.consume_vs_invest_desc")}</p>
        </div>
      </div>
    </div>
  );
};

export default WealthPage;
