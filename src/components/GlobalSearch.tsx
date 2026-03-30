import { useState, useMemo, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X, MessageCircle, CheckSquare } from "lucide-react";
import { useLifeOs } from "@/contexts/LifeOsContext";

export default function GlobalSearch({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate();
  const { entries, allTodos } = useLifeOs();
  const [query, setQuery] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const results = useMemo(() => {
    if (query.trim().length < 2) return { messages: [], todos: [] };
    const q = query.toLowerCase();

    // 搜索日记消息
    const messages: Array<{ date: string; content: string; role: string }> = [];
    entries.forEach(entry => {
      entry.messages.forEach(msg => {
        if (msg.content.toLowerCase().includes(q)) {
          messages.push({ date: entry.date, content: msg.content, role: msg.role });
        }
      });
    });

    // 搜索待办
    const todos = allTodos.filter(t =>
      t.text.toLowerCase().includes(q) ||
      t.tags.some(tag => tag.toLowerCase().includes(q)) ||
      t.note?.toLowerCase().includes(q)
    );

    return { messages: messages.slice(0, 10), todos: todos.slice(0, 10) };
  }, [query, entries, allTodos]);

  const highlight = (text: string, maxLen = 100) => {
    const idx = text.toLowerCase().indexOf(query.toLowerCase());
    if (idx === -1) return text.slice(0, maxLen);
    const start = Math.max(0, idx - 20);
    const end = Math.min(text.length, idx + query.length + 40);
    return (start > 0 ? "..." : "") + text.slice(start, end) + (end < text.length ? "..." : "");
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
        <Search size={16} className="text-muted-foreground" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="搜索日记、待办..."
          className="flex-1 bg-transparent text-sm text-foreground focus:outline-none"
        />
        <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
          <X size={16} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-4">
        {query.trim().length < 2 && (
          <p className="text-xs text-muted-foreground text-center py-8">输入至少 2 个字符开始搜索</p>
        )}

        {results.messages.length > 0 && (
          <div>
            <p className="text-[10px] text-gold font-mono-jb mb-2">💬 日记 ({results.messages.length})</p>
            <div className="space-y-1.5">
              {results.messages.map((m, i) => (
                <button
                  key={i}
                  onClick={() => { navigate(`/history`); onClose(); }}
                  className="w-full text-left bg-surface-2 border border-border rounded-xl px-3 py-2 hover:bg-surface-3 transition"
                >
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <MessageCircle size={10} className="text-muted-foreground" />
                    <span className="text-[9px] text-muted-foreground font-mono-jb">{m.date}</span>
                    <span className="text-[9px] text-muted-foreground">{m.role === "user" ? "我" : "罗盘"}</span>
                  </div>
                  <p className="text-xs text-foreground leading-[1.6]">{highlight(m.content)}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {results.todos.length > 0 && (
          <div>
            <p className="text-[10px] text-gold font-mono-jb mb-2">✅ 待办 ({results.todos.length})</p>
            <div className="space-y-1.5">
              {results.todos.map(todo => (
                <button
                  key={todo.id}
                  onClick={() => { navigate("/todos"); onClose(); }}
                  className="w-full text-left bg-surface-2 border border-border rounded-xl px-3 py-2 hover:bg-surface-3 transition"
                >
                  <div className="flex items-center gap-1.5">
                    <CheckSquare size={10} className={todo.status === "done" ? "text-los-green" : "text-muted-foreground"} />
                    <span className="text-xs text-foreground">{todo.text}</span>
                  </div>
                  {todo.note && <p className="text-[9px] text-muted-foreground mt-0.5 truncate">{todo.note}</p>}
                </button>
              ))}
            </div>
          </div>
        )}

        {query.trim().length >= 2 && results.messages.length === 0 && results.todos.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">没有找到「{query}」相关结果</p>
        )}
      </div>
    </div>
  );
}
