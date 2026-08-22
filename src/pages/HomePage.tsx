import { useState, useRef, useEffect, useCallback, useMemo, type ChangeEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Send, Loader2, X, Clock, Settings, Mic, Plus, Zap, CalendarDays, AlertCircle, Search, Flame, FileText } from "lucide-react";
import VoiceInput from "@/components/VoiceInput";
import JournalEditor from "@/components/JournalEditor";
import { streamChat, extractMeta, StreamChatError, type ChatMsg, type ExtractResult } from "@/lib/streamChat";
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
import { toast } from "sonner";

// EnergyLog.level 存的是中文（'高'|'中'|'低'|'透支'），ENERGY_LEVELS 这个UI常量
// 用的是英文 value——两边转换要一致，否则"选中态"高亮和写入的记录会对不上。
const ENERGY_LEVEL_TO_CN: Record<string, '高' | '中' | '低'> = { high: '高', medium: '中', low: '低' };
const ENERGY_LEVEL_FROM_CN: Record<string, string> = { '高': 'high', '中': 'medium', '低': 'low', '透支': 'low' };

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
    habits, checkInHabit, setFocusTodo, addTodoToDate,
    energyLogs, addEnergyLog, energySummary, consecutiveLowDays,
    defaultModelProfileId, isPrivateModelActive,
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
  // BUG-01：手动"重试"按钮在请求未返回前禁用，避免连续点击对同一段内容重复
  // 调用 extractMeta → 重复生成待办/财务记录。
  const [isRetryingExtract, setIsRetryingExtract] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  // 独立于 abortRef：手动重试可能发生在自动提取的 controller 早已用完之后，
  // 需要自己的 controller 才能在组件卸载时正确取消这次重试请求。
  const retryAbortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const prevTagCountRef = useRef(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [journalMode, setJournalMode] = useState(false); // TipTap 富文本模式
  const [journalContent, setJournalContent] = useState("");

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
  // 之前key是 ai_calls_日期，不分账号，同一浏览器多个账号会共用同一个计数——
  // 按userId分开存。
  const todayCallKey = user ? `ai_calls_${user.id}_${todayKey}` : "";
  const aiCallCount = todayCallKey ? parseInt(localStorage.getItem(todayCallKey) || "0") : 0;
  // 标了🔒私有/本地的模型不占用云端每日额度
  const aiQuotaExceeded = !isPrivateModelActive && aiCallCount >= DAILY_LIMIT;
  const bumpAiCall = () => {
    if (isPrivateModelActive || !todayCallKey) return;
    localStorage.setItem(todayCallKey, String(aiCallCount + 1));
  };

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
  // BUG-01：卸载时一并取消手动重试请求，避免组件已卸载后 extractMeta 才 resolve/reject，
  // 触发"在已卸载组件上 setState"的悬空回调。
  useEffect(() => { return () => { abortRef.current?.abort(); retryAbortRef.current?.abort(); }; }, []);

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
    const greeting = h < 12 ? t("home.briefing.morning") : h < 18 ? t("home.briefing.afternoon") : t("home.briefing.evening");
    const weekdayKeys = ["home.weekday.sun", "home.weekday.mon", "home.weekday.tue", "home.weekday.wed", "home.weekday.thu", "home.weekday.fri", "home.weekday.sat"];

    const focusPart = doingTodo ? t("home.briefing.focus_part", { text: doingTodo.text }) : "";
    const overduePart = overdueTodos.length > 0 ? t("home.briefing.overdue_part", { list: overdueTodos.slice(0, 2).map(t => t.text).join(t("home.list_separator")) }) : "";
    const energyStatus = latestEnergy
      ? t("home.briefing.energy_detail", { level: latestEnergy.level, time: format(new Date(latestEnergy.timestamp), "HH:mm") })
      : t("home.briefing.energy_none");

    const briefingText = t("home.briefing.template", {
      greeting,
      todoCount: todayTodos.length,
      focusPart,
      overdueCount: overdueTodos.length,
      overduePart,
      energyStatus,
      date: format(new Date(), t("calendar.date_format")),
      weekday: t(weekdayKeys[new Date().getDay()]),
    });
    sendMessage(briefingText);
  };

  const handleQuickMood = (mood: typeof QUICK_MOODS[0]) => {
    updateDayMeta(todayKey, { emotionTags: [mood.tag], emotionScore: mood.score });

    sendMessage(`${t("home.quick_mood_prefix")} ${mood.emoji} ${t(mood.labelKey)}`);
  };

  // 精力记录：ENERGY_LEVELS 常量和对应的多语言文案(home.energy.*)其实早就写好了，
  // 但从来没有一个按钮真正调用过 addEnergyLog——"精力都去哪儿了"这块功能
  // 一直只有读(能量预警banner、AI简报)没有写。补上这个入口。
  const handleEnergyCheckIn = (lvl: typeof ENERGY_LEVELS[number]) => {
    addEnergyLog(ENERGY_LEVEL_TO_CN[lvl.value]);
    toast.success(`${t("home.energy_recorded_prefix")}${lvl.emoji} ${t(lvl.labelKey)}`, { id: "energy-checkin" });
  };

  const todayLatestEnergy = useMemo(() => {
    const todayStr = format(new Date(), "yyyy-MM-dd");
    return energyLogs.find(l => format(new Date(l.timestamp), "yyyy-MM-dd") === todayStr) || null;
  }, [energyLogs]);

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
      alert(t("home.image_too_large"));
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => setPastedImage(ev.target?.result as string);
    reader.readAsDataURL(file);
  };


  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading || isProcessing) return;
    if (aiQuotaExceeded) {
      addMessage({ role: "assistant" as const, content: t("home.quota_exceeded", { limit: DAILY_LIMIT }), timestamp: new Date().toISOString() });
      return;
    }
    bumpAiCall();

    // ── 危机关键词检测 ────────────────────────────────────────────────────────
    if (checkCrisis(text)) {
      addMessage({ role: "user" as const, content: text, timestamp: new Date().toISOString() });
      addMessage({
        role: "assistant" as const,
        content: t("home.crisis.response"),
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
        ? t("home.plan.day_intro")
        : t("home.plan.week_intro");
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
        setTodoToast(t("home.plan.todos_created", { count: newTasks.length }));
        setTimeout(() => setTodoToast(null), 3000);
      } else {
        // 继续收集，给出确认
        addMessage({ role: "user" as const, content: text, timestamp: new Date().toISOString() });
        addMessage({ role: "assistant" as const, content: t("home.plan.task_recorded", { text }), timestamp: new Date().toISOString() });
        setInput("");
      }
      return;
    }

    // 突发重排识别
    if (intentResult.intent === "replan") {
      // 注入当前时间块信息到context
      const currentHour = new Date().getHours();
      const remainingTodos = allTodos.filter(t => t.status === "todo");
      const replanContext = t("home.replan.context", {
        time: currentHour,
        list: remainingTodos.map(t => t.text).join(t("home.list_separator")) || t("home.replan.none"),
      });
      const enrichedText = `${text}\n\n${replanContext}`;
      // 走正常AI流程但带上重排上下文
      return sendMessage(enrichedText);
    }
    // ─────────────────────────────────────────────────────────────────────────

    setIsProcessing(true);
    // N4: If image was pasted, prepend a note to the text
    const fullText = pastedImage ? `${t("home.image_attached_prefix")} ${text}` : text;
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
        modelProfileId: defaultModelProfileId,
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
          // BUG-01：复用同一个 controller，页面卸载/用户中止生成时 extractMeta 会
          // 跟着一起取消，而不是在后台继续跑、卸载后才 resolve。
          extractMeta(msgsForExtract, existingTodosForAI, accessToken, controller.signal).then(meta => {
            if (meta.completedTodoIds?.length > 0) {
              meta.completedTodoIds.forEach(todoId => {
                const todo = todosSnapshot.find(t => t.id === todoId);
                if (todo && todo.status !== "done") {
                  toggleTodo(todo.sourceDate || todayKey, todoId);
                }
              });
              setTodoToast(t("home.todo_marked_done", { count: meta.completedTodoIds.length }));
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
                setTodoToast(t("home.todos_auto_generated", { count: todoItems.length }));
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
              const types = meta.financeHints.map(h => h.type === "income" ? t("home.finance.income") : t("home.finance.expense")).join(t("home.list_separator"));
              setFinanceToast(true);
              setTodoToast(t("home.finance_auto_recorded", { types, total }));
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
          }).catch((err) => {
            // BUG-01：用户主动取消 / 页面已卸载不算"提取失败"，不弹"记录未完成"提示——
            // 那是用户自己的选择，不是 AI 出错，弹出来只会让人误以为出了 bug。
            if (err instanceof StreamChatError && err.code === "EXTRACT_CANCELLED") return;
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
        const errorMsg = e.message || t("home.error.network");
        console.error("[sendMessage] Error:", { code: e.code, message: e.message, status: e.status, isRetryable: e.isRetryable });
        addMessage({ role: "assistant", content: t("home.error.assistant_prefix", { error: errorMsg }), timestamp: new Date().toISOString() });
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
      setTodoToast(t("home.time_blocks_recorded", { count: created }));
      setTimeout(() => setTodoToast(null), 3000);
    }
  }, [allTodos, todayKey, addTodoToDate]);

    // Feature 1: Go deeper
  const handleGoDeeper = (msgContent: string) => {
    const lastSentence = msgContent.split(/[。？！.?!\n]/).filter(Boolean).pop() || msgContent.slice(-30);
    sendMessage(t("home.go_deeper_msg", { text: lastSentence }));
  };

  return (
    <div className="flex flex-col h-full max-w-[600px] mx-auto relative">
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground font-mono-jb">{format(new Date(), t("calendar.date_format"))}</span>
          {streak >= 3 && (
            <span className="flex items-center gap-0.5 text-[10px] text-los-orange font-mono-jb bg-los-orange/10 px-1.5 py-0.5 rounded-full">
              <Flame size={10} />{t("home.streak_days", { days: streak })}
            </span>
          )}
        </div>
        <div className="flex gap-0">
          <button onClick={() => navigate("/search")} className="touch-target text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-surface-2" title={t("home.title.search_journal")} aria-label={t("home.title.search_journal")}>
            <Search size={17} />
          </button>
          <button onClick={() => navigate("/history")} className="touch-target text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-surface-2" title={t("home.aria.history")} aria-label={t("home.aria.history")}>
            <Clock size={17} />
          </button>
          <button onClick={() => navigate("/settings")} className="touch-target text-muted-foreground hover:text-foreground transition-colors rounded-xl hover:bg-surface-2" title={t("settings.title")} aria-label={t("settings.title")}>
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
                  <p className="text-xs text-primary font-serif-sc mb-1">{t("home.plan_mode.banner")}</p>
                  {planTasks.length > 0 && (
                    <div className="space-y-1">
                      {planTasks.map((t, i) => <p key={i} className="text-caption text-foreground">✓ {t}</p>)}
                    </div>
                  )}
                  <p className="text-caption text-muted-foreground mt-1.5">{t("home.plan_mode.hint")}</p>
                </div>
              ) : showGaps && gaps.length > 0 ? (
                <div className="bg-los-orange/10 border border-los-orange/30 rounded-xl px-4 py-3 mb-4 text-left">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-xs text-los-orange font-serif-sc flex items-center gap-1">
                      <AlertCircle size={12} /> {t("home.gaps.count", { count: gaps.length })}
                    </p>
                    <button onClick={() => setShowGaps(false)} className="touch-target text-muted-foreground/50 hover:text-muted-foreground scale-75" aria-label={t("common.close")}>
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
                  <p className="text-xs text-gold font-serif-sc mb-1">{t("home.weekly_letter.banner_title")}</p>
                  <p className="text-caption text-foreground leading-relaxed">{t("home.weekly_letter.banner_desc")}</p>
                  <span className="text-caption text-gold mt-1 inline-block">{t("home.weekly_letter.banner_cta")}</span>
                </button>
              ) : consecutiveLowDays >= 3 ? (
                <button onClick={() => sendMessage(t("home.energy_alert.msg"))}
                  className="w-full bg-los-red/10 border border-los-red/30 rounded-xl px-4 py-3 mb-4 text-left hover:bg-los-red/20 transition">
                  <p className="text-xs text-los-red font-serif-sc mb-1">{t("home.energy_alert.title")}</p>
                  <p className="text-caption text-foreground leading-relaxed">{t("home.energy_alert.body", { days: consecutiveLowDays })}</p>
                  <span className="text-caption text-los-red mt-1 inline-block">{t("home.energy_alert.cta")}</span>
                </button>
              ) : null}

              {/* 问候语 + 今日简报 */}
              <div className="text-3xl mb-3">{statusGreeting.emoji}</div>
              <p className="text-foreground text-sm leading-relaxed">{statusGreeting.text}</p>

              {/* 今日简报按钮（始终显示，但不和其他卡片叠加） */}
              {!planMode && (
                <button onClick={handleBriefing}
                  className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 mt-4 mb-4 text-left hover:bg-surface-3 transition">
                  <p className="text-xs text-foreground font-serif-sc mb-0.5">{t("home.briefing.card_title")}</p>
                  <p className="text-caption text-muted-foreground">{t("home.briefing.card_desc")}</p>
                  <span className="text-caption text-gold mt-1 inline-block">{t("home.briefing.card_cta")}</span>
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
                    title={t(mood.labelKey)} aria-label={t(mood.labelKey)}>
                    {mood.emoji}
                  </button>
                ))}
              </div>

              {/* Quick energy check-in */}
              <div className="mt-3">
                <p className="text-caption text-muted-foreground text-center mb-1.5">{t("home.energy.title")}</p>
                <div className="flex justify-center gap-2">
                  {ENERGY_LEVELS.map(lvl => {
                    const active = todayLatestEnergy && ENERGY_LEVEL_FROM_CN[todayLatestEnergy.level] === lvl.value;
                    return (
                      <button key={lvl.value} onClick={() => handleEnergyCheckIn(lvl)}
                        className={`w-11 h-11 rounded-full flex items-center justify-center text-xl transition-all ${active ? "bg-primary/15 ring-2 ring-primary" : "bg-surface-2 hover:scale-110 hover:bg-surface-3"}`}
                        title={t(lvl.labelKey)} aria-label={t(lvl.labelKey)}>
                        {lvl.emoji}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 今日习惯打卡（主页可见）*/}
              {habits.length > 0 && (() => {
                const todayDow = new Date().getDay();
                const todayHabits = habits.filter(h => h.targetDays.includes(todayDow));
                if (todayHabits.length === 0) return null;
                return (
                  <div className="mt-4 bg-surface-2 border border-border rounded-xl px-4 py-3 text-left">
                    <p className="text-caption text-muted-foreground mb-2">{t("home.habits.today_title")}</p>
                    <div className="flex flex-wrap gap-2">
                      {todayHabits.map(habit => {
                        const checked = habit.checkIns.includes(todayKey);
                        return (
                          <button key={habit.id}
                            onClick={() => { if (!checked) checkInHabit(habit.id, todayKey); }}
                            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs transition-all
                              ${checked
                                ? "bg-los-green/20 border border-los-green/40 text-los-green"
                                : "bg-muted border border-border text-muted-foreground hover:border-primary hover:text-foreground"
                              }`}>
                            <span>{habit.emoji}</span>
                            <span>{habit.name}</span>
                            {checked && <span className="text-[9px] opacity-70">✓</span>}
                          </button>
                        );
                      })}
                    </div>
                    {todayHabits.every(h => h.checkIns.includes(todayKey)) && (
                      <p className="text-caption text-los-green mt-2">{t("home.habits.all_done")}</p>
                    )}
                  </div>
                );
              })()}

              {/* 今日一问 */}
              {dailyQuestion && (
                <div className="mt-5 bg-surface-2 border border-border rounded-xl px-4 py-3 text-left">
                  <p className="text-caption text-gold font-mono-jb mb-1">💭 {t("home.daily_question", { domain: dailyQuestion.domain })}</p>
                  <p className="text-xs text-foreground leading-relaxed mb-2">{dailyQuestion.question}</p>
                  <button onClick={() => setInput(dailyQuestion.question)}
                    className="text-caption text-gold hover:text-gold/80 transition-colors">

                    {t("home.daily_question.cta")}
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
                        {t("home.msg_menu.copy")}
                      </button>
                      <button onClick={() => { setInput(msg.content); setLongPressIdx(null); }}
                        className="w-full text-left text-sm text-foreground px-4 py-3 hover:bg-surface-3 rounded-xl transition">
                        {t("home.msg_menu.quote")}
                      </button>
                      <button onClick={() => setLongPressIdx(null)}
                        className="w-full text-center text-sm text-muted-foreground px-4 py-3 hover:bg-surface-3 rounded-xl transition border-t border-border mt-1">
                        {t("common.cancel")}
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
                {/* BUG-10 二次整改（方案A）：文字本身只有约 19px 高。第一版用
                    负外边距抵消正内边距的技巧把热区做到约 39px，没有完全打满
                    44px——因为再加大负边距，热区会开始视觉重叠进相邻消息气泡的
                    渲染框里，点击命中可能落到错误的元素上，属于"看起来达标、实际
                    埋雷"的做法。这里改用真实 padding（py-3.5，不再用负边距抵消），
                    纵向热区做满 47px（19.2px 文字 + 28px 内边距），稳稳超过 44px，
                    不存在重叠风险。代价是每条 AI 回复下方会比之前多出一截真实可见
                    的留白，对话列表会比原来略"松"一点——这是刻意接受的视觉取舍，
                    不是遗漏。 */}
                {msg.role === "assistant" && !isLoading && (
                  <button
                    onClick={() => handleGoDeeper(msg.content)}
                    className="text-caption text-muted-foreground/50 hover:text-gold cursor-pointer px-2 py-3.5 mt-1 transition-colors"
                    aria-label={t("home.go_deeper_aria")}
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
            <p className="font-medium">{t("home.extract_failed.title")}</p>
            <p className="opacity-80 mt-0.5">{t("home.extract_failed.desc")}</p>
          </div>
          <div className="flex gap-2 flex-shrink-0">
            <button
              disabled={isRetryingExtract}
              onClick={async () => {
                // BUG-01：请求在途时禁用按钮本身已经能挡住"手指连点"；这里再加一层
                // ref 判断兜底，双保险防止同一段内容被并发调用两次而产生重复待办/财务。
                if (!retryMsgs || isRetryingExtract) return;
                setIsRetryingExtract(true);
                setExtractFailed(false);
                const retryController = new AbortController();
                retryAbortRef.current = retryController;
                try {
                  const { data: { session } } = await supabase.auth.getSession();
                  const accessToken = session?.access_token;
                  const existingTodosForAI = allTodos
                    .filter(t => t.status !== "dropped")
                    .map(t => ({ id: t.id, text: t.text, status: t.status, priority: t.priority }));
                  const meta = await extractMeta(retryMsgs, existingTodosForAI, accessToken, retryController.signal);

                  if (meta.completedTodoIds?.length > 0) {
                    meta.completedTodoIds.forEach(todoId => {
                      const todo = allTodos.find(t => t.id === todoId);
                      if (todo && todo.status !== "done") {
                        toggleTodo(todo.sourceDate || todayKey, todoId);
                      }
                    });
                  }

                  const todoItems: TodoItem[] = (meta.todos || []).map(t => createTodoFromExtract(t, todayKey));
                  if (meta.emotionTags.length || meta.topicTags.length || todoItems.length) {
                    updateDayMeta(todayKey, {
                      emotionTags: meta.emotionTags,
                      topicTags: meta.topicTags,
                      todos: todoItems.length > 0 ? todoItems : undefined,
                      emotionScore: meta.emotionScore || undefined,
                    });
                  }

                  // 重试路径此前遗漏了 financeHints——之前重试只补得回待办/情绪标签，
                  // 补不回支出/收入，与 BUG-01"确保待办与财务自动归档"的验收标准不符。
                  if (meta.financeHints && meta.financeHints.length > 0) {
                    meta.financeHints.forEach(hint => {
                      addFinanceEntry({ date: todayKey, type: hint.type, amount: hint.amount, category: hint.category, note: hint.note });
                    });
                  }

                  if (meta.goalHints && meta.goalHints.length > 0 && user) {
                    updateKRProgressFromGoalHints(meta.goalHints, user.id);
                  }

                  setTodoToast(t("home.retry_success"));
                  setTimeout(() => setTodoToast(null), 3000);
                } catch (err) {
                  // 用户主动取消/组件卸载：不再弹回"记录未完成"提示，安静结束即可。
                  if (err instanceof StreamChatError && err.code === "EXTRACT_CANCELLED") return;
                  setExtractFailed(true);
                } finally {
                  setIsRetryingExtract(false);
                }
              }}
              className="bg-white/20 hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed px-2.5 py-1 rounded-lg font-medium"
            >
              {isRetryingExtract ? t("home.retrying") : t("home.retry")}
            </button>
            <button onClick={() => setExtractFailed(false)} className="opacity-60 hover:opacity-100 p-1" aria-label={t("common.close")}>
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
            {/* BUG-10：这几个输入区图标按钮之前是 p-2（8px）+ 18px 图标 = 34×34px，
                低于常见 44×44px 触控建议，移动端容易误触/漏触。改成 p-3.5（14px）
                后视觉尺寸变成 46×46px，够到最小建议值；这会让输入区图标看起来比
                之前略大一圈，是一处可见的视觉变化，不是纯粹的无形修复。 */}
            <button
              onClick={() => setShowToolMenu(v => !v)}
              className={`p-3.5 rounded-full transition-all ${showToolMenu ? "bg-primary text-primary-foreground rotate-45" : "text-muted-foreground hover:text-foreground hover:bg-muted"}`}
              aria-label={t("home.aria.tool_menu")} aria-expanded={showToolMenu}
            >
              <Plus size={18} />
            </button>
            {showToolMenu && (
              <div className="absolute bottom-12 left-0 bg-popover border border-border rounded-xl shadow-lg p-1.5 flex gap-1 z-50 animate-in fade-in slide-in-from-bottom-2">
                <button onClick={() => { setShowToolMenu(false); navigate("/calendar"); }} className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg hover:bg-accent transition" title={t("tab.calendar")} aria-label={t("tab.calendar")}>
                  <CalendarDays size={16} className="text-primary" /><span className="text-caption text-muted-foreground">{t("tab.calendar")}</span>
                </button>
                <button onClick={() => { setShowToolMenu(false); navigate("/todos"); }} className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg hover:bg-accent transition" title={t("tab.todo")} aria-label={t("tab.todo")}>
                  <Zap size={16} className="text-primary" /><span className="text-caption text-muted-foreground">{t("tab.todo")}</span>
                </button>
              </div>
            )}
          </div>
          {pastedImage && (
            <div className="relative mb-2">
              <img src={pastedImage} alt={t("home.attachment_alt")} className="max-h-32 rounded-xl object-contain border border-border" />
              <button onClick={() => setPastedImage(null)}
                className="absolute top-1 right-1 bg-background/80 rounded-full p-0.5 text-muted-foreground hover:text-foreground"
                aria-label={t("home.aria.remove_image")}>
                <X size={12} />
              </button>
            </div>
          )}

          {/* 日记模式切换 — TipTap 富文本 */}
          {journalMode ? (
            <div className="mb-2">
              <JournalEditor
                content={journalContent}
                onChange={setJournalContent}
                onSave={(html) => {
                  const text = html.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
                  if (text) sendMessage(`${t("home.journal_prefix")} ${text}`);
                  setJournalContent(""); setJournalMode(false);
                }}
                placeholder={t("home.journal.placeholder")}
              />
              <button onClick={() => setJournalMode(false)} className="mt-1 text-caption text-muted-foreground hover:text-foreground">
                {t("home.journal.back_to_chat")}
              </button>
            </div>
          ) : (
            <textarea
              ref={textareaRef}
              value={input}
              onChange={handleInput}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder={planMode ? t("home.plan.placeholder", { count: planTasks.length }) : t("home.input.placeholder")}
              rows={2}
              className={`flex-1 bg-muted border rounded-2xl px-3.5 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none transition-colors leading-relaxed ${planMode ? "border-primary/50 bg-primary/5" : "border-border focus:border-primary"}`}
              style={{ minHeight: "44px", maxHeight: "120px" }}
            />
          )}
          {canUseVoice && !journalMode && (
            <button
              onClick={() => setShowVoice(true)}
              className="p-3.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition flex-shrink-0"
              title={t("home.aria.voice_input")} aria-label={t("home.aria.voice_input")}
            >
              <Mic size={18} />
            </button>
          )}
          {!journalMode && (
            <button onClick={() => setJournalMode(true)}
              className="p-3.5 text-muted-foreground hover:text-foreground hover:bg-muted rounded-full transition flex-shrink-0"
              title={t("home.title.journal_mode")} aria-label={t("home.title.journal_mode")}>
              <FileText size={18} />
            </button>
          )}
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading || isProcessing}
            className="bg-primary text-primary-foreground rounded-full p-3.5 disabled:opacity-20 hover:bg-primary/90 transition-all flex-shrink-0"
            aria-label={t("home.aria.send")}
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
            <button onClick={() => setShowFocusPicker(false)} className="text-muted-foreground" aria-label={t("common.close")}>
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
