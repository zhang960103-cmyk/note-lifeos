import { useState, useEffect, useCallback } from "react";
import type { DiaryEntry, WheelScore } from "@/types/lifeOs";

const ENTRIES_KEY = "lifeos_entries";
const WHEEL_KEY = "lifeos_wheel";

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export function useEntries() {
  const [entries, setEntries] = useState<DiaryEntry[]>(() => loadFromStorage(ENTRIES_KEY, []));

  useEffect(() => {
    localStorage.setItem(ENTRIES_KEY, JSON.stringify(entries));
  }, [entries]);

  const addEntry = useCallback((entry: DiaryEntry) => {
    setEntries((prev) => [entry, ...prev]);
  }, []);

  const deleteEntry = useCallback((id: string) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
  }, []);

  const updateEntry = useCallback((id: string, updates: Partial<DiaryEntry>) => {
    setEntries((prev) => prev.map((e) => (e.id === id ? { ...e, ...updates } : e)));
  }, []);

  const toggleTask = useCallback((entryId: string, taskId: string) => {
    setEntries((prev) =>
      prev.map((e) =>
        e.id === entryId
          ? { ...e, tasks: e.tasks.map((t) => (t.id === taskId ? { ...t, completed: !t.completed } : t)) }
          : e
      )
    );
  }, []);

  return { entries, addEntry, deleteEntry, updateEntry, toggleTask };
}

export function useWheelScores() {
  const [scores, setScores] = useState<WheelScore[]>(() => loadFromStorage(WHEEL_KEY, []));

  useEffect(() => {
    localStorage.setItem(WHEEL_KEY, JSON.stringify(scores));
  }, [scores]);

  const addScore = useCallback((score: WheelScore) => {
    setScores((prev) => [score, ...prev]);
  }, []);

  return { scores, addScore };
}
