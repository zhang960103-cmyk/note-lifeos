import { useState, useMemo } from "react";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { useNavigate } from "react-router-dom";
import { CheckSquare, Square, ChevronDown, ChevronUp, Trash2, FileText } from "lucide-react";
import { format, parseISO, subDays, isAfter } from "date-fns";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

const HistoryPage = () => {
  const { entries, toggleTodo, deleteEntry, monthFinanceStats, financeEntries } = useLifeOs();
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const emotionData = useMemo(() => {
    const cutoff = subDays(new Date(), 30);
    return entries
      .filter(e => isAfter(parseISO(e.date), cutoff))
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(e => ({
        date: format(parseISO(e.date), "M/d"),
        score: e.emotionScore,
        tags: e.emotionTags.slice(0, 2).join(" "),
        id: e.id,
      }));
  }, [entries]);

  const recentFinance = useMemo(() => financeEntries.slice(0, 5), [financeEntries]);

  return (
    <div className="h-full overflow-y-auto px-4 max-w-[600px] mx-auto pb-4">
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

      {/* Emotion Curve */}
      {emotionData.length > 1 && (
        <div className="bg-surface-2 border border-border rounded-xl p-4 mb-4">
          <h2 className="text-xs text-muted-foreground font-mono-jb mb-3">情绪曲线</h2>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={emotionData}>
              <XAxis dataKey="date" tick={{ fill: "hsl(30 12% 37%)", fontSize: 9 }} axisLine={false} tickLine={false} />
              <YAxis domain={[1, 10]} tick={{ fill: "hsl(30 12% 37%)", fontSize: 9 }} axisLine={false} tickLine={false} width={20} />
              <Tooltip
                contentStyle={{ background: "hsl(30 25% 8%)", border: "1px solid hsl(30 28% 11%)", borderRadius: 8, fontSize: 11, color: "hsl(30 14% 78%)" }}
                formatter={(value: number) => [`${value}/10`, "情绪"]}
              />
              <Line type="monotone" dataKey="score" stroke="hsl(30 14% 78%)" strokeWidth={1.5}
                dot={{ fill: "hsl(30 14% 78%)", r: 2 }} activeDot={{ fill: "hsl(39 58% 53%)", r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
          <div className="flex gap-2 mt-2 overflow-x-auto scrollbar-none">
            {emotionData.map((d, i) => (
              <div key={i} className="text-center min-w-[40px]">
                <div className="text-[8px] text-muted-foreground/60">{d.tags}</div>
              </div>
            ))}
          </div>
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
        <div className="text-center py-16 text-muted-foreground text-xs">还没有记录</div>
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
                    <button onClick={() => deleteEntry(entry.id)} className="text-[10px] text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1 mt-2">
                      <Trash2 size={11} /> 删除
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
