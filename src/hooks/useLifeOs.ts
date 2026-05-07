import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { DayEntry, WheelScore, ChatMessage, TodoItem, FinanceEntry, HabitItem } from "@/types/lifeOs";
import { format, addDays, nextSunday, subDays } from "date-fns";

// Helper: convert dueDate hint from AI to actual ISO date
function resolveDueDate(hint?: string): string | undefined {
  if (!hint) return undefined;
  const today = new Date();
  if (hint === "今天") return format(today, "yyyy-MM-dd");
  if (hint === "明天") return format(addDays(today, 1), "yyyy-MM-dd");
  if (hint === "本周") return format(nextSunday(today), "yyyy-MM-dd");
  if (/^\d{4}-\d{2}-\d{2}$/.test(hint)) return hint;
  return undefined;
}

// 关键词自动分类标签（解决时间统计"其他"占比过高）
const AUTO_TAG_RULES: Array<{ keywords: string[]; tag: string }> = [
  { keywords: ["开会","会议","讨论","汇报","报告","演讲","培训","面试"], tag: "工作" },
  { keywords: ["学习","阅读","读书","课程","笔记","复习","练习","作业"], tag: "学习" },
  { keywords: ["运动","健身","跑步","锻炼","瑜伽","游泳","骑车"], tag: "运动" },
  { keywords: ["吃饭","午饭","晚饭","早饭","外卖","聚餐","咖啡"], tag: "生活" },
  { keywords: ["打电话","联系","拜访","朋友","家人","社交"], tag: "社交" },
  { keywords: ["娱乐","电影","游戏","刷视频","看剧","听音乐"], tag: "娱乐" },
  { keywords: ["写作","创作","设计","画图","拍照","剪辑"], tag: "创作" },
  { keywords: ["采购","买","购物","快递","整理","打扫","家务"], tag: "生活" },
];

function autoTag(text: string, existingTags: string[]): string[] {
  if (existingTags.length > 0) return existingTags;
  for (const rule of AUTO_TAG_RULES) {
    if (rule.keywords.some(kw => text.includes(kw))) return [rule.tag];
  }
  return [];
}

export function createTodoFromExtract(
  raw: { text: string; priority?: string; dueDate?: string; dueTime?: string; tags?: string[]; subTasks?: Array<{text: string}>; note?: string },
  sourceDate: string
): TodoItem {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    text: raw.text,
    status: "todo",
    priority: (raw.priority as any) || "normal",
    dueDate: resolveDueDate(raw.dueDate),
    dueTime: raw.dueTime,
    tags: autoTag(raw.text, raw.tags || []),  // 自动打标签
    subTasks: (raw.subTasks || []).map(s => ({ id: crypto.randomUUID(), text: s.text, done: false })),
    recur: "none",
    note: raw.note,
    sourceDate,
    createdAt: now,
    updatedAt: now,
  };
}

export function useOnboarding(userId: string | undefined) {
  const cached = userId ? localStorage.getItem(`onboarded_${userId}`) : null;
  const [done, setDone] = useState<boolean | null>(cached ? true : null);

  useEffect(() => {
    if (!userId) return;
    supabase.from("profiles").select("onboarded").eq("id", userId).single()
      .then(({ data }) => {
        const val = data?.onboarded ?? false;
        if (val) localStorage.setItem(`onboarded_${userId}`, "1");
        setDone(val);
      });
  }, [userId]);

  const complete = useCallback(async () => {
    if (!userId) return;
    await supabase.from("profiles").update({ onboarded: true }).eq("id", userId);
    localStorage.setItem(`onboarded_${userId}`, "1");
    setDone(true);
  }, [userId]);

  return { onboarded: done, completeOnboarding: complete };
}

export function useDayEntries(userId: string | undefined) {
  const [entries, setEntries] = useState<DayEntry[]>([]);
  const entriesRef = useRef<DayEntry[]>([]);
  useEffect(() => { entriesRef.current = entries; }, [entries]);
  const todayKey = format(new Date(), "yyyy-MM-dd");

  // Load entries from DB
  useEffect(() => {
    if (!userId) return;
    const load = async () => {
      const { data: dayData } = await supabase
        .from("day_entries")
        .select("*")
        .eq("user_id", userId)
        .order("date", { ascending: false });

      if (!dayData) return;

      const entryIds = dayData.map(d => d.id);

      const [{ data: msgs }, { data: todos }] = await Promise.all([
        entryIds.length
          ? supabase.from("chat_messages").select("*").in("entry_id", entryIds).order("timestamp", { ascending: true })
          : Promise.resolve({ data: [] as any[] }),
        supabase.from("todos").select("*").eq("user_id", userId)
          .gte("created_at", format(subDays(new Date(), 90), "yyyy-MM-dd"))
          .order("created_at", { ascending: false }),
      ]);

      const mapped: DayEntry[] = dayData.map(d => ({
        id: d.id,
        date: d.date,
        messages: (msgs || []).filter(m => m.entry_id === d.id).map(m => ({
          role: m.role as "user" | "assistant",
          content: m.content,
          timestamp: m.timestamp,
        })),
        emotionTags: d.emotion_tags || [],
        topicTags: d.topic_tags || [],
        todos: (todos || []).filter(t => t.entry_id === d.id).map(mapTodo),
        emotionScore: d.emotion_score || 5,
        updatedAt: d.updated_at,
      }));

      setEntries(mapped);
    };
    load();
  }, [userId]);

  // Auto-generate recurring todos for today if not yet present
  useEffect(() => {
    if (!userId || entries.length === 0) return;
    const todayEntry = entries.find(e => e.date === todayKey);
    const todayDow = new Date().getDay();

    // Find all recurring todos from the last 30 days
    const allRecurring = entries
      .filter(e => e.date !== todayKey)
      .flatMap(e => e.todos)
      .filter(t => t.recur !== "none" && t.status !== "dropped");

    // Deduplicate by text (only keep most recent version of each recurring task)
    const seen = new Set<string>();
    const uniqueRecurring = allRecurring.filter(t => {
      const key = t.text.trim().toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    uniqueRecurring.forEach(todo => {
      const shouldToday =
        (todo.recur === "daily") ||
        (todo.recur === "weekday" && todayDow >= 1 && todayDow <= 5) ||
        (todo.recur === "weekly" && (todo.recurDays || []).includes(todayDow)) ||
        (todo.recur === "custom" && (todo.recurDays || []).includes(todayDow));

      if (!shouldToday) return;

      // Check if today already has this task
      const alreadyExists = todayEntry?.todos.some(
        t => t.text.trim().toLowerCase() === todo.text.trim().toLowerCase()
      );
      if (alreadyExists) return;

      // Create a fresh instance for today
      const newTodo: typeof todo = {
        ...todo,
        id: crypto.randomUUID(),
        status: "todo" as const,
        sourceDate: todayKey,
        completedAt: undefined,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Add to local state immediately (DB write happens via addTodoToDate)
      setEntries(prev => prev.map(e => {
        if (e.date !== todayKey) return e;
        return { ...e, todos: [...e.todos, newTodo] };
      }));

      // Write to DB async (non-blocking)
      if (userId) {
        supabase.from("day_entries")
          .upsert({ user_id: userId, date: todayKey }, { onConflict: "user_id,date" })
          .select("id").single()
          .then(({ data: entry }) => {
            if (!entry) return;
            supabase.from("todos").insert({
              id: newTodo.id,
              user_id: userId,
              entry_id: entry.id,
              text: newTodo.text,
              status: "todo",
              priority: newTodo.priority,
              tags: newTodo.tags,
              recur: newTodo.recur,
              recur_days: newTodo.recurDays,
              source_date: todayKey,
              created_at: newTodo.createdAt,
              updated_at: newTodo.updatedAt,
            }).then();
          });
      }
    });
  }, [userId, entries.length, todayKey]); // eslint-disable-line

  const ensureEntry = useCallback(async (date: string): Promise<string> => {
    if (!userId) throw new Error("Not authenticated");
    // Check local first
    const existing = entries.find(e => e.date === date);
    if (existing) return existing.id;

    const { data, error } = await supabase
      .from("day_entries")
      .upsert({ user_id: userId, date }, { onConflict: "user_id,date" })
      .select("id")
      .single();

    if (error) throw error;
    return data.id;
  }, [userId, entries]);

  const addMessage = useCallback(async (msg: ChatMessage) => {
    if (!userId) return;
    const entryId = await ensureEntry(todayKey);

    await supabase.from("chat_messages").insert({
      entry_id: entryId,
      user_id: userId,
      role: msg.role,
      content: msg.content,
      timestamp: msg.timestamp,
    });

    setEntries(prev => {
      const idx = prev.findIndex(e => e.date === todayKey);
      if (idx >= 0) {
        const updated = { ...prev[idx], messages: [...prev[idx].messages, msg], updatedAt: new Date().toISOString() };
        return prev.map((e, i) => i === idx ? updated : e);
      }
      const newEntry: DayEntry = {
        id: entryId,
        date: todayKey,
        messages: [msg],
        emotionTags: [],
        topicTags: [],
        todos: [],
        emotionScore: 5,
        updatedAt: new Date().toISOString(),
      };
      return [newEntry, ...prev];
    });
  }, [userId, todayKey, ensureEntry]);



  const updateDayMeta = useCallback(async (date: string, meta: {
    emotionTags?: string[];
    topicTags?: string[];
    todos?: TodoItem[];
    emotionScore?: number;
  }) => {
    if (!userId) return;

    setEntries(prev => {
      const idx = prev.findIndex(e => e.date === date);
      if (idx < 0) return prev;
      const entry = prev[idx];
      const norm = (s: string) => s.trim().toLowerCase().replace(/[，。！？,.!?\s]/g, '');
      let newTodos = entry.todos;
      if (meta.todos && meta.todos.length > 0) {
        const existingNorms = entry.todos.map(t => norm(t.text));
        const deduped = meta.todos.filter(t => {
          const n = norm(t.text);
          return !existingNorms.some(en => en === n || en.includes(n) || n.includes(en));
        });
        newTodos = [...entry.todos, ...deduped];
      }
      const updated = {
        ...entry,
        emotionTags: meta.emotionTags ? [...new Set([...entry.emotionTags, ...meta.emotionTags])].slice(0, 8) : entry.emotionTags,
        topicTags: meta.topicTags ? [...new Set([...entry.topicTags, ...meta.topicTags])].slice(0, 6) : entry.topicTags,
        todos: newTodos,
        emotionScore: meta.emotionScore ?? entry.emotionScore,
        updatedAt: new Date().toISOString(),
      };
      return prev.map((e, i) => i === idx ? updated : e);
    });

    // Persist meta to DB
    const entry = entriesRef.current.find(e => e.date === date);
    if (!entry) return;

    const newEmotionTags = meta.emotionTags
      ? [...new Set([...entry.emotionTags, ...meta.emotionTags])].slice(0, 8)
      : entry.emotionTags;
    const newTopicTags = meta.topicTags
      ? [...new Set([...entry.topicTags, ...meta.topicTags])].slice(0, 6)
      : entry.topicTags;

    await supabase.from("day_entries").update({
      emotion_tags: newEmotionTags,
      topic_tags: newTopicTags,
      emotion_score: meta.emotionScore ?? entry.emotionScore,
      updated_at: new Date().toISOString(),
    }).eq("id", entry.id);

    // Insert new todos
    if (meta.todos && meta.todos.length > 0) {
      const normDb = (s: string) => s.trim().toLowerCase().replace(/[，。！？,.!?\s]/g, '');
      const existingNorms = entry.todos.map(t => normDb(t.text));
      const deduped = meta.todos.filter(t => {
        const n = normDb(t.text);
        return !existingNorms.some(en => en === n || en.includes(n) || n.includes(en));
      });
      if (deduped.length > 0) {
        await supabase.from("todos").insert(deduped.map(t => ({
          id: t.id,
          user_id: userId,
          entry_id: entry.id,
          text: t.text,
          status: t.status,
          priority: t.priority,
          due_date: t.dueDate,
          due_time: t.dueTime,
          tags: t.tags,
          sub_tasks: JSON.stringify(t.subTasks),
          recur: t.recur,
          note: t.note,
          source_date: t.sourceDate,
          created_at: t.createdAt,
          updated_at: t.updatedAt,
        })));
      }
    }
  }, [userId, entries]);

  const toggleTodo = useCallback(async (date: string, todoId: string) => {
    setEntries(prev => prev.map(e =>
      e.date === date
        ? {
            ...e,
            todos: e.todos.map(t => t.id === todoId
              ? { ...t, status: t.status === "done" ? "todo" : "done", completedAt: t.status !== "done" ? new Date().toISOString() : undefined, updatedAt: new Date().toISOString() }
              : t)
          }
        : e
    ));

    const entry = entries.find(e => e.date === date);
    const todo = entry?.todos.find(t => t.id === todoId);
    if (todo) {
      const newStatus = todo.status === "done" ? "todo" : "done";
      await supabase.from("todos").update({
        status: newStatus,
        completed_at: newStatus === "done" ? new Date().toISOString() : null,
        updated_at: new Date().toISOString(),
      }).eq("id", todoId);
    }
  }, [entries]);

  const updateTodo = useCallback(async (date: string, todoId: string, updates: Partial<TodoItem>) => {
    setEntries(prev => prev.map(e =>
      e.date === date
        ? { ...e, todos: e.todos.map(t => t.id === todoId ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t) }
        : e
    ));

    const dbUpdates: any = { updated_at: new Date().toISOString() };
    if (updates.text !== undefined) dbUpdates.text = updates.text;
    if (updates.status !== undefined) dbUpdates.status = updates.status;
    if (updates.priority !== undefined) dbUpdates.priority = updates.priority;
    if (updates.dueDate !== undefined) dbUpdates.due_date = updates.dueDate;
    if (updates.note !== undefined) dbUpdates.note = updates.note;
    await supabase.from("todos").update(dbUpdates).eq("id", todoId);
  }, []);

  const addTodoToDate = useCallback(async (date: string, todo: TodoItem) => {
    if (!userId) return;
    const entryId = await ensureEntry(date);

    await supabase.from("todos").insert({
      id: todo.id,
      user_id: userId,
      entry_id: entryId,
      text: todo.text,
      status: todo.status,
      priority: todo.priority,
      due_date: todo.dueDate,
      due_time: todo.dueTime,
      tags: todo.tags,
      sub_tasks: JSON.stringify(todo.subTasks),
      recur: todo.recur,
      note: todo.note,
      source_date: todo.sourceDate,
      created_at: todo.createdAt,
      updated_at: todo.updatedAt,
    });

    setEntries(prev => {
      const idx = prev.findIndex(e => e.date === date);
      if (idx >= 0) {
        return prev.map((e, i) => i === idx ? { ...e, todos: [...e.todos, todo] } : e);
      }
      const newEntry: DayEntry = {
        id: entryId,
        date,
        messages: [],
        emotionTags: [],
        topicTags: [],
        todos: [todo],
        emotionScore: 5,
        updatedAt: new Date().toISOString(),
      };
      return [newEntry, ...prev];
    });
  }, [userId, ensureEntry]);

  const deleteEntry = useCallback(async (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
    await supabase.from("day_entries").delete().eq("id", id);
  }, []);

  const deleteTodo = useCallback(async (date: string, todoId: string) => {
    setEntries(prev => prev.map(e =>
      e.date === date ? { ...e, todos: e.todos.filter(t => t.id !== todoId) } : e
    ));
    await supabase.from("todos").delete().eq("id", todoId);
  }, []);

  const setFocusTodo = useCallback(async (date: string, todoId: string) => {
    // Collect IDs of todos currently "doing" before the optimistic update
    const prevDoingIds = entriesRef.current
      .flatMap(e => e.todos)
      .filter(t => t.status === "doing" && t.id !== todoId)
      .map(t => t.id);

    // Set target to 'doing', reset any other 'doing' back to 'todo' (optimistic)
    setEntries(prev => prev.map(e => ({
      ...e,
      todos: e.todos.map(t => {
        if (t.id === todoId) return { ...t, status: "doing" as const, updatedAt: new Date().toISOString() };
        if (t.status === "doing") return { ...t, status: "todo" as const, updatedAt: new Date().toISOString() };
        return t;
      }),
    })));

    // Update target todo to "doing" in DB
    await supabase.from("todos").update({ status: "doing", updated_at: new Date().toISOString() }).eq("id", todoId);

    // Reset previously "doing" todos in DB so state stays consistent after refresh
    if (prevDoingIds.length > 0) {
      await supabase.from("todos")
        .update({ status: "todo", updated_at: new Date().toISOString() })
        .in("id", prevDoingIds);
    }
  }, [userId]);

  const allTodos = useMemo(() => {
    return entries.flatMap(e => e.todos.map(t => ({ ...t, sourceDate: t.sourceDate || e.date })));
  }, [entries]);

  const todayEntry = entries.find(e => e.date === todayKey) || null;

  return {
    entries, todayEntry, todayKey, addMessage,
    updateDayMeta, toggleTodo, updateTodo, addTodoToDate, deleteEntry, deleteTodo, setFocusTodo, allTodos,
  };
}

function mapTodo(row: any): TodoItem {
  let subTasks = [];
  try {
    subTasks = typeof row.sub_tasks === "string" ? JSON.parse(row.sub_tasks) : (row.sub_tasks || []);
  } catch { subTasks = []; }

  return {
    id: row.id,
    text: row.text,
    status: row.status || "todo",
    priority: row.priority || "normal",
    dueDate: row.due_date,
    dueTime: row.due_time,
    tags: row.tags || [],
    subTasks,
    recur: row.recur || "none",
    recurDays: row.recur_days,
    reminderMinutes: row.reminder_minutes,
    note: row.note,
    emotionTag: row.emotion_tag,
    sourceDate: row.source_date,
    completedAt: row.completed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function useWheelScores(userId: string | undefined) {
  const [scores, setScores] = useState<WheelScore[]>([]);

  useEffect(() => {
    if (!userId) return;
    supabase.from("wheel_scores").select("*").eq("user_id", userId)
      .order("date", { ascending: false })
      .then(({ data }) => {
        if (data) setScores(data.map(d => ({ date: d.date, scores: d.scores as any })));
      });
  }, [userId]);

  const addScore = useCallback(async (score: WheelScore) => {
    if (!userId) return;
    const dateKey = score.date.split("T")[0];
    await supabase.from("wheel_scores").upsert(
      { user_id: userId, date: dateKey, scores: score.scores as any },
      { onConflict: "user_id,date" }
    );
    setScores(prev => [
      { date: dateKey, scores: score.scores },
      ...prev.filter(s => s.date.split("T")[0] !== dateKey),
    ]);
  }, [userId]);

  return { scores, addScore };
}

export function useFinance(userId: string | undefined) {
  const [entries, setEntries] = useState<FinanceEntry[]>([]);

  useEffect(() => {
    if (!userId) return;
    supabase.from("finance_entries").select("*").eq("user_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setEntries(data.map(d => ({
          id: d.id,
          date: d.date,
          type: d.type as "income" | "expense",
          amount: Number(d.amount),
          category: d.category,
          note: d.note,
          createdAt: d.created_at,
        })));
      });
  }, [userId]);

  const addEntry = useCallback(async (e: Omit<FinanceEntry, "id" | "createdAt">) => {
    if (!userId) return;
    const { data } = await supabase.from("finance_entries").insert({
      user_id: userId,
      date: e.date,
      type: e.type,
      amount: e.amount,
      category: e.category,
      note: e.note,
    }).select().single();

    if (data) {
      setEntries(prev => [{
        id: data.id,
        date: data.date,
        type: data.type as "income" | "expense",
        amount: Number(data.amount),
        category: data.category,
        note: data.note,
        createdAt: data.created_at,
      }, ...prev]);
    }
  }, [userId]);

  const todayStats = useMemo(() => {
    const today = format(new Date(), "yyyy-MM-dd");
    const todayEntries = entries.filter(e => e.date === today);
    const income = todayEntries.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0);
    const expense = todayEntries.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0);
    return { income, expense, net: income - expense, entries: todayEntries };
  }, [entries]);

  const monthStats = useMemo(() => {
    const monthPrefix = format(new Date(), "yyyy-MM");
    const monthEntries = entries.filter(e => e.date.startsWith(monthPrefix));
    const income = monthEntries.filter(e => e.type === "income").reduce((s, e) => s + e.amount, 0);
    const expense = monthEntries.filter(e => e.type === "expense").reduce((s, e) => s + e.amount, 0);
    return { income, expense, net: income - expense, entries: monthEntries, count: monthEntries.length };
  }, [entries]);

  const deleteEntry = useCallback(async (id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
    await supabase.from("finance_entries").delete().eq("id", id);
  }, []);

  const updateEntry = useCallback(async (id: string, updates: Partial<Omit<FinanceEntry, "id" | "createdAt">>) => {
    setEntries(prev => prev.map(e => e.id === id ? { ...e, ...updates } : e));
    const dbUpdates: any = {};
    if (updates.amount !== undefined) dbUpdates.amount = updates.amount;
    if (updates.category !== undefined) dbUpdates.category = updates.category;
    if (updates.note !== undefined) dbUpdates.note = updates.note;
    if (updates.type !== undefined) dbUpdates.type = updates.type;
    if (updates.date !== undefined) dbUpdates.date = updates.date;
    await supabase.from("finance_entries").update(dbUpdates).eq("id", id);
  }, []);

  return { entries, addEntry, deleteEntry, updateEntry, todayStats, monthStats };
}

export interface EnergyLog {
  id: string;
  level: '高' | '中' | '低' | '透支';
  timestamp: string;
  note: string;
}

export function useEnergyLogs(userId: string | undefined) {
  const [logs, setLogs] = useState<EnergyLog[]>([]);

  useEffect(() => {
    if (!userId) return;
    supabase.from("energy_logs").select("*").eq("user_id", userId)
      .order("timestamp", { ascending: false })
      .limit(100)
      .then(({ data }) => {
        if (data) setLogs(data.map(d => ({
          id: d.id,
          level: d.level as EnergyLog['level'],
          timestamp: d.timestamp,
          note: d.note || '',
        })));
      });
  }, [userId]);

  const addLog = useCallback(async (level: EnergyLog['level'], note: string = '') => {
    if (!userId) return;
    const { data } = await supabase.from("energy_logs").insert({
      user_id: userId,
      level,
      note,
    }).select().single();

    if (data) {
      setLogs(prev => [{
        id: data.id,
        level: data.level as EnergyLog['level'],
        timestamp: data.timestamp,
        note: data.note || '',
      }, ...prev]);
    }
    return data;
  }, [userId]);

  // Get recent 7 days summary for AI context
  const recentSummary = useMemo(() => {
    const sevenDaysAgo = subDays(new Date(), 7);
    const recent = logs.filter(l => new Date(l.timestamp) >= sevenDaysAgo);
    if (recent.length === 0) return '';
    const levels = recent.map(l => l.level).join('/');
    const lowCount = recent.filter(l => l.level === '低' || l.level === '透支').length;
    let summary = `用户过去7天精力记录：${levels}`;
    if (lowCount >= 3) {
      summary += `（⚠️ 连续低能量${lowCount}天）`;
    }
    return summary;
  }, [logs]);

  // Check consecutive low energy days
  const consecutiveLowDays = useMemo(() => {
    let count = 0;
    const sorted = [...logs].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    // Group by date, take latest per day
    const byDate = new Map<string, string>();
    for (const l of sorted) {
      const d = format(new Date(l.timestamp), 'yyyy-MM-dd');
      if (!byDate.has(d)) byDate.set(d, l.level);
    }
    const dates = [...byDate.entries()].sort((a, b) => b[0].localeCompare(a[0]));
    for (const [, level] of dates) {
      if (level === '低' || level === '透支') count++;
      else break;
    }
    return count;
  }, [logs]);

  return { logs, addLog, recentSummary, consecutiveLowDays };
}

export function useHabits(userId: string | undefined) {
  const [habits, setHabits] = useState<HabitItem[]>([]);

  useEffect(() => {
    if (!userId) return;
    supabase.from("habits").select("*").eq("user_id", userId)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setHabits(data.map(d => ({
          id: d.id,
          name: d.name,
          emoji: d.emoji,
          targetDays: d.target_days || [],
          checkIns: d.check_ins || [],
          createdAt: d.created_at,
        })));
      });
  }, [userId]);

  const addHabit = useCallback(async (h: Omit<HabitItem, "id" | "createdAt" | "checkIns">) => {
    if (!userId) return;
    const { data } = await supabase.from("habits").insert({
      user_id: userId,
      name: h.name,
      emoji: h.emoji,
      target_days: h.targetDays,
      check_ins: [],
    }).select().single();

    if (data) {
      setHabits(prev => [{
        id: data.id,
        name: data.name,
        emoji: data.emoji,
        targetDays: data.target_days || [],
        checkIns: data.check_ins || [],
        createdAt: data.created_at,
      }, ...prev]);
    }
  }, [userId]);

  const checkIn = useCallback(async (id: string, date: string) => {
    const habit = habits.find(h => h.id === id);
    if (!habit) return;
    const newCheckIns = habit.checkIns.includes(date)
      ? habit.checkIns.filter(d => d !== date)
      : [...habit.checkIns, date];

    setHabits(prev => prev.map(h => h.id === id ? { ...h, checkIns: newCheckIns } : h));
    await supabase.from("habits").update({ check_ins: newCheckIns }).eq("id", id);
  }, [habits]);

  const deleteHabit = useCallback(async (id: string) => {
    setHabits(prev => prev.filter(h => h.id !== id));
    await supabase.from("habits").delete().eq("id", id);
  }, []);

  return { habits, addHabit, checkIn, deleteHabit };
}
