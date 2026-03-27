import { useState, useEffect, useCallback } from "react";
import type { DayEntry, WheelScore, ChatMessage, TodoItem } from "@/types/lifeOs";
import { format } from "date-fns";

const ENTRIES_KEY = "lifeos_days";
const WHEEL_KEY = "lifeos_wheel";
const ONBOARDED_KEY = "lifeos_onboarded";

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

export function useDayEntries() {
  const [entries, setEntries] = useState<DayEntry[]>(() => loadFromStorage(ENTRIES_KEY, []));

  useEffect(() => {
    localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
  }, [entries]);

  const todayKey = format(new Date(), "yyyy-MM-dd");

  const getOrCreateToday = useCallback((): DayEntry => {
    const existing = entries.find(e => e.date === todayKey);
    if (existing) return existing;
    const newEntry: DayEntry = {
      id: crypto.randomUUID(),
      date: todayKey,
      messages: [],
      emotionTags: [],
      topicTags: [],
      todos: [],
      emotionScore: 5,
      updatedAt: new Date().toISOString(),
    };
    return newEntry;
  }, [entries, todayKey]);

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

  const updateDayMeta = useCallback((date: string, meta: { emotionTags?: string[]; topicTags?: string[]; todos?: TodoItem[]; emotionScore?: number }) => {
    setEntries(prev => {
      const idx = prev.findIndex(e => e.date === date);
      if (idx < 0) return prev;
      const entry = prev[idx];
      const updated = {
        ...entry,
        emotionTags: meta.emotionTags ? [...new Set([...entry.emotionTags, ...meta.emotionTags])] : entry.emotionTags,
        topicTags: meta.topicTags ? [...new Set([...entry.topicTags, ...meta.topicTags])] : entry.topicTags,
        todos: meta.todos ? [...entry.todos, ...meta.todos] : entry.todos,
        emotionScore: meta.emotionScore ?? entry.emotionScore,
        updatedAt: new Date().toISOString(),
      };
      return prev.map((e, i) => i === idx ? updated : e);
    });
  }, []);

  const toggleTodo = useCallback((date: string, todoId: string) => {
    setEntries(prev => prev.map(e =>
      e.date === date
        ? { ...e, todos: e.todos.map(t => t.id === todoId ? { ...t, completed: !t.completed } : t) }
        : e
    ));
  }, []);

  const deleteEntry = useCallback((id: string) => {
    setEntries(prev => prev.filter(e => e.id !== id));
  }, []);

  const todayEntry = entries.find(e => e.date === todayKey) || null;

  return { entries, todayEntry, todayKey, addMessage, updateAssistantMessage, updateDayMeta, toggleTodo, deleteEntry };
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
