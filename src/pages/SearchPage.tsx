import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { ChevronLeft, Search, FileText, CheckSquare, DollarSign, X } from "lucide-react";

type ResultType = "todo" | "diary" | "finance";

interface SearchResult {
  type: ResultType;
  id: string;
  title: string;
  snippet: string;
  date: string;
  meta?: string;
}

export default function SearchPage() {
  const navigate = useNavigate();
  const { allTodos, entries, financeEntries } = useLifeOs();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<ResultType | "all">("all");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 1) return [];
    const out: SearchResult[] = [];

    // Search todos
    if (filter === "all" || filter === "todo") {
      allTodos.filter(t =>
        t.text.toLowerCase().includes(q) ||
        (t.note || "").toLowerCase().includes(q) ||
        (t.tags || []).some(tag => tag.toLowerCase().includes(q))
      ).slice(0, 20).forEach(t => {
        out.push({
          type: "todo",
          id: t.id,
          title: t.text,
          snippet: t.note ? t.note.slice(0, 60) : t.tags?.join(", ") || "",
          date: t.dueDate || t.sourceDate || t.createdAt.slice(0, 10),
          meta: t.status === "done" ? "已完成" : t.status === "doing" ? "进行中" : "待办",
        });
      });
    }

    // Search diary entries
    if (filter === "all" || filter === "diary") {
      entries.filter(e =>
        e.messages.some(m => m.content.toLowerCase().includes(q)) ||
        e.emotionTags.some(t => t.toLowerCase().includes(q))
      ).slice(0, 15).forEach(e => {
        const matchMsg = e.messages.find(m => m.content.toLowerCase().includes(q));
        out.push({
          type: "diary",
          id: e.id,
          title: `${e.date} 的日记`,
          snippet: matchMsg?.content.slice(0, 80) || "",
          date: e.date,
          meta: e.emotionTags.slice(0, 3).join("、") || "",
        });
      });
    }

    // Search finance entries
    if (filter === "all" || filter === "finance") {
      financeEntries.filter(f =>
        f.note?.toLowerCase().includes(q) ||
        f.category.toLowerCase().includes(q)
      ).slice(0, 10).forEach(f => {
        out.push({
          type: "finance",
          id: f.id,
          title: f.note || f.category,
          snippet: `${f.type === "income" ? "收入" : "支出"} ¥${f.amount} · ${f.category}`,
          date: f.date,
          meta: f.type === "income" ? "收入" : "支出",
        });
      });
    }

    // Sort by date desc
    return out.sort((a, b) => b.date.localeCompare(a.date));
  }, [query, filter, allTodos, entries, financeEntries]);

  const handleResultClick = (r: SearchResult) => {
    if (r.type === "diary") navigate(`/history?date=${r.date}`);
    else if (r.type === "todo") navigate("/todos");
    else if (r.type === "finance") navigate("/wealth");
  };

  const typeIcon = (t: ResultType) => {
    if (t === "todo") return <CheckSquare size={12} className="text-primary" />;
    if (t === "diary") return <FileText size={12} className="text-gold" />;
    return <DollarSign size={12} className="text-los-green" />;
  };

  const typeLabel = (t: ResultType) => t === "todo" ? "待办" : t === "diary" ? "日记" : "财务";

  return (
    <div className="flex flex-col h-full max-w-[700px] mx-auto">
      {/* Header with inline search */}
      <div className="flex items-center gap-2 px-3 h-[52px] border-b border-border flex-shrink-0 bg-surface-1/90 backdrop-blur-sm">
        <button onClick={() => navigate(-1)} className="touch-target text-muted-foreground hover:text-foreground rounded-xl flex-shrink-0" style={{transform:"scale(0.85)"}}>
          <ChevronLeft size={22} />
        </button>
        <div className="flex-1 flex items-center gap-2 bg-muted border border-border rounded-xl px-3 py-2">
          <Search size={14} className="text-muted-foreground flex-shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="搜索日记、待办、财务…"
            className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none"
          />
          {query && (
            <button onClick={() => setQuery("")} className="text-muted-foreground/60 hover:text-muted-foreground">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Filter pills */}
      <div className="flex gap-1.5 px-4 py-2 border-b border-border flex-shrink-0">
        {(["all", "diary", "todo", "finance"] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-caption px-3 py-1 rounded-full transition ${filter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
            {f === "all" ? "全部" : f === "diary" ? "📔 日记" : f === "todo" ? "✅ 待办" : "💰 财务"}
          </button>
        ))}
      </div>

      {/* Results */}
      <div className="flex-1 overflow-y-auto scrollbar-none">
        {query.length === 0 && (
          <div className="text-center py-12">
            <Search size={32} className="mx-auto mb-3 text-muted-foreground/20" />
            <p className="text-sm text-muted-foreground">搜索日记、待办和财务记录</p>
            <p className="text-caption text-muted-foreground/60 mt-1">支持关键词、标签、金额</p>
          </div>
        )}

        {query.length > 0 && results.length === 0 && (
          <div className="text-center py-12">
            <p className="text-sm text-muted-foreground">没有找到「{query}」相关内容</p>
          </div>
        )}

        {results.length > 0 && (
          <div className="divide-y divide-border">
            {results.map((r, i) => (
              <button key={`${r.type}-${r.id}-${i}`}
                onClick={() => handleResultClick(r)}
                className="w-full text-left px-4 py-3 hover:bg-surface-2 transition">
                <div className="flex items-start gap-2">
                  <div className="flex-shrink-0 mt-0.5">{typeIcon(r.type)}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <p className="text-sm text-foreground truncate flex-1">{r.title}</p>
                      {r.meta && (
                        <span className="text-label text-muted-foreground flex-shrink-0">{r.meta}</span>
                      )}
                    </div>
                    {r.snippet && (
                      <p className="text-caption text-muted-foreground line-clamp-2 leading-relaxed">{r.snippet}</p>
                    )}
                    <p className="text-label text-muted-foreground/60 font-mono mt-0.5">{r.date}</p>
                  </div>
                </div>
              </button>
            ))}
            <p className="text-label text-center text-muted-foreground/40 py-3">共 {results.length} 条结果</p>
          </div>
        )}
      </div>
    </div>
  );
}
