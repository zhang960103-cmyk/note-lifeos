import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { format, subDays, startOfWeek, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isToday, parseISO, differenceInMinutes } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend } from "recharts";
import { ArrowLeft, Clock, TrendingUp, Sparkles, Loader2 } from "lucide-react";

const CATEGORY_COLORS: Record<string, string> = {
  "工作": "hsl(39 58% 53%)",
  "学习": "hsl(211 55% 60%)",
  "生活": "hsl(152 41% 49%)",
  "运动": "hsl(26 78% 57%)",
  "社交": "hsl(268 48% 63%)",
  "娱乐": "hsl(340 65% 65%)",
  "休息": "hsl(174 40% 51%)",
  "其他": "hsl(30 12% 37%)",
};

const TAG_TO_CATEGORY: Record<string, string> = {
  "工作": "工作", "项目": "工作", "会议": "工作", "方案": "工作", "客户": "工作",
  "学习": "学习", "阅读": "学习", "课程": "学习", "写作": "学习", "读书": "学习",
  "运动": "运动", "健身": "运动", "跑步": "运动", "锻炼": "运动",
  "社交": "社交", "朋友": "社交", "聚会": "社交",
  "娱乐": "娱乐", "游戏": "娱乐", "电影": "娱乐",
  "家": "生活", "家务": "生活", "购物": "生活", "做饭": "生活",
  "休息": "休息", "放松": "休息", "冥想": "休息",
};

type TimeRange = "today" | "week" | "month";

export default function TimeStatsPage() {
  const navigate = useNavigate();
  const { entries, allTodos } = useLifeOs();
  const [range, setRange] = useState<TimeRange>("week");
  const [touchStart, setTouchStart] = useState(0);

  const today = format(new Date(), "yyyy-MM-dd");

  // Analyze todos by category based on tags and text
  const categorize = (todo: typeof allTodos[0]): string => {
    // Check tags first
    for (const tag of todo.tags || []) {
      if (TAG_TO_CATEGORY[tag]) return TAG_TO_CATEGORY[tag];
    }
    // Check text content
    const text = todo.text.toLowerCase();
    for (const [keyword, category] of Object.entries(TAG_TO_CATEGORY)) {
      if (text.includes(keyword)) return category;
    }
    return "其他";
  };

  const filteredTodos = useMemo(() => {
    const now = new Date();
    let startDate: string;
    if (range === "today") {
      startDate = today;
    } else if (range === "week") {
      startDate = format(subDays(now, 6), "yyyy-MM-dd");
    } else {
      startDate = format(startOfMonth(now), "yyyy-MM-dd");
    }
    return allTodos.filter(t => {
      const d = t.completedAt?.split("T")[0] || t.sourceDate || "";
      return d >= startDate && d <= today;
    });
  }, [allTodos, range, today]);

  // Category breakdown for pie chart
  const categoryData = useMemo(() => {
    const map: Record<string, number> = {};
    filteredTodos.forEach(t => {
      const cat = categorize(t);
      map[cat] = (map[cat] || 0) + 1;
    });
    return Object.entries(map)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredTodos]);

  // Daily task count for bar chart
  const dailyData = useMemo(() => {
    const now = new Date();
    let days: string[];
    if (range === "today") {
      days = [today];
    } else if (range === "week") {
      days = Array.from({ length: 7 }, (_, i) => format(subDays(now, 6 - i), "yyyy-MM-dd"));
    } else {
      const start = startOfMonth(now);
      const end = endOfMonth(now);
      days = eachDayOfInterval({ start, end }).map(d => format(d, "yyyy-MM-dd"));
    }

    return days.map(d => {
      const dayTodos = allTodos.filter(t => {
        const td = t.completedAt?.split("T")[0] || t.sourceDate || "";
        return td === d;
      });
      const done = dayTodos.filter(t => t.status === "done").length;
      const total = dayTodos.length;
      return {
        date: d.slice(5), // MM-DD
        done,
        total,
      };
    });
  }, [allTodos, range, today]);

  // Emotion trend from entries
  const emotionTrend = useMemo(() => {
    const now = new Date();
    let days: string[];
    if (range === "today") {
      days = [today];
    } else if (range === "week") {
      days = Array.from({ length: 7 }, (_, i) => format(subDays(now, 6 - i), "yyyy-MM-dd"));
    } else {
      days = Array.from({ length: 30 }, (_, i) => format(subDays(now, 29 - i), "yyyy-MM-dd"));
    }
    return days.map(d => {
      const entry = entries.find(e => e.date === d);
      return {
        date: d.slice(5),
        score: entry?.emotionScore || 0,
        msgCount: entry?.messages.length || 0,
      };
    }).filter(d => d.score > 0 || d.msgCount > 0);
  }, [entries, range, today]);

  // Stats summary
  const stats = useMemo(() => {
    const total = filteredTodos.length;
    const done = filteredTodos.filter(t => t.status === "done").length;
    const topCategory = categoryData[0]?.name || "无数据";
    const avgEmotionArr = emotionTrend.filter(e => e.score > 0);
    const avgEmotion = avgEmotionArr.length > 0
      ? (avgEmotionArr.reduce((s, e) => s + e.score, 0) / avgEmotionArr.length).toFixed(1)
      : "--";
    const activeDays = emotionTrend.filter(e => e.msgCount > 0).length;
    return { total, done, topCategory, avgEmotion, activeDays };
  }, [filteredTodos, categoryData, emotionTrend]);

  return (
    <div
      className="flex flex-col h-full max-w-[700px] mx-auto"
      onTouchStart={e => setTouchStart(e.touches[0].clientX)}
      onTouchEnd={e => {
        const delta = e.changedTouches[0].clientX - touchStart;
        if (touchStart < 30 && delta > 70) navigate(-1);
      }}
    >
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={18} />
        </button>
        <span className="font-serif-sc text-lg text-foreground">时间都去哪了</span>
      </div>

      {/* Range tabs */}
      <div className="flex gap-1 px-4 mb-3">
        {([
          { key: "today" as TimeRange, label: "今天" },
          { key: "week" as TimeRange, label: "本周" },
          { key: "month" as TimeRange, label: "本月" },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setRange(t.key)}
            className={`text-xs px-3 py-1.5 rounded-full transition ${range === t.key ? "bg-gold text-background" : "bg-surface-2 text-muted-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">
        {/* Summary cards */}
        <div className="grid grid-cols-4 gap-2">
          <div className="bg-surface-2 border border-border rounded-xl p-2.5 text-center">
            <div className="text-lg font-mono-jb text-gold">{stats.done}</div>
            <div className="text-[9px] text-muted-foreground">已完成</div>
          </div>
          <div className="bg-surface-2 border border-border rounded-xl p-2.5 text-center">
            <div className="text-lg font-mono-jb text-foreground">{stats.total}</div>
            <div className="text-[9px] text-muted-foreground">总任务</div>
          </div>
          <div className="bg-surface-2 border border-border rounded-xl p-2.5 text-center">
            <div className="text-lg font-mono-jb text-los-blue">{stats.avgEmotion}</div>
            <div className="text-[9px] text-muted-foreground">情绪均值</div>
          </div>
          <div className="bg-surface-2 border border-border rounded-xl p-2.5 text-center">
            <div className="text-lg font-mono-jb text-los-green">{stats.activeDays}</div>
            <div className="text-[9px] text-muted-foreground">活跃天数</div>
          </div>
        </div>

        {/* Category pie chart */}
        <div className="bg-surface-2 border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="text-gold" />
            <span className="text-xs font-serif-sc text-foreground">时间分布</span>
          </div>
          {categoryData.length > 0 ? (
            <div className="flex items-center gap-4">
              <div className="w-[140px] h-[140px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={categoryData}
                      cx="50%" cy="50%"
                      innerRadius={35} outerRadius={60}
                      dataKey="value"
                      stroke="none"
                    >
                      {categoryData.map((entry, i) => (
                        <Cell key={i} fill={CATEGORY_COLORS[entry.name] || CATEGORY_COLORS["其他"]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="flex-1 space-y-1.5">
                {categoryData.map((d, i) => {
                  const total = categoryData.reduce((s, c) => s + c.value, 0);
                  const pct = Math.round((d.value / total) * 100);
                  return (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ background: CATEGORY_COLORS[d.name] || CATEGORY_COLORS["其他"] }} />
                      <span className="text-[10px] text-foreground flex-1">{d.name}</span>
                      <span className="text-[10px] font-mono-jb text-muted-foreground">{pct}%</span>
                      <span className="text-[9px] font-mono-jb text-muted-foreground/60">{d.value}项</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/50 text-center py-6">暂无数据</p>
          )}
        </div>

        {/* Daily trend bar chart */}
        <div className="bg-surface-2 border border-border rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={14} className="text-gold" />
            <span className="text-xs font-serif-sc text-foreground">每日完成趋势</span>
          </div>
          {dailyData.some(d => d.total > 0) ? (
            <div className="h-[160px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={dailyData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(30 12% 37%)" }} />
                  <YAxis tick={{ fontSize: 9, fill: "hsl(30 12% 37%)" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: "hsl(30 25% 8%)", border: "1px solid hsl(30 28% 11%)", borderRadius: "8px", fontSize: "11px" }}
                    labelStyle={{ color: "hsl(30 14% 78%)" }}
                  />
                  <Bar dataKey="done" name="已完成" fill="hsl(var(--gold))" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="total" name="总数" fill="hsl(30 25% 15%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/50 text-center py-6">暂无数据</p>
          )}
        </div>

        {/* Emotion line (simple visual) */}
        {emotionTrend.length > 1 && (
          <div className="bg-surface-2 border border-border rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm">💫</span>
              <span className="text-xs font-serif-sc text-foreground">情绪波动</span>
            </div>
            <div className="flex items-end gap-1 h-[80px]">
              {emotionTrend.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div
                    className="w-full rounded-t transition-all"
                    style={{
                      height: `${(d.score / 10) * 60}px`,
                      background: d.score >= 7 ? "hsl(152 41% 49%)" : d.score >= 4 ? "hsl(39 58% 53%)" : "hsl(5 71% 53%)",
                      minHeight: "4px",
                    }}
                  />
                  <span className="text-[7px] text-muted-foreground">{d.date.slice(-2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Most focused category insight */}
        {stats.topCategory !== "无数据" && (
          <div className="bg-surface-2 border border-border rounded-xl p-4">
            <p className="text-xs text-foreground">
              📊 这{range === "today" ? "天" : range === "week" ? "周" : "月"}你在「{stats.topCategory}」上花了最多精力
              {stats.done > 0 && `，完成了 ${stats.done} 项任务`}。
            </p>
            {Number(stats.avgEmotion) > 0 && Number(stats.avgEmotion) < 5 && (
              <p className="text-[10px] text-muted-foreground mt-1">
                情绪均值偏低，试试在日记里聊聊感受？
              </p>
            )}
          </div>
        )}

        {/* AI Analysis Section */}
        <AiAnalysis
          categoryData={categoryData}
          stats={stats}
          emotionTrend={emotionTrend}
          dailyData={dailyData}
          range={range}
        />
      </div>
    </div>
  );
}

/* ─── AI Analysis Component ─── */
function AiAnalysis({
  categoryData,
  stats,
  emotionTrend,
  dailyData,
  range,
}: {
  categoryData: { name: string; value: number }[];
  stats: { total: number; done: number; topCategory: string; avgEmotion: string; activeDays: number };
  emotionTrend: { date: string; score: number; msgCount: number }[];
  dailyData: { date: string; done: number; total: number }[];
  range: string;
}) {
  const [analysis, setAnalysis] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const buildContext = () => {
    const rangeName = range === "today" ? "今天" : range === "week" ? "本周" : "本月";
    const catBreakdown = categoryData.map(d => `${d.name}: ${d.value}项`).join("、");
    const completionRate = stats.total > 0 ? Math.round((stats.done / stats.total) * 100) : 0;
    const emotionInfo = emotionTrend.filter(e => e.score > 0);
    const avgEmotion = emotionInfo.length > 0
      ? (emotionInfo.reduce((s, e) => s + e.score, 0) / emotionInfo.length).toFixed(1)
      : "无数据";
    const dailySummary = dailyData.filter(d => d.total > 0).map(d => `${d.date}: 完成${d.done}/${d.total}`).join("；");

    return `时间范围：${rangeName}
任务总数：${stats.total}，已完成：${stats.done}，完成率：${completionRate}%
分类分布：${catBreakdown || "暂无数据"}
情绪均值：${avgEmotion}
活跃天数：${stats.activeDays}
每日明细：${dailySummary || "暂无"}`;
  };

  const runAnalysis = async () => {
    setLoading(true);
    setError("");
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/life-mentor-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: buildContext() }],
          mode: "time-analysis",
        }),
      });
      if (!resp.ok) throw new Error("分析失败");
      const data = await resp.json();
      setAnalysis(data);
    } catch {
      setError("AI 分析暂时不可用，请稍后再试");
    } finally {
      setLoading(false);
    }
  };

  if (!analysis && !loading) {
    return (
      <button
        onClick={runAnalysis}
        className="w-full bg-surface-2 border border-border rounded-xl p-4 flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-gold hover:border-gold/30 transition"
      >
        <Sparkles size={14} />
        <span className="font-serif-sc">AI 深度分析我的时间</span>
      </button>
    );
  }

  if (loading) {
    return (
      <div className="bg-surface-2 border border-border rounded-xl p-6 flex items-center justify-center gap-2">
        <Loader2 size={14} className="animate-spin text-gold" />
        <span className="text-xs text-muted-foreground">罗盘正在分析你的时间分布…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-surface-2 border border-border rounded-xl p-4">
        <p className="text-xs text-destructive text-center">{error}</p>
        <button onClick={runAnalysis} className="text-[10px] text-gold mt-2 mx-auto block">重试</button>
      </div>
    );
  }

  return (
    <div className="bg-surface-2 border border-gold/20 rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles size={14} className="text-gold" />
        <span className="text-xs font-serif-sc text-foreground">罗盘分析</span>
        <button onClick={runAnalysis} className="ml-auto text-[9px] text-muted-foreground/50 hover:text-gold">刷新</button>
      </div>

      {analysis.summary && (
        <p className="text-xs text-foreground/90 leading-relaxed">{analysis.summary}</p>
      )}

      {analysis.insights?.length > 0 && (
        <div className="space-y-2">
          {analysis.insights.map((ins: any, i: number) => (
            <div key={i} className="flex gap-2">
              <span className="text-sm flex-shrink-0">{ins.icon}</span>
              <div>
                <span className="text-[11px] text-foreground font-medium">{ins.title}</span>
                <p className="text-[10px] text-muted-foreground leading-relaxed">{ins.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {analysis.suggestions?.length > 0 && (
        <div className="border-t border-border pt-2 space-y-1.5">
          <span className="text-[10px] text-muted-foreground">💡 建议</span>
          {analysis.suggestions.map((s: any, i: number) => (
            <div key={i} className="pl-4">
              <p className="text-[11px] text-foreground">{s.action}</p>
              <p className="text-[9px] text-muted-foreground/60">{s.reason}</p>
            </div>
          ))}
        </div>
      )}

      {analysis.encouragement && (
        <p className="text-[10px] text-gold/80 text-center pt-1">✨ {analysis.encouragement}</p>
      )}
    </div>
  );
}
