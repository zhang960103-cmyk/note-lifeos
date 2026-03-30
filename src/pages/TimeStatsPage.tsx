import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { format, subDays, startOfMonth, endOfMonth, eachDayOfInterval } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, LineChart, Line, CartesianGrid } from "recharts";
import { ArrowLeft, Clock, TrendingUp, Sparkles, Loader2, CalendarClock, Flame, Target, Zap, Battery } from "lucide-react";

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
  const [touchStart, setTouchStart] = useState(0);

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

  const dailyData = useMemo(() => {
    const now = new Date();
    let days: string[];
    if (range === "today") days = [today];
    else if (range === "week") days = Array.from({ length: 7 }, (_, i) => format(subDays(now, 6 - i), "yyyy-MM-dd"));
    else {
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
      return { date: d.slice(5), done, total };
    });
  }, [allTodos, range, today]);

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

  // Productivity score (RescueTime-inspired)
  const productivityScore = useMemo(() => {
    if (stats.total === 0) return 0;
    const completionRate = stats.done / stats.total;
    const emotionBonus = Number(stats.avgEmotion) > 0 ? Number(stats.avgEmotion) / 10 * 0.2 : 0;
    const diversityBonus = Math.min(categoryData.length / 5, 1) * 0.1;
    return Math.round((completionRate * 0.7 + emotionBonus + diversityBonus) * 100);
  }, [stats, categoryData]);

  // Streak calculation
  const streak = useMemo(() => {
    let count = 0;
    const now = new Date();
    for (let i = 0; i < 60; i++) {
      const d = format(subDays(now, i), "yyyy-MM-dd");
      const hasActivity = entries.some(e => e.date === d && e.messages.length > 0);
      if (hasActivity) count++;
      else if (i > 0) break;
    }
    return count;
  }, [entries]);

  // Heatmap data (last 12 weeks)
  const heatmapData = useMemo(() => {
    const now = new Date();
    const weeks: { date: Date; count: number }[][] = [];
    const start = subDays(now, 83); // 12 weeks
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
      if (week.length === 7) {
        weeks.push(week);
        week = [];
      }
      current = new Date(current.getTime() + 86400000);
    }
    if (week.length > 0) weeks.push(week);
    return weeks;
  }, [entries, allTodos]);

  const maxActivity = useMemo(() => Math.max(1, ...heatmapData.flat().map(d => d.count)), [heatmapData]);

  // Stacked daily category breakdown
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
      cats.forEach(cat => {
        row[cat] = dayTodos.filter(t => categorize(t) === cat).length;
      });
      return row;
    });
  }, [allTodos, range, today]);

  const activeCats = useMemo(() => {
    const cats = new Set<string>();
    stackedDailyData.forEach(row => {
      Object.keys(CATEGORY_COLORS).forEach(cat => {
        if (row[cat] > 0) cats.add(cat);
      });
    });
    return Array.from(cats);
  }, [stackedDailyData]);

  const getHeatColor = (count: number) => {
    if (count === 0) return "hsl(30 25% 8%)";
    const intensity = count / maxActivity;
    if (intensity < 0.25) return "hsl(39 58% 53% / 0.2)";
    if (intensity < 0.5) return "hsl(39 58% 53% / 0.4)";
    if (intensity < 0.75) return "hsl(39 58% 53% / 0.65)";
    return "hsl(39 58% 53% / 0.9)";
  };

  const scoreColor = productivityScore >= 70 ? "text-los-green" : productivityScore >= 40 ? "text-gold" : "text-los-red";
  const scoreLabel = productivityScore >= 70 ? "高效" : productivityScore >= 40 ? "正常" : "待提升";

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

      {/* Time Range Tabs */}
      <div className="flex gap-1 px-4 mb-3">
        {([
          { key: "today" as TimeRange, label: "今天" },
          { key: "week" as TimeRange, label: "本周" },
          { key: "month" as TimeRange, label: "本月" },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setRange(t.key)}
            className={`text-xs px-3 py-1.5 rounded-full transition ${range === t.key ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-6 space-y-4">
        {/* ─── Hero: Productivity Score ─── */}
        <div className="bg-card border border-border rounded-2xl p-5 flex items-center gap-5">
          <div className="relative w-[88px] h-[88px]">
            <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
              <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--border))" strokeWidth="7" />
              <circle
                cx="50" cy="50" r="42" fill="none"
                stroke="hsl(var(--primary))"
                strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={`${productivityScore * 2.64} 264`}
                className="transition-all duration-1000"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={`text-2xl font-mono-jb font-bold ${scoreColor}`}>{productivityScore}</span>
              <span className="text-[8px] text-muted-foreground">{scoreLabel}</span>
            </div>
          </div>
          <div className="flex-1 grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <Target size={11} className="text-primary" />
                <span className="text-[9px] text-muted-foreground">完成率</span>
              </div>
              <span className="text-lg font-mono-jb text-foreground">
                {stats.total > 0 ? Math.round(stats.done / stats.total * 100) : 0}%
              </span>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <Flame size={11} className="text-los-orange" />
                <span className="text-[9px] text-muted-foreground">连续打卡</span>
              </div>
              <span className="text-lg font-mono-jb text-foreground">{streak}天</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <Zap size={11} className="text-los-blue" />
                <span className="text-[9px] text-muted-foreground">情绪均值</span>
              </div>
              <span className="text-lg font-mono-jb text-foreground">{stats.avgEmotion}</span>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-0.5">
                <Clock size={11} className="text-los-green" />
                <span className="text-[9px] text-muted-foreground">活跃天数</span>
              </div>
              <span className="text-lg font-mono-jb text-foreground">{stats.activeDays}</span>
            </div>
          </div>
        </div>

        {/* ─── Activity Heatmap (GitHub-style) ─── */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <CalendarClock size={14} className="text-primary" />
            <span className="text-xs font-serif-sc text-foreground">活跃热力图</span>
            <span className="ml-auto text-[8px] text-muted-foreground">近 12 周</span>
          </div>
          <div className="flex gap-[3px] overflow-x-auto pb-1">
            {heatmapData.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {week.map((day, di) => (
                  <div
                    key={di}
                    className="w-[10px] h-[10px] rounded-[2px] transition-colors"
                    style={{ background: getHeatColor(day.count) }}
                    title={`${format(day.date, "MM-dd")}: ${day.count} 项活动`}
                  />
                ))}
              </div>
            ))}
          </div>
          <div className="flex items-center justify-end gap-1.5 mt-2">
            <span className="text-[7px] text-muted-foreground">少</span>
            {[0, 0.2, 0.4, 0.65, 0.9].map((op, i) => (
              <div
                key={i}
                className="w-[8px] h-[8px] rounded-[2px]"
                style={{ background: i === 0 ? "hsl(30 25% 8%)" : `hsl(39 58% 53% / ${op})` }}
              />
            ))}
            <span className="text-[7px] text-muted-foreground">多</span>
          </div>
        </div>

        {/* ─── Energy Curve Chart ─── */}
        {energyLogs.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Battery size={14} className="text-los-green" />
              <span className="text-xs font-serif-sc text-foreground">精力曲线</span>
              <span className="ml-auto text-[8px] text-muted-foreground">近 7 天</span>
            </div>
            <ResponsiveContainer width="100%" height={160}>
              <LineChart data={(() => {
                const levelToNum = (l: string) => l === '高' ? 3 : l === '中' ? 2 : l === '低' ? 1 : 0;
                const sevenDaysAgo = subDays(new Date(), 7);
                return energyLogs
                  .filter(l => new Date(l.timestamp) >= sevenDaysAgo)
                  .sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
                  .map(l => ({
                    time: format(new Date(l.timestamp), "M/d HH:mm"),
                    level: levelToNum(l.level),
                    label: l.level,
                  }));
              })()}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="time" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} axisLine={false} tickLine={false} />
                <YAxis
                  domain={[0, 3]}
                  ticks={[0, 1, 2, 3]}
                  tickFormatter={(v: number) => ['透支', '低', '中', '高'][v] || ''}
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }}
                  axisLine={false}
                  tickLine={false}
                  width={30}
                />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }}
                  formatter={(value: number) => [['透支', '低', '中', '高'][value] || '', '精力']}
                />
                <Line type="monotone" dataKey="level" stroke="hsl(39 58% 53%)" strokeWidth={2} dot={{ fill: "hsl(39 58% 53%)", r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* ─── Diary Timeline ─── */}
        <DiaryTimeline entries={entries} today={today} />

        {/* ─── Category Pie (爱时间-style with center label) ─── */}
        <div className="bg-card border border-border rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <Clock size={14} className="text-primary" />
            <span className="text-xs font-serif-sc text-foreground">时间分布</span>
          </div>
          {categoryData.length > 0 ? (
            <div className="flex items-center gap-4">
              <div className="relative w-[140px] h-[140px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={categoryData} cx="50%" cy="50%" innerRadius={38} outerRadius={62} dataKey="value" stroke="none" paddingAngle={2}>
                      {categoryData.map((entry, i) => (
                        <Cell key={i} fill={CATEGORY_COLORS[entry.name] || CATEGORY_COLORS["其他"]} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <span className="text-xl font-mono-jb font-bold text-foreground">{stats.done}</span>
                  <span className="text-[8px] text-muted-foreground">已完成</span>
                </div>
              </div>
              <div className="flex-1 space-y-2">
                {categoryData.map((d) => {
                  const total = categoryData.reduce((s, c) => s + c.value, 0);
                  const pct = Math.round((d.value / total) * 100);
                  return (
                    <div key={d.name} className="space-y-0.5">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CATEGORY_COLORS[d.name] || CATEGORY_COLORS["其他"] }} />
                          <span className="text-[10px] text-foreground">{d.name}</span>
                        </div>
                        <span className="text-[10px] font-mono-jb text-muted-foreground">{pct}%</span>
                      </div>
                      <div className="h-[3px] rounded-full bg-secondary ml-4">
                        <div
                          className="h-full rounded-full transition-all duration-500"
                          style={{
                            width: `${pct}%`,
                            background: CATEGORY_COLORS[d.name] || CATEGORY_COLORS["其他"],
                          }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground/50 text-center py-6">暂无数据</p>
          )}
        </div>

        {/* ─── Stacked Category Bar (Toggl-style) ─── */}
        {activeCats.length > 0 && (
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp size={14} className="text-primary" />
              <span className="text-xs font-serif-sc text-foreground">每日分类明细</span>
            </div>
            <div className="h-[180px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stackedDailyData} margin={{ top: 5, right: 5, bottom: 5, left: -20 }}>
                  <XAxis dataKey="date" tick={{ fontSize: 8, fill: "hsl(30 12% 37%)" }} />
                  <YAxis tick={{ fontSize: 8, fill: "hsl(30 12% 37%)" }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: "hsl(30 25% 8%)", border: "1px solid hsl(30 28% 11%)", borderRadius: "8px", fontSize: "10px" }}
                    labelStyle={{ color: "hsl(30 14% 78%)" }}
                  />
                  {activeCats.map(cat => (
                    <Bar key={cat} dataKey={cat} stackId="a" fill={CATEGORY_COLORS[cat] || CATEGORY_COLORS["其他"]} radius={0} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2 justify-center">
              {activeCats.map(cat => (
                <div key={cat} className="flex items-center gap-1">
                  <div className="w-2 h-2 rounded-sm" style={{ background: CATEGORY_COLORS[cat] }} />
                  <span className="text-[8px] text-muted-foreground">{cat}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Emotion Wave ─── */}
        {emotionTrend.length > 1 && (
          <div className="bg-card border border-border rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <span className="text-sm">💫</span>
              <span className="text-xs font-serif-sc text-foreground">情绪波动</span>
            </div>
            <div className="flex items-end gap-[3px] h-[70px]">
              {emotionTrend.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div className="opacity-0 group-hover:opacity-100 absolute -top-5 bg-card border border-border rounded px-1.5 py-0.5 text-[8px] text-foreground whitespace-nowrap z-10 transition">
                    {d.date} · {d.score}分
                  </div>
                  <div
                    className="w-full rounded-t transition-all"
                    style={{
                      height: `${(d.score / 10) * 55}px`,
                      background: d.score >= 7 ? "hsl(var(--los-green))" : d.score >= 4 ? "hsl(var(--gold))" : "hsl(var(--los-red))",
                      minHeight: "3px",
                    }}
                  />
                  <span className="text-[6px] text-muted-foreground">{d.date.slice(-2)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Smart Insight ─── */}
        {stats.topCategory !== "无数据" && (
          <div className="bg-card border border-primary/20 rounded-2xl p-4 space-y-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm">📊</span>
              <span className="text-xs font-serif-sc text-foreground">洞察</span>
            </div>
            <p className="text-xs text-foreground/90 leading-relaxed">
              这{range === "today" ? "天" : range === "week" ? "周" : "月"}你在「{stats.topCategory}」上花了最多精力
              {stats.done > 0 && `，完成了 ${stats.done} 项任务`}。
              {productivityScore >= 70 && " 效率非常棒，继续保持！🎯"}
              {productivityScore >= 40 && productivityScore < 70 && " 节奏还不错，可以再聚焦一些。"}
              {productivityScore < 40 && " 试试把精力集中在最重要的事上？"}
            </p>
            {Number(stats.avgEmotion) > 0 && Number(stats.avgEmotion) < 5 && (
              <p className="text-[10px] text-muted-foreground">
                情绪均值偏低，试试在日记里聊聊感受？
              </p>
            )}
            {streak >= 7 && (
              <p className="text-[10px] text-primary">
                🔥 已连续记录 {streak} 天，太棒了！
              </p>
            )}
          </div>
        )}

        {/* ─── AI Deep Analysis ─── */}
        <AiAnalysis categoryData={categoryData} stats={stats} emotionTrend={emotionTrend} dailyData={dailyData} range={range} />
      </div>
    </div>
  );
}

/* ─── Diary Timeline Component ─── */
function DiaryTimeline({ entries, today }: { entries: any[]; today: string }) {
  const { allTodos, updateTodo, todayKey } = useLifeOs();
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [extracted, setExtracted] = useState(false);
  const [summary, setSummary] = useState("");
  const [matchedCount, setMatchedCount] = useState(0);

  const todayEntry = entries.find(e => e.date === today);
  const hasMessages = todayEntry && todayEntry.messages.length > 0;

  // Auto-match time blocks to todos and update their notes
  const matchBlocksToTodos = (blocks: TimeBlock[]) => {
    let matched = 0;
    blocks.forEach(block => {
      // Find matching todo by fuzzy text match
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
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: todayEntry.messages.map((m: any) => ({ role: m.role, content: m.content })),
          mode: "time-extract",
        }),
      });
      if (!resp.ok) throw new Error("提取失败");
      const data = await resp.json();
      const blocks = data.timeBlocks || [];
      setTimeBlocks(blocks);
      setSummary(data.summary || "");
      setExtracted(true);
      // Auto-match to todos
      if (blocks.length > 0) {
        matchBlocksToTodos(blocks);
      }
    } catch {
      setTimeBlocks([]);
    } finally {
      setLoading(false);
    }
  };

  if (!hasMessages) return null;

  if (!extracted && !loading) {
    return (
      <button
        onClick={extractTimeline}
        className="w-full bg-card border border-border rounded-2xl p-4 flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-primary hover:border-primary/30 transition"
      >
        <CalendarClock size={14} />
        <span className="font-serif-sc">从今日日记提取时间线</span>
      </button>
    );
  }

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 flex items-center justify-center gap-2">
        <Loader2 size={14} className="animate-spin text-primary" />
        <span className="text-xs text-muted-foreground">正在从日记中提取时间线…</span>
      </div>
    );
  }

  if (timeBlocks.length === 0) {
    return (
      <div className="bg-card border border-border rounded-2xl p-4 text-center">
        <p className="text-xs text-muted-foreground/50">日记中未发现可提取的时间信息</p>
      </div>
    );
  }

  const totalMinutes = timeBlocks.reduce((s, b) => s + b.durationMinutes, 0);
  const totalHours = (totalMinutes / 60).toFixed(1);

  return (
    <div className="bg-card border border-border rounded-2xl p-4">
      <div className="flex items-center gap-2 mb-1">
        <CalendarClock size={14} className="text-primary" />
        <span className="text-xs font-serif-sc text-foreground">今日时间线</span>
        <span className="ml-auto text-[9px] text-muted-foreground font-mono-jb">{totalHours}h</span>
        <button onClick={extractTimeline} className="text-[9px] text-muted-foreground/50 hover:text-primary">刷新</button>
      </div>
      {summary && <p className="text-[10px] text-muted-foreground mb-3">{summary}</p>}
      {matchedCount > 0 && (
        <p className="text-[10px] text-los-green mb-2">✅ 已自动匹配 {matchedCount} 条待办的用时</p>
      )}
      {/* Horizontal stacked bar overview */}
      <div className="h-[6px] rounded-full bg-secondary mb-3 flex overflow-hidden">
        {timeBlocks.map((block, i) => (
          <div
            key={i}
            className="h-full transition-all"
            style={{
              width: `${(block.durationMinutes / totalMinutes) * 100}%`,
              background: CATEGORY_COLORS[block.category] || CATEGORY_COLORS["其他"],
            }}
            title={`${block.activity} ${block.durationMinutes}min`}
          />
        ))}
      </div>

      <div className="relative pl-6 space-y-0">
        {timeBlocks.map((block, i) => (
          <div key={i} className="relative flex gap-3 pb-3 last:pb-0">
            {i < timeBlocks.length - 1 && (
              <div className="absolute left-[-14px] top-[14px] w-[1px] bg-border" style={{ height: "calc(100%)" }} />
            )}
            <div
              className="absolute left-[-17px] top-[4px] w-[7px] h-[7px] rounded-full border-2 border-background"
              style={{ background: CATEGORY_COLORS[block.category] || CATEGORY_COLORS["其他"] }}
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono-jb text-muted-foreground whitespace-nowrap">
                  {block.startTime}-{block.endTime}
                </span>
                <span className="text-[10px] text-foreground truncate">{block.activity}</span>
              </div>
              <div className="flex items-center gap-2 mt-0.5">
                <span
                  className="text-[8px] px-1.5 py-0.5 rounded-full"
                  style={{
                    background: `${CATEGORY_COLORS[block.category] || CATEGORY_COLORS["其他"]}20`,
                    color: CATEGORY_COLORS[block.category] || CATEGORY_COLORS["其他"],
                  }}
                >
                  {block.category}
                </span>
                <span className="text-[8px] text-muted-foreground/50 font-mono-jb">{block.durationMinutes}min</span>
                {block.note && <span className="text-[8px] text-muted-foreground/40 truncate">{block.note}</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ─── AI Analysis Component ─── */
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
    const dailySummary = dailyData.filter(d => d.total > 0).map(d => `${d.date}: 完成${d.done}/${d.total}`).join("；");
    return `时间范围：${rangeName}\n任务总数：${stats.total}，已完成：${stats.done}，完成率：${completionRate}%\n分类分布：${catBreakdown || "暂无数据"}\n情绪均值：${avgEmotion}\n活跃天数：${stats.activeDays}\n每日明细：${dailySummary || "暂无"}`;
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
        body: JSON.stringify({ messages: [{ role: "user", content: buildContext() }], mode: "time-analysis" }),
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
        className="w-full bg-card border border-border rounded-2xl p-4 flex items-center justify-center gap-2 text-xs text-muted-foreground hover:text-primary hover:border-primary/30 transition"
      >
        <Sparkles size={14} />
        <span className="font-serif-sc">AI 深度分析我的时间</span>
      </button>
    );
  }

  if (loading) {
    return (
      <div className="bg-card border border-border rounded-2xl p-6 flex items-center justify-center gap-2">
        <Loader2 size={14} className="animate-spin text-primary" />
        <span className="text-xs text-muted-foreground">罗盘正在分析你的时间分布…</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-card border border-border rounded-2xl p-4">
        <p className="text-xs text-destructive text-center">{error}</p>
        <button onClick={runAnalysis} className="text-[10px] text-primary mt-2 mx-auto block">重试</button>
      </div>
    );
  }

  return (
    <div className="bg-card border border-primary/20 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Sparkles size={14} className="text-primary" />
        <span className="text-xs font-serif-sc text-foreground">罗盘分析</span>
        <button onClick={runAnalysis} className="ml-auto text-[9px] text-muted-foreground/50 hover:text-primary">刷新</button>
      </div>
      {analysis.summary && <p className="text-xs text-foreground/90 leading-relaxed">{analysis.summary}</p>}
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
        <p className="text-[10px] text-primary/80 text-center pt-1">✨ {analysis.encouragement}</p>
      )}
    </div>
  );
}
