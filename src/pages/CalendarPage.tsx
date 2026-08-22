/**
 * 日历 + 时间统计 合并页
 * 上半：周视图日历（看当下安排）
 * 下半：选中日的时间分析（看时间去向）
 * 互通：日历点击日期 → 下方实时更新统计
 */
import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { format, addDays, subDays, startOfWeek, startOfMonth, endOfMonth,
         eachDayOfInterval, parseISO } from "date-fns";
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area,
         XAxis, YAxis, Tooltip } from "recharts";
import { ChevronLeft, ChevronRight, Download, Flame, Target, Zap } from "lucide-react";

// ─── 颜色 & 分类 ────────────────────────────────────────────────────────────
const COLORS = ["hsl(39,58%,53%)", "hsl(211,55%,60%)", "hsl(152,41%,49%)",
                "hsl(26,78%,57%)", "hsl(268,48%,63%)", "hsl(340,65%,65%)", "hsl(174,40%,51%)"];

const TAG_TO_CATEGORY: Record<string, string> = {
  工作: "工作", 开会: "工作", 会议: "工作", 报告: "工作", 方案: "工作", 项目: "工作",
  学习: "学习", 阅读: "学习", 读书: "学习", 课程: "学习", 培训: "学习",
  运动: "运动", 健身: "运动", 跑步: "运动", 锻炼: "运动",
  吃饭: "生活", 购物: "生活", 家务: "生活", 休息: "生活",
  娱乐: "娱乐", 游戏: "娱乐", 刷手机: "娱乐",
  社交: "社交", 朋友: "社交", 聊天: "社交",
};

function categorize(t: any): string {
  if (t.tags?.length) for (const tag of t.tags) if (TAG_TO_CATEGORY[tag]) return TAG_TO_CATEGORY[tag];
  for (const [kw, cat] of Object.entries(TAG_TO_CATEGORY)) if (t.text?.includes(kw)) return cat;
  return "其他";
}

function localDateStr(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

const DAY_LABEL_KEYS = [
  "calendar.day_sun", "calendar.day_mon", "calendar.day_tue", "calendar.day_wed",
  "calendar.day_thu", "calendar.day_fri", "calendar.day_sat",
];

// 固定分类标签（内部用中文做匹配 key，展示时需要走翻译，见 CATEGORY_LABEL_KEYS）
const CATEGORY_LABEL_KEYS: Record<string, string> = {
  "工作": "calendar.category_work",
  "学习": "calendar.category_study",
  "运动": "calendar.category_exercise",
  "生活": "calendar.category_life",
  "娱乐": "calendar.category_entertainment",
  "社交": "calendar.category_social",
  "其他": "calendar.category_other",
};
const HOURS = Array.from({ length: 16 }, (_, i) => i + 7); // 7–22
const CELL_H = 44;

export default function CalendarPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const { allTodos, entries, energyLogs, habits } = useLifeOs();
  const todayStr = localDateStr(new Date());

  // ── 状态 ──
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [view, setView] = useState<"calendar" | "stats" | "drip">("calendar");
  const nowLineRef = useRef<HTMLDivElement>(null);

  // 计算周起点（本地时间，避免时区问题）
  const weekStart = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const diffToMon = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const mon = new Date(now);
    mon.setDate(now.getDate() + diffToMon + weekOffset * 7);
    mon.setHours(0,0,0,0);
    return mon;
  }, [weekOffset]);

  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)), [weekStart]);

  // ── 时间块（日历视图用）──
  const timeBlocks = useMemo(() => {
    const blocks: any[] = [];
    days.forEach((day, dayIndex) => {
      const dateStr = localDateStr(day);
      const entry = entries.find(e => e.date === dateStr);
      allTodos.filter(t => (t.sourceDate === dateStr || t.dueDate === dateStr) && t.dueTime)
        .forEach(t => {
          const [h, m] = t.dueTime.split(":").map(Number);
          blocks.push({ id: `todo-${t.id}`, dayIndex, startMin: h*60+m, endMin: h*60+m+60,
            label: t.text, done: t.status === "done",
            color: t.status === "done" ? "bg-los-green/25 border-los-green/50 text-los-green"
              : t.priority === "urgent" ? "bg-destructive/20 border-destructive/40 text-destructive"
              : "bg-primary/20 border-primary/40 text-primary" });
        });
      if (entry) entry.todos.filter((t: any) => t.note?.includes("⏱")).forEach((t: any) => {
        const m = t.note.match(/⏱ (\d{1,2}:\d{2})-(\d{1,2}:\d{2})/);
        if (m) {
          const [sh, sm] = m[1].split(":").map(Number);
          const [eh, em] = m[2].split(":").map(Number);
          blocks.push({ id: `diary-${t.id}`, dayIndex, startMin: sh*60+sm, endMin: eh*60+em,
            label: t.text, done: true, color: "bg-gold/20 border-gold/40 text-foreground" });
        }
      });
    });
    return blocks;
  }, [days, allTodos, entries]);

  // ── 选中日的数据 ──
  const selectedTodos = useMemo(() =>
    allTodos.filter(t => {
      const d = t.completedAt?.slice(0,10) || t.sourceDate || "";
      return d === selectedDate;
    }), [allTodos, selectedDate]);

  const selectedEntry = useMemo(() => entries.find(e => e.date === selectedDate), [entries, selectedDate]);

  const selectedCategoryData = useMemo(() => {
    const map: Record<string, number> = {};
    selectedTodos.forEach(t => {
      const cat = categorize(t);
      const mins = parseInt(t.note?.match(/\((\d+)分钟\)/)?.[1] || "30");
      map[cat] = (map[cat] || 0) + mins;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a,b) => b.value-a.value);
  }, [selectedTodos]);

  const selectedTotalMin = selectedCategoryData.reduce((s,c) => s+c.value, 0);

  // ── 周统计 ──
  const weekRange = useMemo(() => {
    const dates = days.map(localDateStr);
    return { start: dates[0], end: dates[6], dates };
  }, [days]);

  const weekTodos = useMemo(() =>
    allTodos.filter(t => {
      const d = t.completedAt?.slice(0,10) || t.sourceDate || "";
      return d >= weekRange.start && d <= weekRange.end;
    }), [allTodos, weekRange]);

  const weekCategoryData = useMemo(() => {
    const map: Record<string, number> = {};
    weekTodos.forEach(t => {
      const cat = categorize(t);
      const mins = parseInt(t.note?.match(/\((\d+)分钟\)/)?.[1] || "30");
      map[cat] = (map[cat] || 0) + mins;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value })).sort((a,b) => b.value-a.value);
  }, [weekTodos]);

  const weekTotalMin = weekCategoryData.reduce((s,c) => s+c.value, 0);

  // ── DRIP矩阵 ──
  const dripMatrix = useMemo(() => {
    const HV = ["工作","学习","运动","阅读","写作","项目","课程","目标","创作"];
    const LD = ["通勤","会议","家务","杂事","等待","刷手机","娱乐","游戏","其他"];
    const q = {
      drive:    { label:t("calendar.quadrant_drive_label"), desc:t("calendar.quadrant_drive_desc"), emoji:"🚀", color:"hsl(142,60%,45%)", min:0, items:[] as string[] },
      delegate: { label:t("calendar.quadrant_delegate_label"), desc:t("calendar.quadrant_delegate_desc"), emoji:"⚡", color:"hsl(39,58%,53%)", min:0, items:[] as string[] },
      delight:  { label:t("calendar.quadrant_delight_label"), desc:t("calendar.quadrant_delight_desc"), emoji:"✨", color:"hsl(210,60%,50%)", min:0, items:[] as string[] },
      drain:    { label:t("calendar.quadrant_drain_label"), desc:t("calendar.quadrant_drain_desc"), emoji:"🔋", color:"hsl(0,65%,55%)",  min:0, items:[] as string[] },
    };
    const todos = view === "stats" ? selectedTodos : weekTodos;
    todos.forEach(t => {
      const hv = HV.some(k => t.tags?.includes(k) || t.text?.includes(k));
      const ld = LD.some(k => t.tags?.includes(k) || t.text?.includes(k));
      const mins = parseInt(t.note?.match(/\((\d+)分钟\)/)?.[1] || "30");
      const key = hv && !ld ? "drive" : hv && ld ? "delegate" : !hv && !ld ? "delight" : "drain";
      q[key].min += mins; q[key].items.push(t.text);
    });
    return q;
  }, [selectedTodos, weekTodos, view, t]);

  // ── 精力×时间交叉 ──
  const energyTimeData = useMemo(() => {
    const ENERGY_MAP: Record<string, number> = { "高": 3, "中": 2, "低": 1 };
    return weekRange.dates.map(date => {
      const log = energyLogs.find(l => l.timestamp?.slice(0,10) === date);
      const done = allTodos.filter(t => (t.completedAt?.slice(0,10) || t.sourceDate) === date && t.status === "done").length;
      const mins = allTodos.filter(t => (t.completedAt?.slice(0,10) || t.sourceDate) === date)
        .reduce((s,t) => s + parseInt(t.note?.match(/\((\d+)分钟\)/)?.[1] || "0"), 0);
      return { date: date.slice(5), energy: ENERGY_MAP[log?.level || ""] || 0, done, mins };
    });
  }, [weekRange, energyLogs, allTodos]);

  // ── 习惯完成率 ──
  const habitStats = useMemo(() => {
    if (!habits.length) return null;
    const rate = habits.map(h => {
      const expected = weekRange.dates.filter(d => h.targetDays.includes(new Date(d).getDay())).length;
      const done = h.checkIns.filter(c => c >= weekRange.start && c <= weekRange.end).length;
      return { name: h.name, emoji: h.emoji, rate: expected > 0 ? Math.round(done/expected*100) : 0 };
    });
    return rate;
  }, [habits, weekRange]);

  // iCal 导出
  const exportIcal = () => {
    const lines = ["BEGIN:VCALENDAR","VERSION:2.0","PRODID:-//罗盘 Life OS//ZH"];
    allTodos.filter(t => t.dueDate && t.dueTime && t.status !== "dropped").forEach(t => {
      const dt = `${t.dueDate!.replace(/-/g,"")}T${t.dueTime!.replace(":","00")}`;
      lines.push("BEGIN:VEVENT",`DTSTART:${dt}`,`DTEND:${dt}`,`SUMMARY:${t.text}`,"END:VEVENT");
    });
    lines.push("END:VCALENDAR");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([lines.join("\r\n")],{type:"text/calendar"}));
    a.download = "lifeos.ics"; a.click();
  };

  // 进入页面滚动到当前时刻
  useEffect(() => { nowLineRef.current?.scrollIntoView({ behavior:"smooth", block:"center" }); }, []);

  const todayIdx = days.findIndex(d => localDateStr(d) === todayStr);
  const now = new Date();
  const nowMin = now.getHours()*60 + now.getMinutes();

  return (
    <div className="flex flex-col h-full max-w-[900px] mx-auto">

      {/* ── 顶部导航栏 ── */}
      <div className="flex items-center gap-1 px-3 h-[48px] border-b border-border flex-shrink-0 bg-surface-1/90 backdrop-blur-sm">
        <button onClick={() => setWeekOffset(w => w-1)} className="touch-target text-muted-foreground hover:text-foreground rounded-xl" style={{transform:"scale(0.8)"}}>
          <ChevronLeft size={20} />
        </button>
        <button onClick={() => { setWeekOffset(0); setSelectedDate(todayStr); }}
          className="text-xs px-2 py-1 bg-muted rounded-lg text-muted-foreground hover:bg-accent">{t("calendar.this_week")}</button>
        <button onClick={() => setWeekOffset(w => w+1)} className="touch-target text-muted-foreground hover:text-foreground rounded-xl" style={{transform:"scale(0.8)"}}>
          <ChevronRight size={20} />
        </button>
        <span className="text-sm font-serif-sc text-foreground flex-1">
          {format(weekStart,t("calendar.date_format"))} – {format(addDays(weekStart,6),t("calendar.date_format"))}
        </span>
        {/* 视图切换 */}
        <div className="flex gap-0.5 bg-muted rounded-lg p-0.5">
          {(["calendar","stats","drip"] as const).map(v => (
            <button key={v} onClick={() => setView(v)}
              className={`text-label px-2 py-1 rounded transition ${view===v ? "bg-background text-foreground shadow-sm" : "text-muted-foreground"}`}>
              {v==="calendar" ? t("calendar.view_calendar") : v==="stats" ? t("calendar.view_stats") : t("calendar.view_drip")}
            </button>
          ))}
        </div>
        <button onClick={exportIcal} className="touch-target text-muted-foreground hover:text-primary rounded-xl" style={{transform:"scale(0.8)"}}>
          <Download size={16} />
        </button>
      </div>

      {/* ── 日期行 ── */}
      <div className="flex border-b border-border flex-shrink-0 bg-surface-1" style={{ paddingLeft: view==="calendar" ? 32 : 0 }}>
        {days.map((day, i) => {
          const dateStr = localDateStr(day);
          const isToday = dateStr === todayStr;
          const isSelected = dateStr === selectedDate;
          // 之前只看 allTodos，只写了日记但没有待办的那天会完全没有小圆点提示，
          // 看起来像"这天什么都没做"，其实只是没生成待办。
          const hasActivity = allTodos.some(t => (t.completedAt?.slice(0,10)||t.sourceDate) === dateStr)
            || entries.some(e => e.date === dateStr);
          return (
            <button key={i} onClick={() => setSelectedDate(dateStr)}
              className={`flex-1 text-center py-1.5 transition ${isSelected && !isToday ? "bg-primary/10" : ""}`}>
              <div className={`text-label ${isToday ? "text-primary font-bold" : "text-muted-foreground"}`}>
                {t(DAY_LABEL_KEYS[day.getDay()])}
              </div>
              <div className={`text-sm font-mono-jb mx-auto w-6 h-6 flex items-center justify-center rounded-full mt-0.5
                ${isToday ? "bg-primary text-primary-foreground font-bold" : isSelected ? "bg-primary/20 text-primary" : "text-foreground"}`}>
                {day.getDate()}
              </div>
              {hasActivity && <div className="w-1 h-1 rounded-full bg-primary/50 mx-auto mt-0.5" />}
            </button>
          );
        })}
      </div>

      {/* ── 主体内容 ── */}
      <div className="flex-1 overflow-y-auto scrollbar-none">

        {/* ═══ 日历视图 ═══ */}
        {view === "calendar" && (
          <div className="relative flex" style={{ height: HOURS.length * CELL_H }}>
            {/* 时间标签 */}
            <div className="flex-shrink-0 w-8 select-none">
              {HOURS.map(h => (
                <div key={h} className="flex items-start justify-end pr-1" style={{ height:CELL_H, paddingTop:3 }}>
                  <span className="text-label text-muted-foreground/50 font-mono-jb">{h}</span>
                </div>
              ))}
            </div>
            {/* 日列 */}
            <div className="flex flex-1 relative">
              {HOURS.map(h => (
                <div key={h} className="absolute inset-x-0 border-t border-border/20" style={{ top:(h-7)*CELL_H }} />
              ))}
              {days.map((day, dayIndex) => {
                const dateStr = localDateStr(day);
                const isSelected = dateStr === selectedDate;
                const colBlocks = timeBlocks.filter(b => b.dayIndex === dayIndex);
                return (
                  <div key={dayIndex} onClick={() => setSelectedDate(dateStr)}
                    className={`flex-1 relative border-l border-border/20 cursor-pointer transition
                      ${isSelected ? "bg-primary/[0.06]" : "hover:bg-surface-2/30"}`}>
                    {colBlocks.map(block => {
                      const top = ((block.startMin/60)-7)*CELL_H;
                      const height = Math.max(((block.endMin-block.startMin)/60)*CELL_H, 20);
                      return (
                        <div key={block.id} className={`absolute inset-x-0.5 rounded border text-left px-1 overflow-hidden ${block.color}`}
                          style={{ top, height }}>
                          <span className="text-label font-medium line-clamp-2 leading-tight">{block.label}</span>
                        </div>
                      );
                    })}
                    {/* 当前时刻红线 */}
                    {dateStr === todayStr && nowMin >= 7*60 && nowMin <= 22*60 && (
                      <div ref={nowLineRef} className="absolute inset-x-0 flex items-center z-20 pointer-events-none"
                        style={{ top: ((nowMin/60)-7)*CELL_H }}>
                        <div className="w-2 h-2 rounded-full bg-destructive" />
                        <div className="flex-1 h-px bg-destructive" />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ═══ 统计视图 ═══ */}
        {view === "stats" && (
          <div className="px-4 py-3 space-y-4 pb-6">

            {/* 选中日的日记摘要——合并 InsightsPage 之后这块内容曾经被漏掉，
                selectedEntry 算出来了但从没渲染过，用户点日历完全看不到那天写了什么 */}
            {selectedEntry && (selectedEntry.emotionTags.length > 0 || selectedEntry.topicTags.length > 0 || selectedEntry.messages.length > 0) && (
              <div className="bg-card border border-gold-border rounded-xl p-3">
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-caption text-muted-foreground">{t("calendar.diary_heading")}</p>
                  {selectedEntry.emotionScore > 0 && (
                    <span className="text-label font-mono-jb text-muted-foreground">{t("calendar.emotion_score", { score: selectedEntry.emotionScore })}</span>
                  )}
                </div>
                {(selectedEntry.emotionTags.length > 0 || selectedEntry.topicTags.length > 0) && (
                  <div className="flex gap-1 flex-wrap mb-1.5">
                    {selectedEntry.emotionTags.map(tag => (
                      <span key={tag} className="text-label bg-primary/10 text-primary px-1.5 py-0.5 rounded">{tag}</span>
                    ))}
                    {selectedEntry.topicTags.map(tag => (
                      <span key={tag} className="text-label bg-muted text-muted-foreground px-1.5 py-0.5 rounded">{tag}</span>
                    ))}
                  </div>
                )}
                {(() => {
                  const lastUserMsg = [...selectedEntry.messages].reverse().find(m => m.role === "user");
                  if (!lastUserMsg) return null;
                  return (
                    <p className="text-caption text-foreground/90 leading-relaxed line-clamp-3">
                      {lastUserMsg.content}
                    </p>
                  );
                })()}
              </div>
            )}

            {/* 选中日概览 */}
            <div>
              <p className="text-caption text-muted-foreground mb-2">
                {selectedDate === todayStr ? t("calendar.today") : selectedDate.slice(5)} · {t("calendar.items_count", { count: selectedTodos.length })}
                {selectedTotalMin > 0 && ` · ${t("calendar.total_time", { time: selectedTotalMin >= 60 ? Math.round(selectedTotalMin/60)+"h" : selectedTotalMin+"m" })}`}
              </p>
              {selectedCategoryData.length > 0 ? (
                <div className="flex gap-3 items-center bg-card border border-border rounded-xl p-3">
                  <div className="w-[80px] h-[80px] flex-shrink-0">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={selectedCategoryData} dataKey="value" cx="50%" cy="50%" outerRadius={38} innerRadius={22}>
                          {selectedCategoryData.map((_,i) => <Cell key={i} fill={COLORS[i%COLORS.length]} />)}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="flex-1 space-y-1">
                    {selectedCategoryData.slice(0,4).map((c,i) => (
                      <div key={c.name} className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ background:COLORS[i%COLORS.length] }} />
                        <span className="text-caption text-muted-foreground flex-1">{t(CATEGORY_LABEL_KEYS[c.name] || c.name)}</span>
                        <span className="text-caption font-mono-jb text-foreground">
                          {c.value>=60 ? Math.round(c.value/60)+"h" : c.value+"m"}
                        </span>
                        <span className="text-label text-muted-foreground/60">
                          {Math.round(c.value/selectedTotalMin*100)}%
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-card border border-border rounded-xl p-4 text-center">
                  <p className="text-caption text-muted-foreground">
                    {selectedEntry
                      ? t("calendar.no_trackable_time")
                      : selectedDate === todayStr ? t("calendar.no_time_today") : t("calendar.no_data_day")}
                  </p>
                  <p className="text-label text-muted-foreground/60 mt-1">
                    {t("calendar.record_hint")}
                  </p>
                </div>
              )}
            </div>

            {/* 本周汇总 */}
            <div>
              <p className="text-caption text-muted-foreground mb-2">
                {t("calendar.week_total")} · {weekTotalMin>=60 ? Math.round(weekTotalMin/60)+"h" : weekTotalMin+"m"}
              </p>
              <div className="flex gap-1.5 flex-wrap">
                {weekCategoryData.map((c,i) => (
                  <div key={c.name} className="flex items-center gap-1.5 bg-card border border-border rounded-xl px-2.5 py-1.5">
                    <span className="w-2 h-2 rounded-full" style={{background:COLORS[i%COLORS.length]}} />
                    <span className="text-caption text-foreground">{t(CATEGORY_LABEL_KEYS[c.name] || c.name)}</span>
                    <span className="text-label font-mono-jb text-muted-foreground">
                      {c.value>=60 ? Math.round(c.value/60)+"h" : c.value+"m"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* 精力×时间交叉分析 */}
            {energyTimeData.some(d => d.energy > 0) && (
              <div>
                <p className="text-caption text-muted-foreground mb-2">{t("calendar.energy_efficiency_title")}</p>
                <div className="bg-card border border-border rounded-xl p-3">
                  <ResponsiveContainer width="100%" height={100}>
                    <AreaChart data={energyTimeData} margin={{top:4,right:4,bottom:0,left:-20}}>
                      <XAxis dataKey="date" tick={{fontSize:10}} axisLine={false} tickLine={false} />
                      <YAxis tick={false} axisLine={false} tickLine={false} />
                      <Tooltip formatter={(v:any, name:string) => [
                        name==="energy" ? [t("calendar.level_low"),t("calendar.level_mid"),t("calendar.level_high")][v-1]||t("calendar.level_none") : v,
                        name==="energy" ? t("calendar.metric_energy") : t("calendar.metric_done")
                      ]} />
                      <Area type="monotone" dataKey="energy" stroke="hsl(39,58%,53%)" fill="hsl(39,58%,53%,0.2)" strokeWidth={2} />
                      <Area type="monotone" dataKey="done" stroke="hsl(152,41%,49%)" fill="hsl(152,41%,49%,0.15)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                  <p className="text-label text-muted-foreground text-center mt-1">
                    {t("calendar.energy_chart_caption")}
                  </p>
                </div>
              </div>
            )}

            {/* 习惯完成率 */}
            {habitStats && habitStats.length > 0 && (
              <div>
                <p className="text-caption text-muted-foreground mb-2">{t("calendar.habit_completion_title")}</p>
                <div className="bg-card border border-border rounded-xl p-3 space-y-2">
                  {habitStats.map(h => (
                    <div key={h.name} className="flex items-center gap-2">
                      <span className="text-sm">{h.emoji}</span>
                      <span className="text-caption text-foreground flex-1">{h.name}</span>
                      <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full rounded-full bg-los-green transition-all"
                          style={{ width:`${h.rate}%` }} />
                      </div>
                      <span className="text-label font-mono-jb text-muted-foreground w-8 text-right">{h.rate}%</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>
        )}

        {/* ═══ DRIP矩阵视图 ═══ */}
        {view === "drip" && (
          <div className="px-4 py-3 space-y-3 pb-6">
            <div className="flex items-center justify-between">
              <p className="text-caption text-muted-foreground">{t("calendar.drip_title")}</p>
              <div className="flex gap-1">
                <button onClick={() => setView("stats")} className="text-label px-2 py-1 bg-muted rounded text-muted-foreground hover:text-foreground">{t("calendar.switch_to_stats")}</button>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {(Object.entries(dripMatrix) as any[]).map(([key, q]: any) => {
                const total = Object.values(dripMatrix).reduce((s: number, v: any) => s+v.min, 0);
                const pct = total > 0 ? Math.round(q.min/total*100) : 0;
                return (
                  <div key={key} className="rounded-xl p-3 border" style={{ borderColor:q.color+"40", background:q.color+"10" }}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-base">{q.emoji}</span>
                      <span className="text-label font-mono-jb text-muted-foreground">{pct}%</span>
                    </div>
                    <div className="text-xs font-semibold mb-0.5" style={{color:q.color}}>{q.label}</div>
                    <div className="text-label text-muted-foreground mb-1">{q.desc}</div>
                    <div className="text-label text-muted-foreground">
                      {q.min>=60 ? Math.round(q.min/60)+"h" : q.min+"m"}
                      {q.items.length > 0 && ` · ${q.items.slice(0,2).join(t("calendar.list_separator"))}${q.items.length>2?"…":""}`}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="bg-card border border-border rounded-xl p-3">
              <p className="text-caption text-muted-foreground mb-1">{t("calendar.interpretation_title")}</p>
              <p className="text-caption text-foreground leading-relaxed">
                {t("calendar.drip_interpretation")}
              </p>
            </div>
          </div>
        )}

      </div>

      {/* ── 底部提示 ── */}
      <div className="px-4 py-2 border-t border-border flex-shrink-0 flex items-center justify-between">
        <p className="text-label text-muted-foreground">
          {view==="calendar" ? t("calendar.hint_calendar")
           : view==="stats" ? t("calendar.hint_stats")
           : t("calendar.hint_drip")}
        </p>
        <span className="text-label text-muted-foreground font-mono-jb">{format(new Date(),"HH:mm")}</span>
      </div>
    </div>
  );
}
