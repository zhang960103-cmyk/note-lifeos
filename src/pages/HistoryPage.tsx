import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { useNavigate } from "react-router-dom";
import { CheckSquare, Square, ChevronDown, ChevronUp, Trash2, FileText, AlertTriangle } from "lucide-react";
import { format, parseISO, subDays, eachDayOfInterval, startOfYear, getDay } from "date-fns";

const HistoryPage = () => {
  const { entries, toggleTodo, deleteEntry, monthFinanceStats, financeEntries } = useLifeOs();
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [touchStart, setTouchStart] = useState(0);

  // 365-day heatmap data
  const heatmapData = useMemo(() => {
    const today = new Date();
    const yearAgo = subDays(today, 364);
    const days = eachDayOfInterval({ start: yearAgo, end: today });
    const entryMap = new Map(entries.map(e => [e.date, e]));

    return days.map(d => {
      const dateStr = format(d, "yyyy-MM-dd");
      const entry = entryMap.get(dateStr);
      return {
        date: dateStr,
        dayOfWeek: getDay(d), // 0=Sun
        score: entry?.emotionScore ?? null,
        hasEntry: !!entry,
        tags: entry?.emotionTags?.slice(0, 2) ?? [],
      };
    });
  }, [entries]);

  // Group heatmap by weeks
  const weeks = useMemo(() => {
    const result: typeof heatmapData[] = [];
    let currentWeek: typeof heatmapData = [];
    // Pad start
    if (heatmapData.length > 0) {
      const firstDow = heatmapData[0].dayOfWeek;
      for (let i = 0; i < firstDow; i++) {
        currentWeek.push({ date: "", dayOfWeek: i, score: null, hasEntry: false, tags: [] });
      }
    }
    heatmapData.forEach(d => {
      currentWeek.push(d);
      if (d.dayOfWeek === 6) {
        result.push(currentWeek);
        currentWeek = [];
      }
    });
    if (currentWeek.length > 0) result.push(currentWeek);
    return result;
  }, [heatmapData]);

  const getHeatColor = (score: number | null, hasEntry: boolean) => {
    if (!hasEntry || score === null) return "bg-surface-3";
    if (score >= 8) return "bg-los-green";
    if (score >= 6) return "bg-los-green/60";
    if (score >= 4) return "bg-gold/60";
    if (score >= 2) return "bg-los-orange/60";
    return "bg-los-red/60";
  };

  const selectedEntry = selectedDate ? entries.find(e => e.date === selectedDate) : null;

  const recentFinance = useMemo(() => financeEntries.slice(0, 5), [financeEntries]);

  const handleDelete = (id: string) => {
    if (confirmDeleteId === id) {
      deleteEntry(id);
      setConfirmDeleteId(null);
      setExpandedId(null);
    } else {
      setConfirmDeleteId(id);
      setTimeout(() => setConfirmDeleteId(null), 3000);
    }
  };

  return (
    <div className="h-full overflow-y-auto px-4 max-w-[600px] mx-auto pb-4"
      onTouchStart={(e) => setTouchStart(e.touches[0].clientX)}
      onTouchEnd={(e) => { const delta = e.changedTouches[0].clientX - touchStart; if (touchStart < 30 && delta > 70) navigate(-1); }}
    >
      <div className="py-4 flex items-center justify-between">
        <div>
          <h1 className="font-serif-sc text-lg text-foreground">回顾</h1>
          <span className="text-[10px] text-muted-foreground font-mono-jb">{entries.length} 天记录</span>
        </div>
        <button
          onClick={() => navigate("/review")}
          className="flex items-center gap-1.5 text-gold text-xs bg-gold-light px-3 py-1.5 rounded-full hover:bg-gold/20 transition"
        >
          <FileText size={14} /> 生成复盘信
        </button>
      </div>

      {/* 365-day Emotion Heatmap */}
      <div className="bg-surface-2 border border-border rounded-xl p-4 mb-4">
        <h2 className="text-xs text-muted-foreground font-mono-jb mb-3">情绪热力图 · 过去365天</h2>
        <div className="overflow-x-auto scrollbar-none">
          <div className="flex gap-[2px]" style={{ minWidth: `${weeks.length * 10}px` }}>
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[2px]">
                {week.map((day, di) => (
                  <button
                    key={di}
                    onClick={() => day.date && day.hasEntry && setSelectedDate(day.date === selectedDate ? null : day.date)}
                    className={`w-[8px] h-[8px] rounded-[1px] transition-all ${getHeatColor(day.score, day.hasEntry)} ${
                      day.date === selectedDate ? "ring-1 ring-gold scale-150" : ""
                    } ${!day.date ? "opacity-0" : ""}`}
                    title={day.date ? `${day.date} ${day.score ? `(${day.score}/10)` : "无记录"}` : ""}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-2 mt-2 text-[8px] text-muted-foreground">
          <span>低</span>
          <span className="w-2 h-2 bg-los-red/60 rounded-[1px]" />
          <span className="w-2 h-2 bg-los-orange/60 rounded-[1px]" />
          <span className="w-2 h-2 bg-gold/60 rounded-[1px]" />
          <span className="w-2 h-2 bg-los-green/60 rounded-[1px]" />
          <span className="w-2 h-2 bg-los-green rounded-[1px]" />
          <span>高</span>
          <span className="ml-2">□ 无记录</span>
        </div>
      </div>

      {/* Selected day detail */}
      {selectedEntry && (
        <div className="bg-surface-2 border border-gold-border rounded-xl p-4 mb-4 animate-in fade-in">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-foreground font-serif-sc">{format(parseISO(selectedEntry.date), "M月d日")}</span>
            <span className="text-xs text-gold font-mono-jb">{selectedEntry.emotionScore}/10</span>
          </div>
          {selectedEntry.emotionTags.length > 0 && (
            <div className="flex gap-1 flex-wrap mb-2">
              {selectedEntry.emotionTags.map(t => (
                <span key={t} className="text-[9px] bg-surface-3 text-muted-foreground px-1.5 py-0.5 rounded">{t}</span>
              ))}
            </div>
          )}
          {selectedEntry.messages.filter(m => m.role === "user").slice(0, 2).map((m, i) => (
            <p key={i} className="text-xs text-muted-foreground leading-[1.8] truncate">{m.content.slice(0, 80)}</p>
          ))}
          <button onClick={() => setSelectedDate(null)} className="text-[10px] text-gold mt-2">关闭 ×</button>
        </div>
      )}

      {/* Finance Panel */}
      {(monthFinanceStats.count > 0) && (
        <div className="bg-surface-2 border border-border rounded-xl p-4 mb-4">
          <h2 className="text-xs text-muted-foreground font-mono-jb mb-3">本月财务</h2>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center">
              <div className="text-lg text-los-green font-mono-jb">¥{monthFinanceStats.income}</div>
              <div className="text-[8px] text-muted-foreground">收入</div>
            </div>
            <div className="text-center">
              <div className="text-lg text-los-orange font-mono-jb">¥{monthFinanceStats.expense}</div>
              <div className="text-[8px] text-muted-foreground">支出</div>
            </div>
            <div className="text-center">
              <div className="text-lg text-gold font-mono-jb">¥{monthFinanceStats.net}</div>
              <div className="text-[8px] text-muted-foreground">净值</div>
            </div>
          </div>
          {recentFinance.length > 0 && (
            <div className="space-y-1">
              {recentFinance.map(f => (
                <div key={f.id} className="flex items-center gap-2 text-xs">
                  <span className={f.type === "income" ? "text-los-green" : "text-los-orange"}>
                    {f.type === "income" ? "↑" : "↓"}
                  </span>
                  <span className="text-muted-foreground flex-1 truncate">{f.category} {f.note && `· ${f.note}`}</span>
                  <span className={`font-mono-jb ${f.type === "income" ? "text-los-green" : "text-los-orange"}`}>
                    {f.type === "income" ? "+" : "-"}¥{f.amount}
                  </span>
                  <span className="text-[8px] text-muted-foreground/60">{f.date.slice(5)}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Day list */}
      {entries.length === 0 ? (
        <div className="text-center py-16">
          <div className="text-3xl mb-3">📝</div>
          <p className="text-sm text-muted-foreground leading-[1.8] text-center">开始记录的第一天，往往是改变的起点。</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map(entry => {
            const isExpanded = expandedId === entry.id;
            const userMsgs = entry.messages.filter(m => m.role === "user");
            const preview = userMsgs[0]?.content.slice(0, 60) || "无内容";

            return (
              <div key={entry.id} className="bg-surface-2 border border-border rounded-xl overflow-hidden">
                <button onClick={() => setExpandedId(isExpanded ? null : entry.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] text-muted-foreground font-mono-jb">{format(parseISO(entry.date), "M月d日")}</span>
                      <span className="text-[10px] text-gold font-mono-jb">{entry.emotionScore}/10</span>
                    </div>
                    <p className="text-xs text-foreground truncate">{preview}</p>
                    {entry.emotionTags.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {entry.emotionTags.slice(0, 3).map(t => (
                          <span key={t} className="text-[8px] text-muted-foreground">{t}</span>
                        ))}
                      </div>
                    )}
                  </div>
                  {isExpanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-border">
                    <div className="space-y-3 py-3">
                      {entry.messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                            msg.role === "user"
                              ? "bg-gold text-background rounded-br-sm text-xs leading-[1.8]"
                              : "text-muted-foreground rounded-bl-sm text-[11px] leading-[1.8]"
                          }`}>{msg.content}</div>
                        </div>
                      ))}
                    </div>
                    {(entry.topicTags.length > 0 || entry.emotionTags.length > 0) && (
                      <div className="flex gap-1 flex-wrap mb-2">
                        {entry.emotionTags.map(t => <span key={t} className="text-[9px] bg-surface-3 text-muted-foreground px-1.5 py-0.5 rounded">{t}</span>)}
                        {entry.topicTags.map(t => <span key={t} className="text-[9px] bg-gold-light text-gold px-1.5 py-0.5 rounded">{t}</span>)}
                      </div>
                    )}
                    {entry.todos.length > 0 && (
                      <div className="space-y-1 mb-2">
                        {entry.todos.map(todo => (
                          <button key={todo.id} onClick={() => toggleTodo(entry.date, todo.id)} className="flex items-center gap-2 w-full text-left text-xs">
                            {todo.status === "done"
                              ? <CheckSquare size={13} className="text-los-green flex-shrink-0" />
                              : <Square size={13} className="text-muted-foreground flex-shrink-0" />}
                            <span className={todo.status === "done" ? "line-through text-muted-foreground" : "text-foreground"}>{todo.text}</span>
                          </button>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => handleDelete(entry.id)}
                      className={`text-[10px] transition-colors flex items-center gap-1 mt-2 ${
                        confirmDeleteId === entry.id ? "text-destructive" : "text-muted-foreground hover:text-destructive"
                      }`}
                    >
                      {confirmDeleteId === entry.id ? (
                        <><AlertTriangle size={11} /> 确认删除？再点一次</>
                      ) : (
                        <><Trash2 size={11} /> 删除</>
                      )}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HistoryPage;
