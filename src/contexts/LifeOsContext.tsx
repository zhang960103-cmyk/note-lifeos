import { createContext, useContext, ReactNode } from "react";
import { useDayEntries, useWheelScores, useOnboarding } from "@/hooks/useLifeOs";
import type { DayEntry, WheelScore, ChatMessage, TodoItem } from "@/types/lifeOs";

interface LifeOsContextType {
  entries: DayEntry[];
  todayEntry: DayEntry | null;
  todayKey: string;
  addMessage: (msg: ChatMessage) => void;
  updateAssistantMessage: (content: string) => void;
  updateDayMeta: (date: string, meta: { emotionTags?: string[]; topicTags?: string[]; todos?: TodoItem[]; emotionScore?: number }) => void;
  toggleTodo: (date: string, todoId: string) => void;
  deleteEntry: (id: string) => void;
  wheelScores: WheelScore[];
  addWheelScore: (score: WheelScore) => void;
  onboarded: boolean;
  completeOnboarding: () => void;
}

const LifeOsContext = createContext<LifeOsContextType | null>(null);

export function LifeOsProvider({ children }: { children: ReactNode }) {
  const { entries, todayEntry, todayKey, addMessage, updateAssistantMessage, updateDayMeta, toggleTodo, deleteEntry } = useDayEntries();
  const { scores: wheelScores, addScore: addWheelScore } = useWheelScores();
  const { onboarded, completeOnboarding } = useOnboarding();

  return (
    <LifeOsContext.Provider value={{
      entries, todayEntry, todayKey, addMessage, updateAssistantMessage, updateDayMeta, toggleTodo, deleteEntry,
      wheelScores, addWheelScore, onboarded, completeOnboarding,
    }}>
      {children}
    </LifeOsContext.Provider>
  );
}

export function useLifeOs() {
  const ctx = useContext(LifeOsContext);
  if (!ctx) throw new Error("useLifeOs must be used within LifeOsProvider");
  return ctx;
}
