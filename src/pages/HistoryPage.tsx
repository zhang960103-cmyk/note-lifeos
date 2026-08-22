import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { CheckSquare, Square, ChevronDown, ChevronUp, Trash2, FileText, AlertTriangle } from "lucide-react";
import { format, parseISO, subDays, eachDayOfInterval, startOfYear, getDay } from "date-fns";

const HistoryPage = () => {
  const { entries, toggleTodo, deleteEntry, monthFinanceStats } = useLifeOs();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [touchStart, setTouchStart] = useState(0);
  const [justJumpedId, setJustJumpedId] = useState<string | null>(null);

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

  // BUG-09 二次整改（方案C）：热力图色块本身维持 8×8px 不放大——365 天放大到
  // 44×44px 会让热力图宽度超过 16000px，直接毁掉"一眼看全年"这个功能的存在
  // 意义。但 WCAG 2.5.8（AA）的目标尺寸要求允许一种例外：只要同一页面上有
  // 另一个尺寸达标、功能等效的控件能完成同样的事，小尺寸控件本身可以不达标。
  // 下面的"按记录列表"（Day list）里每一条都是 px-4 py-3 的整行按钮，实测
  // 高度远超 44px，而且展示的内容比色块点击后的迷你卡片更完整（能看到全部
  // 对话，不只是前两条摘要）。所以这里不再让色块弹出一个自己的迷你详情卡片，
  // 改为点击色块直接跳到（展开+滚动定位）下方列表里对应的那一条——色块的
  // 触摸精度不再是"看到这天详情"的唯一路径，44px 达标的入口本来就在页面上，
  // 而不是"技术上有豁免条款但实际上没有对应功能"这种打擦边球的做法。
  const jumpToEntry = (date: string) => {
    const entry = entries.find(e => e.date === date);
    if (!entry) return;
    setExpandedId(entry.id);
    setJustJumpedId(entry.id);
    const scrollToTarget = () => {
      const el = document.getElementById(`history-entry-${date}`);
      if (el && typeof el.scrollIntoView === "function") {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    };
    // 测试环境（jsdom）不一定实现 requestAnimationFrame，降级为同步执行
    if (typeof requestAnimationFrame === "function") {
      requestAnimationFrame(scrollToTarget);
    } else {
      scrollToTarget();
    }
    setTimeout(() => setJustJumpedId(null), 1500);
  };

  // 之前这里从全量financeEntries里取前5条，标题却写"本月财务"——如果本月
  // 消费记录不足5条，列表会用上个月甚至更早的记录悄悄补齐，用户看到的
  // 日期/金额和"本月"完全对不上。改为只从monthFinanceStats.entries(已经
  // 按当月过滤)里取，数据来源和上面的统计卡片保持一致。
  const recentFinance = useMemo(() => monthFinanceStats.entries.slice(0, 5), [monthFinanceStats.entries]);

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
          <h1 className="font-serif-sc text-lg text-foreground">{t("history.title")}</h1>
          <span className="text-[10px] text-muted-foreground font-mono-jb">{t("history.days_count", { count: entries.length })}</span>
        </div>
        <button
          onClick={() => navigate("/review")}
          className="flex items-center gap-1.5 text-gold text-xs bg-gold-light px-3 py-1.5 rounded-full hover:bg-gold/20 transition"
        >
          <FileText size={14} /> {t("history.generate_review")}
        </button>
      </div>

      {/* BUG-09 根因：这个热力图之前对全年（含头尾占位）每一天都渲染一个真实
          <button>，其中占位格是用 opacity-0 藏起来的、完全不可见、也没有任何名
          称的按钮——一年下来大约 389 个可聚焦控件挤在一起，键盘用户要按几百次
          Tab 才能跳过这个区块，触摸也几乎不可能精确点中某一个 8×8px 的格子。
          修复思路（不是完全重做视觉设计，而是把"能不能被 Tab 到"和"点了有没有
          意义"对齐）：
            1. 占位格（不属于统计区间内的日期）改成 aria-hidden 的纯 <div>，
               彻底退出可访问树和 Tab 顺序；
            2. 当天没有日记的格子也改成不可聚焦的 <div>（保留视觉着色和
               title 提示，但点了本来就没反应，不该占一个 Tab 停靠点）；
            3. 只有"这天真的写过日记"的格子才保留成 <button>，并且用
               aria-label（而不是只有 title）给出完整可读的日期+分数；
            4. 整个区块包一层 role="group" + aria-label 汇总说明（一共统计
               了多少天、其中多少天有记录），外加一个视觉隐藏、聚焦时才显示的
               "跳过热力图"链接，键盘用户可以一次性跳到热力图后面的内容。
          8×8px 的格子尺寸本身没有放大到 44×44px——一年 365 天要放大到这个尺寸
          会让整个热力图宽度超过 16000px，直接失去"一眼看全年"的产品意图；这是
          一个视觉密度 vs 触控热区的真实取舍，具体怎么权衡建议由你决定，我在下面
          的报告里会单独说明。 */}
      <a href="#history-heatmap-end" className="sr-only focus:not-sr-only focus:absolute focus:z-50 focus:bg-gold focus:text-background focus:px-3 focus:py-1.5 focus:rounded-lg focus:text-xs">
        {t("history.skip_heatmap")}
      </a>
      <div className="bg-surface-2 border border-border rounded-xl p-4 mb-4">
        <h2 className="text-xs text-muted-foreground font-mono-jb mb-3">{t("history.heatmap_title")}</h2>
        <div className="overflow-x-auto scrollbar-none">
          <div
            className="flex gap-[2px]"
            style={{ minWidth: `${weeks.length * 10}px` }}
            role="group"
            aria-label={t("history.heatmap_summary", { total: heatmapData.length, withEntry: heatmapData.filter(d => d.hasEntry).length })}
          >
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[2px]">
                {week.map((day, di) => {
                  if (!day.date) {
                    // 占位格：不代表任何真实日期，彻底移出可访问树和 Tab 顺序
                    return <div key={di} aria-hidden="true" className="w-[8px] h-[8px] rounded-[1px] opacity-0" />;
                  }
                  if (!day.hasEntry) {
                    // 没有日记的日期：保留视觉着色和 title 提示，但不给 Tab 停靠点
                    // （点了本来就没有任何反应）
                    return (
                      <div
                        key={di}
                        className={`w-[8px] h-[8px] rounded-[1px] transition-all ${getHeatColor(day.score, day.hasEntry)}`}
                        title={`${day.date} ${t("history.no_record")}`}
                      />
                    );
                  }
                  return (
                    <button
                      key={di}
                      onClick={() => jumpToEntry(day.date)}
                      className={`w-[8px] h-[8px] rounded-[1px] transition-all ${getHeatColor(day.score, day.hasEntry)}`}
                      title={`${day.date} ${day.score ? `(${day.score}/10)` : t("history.no_record")}`}
                      aria-label={`${day.date}${day.score !== null ? ` ${day.score}/10` : ""} ${t("history.heatmap_cell_jump_hint")}`}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
        {/* Legend */}
        <div className="flex items-center gap-2 mt-2 text-[8px] text-muted-foreground">
          <span>{t("history.legend_low")}</span>
          <span className="w-2 h-2 bg-los-red/60 rounded-[1px]" />
          <span className="w-2 h-2 bg-los-orange/60 rounded-[1px]" />
          <span className="w-2 h-2 bg-gold/60 rounded-[1px]" />
          <span className="w-2 h-2 bg-los-green/60 rounded-[1px]" />
          <span className="w-2 h-2 bg-los-green rounded-[1px]" />
          <span>{t("history.legend_high")}</span>
          <span className="ml-2">□ {t("history.no_record")}</span>
        </div>
        <p className="text-[8px] text-muted-foreground/70 mt-1.5">{t("history.heatmap_hint")}</p>
      </div>
      <div id="history-heatmap-end" />

      {/* Finance Panel */}
      {(monthFinanceStats.count > 0) && (
        <div className="bg-surface-2 border border-border rounded-xl p-4 mb-4">
          <h2 className="text-xs text-muted-foreground font-mono-jb mb-3">{t("history.finance_title")}</h2>
          <div className="grid grid-cols-3 gap-2 mb-3">
            <div className="text-center">
              <div className="text-lg text-los-green font-mono-jb">¥{monthFinanceStats.income}</div>
              <div className="text-[8px] text-muted-foreground">{t("history.income")}</div>
            </div>
            <div className="text-center">
              <div className="text-lg text-los-orange font-mono-jb">¥{monthFinanceStats.expense}</div>
              <div className="text-[8px] text-muted-foreground">{t("history.expense")}</div>
            </div>
            <div className="text-center">
              <div className="text-lg text-gold font-mono-jb">¥{monthFinanceStats.net}</div>
              <div className="text-[8px] text-muted-foreground">{t("history.net_value")}</div>
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
          <p className="text-sm text-muted-foreground leading-[1.8] text-center">{t("history.empty_state")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map(entry => {
            const isExpanded = expandedId === entry.id;
            const userMsgs = entry.messages.filter(m => m.role === "user");
            const preview = userMsgs[0]?.content.slice(0, 60) || t("history.no_content");

            return (
              <div
                key={entry.id}
                id={`history-entry-${entry.date}`}
                className={`bg-surface-2 border rounded-xl overflow-hidden transition-colors ${
                  justJumpedId === entry.id ? "border-gold" : "border-border"
                }`}
              >
                <button onClick={() => setExpandedId(isExpanded ? null : entry.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] text-muted-foreground font-mono-jb">{format(parseISO(entry.date), t("history.date_format"))}</span>
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
                        <><AlertTriangle size={11} /> {t("history.confirm_delete")}</>
                      ) : (
                        <><Trash2 size={11} /> {t("history.delete")}</>
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
