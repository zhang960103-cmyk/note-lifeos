import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { ArrowLeft, ChevronDown, ChevronUp, Trash2, CheckSquare, Square } from "lucide-react";
import { format, parseISO, subDays, isAfter } from "date-fns";
import { LineChart, Line, XAxis, YAxis, ResponsiveContainer, Tooltip } from "recharts";

const HistoryPage = () => {
  const { entries, toggleTodo, deleteEntry } = useLifeOs();
  const navigate = useNavigate();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Emotion curve data (last 30 days)
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

  return (
    <div className="pb-24 px-4 max-w-[600px] mx-auto">
      <div className="flex items-center gap-3 py-4">
        <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-serif-sc text-lg text-foreground flex-1">回顾</h1>
        <span className="text-[10px] text-muted-foreground font-mono-jb">{entries.length} 天</span>
      </div>

      {/* Emotion Curve */}
      {emotionData.length > 1 && (
        <div className="bg-surface-2 border border-border rounded-xl p-4 mb-5">
          <h2 className="text-xs text-muted-foreground font-mono-jb mb-3">情绪曲线</h2>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={emotionData}>
              <XAxis
                dataKey="date"
                tick={{ fill: "hsl(30 12% 37%)", fontSize: 9 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                domain={[1, 10]}
                tick={{ fill: "hsl(30 12% 37%)", fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                width={20}
              />
              <Tooltip
                contentStyle={{
                  background: "hsl(30 25% 8%)",
                  border: "1px solid hsl(30 28% 11%)",
                  borderRadius: 8,
                  fontSize: 11,
                  color: "hsl(30 14% 78%)",
                }}
                formatter={(value: number) => [`${value}/10`, "情绪"]}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="hsl(30 14% 78%)"
                strokeWidth={1.5}
                dot={{ fill: "hsl(30 14% 78%)", r: 2 }}
                activeDot={{ fill: "hsl(39 58% 53%)", r: 4 }}
              />
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

      {/* Day list */}
      {entries.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground text-xs">
          还没有记录
        </div>
      ) : (
        <div className="space-y-2">
          {entries.map(entry => {
            const isExpanded = expandedId === entry.id;
            const userMsgs = entry.messages.filter(m => m.role === "user");
            const preview = userMsgs[0]?.content.slice(0, 60) || "无内容";

            return (
              <div key={entry.id} className="bg-surface-2 border border-border rounded-xl overflow-hidden">
                {/* Header */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : entry.id)}
                  className="w-full flex items-center gap-3 px-4 py-3 text-left"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] text-muted-foreground font-mono-jb">
                        {format(parseISO(entry.date), "M月d日")}
                      </span>
                      <span className="text-[10px] text-gold font-mono-jb">
                        {entry.emotionScore}/10
                      </span>
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

                {/* Expanded content */}
                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-border">
                    {/* Messages */}
                    <div className="space-y-3 py-3">
                      {entry.messages.map((msg, i) => (
                        <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                          <div
                            className={`max-w-[85%] rounded-2xl px-3 py-2 ${
                              msg.role === "user"
                                ? "bg-gold text-background rounded-br-sm text-xs leading-[1.8]"
                                : "text-muted-foreground rounded-bl-sm text-[11px] leading-[1.8]"
                            }`}
                          >
                            {msg.content}
                          </div>
                        </div>
                      ))}
                    </div>

                    {/* Tags */}
                    {(entry.topicTags.length > 0 || entry.emotionTags.length > 0) && (
                      <div className="flex gap-1 flex-wrap mb-2">
                        {entry.emotionTags.map(t => (
                          <span key={t} className="text-[9px] bg-surface-3 text-muted-foreground px-1.5 py-0.5 rounded">{t}</span>
                        ))}
                        {entry.topicTags.map(t => (
                          <span key={t} className="text-[9px] bg-gold-light text-gold px-1.5 py-0.5 rounded">{t}</span>
                        ))}
                      </div>
                    )}

                    {/* Todos */}
                    {entry.todos.length > 0 && (
                      <div className="space-y-1 mb-2">
                        {entry.todos.map(todo => (
                          <button
                            key={todo.id}
                            onClick={() => toggleTodo(entry.date, todo.id)}
                            className="flex items-center gap-2 w-full text-left text-xs"
                          >
                            {todo.completed
                              ? <CheckSquare size={13} className="text-los-green flex-shrink-0" />
                              : <Square size={13} className="text-muted-foreground flex-shrink-0" />}
                            <span className={todo.completed ? "line-through text-muted-foreground" : "text-foreground"}>
                              {todo.text}
                            </span>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Delete */}
                    <button
                      onClick={() => deleteEntry(entry.id)}
                      className="text-[10px] text-muted-foreground hover:text-destructive transition-colors flex items-center gap-1 mt-2"
                    >
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
