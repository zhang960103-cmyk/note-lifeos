import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval, startOfWeek, addDays } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, CartesianGrid } from "recharts";
import { ArrowLeft, Clock, TrendingUp, Sparkles, Loader2, CalendarClock, Flame, Target, Zap, Battery, Search, Timer, Pencil, Check, X } from "lucide-react";
import QuickTimeEntry from "@/components/QuickTimeEntry";

const CATEGORY_COLORS: Record<string, string> = {
  "工作": "hsl(39 58% 53%)",
  "学习": "hsl(211 55% 60%)",
  "生活": "hsl(152 41% 49%)",
  "运动": "hsl(26 78% 57%)",
  "社交": "hsl(268 48% 63%)",
  "娱乐": "hsl(340 65% 65%)",
  "休息": "hsl(174 40% 51%)",
  "通勤": "hsl(45 50% 45%)",
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
type TimeBlock = {
  activity: string;
  category: string;
  startTime: string;
  endTime: string;
  durationMinutes: number;
  note?: string;
};

export default function TimeStatsPage() {
  const navigate = useNavigate();
  const { entries, allTodos, energyLogs } = useLifeOs();
  const [range, setRange] = useState<TimeRange>("week");
  const [showQuickEntry, setShowQuickEntry] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [viewMode, setViewMode] = useState<"overview" | "week">("overview");

  const today = format(new Date(), "yyyy-MM-dd");

  const categorize = (todo: typeof allTodos[0]): string => {
    for (const tag of todo.tags || []) {
      if (TAG_TO_CATEGORY[tag]) return TAG_TO_CATEGORY[tag];
    }
    const text = todo.text.toLowerCase();
    for (const [keyword, category] of Object.entries(TAG_TO_CATEGORY)) {
      if (text.includes(keyword)) return category;
    }
    return "其他";
  };

  const filteredTodos = useMemo(() => {
    const now = new Date();
    let startDate: string;
    if (range === "today") startDate = today;
    else if (range === "week") startDate = format(subDays(now, 6), "yyyy-MM-dd");
    else startDate = format(startOfMonth(now), "yyyy-MM-dd");
    return allTodos.filter(t => {
      const d = t.completedAt?.split("T")[0] || t.sourceDate || "";
      return d >= startDate && d <= today;
    });
  }, [allTodos, range, today]);

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

  const emotionTrend = useMemo(() => {
    const now = new Date();
    let days: string[];
    if (range === "today") days = [today];
    else if (range === "week") days = Array.from({ length: 7 }, (_, i) => format(subDays(now, 6 - i), "yyyy-MM-dd"));
    else days = Array.from({ length: 30 }, (_, i) => format(subDays(now, 29 - i), "yyyy-MM-dd"));
    return days.map(d => {
      const entry = entries.find(e => e.date === d);
      return { date: d.slice(5), score: entry?.emotionScore || 0, msgCount: entry?.messages.length || 0 };
    }).filter(d => d.score > 0 || d.msgCount > 0);
  }, [entries, range, today]);

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

  const productivityScore = useMemo(() => {
    if (stats.total === 0) return 0;
    const completionRate = stats.done / stats.total;
    const emotionBonus = Number(stats.avgEmotion) > 0 ? Number(stats.avgEmotion) / 10 * 0.2 : 0;
    const diversityBonus = Math.min(categoryData.length / 5, 1) * 0.1;
    return Math.round((completionRate * 0.7 + emotionBonus + diversityBonus) * 100);
  }, [stats, categoryData]);

  const streak = useMemo(() => {
    let count = 0;
    const now = new Date();
    for (let i = 0; i < 60; i++) {
      const d = format(subDays(now, i), "yyyy-MM-dd");
      const hasActivity = entries.some(e => e.date === d && e.messages.length > 0) ||
        allTodos.some(t => t.completedAt?.split("T")[0] === d);
      if (hasActivity) count++;
      else if (i > 0) break;
    }
    return count;
  }, [entries, allTodos]);

  // Compact heatmap (last 8 weeks instead of 12)
  const heatmapData = useMemo(() => {
    const now = new Date();
    const weeks: { date: Date; count: number }[][] = [];
    const start = subDays(now, 55); // 8 weeks
    let current = start;
    let week: { date: Date; count: number }[] = [];
    while (current <= now) {
      const d = format(current, "yyyy-MM-dd");
      const entry = entries.find(e => e.date === d);
      const todoCount = allTodos.filter(t => {
        const td = t.completedAt?.split("T")[0] || t.sourceDate || "";
        return td === d && t.status === "done";
      }).length;
      const activity = (entry?.messages.length || 0) + todoCount;
      week.push({ date: new Date(current), count: activity });
      if (week.length === 7) { weeks.push(week); week = []; }
      current = new Date(current.getTime() + 86400000);
    }
    if (week.length > 0) weeks.push(week);
    return weeks;
  }, [entries, allTodos]);

  const maxActivity = useMemo(() => Math.max(1, ...heatmapData.flat().map(d => d.count)), [heatmapData]);

  const dailyData = useMemo(() => {
    const now = new Date();
    let days: string[];
    if (range === "today") days = [today];
    else if (range === "week") days = Array.from({ length: 7 }, (_, i) => format(subDays(now, 6 - i), "yyyy-MM-dd"));
    else days = eachDayOfInterval({ start: startOfMonth(now), end: endOfMonth(now) }).map(d => format(d, "yyyy-MM-dd"));
    return days.map(d => {
      const dayTodos = allTodos.filter(t => {
        const td = t.completedAt?.split("T")[0] || t.sourceDate || "";
        return td === d;
      });
      const done = dayTodos.filter(t => t.status === "done").length;
      return { date: d.slice(5), done, total: dayTodos.length };
    });
  }, [allTodos, range, today]);

  // Stacked daily
  const stackedDailyData = useMemo(() => {
    const now = new Date();
    const days = range === "today" ? [today]
      : range === "week" ? Array.from({ length: 7 }, (_, i) => format(subDays(now, 6 - i), "yyyy-MM-dd"))
      : eachDayOfInterval({ start: startOfMonth(now), end: endOfMonth(now) }).map(d => format(d, "yyyy-MM-dd"));
    const cats = Object.keys(CATEGORY_COLORS);
    return days.map(d => {
      const dayTodos = allTodos.filter(t => {
        const td = t.completedAt?.split("T")[0] || t.sourceDate || "";
        return td === d && t.status === "done";
      });
      const row: Record<string, any> = { date: d.slice(5) };
      cats.forEach(cat => { row[cat] = dayTodos.filter(t => categorize(t) === cat).length; });
      return row;
    });
  }, [allTodos, range, today]);

  const activeCats = useMemo(() => {
    const cats = new Set<string>();
    stackedDailyData.forEach(row => {
      Object.keys(CATEGORY_COLORS).forEach(cat => { if (row[cat] > 0) cats.add(cat); });
    });
    return Array.from(cats);
  }, [stackedDailyData]);

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return allTodos.filter(t => {
      const text = t.text.toLowerCase();
      const note = (t.note || "").toLowerCase();
      const tags = (t.tags || []).join(" ").toLowerCase();
      return text.includes(q) || note.includes(q) || tags.includes(q);
    }).slice(0, 20);
  }, [allTodos, searchQuery]);

  // Week view
  const weekViewData = useMemo(() => {
    const now = new Date();
    const ws = startOfWeek(now, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => {
      const d = addDays(ws, i);
      const dateStr = format(d, "yyyy-MM-dd");
      const dayTodos = allTodos.filter(t => {
        const td = t.completedAt?.split("T")[0] || t.sourceDate || "";
        return td === dateStr && t.status === "done";
      });
      const blocks = dayTodos.map(t => {
        const cat = categorize(t);
        const timeMatch = t.note?.match(/⏱\s*(\d{1,2}:\d{2})-(\d{1,2}:\d{2})/);
        if (timeMatch) {
          const [, start, end] = timeMatch;
          const [sh, sm] = start.split(":").map(Number);
          const [eh, em] = end.split(":").map(Number);
          return { startHour: sh + sm / 60, endHour: eh + em / 60, category: cat, text: t.text };
        }
        return null;
      }).filter(Boolean);
      return { date: dateStr, label: ["一", "二", "三", "四", "五", "六", "日"][i], blocks };
    });
  }, [allTodos]);

  const getHeatColor = (count: number) => {
    if (count === 0) return "hsl(var(--muted))";
    const intensity = count / maxActivity;
    if (intensity < 0.25) return "hsl(var(--primary) / 0.2)";
    if (intensity < 0.5) return "hsl(var(--primary) / 0.4)";
    if (intensity < 0.75) return "hsl(var(--primary) / 0.65)";
    return "hsl(var(--primary) / 0.9)";
  };

  const scoreColor = productivityScore >= 70 ? "text-los-green" : productivityScore >= 40 ? "text-primary" : "text-destructive";
  const scoreLabel = productivityScore >= 70 ? "高效" : productivityScore >= 40 ? "正常" : "待提升";

  return (
    <div className="flex flex-col h-full max-w-[700px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground">
          <ArrowLeft size={18} />
        </button>
        <span className="font-serif-sc text-base text-foreground">时间都去哪了</span>
        <div className="ml-auto flex gap-1">
          <button onClick={() => setShowSearch(!showSearch)}
            className={`p-1.5 rounded-lg transition ${showSearch ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>
            <Search size={15} />
          </button>
          <button onClick={() => setShowQuickEntry(!showQuickEntry)}
            className={`p-1.5 rounded-lg transition ${showQuickEntry ? "bg-primary/10 text-primary" : "text-muted-foreground"}`}>
            <Timer size={15} />
          </button>
        </div>
      </div>

      {/* Search */}
      {showSearch && (
        <div className="px-4 mb-2">
          <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
            placeholder="搜索活动、备注、标签..."
            autoFocus
            className="w-full bg-muted border border-border rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary" />
          {searchResults.length > 0 && (
            <div className="mt-2 bg-card border border-border rounded-xl max-h-[160px] overflow-y-auto">
              {searchResults.map(t => (
                <div key={t.id} className="px-3 py-1.5 border-b border-border last:border-0">
                  <p className="text-[11px] text-foreground">{t.text}</p>
                  <span className="text-[9px] text-muted-foreground">{t.sourceDate || t.completedAt?.split("T")[0]}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 px-4 mb-3 justify-between">
        <div className="flex gap-1">
          {(["today", "week", "month"] as TimeRange[]).map(key => (
            <button key={key} onClick={() => setRange(key)}
              className={`text-[11px] px-3 py-1 rounded-full transition ${range === key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {key === "today" ? "今天" : key === "week" ? "本周" : "本月"}
            </button>
          ))}
        </div>
        <div className="flex gap-1">
          <button onClick={() => setViewMode("overview")}
            className={`text-[10px] px-2 py-1 rounded-full transition ${viewMode === "overview" ? "bg-primary/20 text-primary" : "text-muted-foreground"}`}>概览</button>
          <button onClick={() => setViewMode("week")}
            className={`text-[10px] px-2 py-1 rounded-full transition ${viewMode === "week" ? "bg-primary/20 text-primary" : "text-muted-foreground"}`}>周视图</button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-3">
        {showQuickEntry && <QuickTimeEntry onClose={() => setShowQuickEntry(false)} />}

        {/* Week View */}
        {viewMode === "week" && (
          <div className="bg-card border border-border rounded-2xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <CalendarClock size={13} className="text-primary" />
              <span className="text-[11px] font-serif-sc text-foreground">周时间色块</span>
            </div>
            <div className="flex gap-[2px]">
              <div className="flex flex-col justify-between text-[6px] text-muted-foreground pr-0.5" style={{ height: 180 }}>
                {[6, 12, 18, 24].map(h => <span key={h}>{h}</span>)}
              </div>
              {weekViewData.map((day, di) => (
                <div key={di} className="flex-1 flex flex-col">
                  <span className={`text-[7px] text-center mb-0.5 ${day.date === today ? "text-primary font-bold" : "text-muted-foreground"}`}>{day.label}</span>
                  <div className="relative bg-muted rounded flex-1" style={{ height: 180 }}>
                    {(day.blocks as any[]).map((block: any, bi: number) => {
                      const top = ((block.startHour - 6) / 18) * 100;
                      const height = ((block.endHour - block.startHour) / 18) * 100;
                      return (
                        <div key={bi} className="absolute left-0.5 right-0.5 rounded-sm"
                          style={{ top: `${Math.max(0, top)}%`, height: `${Math.max(2, height)}%`, background: CATEGORY_COLORS[block.category] || CATEGORY_COLORS["其他"], opacity: 0.8 }}
                          title={block.text} />
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Hero Score - more compact */}
        <div className="bg-card border border-border rounded-2xl p-4 flex items-center gap-4">
          <div className="relative w-16 h-16 flex-shrink-0">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
              <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--primary))" strokeWidth="8" strokeLinecap="round"
                strokeDasharray={`${productivityScore * 2.64} 264`} className="transition-all duration-1000" />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-lg font-mono-jb font-bold ${scoreColor}`}>{productivityScore}</span>
              <span className="text-[7px] text-muted-foreground">{scoreLabel}</span>
            </div>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-2">
            {[
              { icon: <Target size={10} className="text-primary" />, label: "完成率", value: `${stats.total > 0 ? Math.round(stats.done / stats.total * 100) : 0}%` },
              { icon: <Flame size={10} className="text-los-orange" />, label: "连续", value: `${streak}天` },
              { icon: <Zap size={10} className="text-los-blue" />, label: "情绪", value: stats.avgEmotion },
              { icon: <Clock size={10} className="text-los-green" />, label: "活跃", value: `${stats.activeDays}天` },
            ].map((s, i) => (
              <div key={i} className="flex items-center gap-1.5">
                {s.icon}
                <div>
                  <div className="text-[8px] text-muted-foreground">{s.label}</div>
                  <div className="text-sm font-mono-jb text-foreground leading-none">{s.value}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Compact Heatmap */}
        <div className="bg-card border border-border rounded-2xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <CalendarClock size={12} className="text-primary" />
            <span className="text-[11px] font-serif-sc text-foreground">活跃热力图</span>
            <span className="ml-auto text-[7px] text-muted-foreground">近 8 周</span>
          </div>
          <div className="flex gap-[2px] overflow-x-auto">
            {heatmapData.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[2px]">
                {week.map((day, di) => (
                  <div key={di} className="w-[8px] h-[8px] rounded-[1.5px]"
                    style={{ background: getHeatColor(day.count) }}
                    title={`${format(day.date, "MM-dd")}: ${day.count}`} />
                ))}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-end gap-1 mt-1.5">
            <span className="text-[6px] text-muted-foreground">少</span>
            {[0, 0.2, 0.4, 0.65, 0.9].map((op, i) => (
              <div key={i} className="w-[6px] h-[6px] rounded-[1px]"
                style={{ background: i === 0 ? "hsl(var(--muted))" : `hsl(var(--primary) / ${op})` }} />
            ))}
            <span className="text-[6px] text-muted-foreground">多</span>
          </div>
        </div>

        {/* Compact Energy Curve */}
        {energyLogs.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <Battery size={12} className="text-los-green" />
              <span className="text-[11px] font-serif-sc text-foreground">精力曲线</span>
            </div>
            <ResponsiveContainer width="100%" height={100}>
              <LineChart data={(() => {
                const levelToNum = (l: string) => l === '高' ? 3 : l === '中' ? 2 : l === '低' ? 1 : 0;
                const sevenDaysAgo = subDays(new Date(), 7);
                return energyLogs
                  .filter(l => new Date(l.timestamp) >= sevenDaysAgo)
                  .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                  .map(l => ({ time: format(new Date(l.timestamp), "M/d"), level: levelToNum(l.level) }));
              })()}>
                <XAxis dataKey="time" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 8 }} axisLine={false} tickLine={false} />
                <YAxis domain={[0, 3]} ticks={[1, 2, 3]} tickFormatter={(v: number) => ['', '低', '中', '高'][v] || ''}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 8 }} axisLine={false} tickLine={false} width={24} />
                <Line type="monotone" dataKey="level" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ fill: "hsl(var(--primary))", r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Diary Timeline - auto-extracted, editable */}
        <DiaryTimeline entries={entries} today={today} />

        {/* Category Pie - compact */}
        <div className="bg-card border border-border rounded-2xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={12} className="text-primary" />
            <span className="text-[11px] font-serif-sc text-foreground">时间分布</span>
          </div>
          {categoryData.length > 0 ? (
            <div className="flex items-center gap-3">
              <div className="relative w-[100px] h-[100px] flex-shrink-0">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={30} outerRadius={45} dataKey="value" stroke="none" paddingAngle={2}>
                      {categoryData.map((entry, i) => (
                        <Cell key={i} fill={CATEGORY_COLORS[entry.name] || CATEGORY_COLORS["其他"]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-base font-mono-jb font-bold text-foreground">{stats.done}</span>
                  <span className="text-[7px] text-muted-foreground">完成</span>
                </div>
              </div>
              <div className="flex-1 space-y-1.5">
                {categoryData.slice(0, 5).map(d => {
                  const total = categoryData.reduce((s, c) => s + c.value, 0);
                  const pct = Math.round((d.value / total) * 100);
                  return (
                    <div key={d.name} className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: CATEGORY_COLORS[d.name] || CATEGORY_COLORS["其他"] }} />
                      <span className="text-[10px] text-foreground flex-1">{d.name}</span>
                      <span className="text-[9px] font-mono-jb text-muted-foreground">{pct}%</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-[11px] text-muted-foreground/50 text-center py-4">暂无数据</p>
          )}
        </div>

        {/* Stacked Bar - compact */}
        {activeCats.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-3">
            <div className="flex items-center gap-2 mb-2">
              <TrendingUp size={12} className="text-primary" />
              <span className="text-[11px] font-serif-sc text-foreground">每日分类</span>
            </div>
            <div className="h-[120px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stackedDailyData} margin={{ top: 2, right: 2, bottom: 2, left: -25 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 7, fill: "hsl(var(--muted-foreground))" }} />
                  <YAxis tick={{ fontSize: 7, fill: "hsl(var(--muted-foreground))" }} allowDecimals={false} />
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 10 }} />
                  {activeCats.map(cat => (
                    <Bar key={cat} dataKey={cat} stackId="a" fill={CATEGORY_COLORS[cat] || CATEGORY_COLORS["其他"]} radius={0} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Emotion mini-bar */}
        {emotionTrend.length > 1 && (
          <div className="bg-card border border-border rounded-2xl p-3">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-sm">💫</span>
                <span className="text-[11px] font-serif-sc text-foreground">情绪波动</span>
              </div>
              <button onClick={() => navigate("/insights")} className="text-[9px] text-primary">详细 →</button>
            </div>
            <div className="flex items-end gap-[2px] h-[36px]">
              {emotionTrend.slice(-14).map((d, i) => (
                <div key={i} className="flex-1">
                  <div className="w-full rounded-t transition-all"
                    style={{
                      height: `${(d.score / 10) * 32}px`,
                      background: d.score >= 7 ? "hsl(var(--los-green))" : d.score >= 4 ? "hsl(var(--primary))" : "hsl(var(--destructive))",
                      minHeight: "2px",
                    }} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Smart Insight */}
        {stats.topCategory !== "无数据" && (
          <div className="bg-card border border-primary/20 rounded-2xl p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm">📊</span>
              <span className="text-[11px] font-serif-sc text-foreground">洞察</span>
            </div>
            <p className="text-[11px] text-foreground/90 leading-relaxed">
              这{range === "today" ? "天" : range === "week" ? "周" : "月"}你在「{stats.topCategory}」上花了最多精力
              {stats.done > 0 && `，完成了 ${stats.done} 项任务`}。
              {productivityScore >= 70 && " 效率非常棒！🎯"}
              {productivityScore >= 40 && productivityScore < 70 && " 节奏不错，可以再聚焦一些。"}
              {productivityScore < 40 && " 试试集中精力在最重要的事上？"}
            </p>
          </div>
        )}

        {/* AI Analysis */}
        <AiAnalysis categoryData={categoryData} stats={stats} emotionTrend={emotionTrend} dailyData={dailyData} range={range} />
      </div>
    </div>
  );
}

/* ─── Diary Timeline - auto-extracted with editable blocks ─── */
function DiaryTimeline({ entries, today }: { entries: any[]; today: string }) {
  const { allTodos, updateTodo, todayKey } = useLifeOs();
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [extracted, setExtracted] = useState(false);
  const [summary, setSummary] = useState("");
  const [matchedCount, setMatchedCount] = useState(0);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editBlock, setEditBlock] = useState<TimeBlock | null>(null);

  const todayEntry = entries.find((e: any) => e.date === today);
  const hasMessages = todayEntry && todayEntry.messages.length > 0;

  const matchBlocksToTodos = (blocks: TimeBlock[]) => {
    let matched = 0;
    blocks.forEach(block => {
      const matchingTodo = allTodos.find(t => {
        const text = t.text.toLowerCase();
        const activity = block.activity.toLowerCase();
        return activity.includes(text) || text.includes(activity) ||
          activity.split(/\s+/).some(w => w.length > 2 && text.includes(w));
      });
      if (matchingTodo) {
        const timeNote = `⏱ ${block.startTime}-${block.endTime} (${block.durationMinutes}分钟)`;
        const existingNote = matchingTodo.note || "";
        if (!existingNote.includes("⏱")) {
          updateTodo(matchingTodo.sourceDate || todayKey, matchingTodo.id, {
            note: existingNote ? `${existingNote}\n${timeNote}` : timeNote,
          });
          matched++;
        }
      }
    });
    setMatchedCount(matched);
  };

  const extractTimeline = async () => {
    if (!todayEntry) return;
    setLoading(true);
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/life-mentor-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({
          messages: todayEntry.messages.map((m: any) => ({ role: m.role, content: m.content })),
          mode: "time-extract",
        }),
      });
      if (!resp.ok) throw new Error();
      const data = await resp.json();
      const blocks = data.timeBlocks || [];
      setTimeBlocks(blocks);
      setSummary(data.summary || "");
      setExtracted(true);
      if (blocks.length > 0) matchBlocksToTodos(blocks);
    } catch {
      setTimeBlocks([]);
    } finally {
      setLoading(false);
    }
  };

  // Auto-extract on mount if today has messages
  useMemo(() => {
    if (hasMessages && !extracted && !loading) {
      extractTimeline();
    }
  }, [hasMessages]);

  const saveEdit = (idx: number) => {
    if (!editBlock) return;
    const newBlocks = [...timeBlocks];
    // Recalculate duration
    const [sh, sm] = editBlock.startTime.split(":").map(Number);
    const [eh, em] = editBlock.endTime.split(":").map(Number);
    const dur = (eh * 60 + em) - (sh * 60 + sm);
    newBlocks[idx] = { ...editBlock, durationMinutes: Math.max(dur, 1) };
    setTimeBlocks(newBlocks);
    setEditingIdx(null);
    setEditBlock(null);
  };

  if (!hasMessages) return null;

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-center gap-2">
        <Loader2 size={14} className="animate-spin text-primary" />
        <span className="text-[11px] text-muted-foreground">提取时间线…</span>
      </div>
    );
  }

  if (timeBlocks.length === 0 && extracted) {
    return (
      <div className="bg-card border border-border rounded-2xl p-3 text-center">
        <p className="text-[11px] text-muted-foreground/50">日记中未发现时间信息</p>
        <button onClick={extractTimeline} className="text-[10px] text-primary mt-1">重新提取</button>
      </div>
    );
  }

  if (timeBlocks.length === 0) return null;

  const totalMinutes = timeBlocks.reduce((s, b) => s + b.durationMinutes, 0);
  const totalHours = (totalMinutes / 60).toFixed(1);

  return (
    <div className="bg-card border border-primary/20 rounded-2xl p-3">
      <div className="flex items-center gap-2 mb-1">
        <CalendarClock size={12} className="text-primary" />
        <span className="text-[11px] font-serif-sc text-foreground">今日时间线</span>
        <span className="ml-auto text-[9px] text-muted-foreground font-mono-jb">{totalHours}h</span>
        <button onClick={extractTimeline} className="text-[9px] text-muted-foreground/50 hover:text-primary">刷新</button>
      </div>
      {summary && <p className="text-[10px] text-muted-foreground mb-2">{summary}</p>}
      {matchedCount > 0 && <p className="text-[9px] text-los-green mb-2">✅ 已匹配 {matchedCount} 条待办用时</p>}

      {/* Compact stacked bar */}
      <div className="h-[4px] rounded-full bg-muted mb-2 flex overflow-hidden">
        {timeBlocks.map((block, i) => (
          <div key={i} className="h-full"
            style={{ width: `${(block.durationMinutes / totalMinutes) * 100}%`, background: CATEGORY_COLORS[block.category] || CATEGORY_COLORS["其他"] }}
            title={`${block.activity} ${block.durationMinutes}min`} />
        ))}
      </div>

      {/* Editable timeline entries */}
      <div className="space-y-1">
        {timeBlocks.map((block, i) => (
          <div key={i} className="flex items-center gap-2 group">
            <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{ background: CATEGORY_COLORS[block.category] || CATEGORY_COLORS["其他"] }} />
            {editingIdx === i && editBlock ? (
              <div className="flex-1 flex items-center gap-1">
                <input value={editBlock.startTime} onChange={e => setEditBlock({ ...editBlock, startTime: e.target.value })}
                  className="w-12 bg-muted border border-border rounded px-1 py-0.5 text-[9px] text-foreground font-mono-jb" />
                <span className="text-[9px] text-muted-foreground">-</span>
                <input value={editBlock.endTime} onChange={e => setEditBlock({ ...editBlock, endTime: e.target.value })}
                  className="w-12 bg-muted border border-border rounded px-1 py-0.5 text-[9px] text-foreground font-mono-jb" />
                <input value={editBlock.activity} onChange={e => setEditBlock({ ...editBlock, activity: e.target.value })}
                  className="flex-1 bg-muted border border-border rounded px-1 py-0.5 text-[9px] text-foreground" />
                <button onClick={() => saveEdit(i)} className="text-los-green"><Check size={12} /></button>
                <button onClick={() => { setEditingIdx(null); setEditBlock(null); }} className="text-muted-foreground"><X size={12} /></button>
              </div>
            ) : (
              <>
                <span className="text-[9px] font-mono-jb text-muted-foreground w-[72px] flex-shrink-0">{block.startTime}-{block.endTime}</span>
                <span className="text-[10px] text-foreground flex-1 truncate">{block.activity}</span>
                <span className="text-[8px] text-muted-foreground font-mono-jb">{block.durationMinutes}m</span>
                <button onClick={() => { setEditingIdx(i); setEditBlock({ ...block }); }}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-opacity">
                  <Pencil size={10} />
                </button>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── AI Analysis ─── */
function AiAnalysis({
  categoryData, stats, emotionTrend, dailyData, range,
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
      ? (emotionInfo.reduce((s, e) => s + e.score, 0) / emotionInfo.length).toFixed(1) : "无数据";
    return `时间范围：${rangeName}\n任务总数：${stats.total}，已完成：${stats.done}，完成率：${completionRate}%\n分类分布：${catBreakdown || "暂无"}\n情绪均值：${avgEmotion}\n活跃天数：${stats.activeDays}`;
  };

  const runAnalysis = async () => {
    setLoading(true);
    setError("");
    try {
      const resp = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/life-mentor-chat`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ messages: [{ role: "user", content: buildContext() }], mode: "time-analysis" }),
      });
      if (!resp.ok) throw new Error();
      setAnalysis(await resp.json());
    } catch { setError("AI 分析暂不可用"); } finally { setLoading(false); }
  };

  if (!analysis && !loading) {
    return (
      <button onClick={runAnalysis}
        className="w-full bg-card border border-border rounded-2xl p-3 flex items-center justify-center gap-2 text-[11px] text-muted-foreground hover:text-primary hover:border-primary/30 transition">
        <Sparkles size={13} />
        <span className="font-serif-sc">AI 深度分析</span>
      </button>
    );
  }

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-4 flex items-center justify-center gap-2">
        <Loader2 size={14} className="animate-spin text-primary" />
        <span className="text-[11px] text-muted-foreground">分析中…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card border border-border rounded-2xl p-3 text-center">
        <p className="text-[11px] text-destructive">{error}</p>
        <button onClick={runAnalysis} className="text-[10px] text-primary mt-1">重试</button>
      </div>
    );
  }

  return (
    <div className="bg-card border border-primary/20 rounded-2xl p-3 space-y-2">
      <div className="flex items-center gap-2">
        <Sparkles size={12} className="text-primary" />
        <span className="text-[11px] font-serif-sc text-foreground">罗盘分析</span>
        <button onClick={runAnalysis} className="ml-auto text-[9px] text-muted-foreground/50 hover:text-primary">刷新</button>
      </div>
      {analysis.summary && <p className="text-[11px] text-foreground/90 leading-relaxed">{analysis.summary}</p>}
      {analysis.insights?.map((ins: any, i: number) => (
        <div key={i} className="flex gap-2">
          <span className="text-sm flex-shrink-0">{ins.icon}</span>
          <div>
            <span className="text-[10px] text-foreground font-medium">{ins.title}</span>
            <p className="text-[9px] text-muted-foreground leading-relaxed">{ins.detail}</p>
          </div>
        </div>
      ))}
      {analysis.suggestions?.length > 0 && (
        <div className="border-t border-border pt-2 space-y-1">
          <span className="text-[9px] text-muted-foreground">💡 建议</span>
          {analysis.suggestions.map((s: any, i: number) => (
            <p key={i} className="text-[10px] text-foreground pl-3">{s.action}</p>
          ))}
        </div>
      )}
      {analysis.encouragement && <p className="text-[9px] text-primary/80 text-center">✨ {analysis.encouragement}</p>}
    </div>
  );
}
