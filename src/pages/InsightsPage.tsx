import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Bookmark, BookmarkCheck, Search, TrendingDown, MessageCircle } from "lucide-react";
import { format, parseISO, subDays } from "date-fns";

const ACTION_KEYWORDS = ["建议", "试试", "推荐", "可以", "行动", "做", "开始", "尝试", "方法", "步骤", "📚", "练习", "计划"];

interface Insight {
  id: string;
  content: string;
  date: string;
  context: string;
}

const DAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];

const InsightsPage = () => {
  const { entries } = useLifeOs();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [search, setSearch] = useState("");
  const [bookmarked, setBookmarked] = useState<Set<string>>(new Set());
  const [filterBookmarked, setFilterBookmarked] = useState(false);
  const [activeTab, setActiveTab] = useState<"insights" | "patterns">("patterns");

  // 从 Supabase 加载书签
  useEffect(() => {
    if (!user) return;
    supabase
      .from("insight_bookmarks")
      .select("insight_id")
      .eq("user_id", user.id)
      .then(({ data }) => {
        if (data) setBookmarked(new Set(data.map((d: any) => d.insight_id)));
      });
  }, [user]);

  const insights = useMemo(() => {
    const result: Insight[] = [];
    entries.forEach(entry => {
      entry.messages.forEach((msg, i) => {
        if (msg.role !== "assistant") return;
        const hasAction = ACTION_KEYWORDS.some(k => msg.content.includes(k));
        if (!hasAction) return;
        const sentences = msg.content.split(/[。！？\n]/).filter(s => s.trim().length > 10);
        const actionable = sentences.filter(s => ACTION_KEYWORDS.some(k => s.includes(k)));
        if (actionable.length === 0) return;
        const prevUser = entry.messages.slice(0, i).reverse().find(m => m.role === "user");
        result.push({
          id: `${entry.id}-${i}`,
          content: actionable.join("。") + "。",
          date: entry.date,
          context: prevUser?.content.slice(0, 60) || "",
        });
      });
    });
    return result;
  }, [entries]);

  const patterns = useMemo(() => {
    const cutoff = subDays(new Date(), 30);
    const recent = entries.filter(e => parseISO(e.date) >= cutoff);
    const tagCounts: Record<string, number> = {};
    recent.forEach(e => e.emotionTags.forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; }));
    const recurring = Object.entries(tagCounts).filter(([, c]) => c >= 3).sort((a, b) => b[1] - a[1]);
    const dayScores: Record<number, number[]> = {};
    recent.forEach(e => { const day = parseISO(e.date).getDay(); if (!dayScores[day]) dayScores[day] = []; dayScores[day].push(e.emotionScore); });
    const dayAvgs: { day: number; avg: number; count: number }[] = [];
    for (const [d, scores] of Object.entries(dayScores)) {
      if (scores.length >= 2) dayAvgs.push({ day: +d, avg: +(scores.reduce((a, b) => a + b, 0) / scores.length).toFixed(1), count: scores.length });
    }
    dayAvgs.sort((a, b) => a.avg - b.avg);
    const weekMap: Record<string, number[]> = {};
    recent.forEach(e => { const wk = format(parseISO(e.date), "yyyy-ww"); if (!weekMap[wk]) weekMap[wk] = []; weekMap[wk].push(e.emotionScore); });
    const volatileWeeks = Object.entries(weekMap)
      .filter(([, scores]) => scores.length >= 3 && Math.max(...scores) - Math.min(...scores) > 4)
      .map(([wk, scores]) => ({ week: wk, range: Math.max(...scores) - Math.min(...scores), count: scores.length }));
    return { recurring, dayAvgs, volatileWeeks };
  }, [entries]);

  const filtered = useMemo(() => {
    let list = insights;
    if (filterBookmarked) list = list.filter(i => bookmarked.has(i.id));
    if (search) list = list.filter(i => i.content.includes(search) || i.context.includes(search));
    return list;
  }, [insights, filterBookmarked, bookmarked, search]);

  const toggleBookmark = useCallback(async (id: string) => {
    if (!user) return;
    setBookmarked(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
        supabase.from("insight_bookmarks").delete().eq("user_id", user.id).eq("insight_id", id).then(() => {});
      } else {
        next.add(id);
        supabase.from("insight_bookmarks").insert({ user_id: user.id, insight_id: id }).then(() => {});
      }
      return next;
    });
  }, [user]);

  const askAboutPattern = (tag: string) => {
    navigate(`/?prefill=${encodeURIComponent(`我注意到我经常感到${tag}，一起分析一下吗？`)}`);
  };

  return (
    <div className="h-full overflow-y-auto px-4 max-w-[600px] mx-auto pb-4">
      <div className="py-4">
        <h1 className="font-serif-sc text-lg text-foreground">💡 破局手册</h1>
        <p className="text-[10px] text-muted-foreground">洞察与行为模式分析</p>
      </div>

      <div className="flex gap-1 mb-4 bg-surface-2 rounded-xl p-1">
        <button onClick={() => setActiveTab("patterns")} className={`flex-1 py-2 rounded-lg text-xs transition ${activeTab === "patterns" ? "bg-gold text-background" : "text-muted-foreground"}`}>
          🔍 行为模式
        </button>
        <button onClick={() => setActiveTab("insights")} className={`flex-1 py-2 rounded-lg text-xs transition ${activeTab === "insights" ? "bg-gold text-background" : "text-muted-foreground"}`}>
          💡 行动洞察
        </button>
      </div>

      {activeTab === "patterns" && (
        <div className="space-y-3">
          {patterns.recurring.length === 0 && patterns.dayAvgs.length === 0 && patterns.volatileWeeks.length === 0 && (
            <div className="text-center py-12 text-muted-foreground text-xs">多和罗盘聊聊，行为模式会逐渐显现。至少需要 3 天以上的记录。</div>
          )}
          {patterns.recurring.length > 0 && (
            <div>
              <p className="text-[10px] text-gold font-mono-jb mb-2">🔁 高频情绪（近 30 天）</p>
              <div className="space-y-2">
                {patterns.recurring.map(([tag, count]) => (
                  <div key={tag} className="bg-surface-2 border border-border rounded-xl px-4 py-3 flex items-center justify-between">
                    <div><p className="text-sm text-foreground">{tag}</p><p className="text-[10px] text-muted-foreground">出现了 {count} 次</p></div>
                    <button onClick={() => askAboutPattern(tag)} className="text-[10px] text-gold hover:text-gold/80 flex items-center gap-1 transition-colors">
                      <MessageCircle size={12} /> 问问罗盘
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {patterns.dayAvgs.length >= 2 && (
            <div>
              <p className="text-[10px] text-gold font-mono-jb mb-2 mt-4">📊 星期情绪趋势</p>
              <div className="bg-surface-2 border border-border rounded-xl px-4 py-3">
                <div className="flex items-end gap-1 h-20 justify-center">
                  {[1, 2, 3, 4, 5, 6, 0].map(d => {
                    const data = patterns.dayAvgs.find(a => a.day === d);
                    const avg = data?.avg || 5;
                    const height = (avg / 10) * 100;
                    const color = avg >= 7 ? "bg-los-green" : avg >= 4 ? "bg-gold" : "bg-los-red";
                    return (
                      <div key={d} className="flex-1 flex flex-col items-center gap-1">
                        <span className="text-[8px] text-muted-foreground font-mono-jb">{data ? avg : "-"}</span>
                        <div className={`w-full rounded-t ${color} transition-all`} style={{ height: `${height}%`, minHeight: data ? 4 : 0 }} />
                        <span className="text-[8px] text-muted-foreground">{DAY_NAMES[d]}</span>
                      </div>
                    );
                  })}
                </div>
                {patterns.dayAvgs.length >= 2 && (
                  <p className="text-[10px] text-muted-foreground mt-2 text-center">
                    {DAY_NAMES[patterns.dayAvgs[0].day]}平均情绪最低（{patterns.dayAvgs[0].avg}分）
                    {patterns.dayAvgs[patterns.dayAvgs.length - 1] && `，${DAY_NAMES[patterns.dayAvgs[patterns.dayAvgs.length - 1].day]}最高（${patterns.dayAvgs[patterns.dayAvgs.length - 1].avg}分）`}
                  </p>
                )}
              </div>
            </div>
          )}
          {patterns.volatileWeeks.length > 0 && (
            <div>
              <p className="text-[10px] text-gold font-mono-jb mb-2 mt-4">⚡ 情绪波动周</p>
              <div className="space-y-2">
                {patterns.volatileWeeks.map(vw => (
                  <div key={vw.week} className="bg-surface-2 border border-border rounded-xl px-4 py-3 flex items-center gap-3">
                    <TrendingDown size={16} className="text-los-red flex-shrink-0" />
                    <div><p className="text-xs text-foreground">第 {vw.week.split("-")[1]} 周</p><p className="text-[10px] text-muted-foreground">情绪波动幅度 {vw.range} 分（{vw.count} 天记录）</p></div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {activeTab === "insights" && (
        <>
          <div className="flex gap-2 mb-4">
            <div className="flex-1 relative">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="搜索洞察..."
                className="w-full bg-surface-2 border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-foreground focus:outline-none focus:border-gold-border" />
            </div>
            <button onClick={() => setFilterBookmarked(!filterBookmarked)}
              className={`px-3 py-2 rounded-xl text-xs transition ${filterBookmarked ? "bg-gold text-background" : "bg-surface-2 text-muted-foreground"}`}>
              ★ {bookmarked.size}
            </button>
          </div>
          <div className="bg-surface-2 border border-border rounded-xl p-3 mb-4 flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">共提取 {insights.length} 条洞察</span>
            <span className="text-[10px] text-gold">已收藏 {bookmarked.size}</span>
          </div>
          {filtered.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground text-xs">{insights.length === 0 ? "还没有足够的对话数据。多和罗盘聊聊，洞察会自动积累。" : "没有匹配的洞察"}</div>
          ) : (
            <div className="space-y-2">
              {filtered.map(insight => (
                <div key={insight.id} className="bg-surface-2 border border-border rounded-xl px-4 py-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      {insight.context && <p className="text-[9px] text-muted-foreground/60 mb-1 truncate">💬 {insight.context}</p>}
                      <p className="text-xs text-foreground leading-[1.8]">{insight.content}</p>
                      <span className="text-[8px] text-muted-foreground/50 font-mono-jb">{insight.date}</span>
                    </div>
                    <button onClick={() => toggleBookmark(insight.id)} className="flex-shrink-0 mt-1">
                      {bookmarked.has(insight.id) ? <BookmarkCheck size={16} className="text-gold" /> : <Bookmark size={16} className="text-muted-foreground/40" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default InsightsPage;
