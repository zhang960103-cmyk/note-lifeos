import { useState, useRef, useEffect, useCallback, useMemo, type ChangeEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Send, Loader2, X, Clock, Settings, Mic, Plus, Zap, CalendarDays, AlertCircle, Search, Flame } from "lucide-react";
import VoiceInput from "@/components/VoiceInput";
import { streamChat, extractMeta, type ChatMsg, type ExtractResult } from "@/lib/streamChat";
import { recognizeIntent, detectPlanGaps, generateDayPlan, formatDayPlan } from "@/lib/intentEngine";
import { extractTimeBlocks, hasTimeHints } from "@/lib/timeExtractor"; // 本地快速时间提取
import { updateKRProgressFromGoalHints } from "@/pages/GoalsPage";
import { buildMemoryContext, getKeyPatterns } from "@/lib/memoryEngine";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";
import { createTodoFromExtract } from "@/hooks/useLifeOs";
import { supabase } from "@/integrations/supabase/client";
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
  const { user } = useAuth();
  const {
    todayEntry, todayKey, addMessage, updateDayMeta,
    addFinanceEntry, todayFinanceStats, wheelScores, entries, allTodos, toggleTodo,
    habits, setFocusTodo, addTodoToDate,
    energyLogs, addEnergyLog, energySummary, consecutiveLowDays,
  } = useLifeOs();
  const [dailyQuestion, setDailyQuestion] = useState<{ question: string; domain: string } | null>(null);
  const [input, setInput] = useState("");
  const [pastedImage, setPastedImage] = useState<string | null>(null); // N4: base64 image
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [todoToast, setTodoToast] = useState<string | null>(null);
  const [showFocusPicker, setShowFocusPicker] = useState(false);
  const [showVoice, setShowVoice] = useState(false);
  const [showToolMenu, setShowToolMenu] = useState(false);
  const [planMode, setPlanMode] = useState(false);        // 规划模式：收集任务中
  const [planTasks, setPlanTasks] = useState<string[]>([]); // 收集到的任务列表
  const [showGaps, setShowGaps] = useState(false);        // 显示计划漏洞提示
  const [gaps, setGaps] = useState<ReturnType<typeof detectPlanGaps>>([]); // 漏洞列表
  const canUseVoice = typeof window !== "undefined"
    && ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);
  const [showTagHint, setShowTagHint] = useState(false);
  const [extractFailed, setExtractFailed] = useState(false);
  const [retryMsgs, setRetryMsgs] = useState<ChatMsg[] | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevTagCountRef = useRef(0);
  const [isProcessing, setIsProcessing] = useState(false);

  // #2: Long-press for message actions (mobile-friendly)
  const longPressTimer = useRef<number | null>(null);
  const [longPressIdx, setLongPressIdx] = useState<number | null>(null);
  const handleMsgTouchStart = (idx: number) => {
    longPressTimer.current = window.setTimeout(() => setLongPressIdx(idx), 500);
  };
  const handleMsgTouchEnd = () => {
    if (longPressTimer.current) clearTimeout(longPressTimer.current);
  };
  const copyMsg = (content: string) => {
    navigator.clipboard.writeText(content);
    setLongPressIdx(null);
  };

  // R1: AI 每日调用配额（防止成本失控）
  const DAILY_LIMIT = 30;
  const todayCallKey = `ai_calls_${todayKey}`;
  const aiCallCount = parseInt(localStorage.getItem(todayCallKey) || "0");
  const aiQuotaExceeded = aiCallCount >= DAILY_LIMIT;
  const bumpAiCall = () => localStorage.setItem(todayCallKey, String(aiCallCount + 1));

  // Android keyboard fix: listen to visualViewport resize to prevent input being hidden
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handleResize = () => {
      const offset = window.innerHeight - vv.height;
      document.documentElement.style.setProperty("--keyboard-offset", `${offset}px`);
    };
    vv.addEventListener("resize", handleResize);
    vv.addEventListener("scroll", handleResize);
    return () => { vv.removeEventListener("resize", handleResize); vv.removeEventListener("scroll", handleResize); };
  }, []);

  // Crisis keyword detection
  const CRISIS_PATTERNS = [
    /不想活了|活着没意思|结束生命|自杀|轻生|不如死了/,
    /活不下去|太痛苦了.{0,10}(不想|不愿)|已经放弃了一切/,
  ];
  const checkCrisis = (text: string) => CRISIS_PATTERNS.some(p => p.test(text));

  // Streak calculation
  const streak = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    let count = 0;
    let d = new Date();
    while (true) {
      const key = format(d, "yyyy-MM-dd");
      const hasEntry = entries.some(e => e.date === key && e.messages.length > 0);
      if (!hasEntry && key !== today) break;
      if (hasEntry) count++;
      d = new Date(d.getTime() - 86400000);
      if (count > 365) break;
    }
    return count;
  }, [entries]);

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
      ? t("home.sunset.completed", { count: completedCount })
      : t("home.sunset.empty");
  }, [showSunset, todayEntry, t]);

  // Weekly letter ready check - show any day if enough data exists
  const weeklyLetterReady = useMemo(() => {
    const today = new Date();
    const lastWeekEntries = entries.filter(e => {
      const d = parseISO(e.date);
      return d >= subDays(today, 8) && d < subDays(today, 1);
    });
    const hasLastWeekData = lastWeekEntries.length >= 3;
    const weekKey = format(today, "yyyy-ww");
    const alreadyRead = localStorage.getItem(`letter_read_${weekKey}`);
    return hasLastWeekData && !alreadyRead;
  }, [entries]);

  const handleOpenLetter = () => {
    const weekKey = format(new Date(), "yyyy-ww");
    localStorage.setItem(`letter_read_${weekKey}`, "1");
    navigate("/review?auto=weekly");
  };

  // ── 今日简报 ──
  const handleBriefing = () => {
    // 同时触发漏洞检测
    const detectedGaps = detectPlanGaps({
      todayTodos: allTodos.filter(t => t.sourceDate === todayKey || !t.sourceDate),
      allTodos,
      habits,
      todayKey,
    });
    if (detectedGaps.length > 0) {
      setGaps(detectedGaps);
      setShowGaps(true);
    }

    const overdueTodos = allTodos.filter(t => t.status !== "done" && t.status !== "dropped" && t.dueDate && t.dueDate < todayKey);
    const doingTodo = allTodos.find(t => t.status === "doing");
    const todayTodos = allTodos.filter(t => t.status === "todo" || t.status === "doing");
    const latestEnergy = energyLogs[0];
    const h = new Date().getHours();
    const greeting = h < 12 ? "早上好" : h < 18 ? "下午好" : "晚上好";

    const briefingText = `${greeting}，帮我做一个今日简报：
- 今天待办 ${todayTodos.length} 件${doingTodo ? `，正在专注：${doingTodo.text}` : ""}
- 逾期未完成 ${overdueTodos.length} 件${overdueTodos.length > 0 ? `：${overdueTodos.slice(0, 2).map(t => t.text).join("、")}` : ""}
- 当前精力状态：${latestEnergy ? `${latestEnergy.level}（${format(new Date(latestEnergy.timestamp), "HH:mm")}记录）` : "未记录"}
- 今天是 ${format(new Date(), "M月d日")} ${["周日", "周一", "周二", "周三", "周四", "周五", "周六"][new Date().getDay()]}
请给我一个简短的今日状态分析和最重要的一件事建议。`;
    sendMessage(briefingText);
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

  // N4: Handle image paste from clipboard
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = Array.from(e.clipboardData.items);
    const imageItem = items.find(item => item.type.startsWith("image/"));
    if (!imageItem) return;
    e.preventDefault();
    const file = imageItem.getAsFile();
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { // 2MB limit
      alert("图片不能超过2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setPastedImage(ev.target?.result as string);
    reader.readAsDataURL(file);
  };


  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading || isProcessing) return;
    if (aiQuotaExceeded) {
      addMessage({ role: "assistant" as const, content: `今天已达到每日 ${DAILY_LIMIT} 次对话上限，明天继续。如需更多，请升级到 Pro 版本。`, timestamp: new Date().toISOString() });
      return;
    }
    bumpAiCall();

    // ── 危机关键词检测 ────────────────────────────────────────────────────────
    if (checkCrisis(text)) {
      addMessage({ role: "user" as const, content: text, timestamp: new Date().toISOString() });
      addMessage({
        role: "assistant" as const,
        content: `我听到你说的了。这些话让我很担心你现在的状态。\n\n你不需要独自承受这些——现在有人可以陪你：\n\n📞 **北京心理危机研究与干预中心**：010-82951332\n📞 **全国心理援助热线**：400-161-9995\n📞 **生命热线**：400-821-1215（24小时）\n\n你愿意告诉我，现在是什么让你有这种感受吗？我在这里陪你。`,
        timestamp: new Date().toISOString(),
      });
      setInput("");
      return;
    }
    // ─────────────────────────────────────────────────────────────────────────

    // ── 意图识别层（本地，毫秒级）──────────────────────────────────────────
    const intentResult = recognizeIntent(text);

    // 规划模式：收集任务后生成时间计划
    if (intentResult.intent === "plan_day" || intentResult.intent === "plan_week") {
      const isPlanDay = intentResult.intent === "plan_day";
      // 先给用户即时反馈
      const quickReply = isPlanDay
        ? "好的，帮你安排今天！请告诉我今天要做的事情（可以一次说多件）："
        : "好的，帮你规划本周！请列出这周最重要的几件事：";
      setPlanMode(true);
      setPlanTasks([]);
      setIsProcessing(true);
      addMessage({ role: "user" as const, content: text, timestamp: new Date().toISOString() });
      addMessage({ role: "assistant" as const, content: quickReply, timestamp: new Date().toISOString() });
      setIsProcessing(false);
      setInput("");

      // 同时触发漏洞检测
      const detectedGaps = detectPlanGaps({ todayTodos: allTodos.filter(t => t.sourceDate === todayKey || !t.sourceDate), allTodos, habits, todayKey });
      if (detectedGaps.length > 0) { setGaps(detectedGaps); setShowGaps(true); }
      return;
    }

    // 规划模式收集阶段：用户说出任务，积累后生成计划
    if (planMode) {
      const newTasks = [...planTasks, text];
      setPlanTasks(newTasks);
      // 如果用户说"好了"/"就这些"/"完了"，或者已经收集了3+个任务，生成计划
      const isDone = /好了|就这些|没了|完了|结束|ok|OK|确认/.test(text) || newTasks.length >= 5;
      if (isDone) {
        setPlanMode(false);
        const latestEnergy = energyLogs[0];
        const energyLevel = latestEnergy?.level === "高" ? "high" : latestEnergy?.level === "低" ? "low" : "medium";
        const plan = generateDayPlan(newTasks.filter(t => !/好了|就这些|没了/.test(t)), energyLevel);
        const planText = formatDayPlan(plan, newTasks);
        addMessage({ role: "user" as const, content: text, timestamp: new Date().toISOString() });
        addMessage({ role: "assistant" as const, content: planText, timestamp: new Date().toISOString() });
        setInput("");
        // 自动创建待办
        newTasks.filter(t => !/好了|就这些|没了/.test(t)).forEach(task => {
          addTodoToDate(todayKey, createTodoFromExtract({ text: task }, todayKey));
        });
        setTodoToast(`📅 已创建 ${newTasks.length} 个待办并安排时间`);
        setTimeout(() => setTodoToast(null), 3000);
      } else {
        // 继续收集，给出确认
        addMessage({ role: "user" as const, content: text, timestamp: new Date().toISOString() });
        addMessage({ role: "assistant" as const, content: `好，记下了「${text}」。还有其他要安排的吗？说完告诉我"好了"，我来生成时间计划。`, timestamp: new Date().toISOString() });
        setInput("");
      }
      return;
    }

    // 突发重排识别
    if (intentResult.intent === "replan") {
      // 注入当前时间块信息到context
      const currentHour = new Date().getHours();
      const remainingTodos = allTodos.filter(t => t.status === "todo");
      const replanContext = `[突发重排请求] 当前时间：${currentHour}:00，今日剩余待办：${remainingTodos.map(t => t.text).join("、") || "无"}`;
      const enrichedText = `${text}\n\n${replanContext}`;
      // 走正常AI流程但带上重排上下文
      return sendMessage(enrichedText);
    }
    // ─────────────────────────────────────────────────────────────────────────

    setIsProcessing(true);
    // N4: If image was pasted, prepend a note to the text
    const fullText = pastedImage ? `[附有图片] ${text}` : text;
    const userMsg = { role: "user" as const, content: fullText, timestamp: new Date().toISOString() };
    if (pastedImage) setPastedImage(null); // Clear after sending
    addMessage(userMsg);
    setInput("");
    setIsLoading(true);
    setStreamingContent("");

    const controller = new AbortController();
    abortRef.current = controller;

    // 提前获取用户 JWT，传给 Edge Function 以支持自定义模型
    const { data: { session } } = await supabase.auth.getSession();
    const accessToken = session?.access_token;

    // 提前快照，避免异步回调里 allTodos stale closure
    const todosSnapshot = [...allTodos];

    let full = "";
    const allMsgs: ChatMsg[] = [
      ...messagesRef.current.map(m => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: text },
    ];

    const memoryContext = buildMemoryContext(entries, 14);
    const patterns = getKeyPatterns(entries);
    // Inject energy summary + page context into memory context
    const pageContext = `当前页面：主页对话（home-chat）\n今日待办：${allTodos.filter(t=>t.status==="todo"||t.status==="doing").length}件\n今日情绪：${todayEntry?.emotionScore || "未记录"}/10`;
    const fullMemoryContext = [memoryContext, energySummary, pageContext].filter(Boolean).join('\n');

    try {
      await streamChat({
        messages: allMsgs,
        mode: "default",
        memoryContext: fullMemoryContext,
        patterns,
        accessToken,
        onDelta: (chunk) => {
          full += chunk;
          setStreamingContent(full);
        },
        onDone: () => {
          addMessage({ role: "assistant", content: full, timestamp: new Date().toISOString() });
          setStreamingContent("");
          setIsLoading(false);
          setIsProcessing(false);

          const msgsForExtract = [...allMsgs, { role: "assistant" as const, content: full }];
          const existingTodosForAI = todosSnapshot
            .filter(t => t.status !== "dropped")
            .map(t => ({ id: t.id, text: t.text, status: t.status, priority: t.priority }));
          setExtractFailed(false);
          setRetryMsgs(msgsForExtract);
          extractMeta(msgsForExtract, existingTodosForAI, accessToken).then(meta => {
            if (meta.completedTodoIds?.length > 0) {
              meta.completedTodoIds.forEach(todoId => {
                const todo = todosSnapshot.find(t => t.id === todoId);
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

            // Auto-link KR progress from goalHints
            if (meta.goalHints && meta.goalHints.length > 0 && user) {
              updateKRProgressFromGoalHints(meta.goalHints, user.id);
            }

            // 只有对话里含时间信息时才发起时间块提取，节省 API 额度
            const combinedText = text + full;
            const hasTimeHints = /\d{1,2}[:：点时]\d{0,2}|上午|下午|凌晨|小时|分钟|半天|整天/.test(combinedText);
            autoExtractTimeBlocks(msgsForExtract);
          }).catch(() => {
            setExtractFailed(true);
            setIsProcessing(false);
          });
        },
        signal: controller.signal,
        maxRetries: 2,
        timeoutMs: 30000,
      });
    } catch (e: any) {
      if (e.name !== "AbortError") {
        const errorMsg = e.message || "网络错误，请检查连接";
        console.error("[sendMessage] Error:", { code: e.code, message: e.message, status: e.status, isRetryable: e.isRetryable });
        addMessage({ role: "assistant", content: `抱歉，出了点问题。${errorMsg}`, timestamp: new Date().toISOString() });
      }
      setStreamingContent("");
      setIsLoading(false);
      setIsProcessing(false);
    }
  }, [isLoading, isProcessing, addMessage, updateDayMeta, todayKey, addFinanceEntry, allTodos, toggleTodo, user, entries, energySummary, addTodoToDate, planMode, planTasks, energyLogs, habits]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  // 本地快速时间提取（毫秒级，无AI调用）
  const autoExtractTimeBlocks = useCallback((msgs: ChatMsg[]) => {
    const userText = msgs.filter(m => m.role === "user").map(m => m.content).join(" ");
    if (!hasTimeHints(userText)) return;
    const blocks = extractTimeBlocks(userText);
    if (blocks.length === 0) return;
    let created = 0;
    blocks.forEach(block => {
      if (block.durationMin <= 0 || block.durationMin > 480) return;
      const noteKey = `⏱ ${block.startTime}-${block.endTime}`;
      const exists = allTodos.some(t => t.note?.includes(noteKey));
      if (exists) return;
      const todo: TodoItem = {
        id: crypto.randomUUID(), text: block.label,
        status: "done" as const, priority: "normal" as const,
        tags: ["时间记录"], subTasks: [], recur: "none" as const,
        note: `${noteKey} (${block.durationMin}分钟)`,
        completedAt: new Date().toISOString(), sourceDate: todayKey,
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      };
      addTodoToDate(todayKey, todo); created++;
    });
    if (created > 0) {
      setTodoToast(`⏱ 自动记录了 ${created} 个时间段`);
      setTimeout(() => setTodoToast(null), 3000);
    }
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
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono-jb">{format(new Date(), "M月d日")}</span>
          {streak >= 3 && (
            <span className="flex items-center gap-0.5 text-[10px] text-los-orange font-mono-jb bg-los-orange/10 px-1.5 py-0.5 rounded-full">
              <Flame size={10} />{streak}天
            </span>
          )}
        </div>
        <div className="flex gap-0">
          <button onClick={() => navigate("/history?search=1")} className="touch-target text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-surface-2" title="搜索日记">
            <Search size={17} />
          </button>
          <button onClick={() => navigate("/history")} className="touch-target text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-surface-2">
            <Clock size={17} />
          </button>
          <button onClick={() => navigate("/settings")} className="touch-target text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-surface-2" title={t("settings.title")}>
            <Settings size={17} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {displayMessages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-[320px] w-full">

              {/* #5: 最多展示1个优先卡片（漏洞>周信>能量预警>规划模式，按优先级取第一个）*/}
              {planMode ? (
                <div className="bg-primary/10 border border-primary/30 rounded-xl px-4 py-3 mb-4 text-left">
                  <p className="text-xs text-primary font-serif-sc mb-1">📅 规划模式 · 收集中</p>
                  {planTasks.length > 0 && (
                    <div className="space-y-1">
                      {planTasks.map((t, i) => <p key={i} className="text-caption text-foreground">✓ {t}</p>)}
                    </div>
                  )}
                  <p className="text-caption text-muted-foreground mt-1.5">说完所有任务告诉我「好了」，生成时间计划</p>
                </div>
              ) : showGaps && gaps.length > 0 ? (
                <div className="bg-los-orange/10 border border-los-orange/30 rounded-xl px-4 py-3 mb-4 text-left">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-los-orange font-serif-sc flex items-center gap-1">
                      <AlertCircle size={12} /> 今日有 {gaps.length} 个待关注
                    </p>
                    <button onClick={() => setShowGaps(false)} className="touch-target text-muted-foreground/50 hover:text-muted-foreground scale-75">
                      <X size={14} />
                    </button>
                  </div>
                  {gaps.slice(0, 2).map((gap, i) => (
                    <p key={i} className="text-caption text-foreground/80 leading-relaxed mb-1">
                      {gap.severity === "high" ? "🔴" : gap.severity === "medium" ? "🟡" : "🟢"} {gap.message}
                    </p>
                  ))}
                </div>
              ) : weeklyLetterReady ? (
                <button onClick={handleOpenLetter}
                  className="w-full bg-gold/10 border border-gold-border rounded-xl px-4 py-3 mb-4 text-left hover:bg-gold/20 transition">
                  <p className="text-xs text-gold font-serif-sc mb-1">📨 罗盘的来信</p>
                  <p className="text-caption text-foreground leading-relaxed">本周复盘信已生成，点击查看</p>
                  <span className="text-caption text-gold mt-1 inline-block">打开信件 →</span>
                </button>
              ) : consecutiveLowDays >= 3 ? (
                <button onClick={() => sendMessage("我已经连续低能量好几天了，帮我分析一下可能的原因？")}
                  className="w-full bg-los-red/10 border border-los-red/30 rounded-xl px-4 py-3 mb-4 text-left hover:bg-los-red/20 transition">
                  <p className="text-xs text-los-red font-serif-sc mb-1">⚠️ 能量预警</p>
                  <p className="text-caption text-foreground leading-relaxed">你已经连续{consecutiveLowDays}天低能量了</p>
                  <span className="text-caption text-los-red mt-1 inline-block">聊聊怎么回事 →</span>
                </button>
              ) : null}

              {/* 问候语 + 今日简报 */}
              <div className="text-3xl mb-3">{statusGreeting.emoji}</div>
              <p className="text-foreground text-sm leading-relaxed">{statusGreeting.text}</p>

              {/* 今日简报按钮（始终显示，但不和其他卡片叠加） */}
              {!planMode && (
                <button onClick={handleBriefing}
                  className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 mt-4 mb-4 text-left hover:bg-surface-3 transition">
                  <p className="text-xs text-foreground font-serif-sc mb-0.5">🧭 今日简报</p>
                  <p className="text-caption text-muted-foreground">一键了解今天的状态、待办和重点</p>
                  <span className="text-caption text-gold mt-1 inline-block">获取简报 →</span>
                </button>
              )}

              {/* Starter prompts */}
              <div className="grid grid-cols-2 gap-2 text-left">
                {[
                  { emoji: "📝", textKey: "home.starter.record", msgKey: "home.starter.record_msg" },
                  { emoji: "🎯", textKey: "home.starter.plan", msgKey: "home.starter.plan_msg" },
                  { emoji: "💭", textKey: "home.starter.thoughts", msgKey: "home.starter.thoughts_msg" },
                  { emoji: "📊", textKey: "home.starter.review", msgKey: "home.starter.review_msg" },
                ].map(sp => (
                  <button key={sp.msgKey} onClick={() => sendMessage(t(sp.msgKey))}
                    className="bg-surface-2 border border-border rounded-xl px-3 py-3 hover:bg-surface-3 transition text-xs text-foreground leading-relaxed text-left">
                    <span className="text-sm">{sp.emoji}</span> {t(sp.textKey)}
                  </button>
                ))}
              </div>

              {/* Quick mood */}
              <div className="flex justify-center gap-2 mt-4">
                {QUICK_MOODS.map(mood => (
                  <button key={mood.tag} onClick={() => handleQuickMood(mood)}
                    className="w-11 h-11 rounded-full bg-surface-2 flex items-center justify-center text-xl hover:scale-110 hover:bg-surface-3 transition-all"
                    title={t(mood.labelKey)}>
                    {mood.emoji}
                  </button>
                ))}
              </div>

              {/* 今日一问 */}
              {dailyQuestion && (
                <div className="mt-5 bg-surface-2 border border-border rounded-xl px-4 py-3 text-left">
                  <p className="text-caption text-gold font-mono-jb mb-1">💭 今日一问 · {dailyQuestion.domain}</p>
                  <p className="text-xs text-foreground leading-relaxed mb-2">{dailyQuestion.question}</p>
                  <button onClick={() => setInput(dailyQuestion.question)}
                    className="text-caption text-gold hover:text-gold/80 transition-colors">

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
              <div className={msg.role === "assistant" ? "max-w-[84%]" : "max-w-[84%]"}>
                {/* #2: Long-press overlay */}
                {longPressIdx === i && (
                  <div className="fixed inset-0 z-50 bg-black/40 flex items-end justify-center pb-[80px]"
                    onClick={() => setLongPressIdx(null)}>
                    <div className="bg-surface-2 border border-border rounded-2xl p-2 w-64 shadow-xl" onClick={e => e.stopPropagation()}>
                      <button onClick={() => copyMsg(msg.content)}
                        className="w-full text-left text-sm text-foreground px-4 py-3 hover:bg-surface-3 rounded-xl transition">
                        📋 复制文字
                      </button>
                      <button onClick={() => { setInput(msg.content); setLongPressIdx(null); }}
                        className="w-full text-left text-sm text-foreground px-4 py-3 hover:bg-surface-3 rounded-xl transition">
                        ✏️ 引用回复
                      </button>
                      <button onClick={() => setLongPressIdx(null)}
                        className="w-full text-center text-sm text-muted-foreground px-4 py-3 hover:bg-surface-3 rounded-xl transition border-t border-border mt-1">
                        取消
                      </button>
                    </div>
                  </div>
                )}
                <div
                  onTouchStart={() => handleMsgTouchStart(i)}
                  onTouchEnd={handleMsgTouchEnd}
                  onTouchMove={handleMsgTouchEnd}
                  className={`max-w-full rounded-2xl px-4 py-3 cursor-pointer select-none ${
                    msg.role === "user"
                      ? `bg-gold text-background rounded-br-md text-sm leading-relaxed${i === displayMessages.length - 1 ? " animate-msg-in" : ""}`
                      : "text-foreground rounded-bl-md text-sm leading-relaxed bg-surface-2 border border-border"
                  }`}
                >
                  {msg.content}
                </div>
                {/* #11: Go Deeper — 字号提升到 11px */}
                {msg.role === "assistant" && !isLoading && (
                  <button
                    onClick={() => handleGoDeeper(msg.content)}
                    className="text-caption text-muted-foreground/50 hover:text-gold cursor-pointer px-1 mt-1 transition-colors"
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

      {/* T02: extractMeta retry - improved UX */}
      {extractFailed && (
        <div className="absolute bottom-20 left-4 right-4 bg-los-orange/95 text-white text-xs px-4 py-3 rounded-xl flex items-start gap-2 z-50 animate-in fade-in shadow-lg">
          <AlertCircle size={14} className="mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <p className="font-medium">自动记录未完成</p>
            <p className="opacity-80 mt-0.5">你刚才说的内容，AI 分析时出错，待办/财务可能没有被自动记录。</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={async () => {
                if (!retryMsgs) return;
                setExtractFailed(false);
                const { data: { session } } = await supabase.auth.getSession();
                const accessToken = session?.access_token;
                const existingTodosForAI = allTodos
                  .filter(t => t.status !== "dropped")
                  .map(t => ({ id: t.id, text: t.text, status: t.status, priority: t.priority }));
                extractMeta(retryMsgs, existingTodosForAI, accessToken).then(meta => {
                  if (meta.emotionTags.length || meta.topicTags.length || meta.todos?.length) {
                    updateDayMeta(todayKey, {
                      emotionTags: meta.emotionTags,
                      topicTags: meta.topicTags,
                      todos: meta.todos?.length ? meta.todos.map(t => createTodoFromExtract(t, todayKey)) : undefined,
                      emotionScore: meta.emotionScore || undefined,
                    });
                    setTodoToast("✅ 重试成功，已记录");
                    setTimeout(() => setTodoToast(null), 3000);
                  }
                }).catch(() => setExtractFailed(true));
              }}
              className="bg-white/20 hover:bg-white/30 px-2.5 py-1 rounded-lg font-medium"
            >
              重试
            </button>
            <button onClick={() => setExtractFailed(false)} className="opacity-60 hover:opacity-100 p-1">
              <X size={12} />
            </button>
          </div>
        </div>
      )}

      {/* Toasts */}
      {todoToast && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 bg-gold text-background text-xs px-4 py-1.5 rounded-full animate-pulse z-50">
          📝 {todoToast}
        </div>
      )}

      {/* Focus bar — height h-10 for 40px touch target */}
      <div className="px-4 h-10 flex items-center border-t border-border/50">
        <button onClick={() => setShowFocusPicker(true)} className="w-full text-left truncate py-1">
          {focusTodo ? (

            <span className="text-[11px] text-gold">{t("home.focus.now")}{focusTodo.text.slice(0, 20)}{focusTodo.text.length > 20 ? "..." : ""}</span>
          ) : (
            <span className="text-[11px] text-muted-foreground/50">{t("home.focus.none")}</span>
          )}
        </button>
      </div>

      {/* Input area - consolidated */}
      <div className="px-3 py-2 pb-1">
        <div className="flex gap-1.5 items-end">
          {/* Tools toggle */}
          <div className="relative flex-shrink-0">
            <button
              onClick={() => setShowToolMenu(v => !v)}
              className={`p-2 rounded-full transition-all ${showToolMenu ? "bg-primary text-primary-foreground rotate-45" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
            >
              <Plus size={18} />
            </button>
            {showToolMenu && (
              <div className="absolute bottom-12 left-0 bg-popover border border-border rounded-xl shadow-lg p-1.5 flex gap-1 z-50 animate-in fade-in slide-in-from-bottom-2">
                <button onClick={() => { setShowToolMenu(false); navigate("/calendar"); }} className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg hover:bg-accent transition" title="日历">
                  <CalendarDays size={16} className="text-primary" /><span className="text-caption text-muted-foreground">日历</span>
                </button>
                <button onClick={() => { setShowToolMenu(false); navigate("/todos"); }} className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg hover:bg-accent transition" title="待办">
                  <Zap size={16} className="text-primary" /><span className="text-caption text-muted-foreground">待办</span>
                </button>
              </div>
            )}
          </div>
          {pastedImage && (
            <div className="relative mb-2">
              <img src={pastedImage} alt="附件" className="max-h-32 rounded-xl object-contain border border-border" />
              <button onClick={() => setPastedImage(null)}
                className="absolute top-1 right-1 bg-background/80 rounded-full p-0.5 text-muted-foreground hover:text-foreground">
                <X size={12} />
              </button>
            </div>
          )}
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleInput}
            onKeyDown={handleKeyDown}
            onPaste={handlePaste}
            placeholder={planMode ? `已记录 ${planTasks.length} 件，继续说，或说"好了"生成计划…` : t("home.input.placeholder")}
            rows={2}
            className={`flex-1 bg-muted border rounded-2xl px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none transition-colors leading-relaxed ${planMode ? "border-primary/50 bg-primary/5" : "border-border focus:border-primary"}`}
            style={{ minHeight: "44px", maxHeight: "120px" }}
          />
          {canUseVoice && (
            <button
              onClick={() => setShowVoice(true)}
              className="p-2 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition flex-shrink-0"
            >
              <Mic size={18} />
            </button>
          )}
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading || isProcessing}
            className="bg-primary text-primary-foreground rounded-full p-2 disabled:opacity-20 hover:bg-primary/90 transition-all flex-shrink-0"
          >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>

      {/* Focus picker sheet */}
      {showFocusPicker && (
        <div className="absolute inset-x-0 bottom-0 bg-surface-1 border-t border-border rounded-t-2xl p-5 z-50 animate-in slide-in-from-bottom max-h-[50vh] flex flex-col">
          <div className="flex justify-between items-center mb-3">
            <span className="text-xs text-foreground font-serif-sc">{t("home.focus.title")}</span>
            <button onClick={() => setShowFocusPicker(false)} className="text-muted-foreground">
              <X size={16} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto space-y-1">
            {todayUndoneTodos.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-4">{t("home.focus.empty")}</p>
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
            sendMessage(text);
          }}
          onClose={() => setShowVoice(false)}
          accessToken={undefined}
        />
      )}
    </div>
  );
};

export default HomePage;
