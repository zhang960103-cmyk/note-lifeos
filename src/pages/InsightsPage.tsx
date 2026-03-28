import { useState, useMemo } from "react";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { Bookmark, BookmarkCheck, Search } from "lucide-react";

const ACTION_KEYWORDS = ["建议", "试试", "推荐", "可以", "行动", "做", "开始", "尝试", "方法", "步骤", "📚", "练习", "计划"];

interface Insight {
  id: string;
  content: string;
  date: string;
  context: string; // user message before
}

const InsightsPage = () => {
  const { entries } = useLifeOs();
  const [search, setSearch] = useState("");
  const [bookmarked, setBookmarked] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("los-bookmarks");
      return saved ? new Set(JSON.parse(saved)) : new Set();
    } catch { return new Set(); }
  });
  const [filterBookmarked, setFilterBookmarked] = useState(false);

  const insights = useMemo(() => {
    const result: Insight[] = [];
    entries.forEach(entry => {
      entry.messages.forEach((msg, i) => {
        if (msg.role !== "assistant") return;
        // Check if contains actionable content
        const hasAction = ACTION_KEYWORDS.some(k => msg.content.includes(k));
        if (!hasAction) return;
        // Split by sentences and find actionable ones
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

  const filtered = useMemo(() => {
    let list = insights;
    if (filterBookmarked) list = list.filter(i => bookmarked.has(i.id));
    if (search) list = list.filter(i => i.content.includes(search) || i.context.includes(search));
    return list;
  }, [insights, filterBookmarked, bookmarked, search]);

  const toggleBookmark = (id: string) => {
    setBookmarked(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      localStorage.setItem("los-bookmarks", JSON.stringify([...next]));
      return next;
    });
  };

  return (
    <div className="h-full overflow-y-auto px-4 max-w-[600px] mx-auto pb-4">
      <div className="py-4">
        <h1 className="font-serif-sc text-lg text-foreground">💡 破局手册</h1>
        <p className="text-[10px] text-muted-foreground">从你的对话中提取的行动洞察</p>
      </div>

      {/* Search & filter */}
      <div className="flex gap-2 mb-4">
        <div className="flex-1 relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="搜索洞察..."
            className="w-full bg-surface-2 border border-border rounded-xl pl-9 pr-3 py-2 text-xs text-foreground focus:outline-none focus:border-gold-border"
          />
        </div>
        <button
          onClick={() => setFilterBookmarked(!filterBookmarked)}
          className={`px-3 py-2 rounded-xl text-xs transition ${filterBookmarked ? "bg-gold text-background" : "bg-surface-2 text-muted-foreground"}`}
        >
          ★ {bookmarked.size}
        </button>
      </div>

      {/* Stats */}
      <div className="bg-surface-2 border border-border rounded-xl p-3 mb-4 flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground">共提取 {insights.length} 条洞察</span>
        <span className="text-[10px] text-gold">已收藏 {bookmarked.size}</span>
      </div>

      {/* Insights list */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-xs">
          {insights.length === 0 ? "还没有足够的对话数据。多和罗盘聊聊，洞察会自动积累。" : "没有匹配的洞察"}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(insight => (
            <div key={insight.id} className="bg-surface-2 border border-border rounded-xl px-4 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  {insight.context && (
                    <p className="text-[9px] text-muted-foreground/60 mb-1 truncate">💬 {insight.context}</p>
                  )}
                  <p className="text-xs text-foreground leading-[1.8]">{insight.content}</p>
                  <span className="text-[8px] text-muted-foreground/50 font-mono-jb">{insight.date}</span>
                </div>
                <button onClick={() => toggleBookmark(insight.id)} className="flex-shrink-0 mt-1">
                  {bookmarked.has(insight.id)
                    ? <BookmarkCheck size={16} className="text-gold" />
                    : <Bookmark size={16} className="text-muted-foreground/40" />
                  }
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default InsightsPage;
