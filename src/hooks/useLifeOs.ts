import { useState, useEffect, useCallback, useMemo } from "react";
import type { DayEntry, WheelScore, ChatMessage, TodoItem, FinanceEntry, HabitItem } from "@/types/lifeOs";
import { format, addDays, nextSunday } from "date-fns";

const ENTRIES_KEY = "lifeos_days";
const WHEEL_KEY = "lifeos_wheel";
const ONBOARDED_KEY = "lifeos_onboarded";
const FINANCE_KEY = "lifeos_finance";
const HABITS_KEY = "lifeos_habits";

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function useOnboarding() {
  const [done, setDone] = useState(() => localStorage.getItem(ONBOARDED_KEY) === "1");
  const complete = useCallback(() => {
    localStorage.setItem(ONBOARDED_KEY, "1");
    setDone(true);
  }, []);
  return { onboarded: done, completeOnboarding: complete };
}

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

// Create a full TodoItem from AI-extracted partial data
export function createTodoFromExtract(
  raw: { text: string; priority?: string; dueDate?: string; tags?: string[] },
  sourceDate: string
): TodoItem {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    text: raw.text,
    status: "todo",
    priority: (raw.priority as any) || "normal",
    dueDate: resolveDueDate(raw.dueDate),
    tags: raw.tags || [],
    subTasks: [],
    recur: "none",
    sourceDate,
    createdAt: now,
    updatedAt: now,
  };
}

export function useDayEntries() {
  const [entries, setEntries] = useState<DayEntry[]>(() => loadFromStorage(ENTRIES_KEY, []));

  useEffect(() => {
    localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
  }, [entries]);

  const todayKey = format(new Date(), "yyyy-MM-dd");

  const addMessage = useCallback((msg: ChatMessage) => {
    setEntries(prev => {
      const idx = prev.findIndex(e => e.date === todayKey);
      if (idx >= 0) {
        const updated = { ...prev[idx], messages: [...prev[idx].messages, msg], updatedAt: new Date().toISOString() };
        return prev.map((e, i) => i === idx ? updated : e);
      }
      const newEntry: DayEntry = {
        id: crypto.randomUUID(),
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
  }, [todayKey]);

  const updateAssistantMessage = useCallback((content: string) => {
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

  const updateDayMeta = useCallback((date: string, meta: {
    emotionTags?: string[];
    topicTags?: string[];
    todos?: TodoItem[];
    emotionScore?: number;
  }) => {
    setEntries(prev => {
      const idx = prev.findIndex(e => e.date === date);
      if (idx < 0) return prev;
      const entry = prev[idx];

      // Deduplicate todos
      let newTodos = entry.todos;
      if (meta.todos && meta.todos.length > 0) {
        const existingTexts = entry.todos.map(t => t.text.trim().toLowerCase());
        const deduped = meta.todos.filter(t => {
          const normalized = t.text.trim().toLowerCase();
          return !existingTexts.some(et => et === normalized || similarity(et, normalized) > 0.8);
        });
        newTodos = [...entry.todos, ...deduped];
      }

      const updated = {
        ...entry,
        emotionTags: meta.emotionTags ? [...new Set([...entry.emotionTags, ...meta.emotionTags])] : entry.emotionTags,
        topicTags: meta.topicTags ? [...new Set([...entry.topicTags, ...meta.topicTags])] : entry.topicTags,
        todos: newTodos,
        emotionScore: meta.emotionScore ?? entry.emotionScore,
        updatedAt: new Date().toISOString(),
      };
      return prev.map((e, i) => i === idx ? updated : e);
    });
  }, []);

  const toggleTodo = useCallback((date: string, todoId: string) => {
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
  }, []);

  const updateTodo = useCallback((date: string, todoId: string, updates: Partial<TodoItem>) => {
    setEntries(prev => prev.map(e =>
      e.date === date
        ? { ...e, todos: e.todos.map(t => t.id === todoId ? { ...t, ...updates, updatedAt: new Date().toISOString() } : t) }
        : e
    ));
  }, []);

  const addTodoToDate = useCallback((date: string, todo: TodoItem) => {
    setEntries(prev => {
      const idx = prev.findIndex(e => e.date === date);
      if (idx >= 0) {
        return prev.map((e, i) => i === idx ? { ...e, todos: [...e.todos, todo] } : e);
      }
      // Create entry for the date
      const newEntry: DayEntry = {
        id: crypto.randomUUID(),
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
  }, []);

  const deleteEntry = useCallback((id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
  }, []);

  // Get all todos across all entries
  const allTodos = useMemo(() => {
    return entries.flatMap(e => e.todos.map(t => ({ ...t, sourceDate: t.sourceDate || e.date })));
  }, [entries]);

  const todayEntry = entries.find(e => e.date === todayKey) || null;

  return {
    entries, todayEntry, todayKey, addMessage, updateAssistantMessage,
    updateDayMeta, toggleTodo, updateTodo, addTodoToDate, deleteEntry, allTodos,
  };
}

// Simple character overlap similarity
function similarity(a: string, b: string): number {
  if (a === b) return 1;
  const setA = new Set(a.split(""));
  const setB = new Set(b.split(""));
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);
  return intersection.size / union.size;
}

export function useWheelScores() {
  const [scores, setScores] = useState<WheelScore[]>(() => loadFromStorage(WHEEL_KEY, []));

  useEffect(() => {
    localStorage.setItem(WHEEL_KEY, JSON.stringify(scores));
  }, [scores]);

  const addScore = useCallback((score: WheelScore) => {
    setScores(prev => [score, ...prev]);
  }, []);

  return { scores, addScore };
}

export function useFinance() {
  const [entries, setEntries] = useState<FinanceEntry[]>(
    () => loadFromStorage(FINANCE_KEY, [])
  );

  useEffect(() => {
    localStorage.setItem(FINANCE_KEY, JSON.stringify(entries));
  }, [entries]);

  const addEntry = useCallback((e: Omit<FinanceEntry, 'id' | 'createdAt'>) => {
    setEntries(prev => [{
      ...e, id: crypto.randomUUID(),
      createdAt: new Date().toISOString()
    }, ...prev]);
  }, []);

  const todayStats = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    const todayEntries = entries.filter(e => e.date === today);
    const income = todayEntries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
    const expense = todayEntries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
    return { income, expense, net: income - expense, entries: todayEntries };
  }, [entries]);

  const monthStats = useMemo(() => {
    const monthPrefix = format(new Date(), 'yyyy-MM');
    const monthEntries = entries.filter(e => e.date.startsWith(monthPrefix));
    const income = monthEntries.filter(e => e.type === 'income').reduce((s, e) => s + e.amount, 0);
    const expense = monthEntries.filter(e => e.type === 'expense').reduce((s, e) => s + e.amount, 0);
    return { income, expense, net: income - expense, entries: monthEntries, count: monthEntries.length };
  }, [entries]);

  return { entries, addEntry, todayStats, monthStats };
}

export function useHabits() {
  const [habits, setHabits] = useState<HabitItem[]>(
    () => loadFromStorage(HABITS_KEY, [])
  );

  useEffect(() => {
    localStorage.setItem(HABITS_KEY, JSON.stringify(habits));
  }, [habits]);

  const addHabit = useCallback((h: Omit<HabitItem, 'id' | 'createdAt' | 'checkIns'>) => {
    setHabits(prev => [{
      ...h, id: crypto.randomUUID(),
      checkIns: [], createdAt: new Date().toISOString()
    }, ...prev]);
  }, []);

  const checkIn = useCallback((id: string, date: string) => {
    setHabits(prev => prev.map(h =>
      h.id === id
        ? { ...h, checkIns: h.checkIns.includes(date) ? h.checkIns.filter(d => d !== date) : [...h.checkIns, date] }
        : h
    ));
  }, []);

  const deleteHabit = useCallback((id: string) => {
    setHabits(prev => prev.filter(h => h.id !== id));
  }, []);

  return { habits, addHabit, checkIn, deleteHabit };
}
