import { useMemo, useState } from "react";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { format, parseISO, subDays, startOfMonth, endOfMonth, eachDayOfInterval, isWithinInterval } from "date-fns";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, PieChart, Pie, Cell } from "recharts";
import { TrendingUp, TrendingDown, Wallet, BookOpen, Trash2, Pencil, Check, X, Zap } from "lucide-react";

const COLORS = ["hsl(39,58%,53%)", "hsl(0,65%,55%)", "hsl(142,60%,45%)", "hsl(210,60%,50%)", "hsl(280,55%,55%)", "hsl(30,50%,45%)"];

const FINANCE_TIPS = [
  { level: "生存期", condition: (net: number) => net <= 0, tip: "你的支出≥收入，优先用「50-30-20法则」分配：50%必需、30%想要、20%储蓄", resource: "📚《小狗钱钱》— 最简单的理财入门，建立正确的金钱观" },
  { level: "积累期", condition: (net: number) => net > 0 && net < 5000, tip: "有储蓄是好的开始。下一步：建立3个月应急金，然后了解指数基金定投", resource: "📚《穷爸爸富爸爸》— 理解资产和负债的区别" },
  { level: "增长期", condition: (net: number) => net >= 5000 && net < 20000, tip: "你已经有了一定积累。考虑建立被动收入渠道：课程、内容、数字产品", resource: "📚《纳瓦尔宝典》— 用杠杆和复利实现财务自由" },
  { level: "自由期", condition: (net: number) => net >= 20000, tip: "优化资产配置，让钱为你工作。关注被动收入是否覆盖生活支出", resource: "📚《穷查理宝典》— 查理·芒格的多元思维模型" },
];

const WealthPage = () => {
  const { financeEntries, monthFinanceStats, deleteFinanceEntry, updateFinanceEntry, energyLogs } = useLifeOs();
  const [period, setPeriod] = useState<"week" | "month" | "all">("month");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editNote, setEditNote] = useState("");

  // Filter entries by period
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

  // Category breakdown (expenses)
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.filter(e => e.type === "expense").forEach(e => {
      map[e.category || "其他"] = (map[e.category || "其他"] || 0) + e.amount;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  }, [filtered]);

  // Daily trend
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

  // Income source breakdown
  const incomeData = useMemo(() => {
    const map: Record<string, number> = {};
    filtered.filter(e => e.type === "income").forEach(e => {
      map[e.category || "其他"] = (map[e.category || "其他"] || 0) + e.amount;
    });
    return Object.entries(map)
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value }));
  }, [filtered]);

  // Financial level tip
  const currentTip = useMemo(() => {
    for (const tip of FINANCE_TIPS) {
      if (tip.condition(stats.net)) return tip;
    }
    return FINANCE_TIPS[0];
  }, [stats.net]);

  // Passive income ratio
  const passiveRatio = useMemo(() => {
    const passive = filtered.filter(e => e.type === "income" && ["被动收入", "投资", "分红", "版税", "租金"].some(k => e.category?.includes(k) || e.note?.includes(k)));
    const totalIncome = stats.income;
    if (totalIncome === 0) return 0;
    return Math.round((passive.reduce((s, e) => s + e.amount, 0) / totalIncome) * 100);
  }, [filtered, stats.income]);

  return (
    <div className="h-full overflow-y-auto px-4 max-w-[600px] mx-auto pb-4">
      <div className="py-4">
        <h1 className="font-serif-sc text-lg text-foreground">财富看板</h1>
        <p className="text-[10px] text-muted-foreground">认知你的财务，升维你的财商</p>
      </div>

      {/* Period selector */}
      <div className="flex gap-1 mb-4">
        {([["week", "近7天"], ["month", "本月"], ["all", "全部"]] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setPeriod(key)}
            className={`text-xs px-3 py-1 rounded-full transition ${period === key ? "bg-gold text-background" : "bg-surface-2 text-muted-foreground"}`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="bg-surface-2 border border-border rounded-xl p-3 text-center">
          <TrendingUp size={14} className="text-los-green mx-auto mb-1" />
          <div className="text-lg text-los-green font-mono-jb">¥{stats.income}</div>
          <div className="text-[8px] text-muted-foreground">收入</div>
        </div>
        <div className="bg-surface-2 border border-border rounded-xl p-3 text-center">
          <TrendingDown size={14} className="text-los-orange mx-auto mb-1" />
          <div className="text-lg text-los-orange font-mono-jb">¥{stats.expense}</div>
          <div className="text-[8px] text-muted-foreground">支出</div>
        </div>
        <div className="bg-surface-2 border border-border rounded-xl p-3 text-center">
          <Wallet size={14} className="text-gold mx-auto mb-1" />
          <div className={`text-lg font-mono-jb ${stats.net >= 0 ? "text-los-green" : "text-los-orange"}`}>
            ¥{stats.net}
          </div>
          <div className="text-[8px] text-muted-foreground">净值</div>
        </div>
      </div>

      {/* Passive income indicator */}
      <div className="bg-surface-2 border border-border rounded-xl p-3 mb-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] text-muted-foreground">被动收入占比</span>
          <span className="text-xs text-gold font-mono-jb">{passiveRatio}%</span>
        </div>
        <div className="w-full h-1.5 bg-surface-3 rounded-full overflow-hidden">
          <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${Math.min(passiveRatio, 100)}%` }} />
        </div>
        <p className="text-[9px] text-muted-foreground mt-1.5">
          {passiveRatio === 0 ? "还没有被动收入记录，在对话中提到投资/分红/版税等会自动标记" :
           passiveRatio < 30 ? "被动收入还在起步，继续建设你的收入管道" :
           passiveRatio < 70 ? "不错的被动收入占比，继续优化" : "优秀！被动收入已占大头"}
        </p>
      </div>

      {/* Daily trend chart */}
      {dailyTrend.length > 1 && (
        <div className="bg-surface-2 border border-border rounded-xl p-4 mb-4">
          <h2 className="text-xs text-muted-foreground font-mono-jb mb-3">收支趋势</h2>
          <ResponsiveContainer width="100%" height={140}>
            <BarChart data={dailyTrend}>
              <XAxis dataKey="date" tick={{ fill: "hsl(30 12% 37%)", fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "hsl(30 12% 37%)", fontSize: 9 }} axisLine={false} tickLine={false} width={30} />
              <Tooltip
                contentStyle={{ background: "hsl(30 25% 8%)", border: "1px solid hsl(30 28% 11%)", borderRadius: 8, fontSize: 11, color: "hsl(30 14% 78%)" }}
              />
              <Bar dataKey="income" fill="hsl(142,60%,45%)" radius={[2, 2, 0, 0]} />
              <Bar dataKey="expense" fill="hsl(0,65%,55%)" radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Category breakdown */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        {categoryData.length > 0 && (
          <div className="bg-surface-2 border border-border rounded-xl p-3">
            <h2 className="text-[10px] text-muted-foreground mb-2">支出分类</h2>
            <ResponsiveContainer width="100%" height={100}>
              <PieChart>
                <Pie data={categoryData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={40} innerRadius={20}>
                  {categoryData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(30 25% 8%)", border: "none", borderRadius: 8, fontSize: 10, color: "hsl(30 14% 78%)" }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-0.5 mt-1">
              {categoryData.slice(0, 4).map((c, i) => (
                <div key={c.name} className="flex items-center gap-1 text-[9px]">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: COLORS[i % COLORS.length] }} />
                  <span className="text-muted-foreground flex-1">{c.name}</span>
                  <span className="text-foreground font-mono-jb">¥{c.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
        {incomeData.length > 0 && (
          <div className="bg-surface-2 border border-border rounded-xl p-3">
            <h2 className="text-[10px] text-muted-foreground mb-2">收入来源</h2>
            <ResponsiveContainer width="100%" height={100}>
              <PieChart>
                <Pie data={incomeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={40} innerRadius={20}>
                  {incomeData.map((_, i) => <Cell key={i} fill={COLORS[(i + 2) % COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(30 25% 8%)", border: "none", borderRadius: 8, fontSize: 10, color: "hsl(30 14% 78%)" }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-0.5 mt-1">
              {incomeData.slice(0, 4).map((c, i) => (
                <div key={c.name} className="flex items-center gap-1 text-[9px]">
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: COLORS[(i + 2) % COLORS.length] }} />
                  <span className="text-muted-foreground flex-1">{c.name}</span>
                  <span className="text-foreground font-mono-jb">¥{c.value}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Recent transactions */}
      <div className="bg-surface-2 border border-border rounded-xl p-3 mb-4">
        <h2 className="text-[10px] text-muted-foreground mb-2">最近记录</h2>
        {filtered.length === 0 ? (
          <p className="text-[10px] text-muted-foreground/60 text-center py-4">
            在对话中提到收支会自动记录<br />例如："今天上课赚了500" "买了本书花了40"
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
                    <input
                      value={editAmount}
                      onChange={e => setEditAmount(e.target.value)}
                      className="w-16 bg-surface-3 border border-border rounded px-1 py-0.5 text-xs font-mono-jb text-foreground"
                      type="number"
                    />
                    <input
                      value={editNote}
                      onChange={e => setEditNote(e.target.value)}
                      className="flex-1 bg-surface-3 border border-border rounded px-1 py-0.5 text-xs text-foreground"
                      placeholder="备注"
                    />
                    <button onClick={() => {
                      updateFinanceEntry(f.id, { amount: Number(editAmount), note: editNote });
                      setEditingId(null);
                    }} className="text-los-green"><Check size={12} /></button>
                    <button onClick={() => setEditingId(null)} className="text-muted-foreground"><X size={12} /></button>
                  </>
                ) : (
                  <>
                    <span className={f.type === "income" ? "text-los-green" : "text-los-orange"}>
                      {f.type === "income" ? "↑" : "↓"}
                    </span>
                    <span className="text-muted-foreground flex-1 truncate">{f.category} {f.note && `· ${f.note}`}</span>
                    <span className={`font-mono-jb ${f.type === "income" ? "text-los-green" : "text-los-orange"}`}>
                      {f.type === "income" ? "+" : "-"}¥{f.amount}
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

      {/* Financial literacy tip */}
      <div className="bg-surface-2 border border-gold-border rounded-xl p-4 mb-4">
        <div className="flex items-center gap-2 mb-2">
          <BookOpen size={14} className="text-gold" />
          <span className="text-xs text-gold font-serif-sc">财商升维 · {currentTip.level}</span>
        </div>
        <p className="text-xs text-foreground leading-[1.8] mb-2">{currentTip.tip}</p>
        <p className="text-[10px] text-muted-foreground leading-[1.6]">{currentTip.resource}</p>
      </div>

      {/* Wealth mindset */}
      <div className="bg-surface-2 border border-border rounded-xl p-4 mb-8">
        <h2 className="text-xs text-muted-foreground font-mono-jb mb-3">💡 财商认知清单</h2>
        <div className="space-y-2 text-[11px] text-foreground leading-[1.8]">
          <p>• <strong className="text-gold">资产 vs 负债</strong>：让你口袋里的钱增加的是资产，减少的是负债</p>
          <p>• <strong className="text-gold">主动 vs 被动</strong>：你停止工作后收入是否还在？</p>
          <p>• <strong className="text-gold">时间出租 vs 系统产出</strong>：按小时计费=出租，产品/内容复利=系统</p>
          <p>• <strong className="text-gold">消费 vs 投资</strong>：花钱前问自己——这笔钱3年后还在为我创造价值吗？</p>
        </div>
      </div>
    </div>
  );
};

export default WealthPage;
