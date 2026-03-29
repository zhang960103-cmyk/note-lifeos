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
    tags: raw.tags || [],
    subTasks: (raw.subTasks || []).map(s => ({ id: crypto.randomUUID(), text: s.text, done: false })),
    recur: "none",
    note: raw.note,
    sourceDate,
    createdAt: now,
    updatedAt: now,
  };
}

export function useOnboarding(userId: string | undefined) {
  const [done, setDone] = useState<boolean | null>(null);

  useEffect(() => {
    if (!userId) return;
    supabase.from("profiles").select("onboarded").eq("id", userId).single()
      .then(({ data }) => setDone(data?.onboarded ?? false));
  }, [userId]);

  const complete = useCallback(async () => {
    if (!userId) return;
    await supabase.from("profiles").update({ onboarded: true }).eq("id", userId);
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

  const updateDayMeta
    setEntries(prev => {
      const idx = prev.findIndex(e => e.date === todayKey);
      if (idx < 0) return prev;
      const entry = prev[idx];
      const msgs = [...entry.messages];
      if (msgs.length > 0 && msgs[msgs.length - 1].role === "assistant") {
        msgs[msgs.length - 1] = { ...msgs[msgs.length - 1], content };
      } else {
        msgs.push({ role: "assistant", content, timestamp: new Date().toISOString() });
      }
      return prev.map((e, i) => i === idx ? { ...e, messages: msgs, updatedAt: new Date().toISOString() } : e);
    });
  }, [todayKey]);

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
    // Set target to 'doing', reset any other 'doing' back to 'todo'
    setEntries(prev => prev.map(e => ({
      ...e,
      todos: e.todos.map(t => {
        if (t.id === todoId) return { ...t, status: "doing" as const, updatedAt: new Date().toISOString() };
        if (t.status === "doing") return { ...t, status: "todo" as const, updatedAt: new Date().toISOString() };
        return t;
      }),
    })));

    // Only update the target todo in DB; frontend setEntries already handles resetting others
    await supabase.from("todos").update({ status: "doing", updated_at: new Date().toISOString() }).eq("id", todoId);
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
