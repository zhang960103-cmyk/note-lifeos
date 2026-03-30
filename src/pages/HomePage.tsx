import { useState, useRef, useEffect, useCallback, useMemo, type ChangeEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Send, Loader2, DollarSign, X, Clock, Settings, Zap, Brain, Mic } from "lucide-react";
import VoiceInput from "@/components/VoiceInput";
import { streamChat, extractMeta, type ChatMsg } from "@/lib/streamChat";
import { buildMemoryContext, getKeyPatterns } from "@/lib/memoryEngine";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { createTodoFromExtract } from "@/hooks/useLifeOs";
import { format, subDays, parseISO } from "date-fns";
import type { TodoItem } from "@/types/lifeOs";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/life-mentor-chat`;
const ENERGY_LEVELS = [
  { value: "high", emoji: "🔥", labelKey: "home.energy.high" },
  { value: "medium", emoji: "⚡", labelKey: "home.energy.medium" },
  { value: "low", emoji: "🔋", labelKey: "home.energy.low" },
];

const QUICK_MOODS = [
  { emoji: "😊", labelKey: "home.mood.happy", score: 8, tag: "开心" },
  { emoji: "😌", labelKey: "home.mood.calm", score: 6, tag: "平静" },
  { emoji: "😤", labelKey: "home.mood.irritated", score: 3, tag: "烦躁" },
  { emoji: "😔", labelKey: "home.mood.down", score: 2, tag: "低落" },
  { emoji: "😰", labelKey: "home.mood.anxious", score: 3, tag: "焦虑" },
  { emoji: "🤩", labelKey: "home.mood.excited", score: 9, tag: "兴奋" },
];

const HomePage = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  // Auth no longer needed directly here - moved to settings
  const {
    todayEntry, todayKey, addMessage, updateDayMeta,
    addFinanceEntry, todayFinanceStats, wheelScores, entries, allTodos, toggleTodo,
    habits, setFocusTodo, addTodoToDate,
    energyLogs, addEnergyLog, energySummary, consecutiveLowDays,
  } = useLifeOs();
  const [dailyQuestion, setDailyQuestion] = useState<{ question: string; domain: string } | null>(null);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [showFinance, setShowFinance] = useState(false);
  const [financeNLInput, setFinanceNLInput] = useState("");
  const [financeNLLoading, setFinanceNLLoading] = useState(false);
  const [financeToast, setFinanceToast] = useState(false);
  const [todoToast, setTodoToast] = useState<string | null>(null);
  const [showEnergyPicker, setShowEnergyPicker] = useState(false);
  const [showBrainDump, setShowBrainDump] = useState(false);
  const [brainDumpText, setBrainDumpText] = useState("");
  const [showFocusPicker, setShowFocusPicker] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const canUseVoice = typeof window !== "undefined"
    && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
  const [showTagHint, setShowTagHint] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevTagCountRef = useRef(0);

  // Handle prefill from URL param (e.g. from InsightsPage)
  useEffect(() => {
    const prefill = searchParams.get("prefill");
    if (prefill) {
      setInput(prefill);
      textareaRef.current?.focus();
    }
  }, [searchParams]);

  const messages = todayEntry?.messages || [];
  const messagesRef = useRef(messages);
  useEffect(() => { messagesRef.current = messages; }, [messages]);

  const displayMessages = isLoading && streamingContent
    ? [...messages, { role: "assistant" as const, content: streamingContent, timestamp: new Date().toISOString() }]
    : messages;

  // Fix 5: abort cleanup on unmount
  useEffect(() => { return () => { abortRef.current?.abort(); }; }, []);

  // UX 3: Tag hint
  useEffect(() => {
    const currentCount = (todayEntry?.emotionTags.length || 0) + (todayEntry?.topicTags.length || 0);
    if (prevTagCountRef.current === 0 && currentCount > 0) {
      setShowTagHint(true);
      setTimeout(() => setShowTagHint(false), 3000);
    }
    prevTagCountRef.current = currentCount;
  }, [todayEntry?.emotionTags.length, todayEntry?.topicTags.length]);

  // UX 1: Status-aware greeting
  const statusGreeting = useMemo(() => {
    const h = new Date().getHours();
    const yesterday = format(subDays(new Date(), 1), "yyyy-MM-dd");
    const yesterdayEntry = entries.find(e => e.date === yesterday);

    // Priority 1: Yesterday low emotion
    if (yesterdayEntry && yesterdayEntry.emotionScore <= 4) {
      return { emoji: "🌧️", text: t("home.greeting.yesterday_low") };
    }

    // Priority 2: Habit streak 3+ days
    if (habits && habits.length > 0) {
      for (const habit of habits) {
        if (habit.checkIns && habit.checkIns.length >= 3) {
          const sorted = [...habit.checkIns].sort().reverse();
          let streak = 1;
          for (let i = 1; i < sorted.length; i++) {
            const prev = new Date(sorted[i - 1]);
            const curr = new Date(sorted[i]);
            const diff = (prev.getTime() - curr.getTime()) / (1000 * 60 * 60 * 24);
            if (diff <= 1.5) streak++;
            else break;
          }
          if (streak >= 3) {
            return { emoji: "⚡", text: t("home.greeting.streak", { days: streak }) };
          }
        }
      }
    }

    // Priority 3: Monday
    if (new Date().getDay() === 1) {
      return { emoji: "🚀", text: t("home.greeting.monday") };
    }

    if (h < 6) return { emoji: "🧭", text: t("home.greeting.night_late") };
    if (h < 9) return { emoji: "🧭", text: t("home.greeting.morning_early") };
    if (h < 12) return { emoji: "🧭", text: t("home.greeting.morning") };
    if (h < 14) return { emoji: "🧭", text: t("home.greeting.noon") };
    if (h < 18) return { emoji: "🧭", text: t("home.greeting.afternoon") };
    if (h < 21) return { emoji: "🧭", text: t("home.greeting.evening") };
    return { emoji: "🧭", text: t("home.greeting.night") };
  }, [entries, habits, t]);

  // Feature 4: Sunset ritual
  const isSunsetHour = useMemo(() => {
    const h = new Date().getHours();
    return h >= 20 && h <= 22;
  }, []);
  const showSunset = isSunsetHour && (!todayEntry || todayEntry.messages.length === 0);
  const sunsetText = useMemo(() => {
    if (!showSunset) return "";
    const completedCount = todayEntry?.todos.filter(t => t.status === "done").length || 0;
    return completedCount > 0
      ? `🌅 今天完成了 ${completedCount} 件事。写下今天的感受？`
      : "🌅 快到今天结束了。有什么想记录的吗？";
  }, [showSunset, todayEntry]);

  // Weekly letter ready check
  const weeklyLetterReady = useMemo(() => {
    const today = new Date();
    const isMonday = today.getDay() === 1;
    const lastWeekEntries = entries.filter(e => {
      const d = parseISO(e.date);
      return d >= subDays(today, 8) && d < subDays(today, 1);
    });
    const hasLastWeekData = lastWeekEntries.length >= 3;
    const weekKey = format(today, "yyyy-ww");
    const alreadyRead = localStorage.getItem(`letter_read_${weekKey}`);
    return isMonday && hasLastWeekData && !alreadyRead;
  }, [entries]);

  const handleOpenLetter = () => {
    const weekKey = format(new Date(), "yyyy-ww");
    localStorage.setItem(`letter_read_${weekKey}`, "1");
    navigate("/review?auto=weekly");
  };

  const handleQuickMood = (mood: typeof QUICK_MOODS[0]) => {
    updateDayMeta(todayKey, { emotionTags: [mood.tag], emotionScore: mood.score });
    sendMessage(`[快速情绪记录] ${mood.emoji} ${t(mood.labelKey)}`);
  };

  const focusTodo = useMemo(() => {
    return allTodos.find(t => t.status === "doing");
  }, [allTodos]);

  const todayUndoneTodos = useMemo(() => {
    return allTodos.filter(t => t.status === "todo" || t.status === "doing");
  }, [allTodos]);

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

  const handleInput = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const ta = e.currentTarget;
    ta.style.height = 'auto';
    ta.style.height = Math.min(ta.scrollHeight, 120) + 'px';
    setInput(ta.value);
  };

  const handleEnergyLog = async (level: string) => {
    setShowEnergyPicker(false);
    const emoji = ENERGY_LEVELS.find(e => e.value === level)?.emoji || "⚡";
    const cnLevel = level === "high" ? "高" : level === "medium" ? "中" : "低";
    // Save to Supabase
    await addEnergyLog(cnLevel as any);
    const text = `[精力记录] ${emoji} 当前精力：${cnLevel}`;
    sendMessage(text);
  };

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
      ...messagesRef.current.map(m => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: text },
    ];

    const memoryContext = buildMemoryContext(entries, 14);
    const patterns = getKeyPatterns(entries);
    // Inject energy summary into memory context
    const fullMemoryContext = [memoryContext, energySummary].filter(Boolean).join('\n');

    try {
      await streamChat({
        messages: allMsgs,
        mode: "default",
        memoryContext: fullMemoryContext,
        patterns,
        onDelta: (chunk) => {
          full += chunk;
          setStreamingContent(full);
        },
        onDone: () => {
          addMessage({ role: "assistant", content: full, timestamp: new Date().toISOString() });
          setStreamingContent("");
          setIsLoading(false);

          const msgsForExtract = [...allMsgs, { role: "assistant" as const, content: full }];
          const existingTodosForAI = allTodos
            .filter(t => t.status !== "dropped")
            .map(t => ({ id: t.id, text: t.text, status: t.status, priority: t.priority }));
          extractMeta(msgsForExtract, existingTodosForAI).then(meta => {
            if (meta.completedTodoIds?.length > 0) {
              meta.completedTodoIds.forEach(todoId => {
                const todo = allTodos.find(t => t.id === todoId);
                if (todo && todo.status !== "done") {
                  toggleTodo(todo.sourceDate || todayKey, todoId);
                }
              });
              setTodoToast(`✅ 已标记 ${meta.completedTodoIds.length} 条任务完成`);
              setTimeout(() => setTodoToast(null), 3000);
            }

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

              if (todoItems.length > 0) {
                setTodoToast(`已自动生成 ${todoItems.length} 条待办`);
                setTimeout(() => setTodoToast(null), 3000);
              }
            }

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

            // Auto-extract time blocks from diary and create time-tagged todos
            autoExtractTimeBlocks(msgsForExtract);
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
  }, [isLoading, addMessage, updateDayMeta, todayKey, addFinanceEntry, allTodos, toggleTodo]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // Feature 5: Natural language finance input
  const handleFinanceNL = async () => {
    if (!financeNLInput.trim() || financeNLLoading) return;
    setFinanceNLLoading(true);
    try {
      const meta = await extractMeta([{ role: "user", content: financeNLInput }]);
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
        setTodoToast(`💰 已记录 ¥${total}`);
        setTimeout(() => setTodoToast(null), 3000);
        setFinanceNLInput("");
        setShowFinance(false);
      } else {
        setTodoToast("未识别到金额，请重新描述");
        setTimeout(() => setTodoToast(null), 3000);
      }
    } catch {
      setTodoToast("解析失败，请重试");
      setTimeout(() => setTodoToast(null), 3000);
    }
    setFinanceNLLoading(false);
  };

  // Feature 2: Brain dump - simplified to send as chat message (chat already extracts todos)
  const handleBrainDump = async () => {
    if (!brainDumpText.trim()) return;
    const text = `🧠 脑清空：\n${brainDumpText}`;
    setShowBrainDump(false);
    setBrainDumpText("");
    sendMessage(text);
  };

  // Auto-extract time blocks from diary conversation and create time-tagged todos
  const autoExtractTimeBlocks = useCallback(async (msgs: ChatMsg[]) => {
    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ messages: msgs, mode: "time-extract" }),
      });
      if (!resp.ok) return;
      const data = await resp.json();
      const blocks = data.timeBlocks || [];
      if (blocks.length === 0) return;

      // Create time-tagged todos for each block so TimeStats can visualize them
      let created = 0;
      blocks.forEach((block: any) => {
        // Check if a matching todo already exists (avoid duplicates)
        const exists = allTodos.some(t => {
          const noteMatch = t.note?.includes(`⏱ ${block.startTime}-${block.endTime}`);
          const textMatch = t.text.toLowerCase().includes(block.activity.toLowerCase().slice(0, 6));
          return noteMatch || (textMatch && t.note?.includes("⏱"));
        });
        if (exists) return;

        const todo: TodoItem = {
          id: crypto.randomUUID(),
          text: block.activity,
          status: "done" as const,
          priority: "normal" as const,
          tags: [block.category || "其他"],
          subTasks: [],
          recur: "none" as const,
          note: `⏱ ${block.startTime}-${block.endTime} (${block.durationMinutes}分钟)${block.note ? `\n${block.note}` : ""}`,
          completedAt: new Date().toISOString(),
          sourceDate: todayKey,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };
        addTodoToDate(todayKey, todo);
        created++;
      });

      if (created > 0) {
        setTodoToast(`⏱ 已自动记录 ${created} 个时间段`);
        setTimeout(() => setTodoToast(null), 3000);
      }
    } catch {}
  }, [allTodos, todayKey, addTodoToDate]);

  // Feature 1: Go deeper
  const handleGoDeeper = (msgContent: string) => {
    const lastSentence = msgContent.split(/[。？！.?!\n]/).filter(Boolean).pop() || msgContent.slice(-30);
    sendMessage(`请针对你刚才说的「${lastSentence}」，再往深处挖一层。`);
  };

  return (
    <div className="flex flex-col h-full max-w-[600px] mx-auto relative">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2">
        <span className="text-xs text-muted-foreground font-mono-jb">{format(new Date(), "M月d日")}</span>
        <div className="flex gap-2">
          <button onClick={() => navigate("/history")} className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-surface-2">
            <Clock size={16} />
          </button>
          <button onClick={() => navigate("/settings")} className="text-muted-foreground hover:text-foreground transition-colors p-1.5 rounded-lg hover:bg-surface-2" title={t("settings.title")}>
            <Settings size={16} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {displayMessages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-[300px]">
              {/* Weekly letter card */}
              {weeklyLetterReady && (
                <button
                  onClick={handleOpenLetter}
                  className="w-full bg-gold/10 border border-gold-border rounded-xl px-4 py-3 mb-4 text-left hover:bg-gold/20 transition"
                >
                  <p className="text-xs text-gold font-serif-sc mb-1">📨 罗盘的来信</p>
                  <p className="text-[11px] text-foreground leading-[1.8]">本周有一封信在等你</p>
                  <span className="text-[10px] text-gold mt-1 inline-block">打开信件 →</span>
                </button>
              )}
              {/* Energy debt warning */}
              {consecutiveLowDays >= 3 && (
                <button
                  onClick={() => sendMessage("我已经连续低能量好几天了，帮我分析一下可能的原因？")}
                  className="w-full bg-los-red/10 border border-los-red/30 rounded-xl px-4 py-3 mb-3 text-left hover:bg-los-red/20 transition"
                >
                  <p className="text-xs text-los-red font-serif-sc mb-1">⚠️ 能量预警</p>
                  <p className="text-[11px] text-foreground leading-[1.8]">你已经连续{consecutiveLowDays}天低能量了</p>
                  <span className="text-[10px] text-los-red mt-1 inline-block">聊聊怎么回事 →</span>
                </button>
              )}
              {/* Feature 4: Sunset card */}
              {showSunset && (
                <button
                  onClick={() => textareaRef.current?.focus()}
                  className="bg-surface-2 rounded-xl px-4 py-3 mb-3 w-full text-left hover:bg-surface-3 transition"
                >
                  <p className="text-xs text-foreground leading-[1.8]">{sunsetText}</p>
                </button>
              )}
              {/* UX 1: Status-aware greeting */}
              <div className="text-3xl mb-4">{statusGreeting.emoji}</div>
              <p className="text-foreground text-sm leading-[1.8]">{statusGreeting.text}</p>
              <p className="text-muted-foreground text-xs mt-2 leading-[1.8]">{t("home.input.placeholder")}</p>
              {/* Emoji mood quick-pick */}
              <div className="flex justify-center gap-2 mt-4">
                {QUICK_MOODS.map(mood => (
                  <button
                    key={mood.tag}
                    onClick={() => handleQuickMood(mood)}
                    className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-lg hover:scale-110 hover:bg-surface-3 transition-all"
                    title={t(mood.labelKey)}
                  >
                    {mood.emoji}
                  </button>
                ))}
              </div>
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
              <div className={msg.role === "assistant" ? "max-w-[82%]" : ""}>
                <div
                  className={`max-w-full rounded-2xl px-4 py-3 ${
                    msg.role === "user"
                      ? `bg-gold text-background rounded-br-sm text-sm leading-[1.8]${i === displayMessages.length - 1 ? " animate-msg-in" : ""}`
                      : "text-muted-foreground rounded-bl-sm text-[13px] leading-[1.8]"
                  }`}
                >
                  {msg.content}
                </div>
                {/* Feature 1: Go Deeper button */}
                {msg.role === "assistant" && !isLoading && (
                  <button
                    onClick={() => handleGoDeeper(msg.content)}
                    className="text-[10px] text-muted-foreground/40 hover:text-gold cursor-pointer px-1 mt-0.5 transition-colors"
                  >
                    {t("home.go_deeper")}
                  </button>
                )}
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

      {/* Tags strip + UX 3: Tag hint */}
      {todayEntry && (todayEntry.emotionTags.length > 0 || todayEntry.topicTags.length > 0) && (
        <div className="px-4 py-1.5 flex gap-1.5 overflow-x-auto scrollbar-none items-center">
          {todayEntry.emotionTags.map(t => (
            <span key={t} className="text-[9px] bg-surface-2 text-muted-foreground px-2 py-0.5 rounded-full whitespace-nowrap">{t}</span>
          ))}
          {todayEntry.topicTags.map(t => (
            <span key={t} className="text-[9px] bg-gold-light text-gold px-2 py-0.5 rounded-full whitespace-nowrap">{t}</span>
          ))}
          <span className={`text-[9px] text-muted-foreground/50 whitespace-nowrap transition-opacity duration-500 ${showTagHint ? "opacity-100" : "opacity-0"}`}>
            {t("home.tag_hint")}
          </span>
        </div>
      )}

      {/* Toasts */}
      {financeToast && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-los-green text-background text-xs px-4 py-1.5 rounded-full animate-pulse z-50">
          已记录 ✓
        </div>
      )}
      {todoToast && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-gold text-background text-xs px-4 py-1.5 rounded-full animate-pulse z-50">
          📝 {todoToast}
        </div>
      )}

      {/* Energy picker */}
      {showEnergyPicker && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-surface-2 border border-border rounded-xl px-3 py-2 flex gap-2 animate-in fade-in z-50">
          {ENERGY_LEVELS.map(e => (
            <button key={e.value} onClick={() => handleEnergyLog(e.value)} className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg hover:bg-surface-3 transition">
              <span className="text-lg">{e.emoji}</span>
              <span className="text-[9px] text-muted-foreground">{t(e.labelKey)}</span>
            </button>
          ))}
        </div>
      )}

      {/* Feature 3: Focus bar */}
      <div className="px-4 h-6 flex items-center">
        <button onClick={() => setShowFocusPicker(true)} className="w-full text-left truncate">
          {focusTodo ? (
            <span className="text-[11px] text-gold">{t("home.focus.now")}{focusTodo.text.slice(0, 20)}{focusTodo.text.length > 20 ? "..." : ""}</span>
          ) : (
            <span className="text-[11px] text-muted-foreground/50">{t("home.focus.none")}</span>
          )}
        </button>
      </div>

      {/* Input */}
      <div className="px-4 py-3 pb-2">
        <div className="flex gap-2 items-end">
          <button
            onClick={() => setShowEnergyPicker(!showEnergyPicker)}
            className="text-muted-foreground hover:text-gold transition-colors p-2.5 flex-shrink-0"
            title="记录精力"
          >
            <Zap size={18} />
          </button>
          <button
            onClick={() => setShowFinance(!showFinance)}
            className="text-muted-foreground hover:text-gold transition-colors p-2.5 flex-shrink-0"
          >
            <DollarSign size={18} />
          </button>
          <button
            onClick={() => setShowBrainDump(true)}
            className="text-muted-foreground hover:text-gold transition-colors p-2.5 flex-shrink-0"
            title="脑清空"
          >
            <Brain size={18} />
          </button>
          {canUseVoice && (
            <button
              onClick={() => setShowVoice(true)}
              className="text-muted-foreground hover:text-gold transition-colors p-2.5 flex-shrink-0"
              title="语音输入"
            >
              <Mic size={18} />
            </button>
          )}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            placeholder={t("home.input.placeholder")}
            rows={3}
            className="flex-1 bg-surface-2 border border-border rounded-2xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:border-gold-border transition-colors leading-[1.8]"
            style={{ minHeight: "72px", maxHeight: "160px" }}
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

      {/* Feature 5: Finance Sheet - NL input */}
      {showFinance && (
        <div className="absolute inset-x-0 bottom-0 bg-surface-1 border-t border-border rounded-t-2xl p-5 z-50 animate-in slide-in-from-bottom">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs text-foreground font-serif-sc">{t("home.finance.title")}</span>
            <button onClick={() => setShowFinance(false)} className="text-muted-foreground">
              <X size={16} />
            </button>
          </div>
          <div className="flex gap-3 text-center mb-4">
            <div className="flex-1 bg-surface-2 rounded-lg py-2">
              <div className="text-[10px] text-muted-foreground">{t("home.finance.income")}</div>
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
          <div className="space-y-3">
            <input
              value={financeNLInput}
              onChange={e => setFinanceNLInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleFinanceNL(); }}
              placeholder="随便说，如：今天收了600学费，买书花了89..."
              className="w-full bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-gold-border"
              autoFocus
            />
            <button
              onClick={handleFinanceNL}
              disabled={!financeNLInput.trim() || financeNLLoading}
              className="w-full bg-gold text-background py-2.5 rounded-xl text-sm disabled:opacity-30 hover:bg-gold/90 transition flex items-center justify-center gap-2"
            >
              {financeNLLoading ? <Loader2 size={14} className="animate-spin" /> : null}
              AI 智能记账
            </button>
          </div>
        </div>
      )}

      {/* Feature 2: Brain Dump Sheet - simplified (sends to chat for auto-extraction) */}
      {showBrainDump && (
        <div className="absolute inset-x-0 bottom-0 bg-surface-1 border-t border-border rounded-t-2xl z-50 animate-in slide-in-from-bottom flex flex-col" style={{ height: "50vh" }}>
          <div className="flex justify-between items-center p-4 pb-2">
            <span className="text-xs text-foreground font-serif-sc">🧠 脑清空</span>
            <button onClick={() => setShowBrainDump(false)} className="text-muted-foreground">
              <X size={16} />
            </button>
          </div>
          <p className="px-4 text-[10px] text-muted-foreground mb-2">随便倒，罗盘会自动整理成待办、记录时间和财务</p>
          <textarea
            value={brainDumpText}
            onChange={e => setBrainDumpText(e.target.value)}
            placeholder="把脑子里所有想法随便倒出来..."
            className="flex-1 mx-4 bg-surface-2 border border-border rounded-xl px-4 py-3 text-sm text-foreground resize-none focus:outline-none focus:border-gold-border leading-[1.8]"
            autoFocus
          />
          <div className="p-4 pt-2">
            <button
              onClick={handleBrainDump}
              disabled={!brainDumpText.trim() || isLoading}
              className="w-full bg-gold text-background py-3 rounded-xl text-sm disabled:opacity-30 hover:bg-gold/90 transition flex items-center justify-center gap-2"
            >
              📤 发给罗盘整理
            </button>
          </div>
        </div>
      )}

      {/* Feature 3: Focus picker sheet */}
      {showFocusPicker && (
        <div className="absolute inset-x-0 bottom-0 bg-surface-1 border-t border-border rounded-t-2xl p-5 z-50 animate-in slide-in-from-bottom max-h-[50vh] flex flex-col">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs text-foreground font-serif-sc">选择聚焦任务</span>
            <button onClick={() => setShowFocusPicker(false)} className="text-muted-foreground">
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1">
            {todayUndoneTodos.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">暂无待办任务</p>
            ) : (
              todayUndoneTodos.map(todo => (
                <button
                  key={todo.id}
                  onClick={() => {
                    setFocusTodo(todo.sourceDate || todayKey, todo.id);
                    setShowFocusPicker(false);
                  }}
                  className={`w-full text-left px-3 py-2 rounded-lg text-xs transition ${
                    todo.status === "doing" ? "bg-gold/20 text-gold" : "bg-surface-2 text-foreground hover:bg-surface-3"
                  }`}
                >
                  {todo.status === "doing" ? "⚡ " : ""}{todo.text}
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Voice Input */}
      {showVoice && (
        <VoiceInput
          onTranscript={(text) => {
            setShowVoice(false);
            setInput(text);
          }}
          onClose={() => setShowVoice(false)}
        />
      )}
    </div>
  );
};

export default HomePage;
