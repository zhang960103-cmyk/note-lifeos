import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Send, Loader2, DollarSign, X, Clock, BookOpen } from "lucide-react";
import { streamChat, extractMeta, type ChatMsg } from "@/lib/streamChat";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { createTodoFromExtract } from "@/hooks/useLifeOs";
import { format } from "date-fns";
import type { TodoItem } from "@/types/lifeOs";

const CATEGORIES = ["教学", "内容", "餐饮", "交通", "购物", "其他"];
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/life-mentor-chat`;

const HomePage = () => {
  const navigate = useNavigate();
  const {
    todayEntry, todayKey, addMessage, updateDayMeta,
    addFinanceEntry, todayFinanceStats, wheelScores,
  } = useLifeOs();
  const [dailyQuestion, setDailyQuestion] = useState<{ question: string; domain: string } | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [showFinance, setShowFinance] = useState(false);
  const [financeType, setFinanceType] = useState<"income" | "expense" | null>(null);
  const [financeAmount, setFinanceAmount] = useState("");
  const [financeCategory, setFinanceCategory] = useState("其他");
  const [financeNote, setFinanceNote] = useState("");
  const [financeToast, setFinanceToast] = useState(false);
  const [todoToast, setTodoToast] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const messages = todayEntry?.messages || [];
  const displayMessages = isLoading && streamingContent
    ? [...messages, { role: "assistant" as const, content: streamingContent, timestamp: new Date().toISOString() }]
    : messages;

  // Fetch daily question when no messages today
  useEffect(() => {
    if (messages.length === 0 && wheelScores.length > 0) {
      const lastScores = wheelScores[0].scores;
      fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ mode: "daily-question", messages: [], scores: lastScores }),
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => { if (data?.question) setDailyQuestion(data); })
        .catch(() => {});
    }
  }, [messages.length, wheelScores]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages.length, streamingContent]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg = { role: "user" as const, content: text, timestamp: new Date().toISOString() };
    addMessage(userMsg);
    setInput("");
    setIsLoading(true);
    setStreamingContent("");

    const controller = new AbortController();
    abortRef.current = controller;

    let full = "";
    const allMsgs: ChatMsg[] = [
      ...messages.map(m => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: text },
    ];

    try {
      await streamChat({
        messages: allMsgs,
        mode: "default",
        onDelta: (chunk) => {
          full += chunk;
          setStreamingContent(full);
        },
        onDone: () => {
          addMessage({ role: "assistant", content: full, timestamp: new Date().toISOString() });
          setStreamingContent("");
          setIsLoading(false);

          // Background extraction
          const msgsForExtract = [...allMsgs, { role: "assistant" as const, content: full }];
          extractMeta(msgsForExtract).then(meta => {
            const todoItems: TodoItem[] = (meta.todos || []).map(t =>
              createTodoFromExtract(t, todayKey)
            );

            if (meta.emotionTags.length || meta.topicTags.length || todoItems.length) {
              updateDayMeta(todayKey, {
                emotionTags: meta.emotionTags,
                topicTags: meta.topicTags,
                todos: todoItems.length > 0 ? todoItems : undefined,
                emotionScore: meta.emotionScore || undefined,
              });

              // Show toast for auto-created todos
              if (todoItems.length > 0) {
                setTodoToast(`已自动生成 ${todoItems.length} 条待办`);
                setTimeout(() => setTodoToast(null), 3000);
              }
            }

            // Auto-save finance hints with visible feedback
            if (meta.financeHints && meta.financeHints.length > 0) {
              meta.financeHints.forEach(hint => {
                addFinanceEntry({
                  date: todayKey,
                  type: hint.type,
                  amount: hint.amount,
                  category: hint.category,
                  note: hint.note,
                });
              });
              const total = meta.financeHints.reduce((s, h) => s + h.amount, 0);
              const types = meta.financeHints.map(h => h.type === "income" ? "收入" : "支出").join("、");
              setFinanceToast(true);
              setTodoToast(`💰 已自动记录${types} ¥${total}`);
              setTimeout(() => { setFinanceToast(false); setTodoToast(null); }, 3000);
            }
          });
        },
        signal: controller.signal,
      });
    } catch (e: any) {
      if (e.name !== "AbortError") {
        addMessage({ role: "assistant", content: `抱歉，出了点问题。${e.message || ""}`, timestamp: new Date().toISOString() });
      }
      setStreamingContent("");
      setIsLoading(false);
    }
  }, [isLoading, messages, addMessage, updateDayMeta, todayKey, addFinanceEntry]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const handleFinanceSave = () => {
    if (!financeType || !financeAmount) return;
    addFinanceEntry({
      date: todayKey,
      type: financeType,
      amount: parseFloat(financeAmount),
      category: financeCategory,
      note: financeNote,
    });
    setFinanceType(null);
    setFinanceAmount("");
    setFinanceNote("");
    setShowFinance(false);
    setFinanceToast(true);
    setTimeout(() => setFinanceToast(false), 2000);
  };

  return (
    <div className="flex flex-col h-full max-w-[600px] mx-auto relative">
      {/* Top bar with History & Guide */}
      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-xs text-muted-foreground font-mono-jb">{format(new Date(), "M月d日")}</span>
        <div className="flex gap-2">
          <button onClick={() => navigate("/history")} className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-surface-2">
            <Clock size={16} />
          </button>
          <button onClick={() => navigate("/guide")} className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-surface-2">
            <BookOpen size={16} />
          </button>
        </div>
      </div>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {displayMessages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-[300px]">
              <div className="text-3xl mb-4">🧭</div>
              <p className="text-foreground text-sm leading-[1.8]">今天，你想说什么？</p>
              <p className="text-muted-foreground text-xs mt-2 leading-[1.8]">随便聊，我在听。</p>
              {dailyQuestion && (
                <div className="mt-6 bg-surface-2 border border-border rounded-xl px-4 py-3 text-left">
                  <p className="text-[10px] text-gold font-mono-jb mb-1">💭 今日一问 · {dailyQuestion.domain}</p>
                  <p className="text-xs text-foreground leading-[1.8] mb-2">{dailyQuestion.question}</p>
                  <button
                    onClick={() => setInput(dailyQuestion.question)}
                    className="text-[10px] text-gold hover:text-gold/80 transition-colors"
                  >
                    回应这个问题 →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="space-y-4">
          {displayMessages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[82%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-gold text-background rounded-br-sm text-sm leading-[1.8]"
                    : "text-muted-foreground rounded-bl-sm text-[13px] leading-[1.8]"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {isLoading && !streamingContent && (
            <div className="flex justify-start">
              <div className="px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>
        <div ref={chatEndRef} />
      </div>

      {/* Tags strip */}
      {todayEntry && (todayEntry.emotionTags.length > 0 || todayEntry.topicTags.length > 0) && (
        <div className="px-4 py-1.5 flex gap-1.5 overflow-x-auto scrollbar-none">
          {todayEntry.emotionTags.map(t => (
            <span key={t} className="text-[9px] bg-surface-2 text-muted-foreground px-2 py-0.5 rounded-full whitespace-nowrap">{t}</span>
          ))}
          {todayEntry.topicTags.map(t => (
            <span key={t} className="text-[9px] bg-gold-light text-gold px-2 py-0.5 rounded-full whitespace-nowrap">{t}</span>
          ))}
        </div>
      )}

      {/* Finance toast */}
      {financeToast && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-los-green text-background text-xs px-4 py-1.5 rounded-full animate-pulse">
          已记录 ✓
        </div>
      )}

      {todoToast && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-gold text-background text-xs px-4 py-1.5 rounded-full animate-pulse">
          📝 {todoToast}
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 pb-2">
        <div className="flex gap-2 items-end">
          <button
            onClick={() => setShowFinance(!showFinance)}
            className="text-muted-foreground hover:text-gold transition-colors p-2.5 flex-shrink-0"
          >
            <DollarSign size={18} />
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="说点什么..."
            rows={1}
            className="flex-1 bg-surface-2 border border-border rounded-2xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:border-gold-border transition-colors leading-[1.8]"
            style={{ minHeight: "42px", maxHeight: "120px" }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="bg-gold text-background rounded-full p-2.5 disabled:opacity-20 hover:bg-gold/90 transition-all flex-shrink-0"
          >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>

      {/* Finance Sheet */}
      {showFinance && (
        <div className="absolute inset-x-0 bottom-0 bg-surface-1 border-t border-border rounded-t-2xl p-5 z-50 animate-in slide-in-from-bottom">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs text-foreground font-serif-sc">记账</span>
            <button onClick={() => { setShowFinance(false); setFinanceType(null); }} className="text-muted-foreground">
              <X size={16} />
            </button>
          </div>

          {/* Today summary */}
          <div className="flex gap-3 text-center mb-4">
            <div className="flex-1 bg-surface-2 rounded-lg py-2">
              <div className="text-[10px] text-muted-foreground">收入</div>
              <div className="text-sm text-los-green font-mono-jb">¥{todayFinanceStats.income}</div>
            </div>
            <div className="flex-1 bg-surface-2 rounded-lg py-2">
              <div className="text-[10px] text-muted-foreground">支出</div>
              <div className="text-sm text-los-orange font-mono-jb">¥{todayFinanceStats.expense}</div>
            </div>
            <div className="flex-1 bg-surface-2 rounded-lg py-2">
              <div className="text-[10px] text-muted-foreground">净值</div>
              <div className="text-sm text-gold font-mono-jb">¥{todayFinanceStats.net}</div>
            </div>
          </div>

          {!financeType ? (
            <div className="flex gap-3">
              <button onClick={() => setFinanceType("income")} className="flex-1 bg-los-green/20 text-los-green py-3 rounded-xl text-sm hover:bg-los-green/30 transition">+ 收入</button>
              <button onClick={() => setFinanceType("expense")} className="flex-1 bg-los-orange/20 text-los-orange py-3 rounded-xl text-sm hover:bg-los-orange/30 transition">- 支出</button>
            </div>
          ) : (
            <div className="space-y-3">
              <input
                type="number"
                value={financeAmount}
                onChange={e => setFinanceAmount(e.target.value)}
                placeholder="金额"
                className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-foreground text-lg font-mono-jb focus:outline-none focus:border-gold-border"
                autoFocus
              />
              <div className="flex gap-1.5 flex-wrap">
                {CATEGORIES.map(c => (
                  <button
                    key={c}
                    onClick={() => setFinanceCategory(c)}
                    className={`text-xs px-3 py-1 rounded-full transition ${financeCategory === c ? "bg-gold text-background" : "bg-surface-2 text-muted-foreground"}`}
                  >
                    {c}
                  </button>
                ))}
              </div>
              <input
                value={financeNote}
                onChange={e => setFinanceNote(e.target.value)}
                placeholder="备注（可选）"
                className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2 text-sm text-foreground focus:outline-none focus:border-gold-border"
              />
              <button
                onClick={handleFinanceSave}
                disabled={!financeAmount}
                className="w-full bg-gold text-background py-2.5 rounded-xl text-sm disabled:opacity-30 hover:bg-gold/90 transition"
              >
                确认
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default HomePage;
