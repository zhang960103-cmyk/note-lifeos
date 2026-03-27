import { createContext, useContext, ReactNode } from "react";
import { useDayEntries, useWheelScores, useOnboarding, useFinance, useHabits } from "@/hooks/useLifeOs";
import type { DayEntry, WheelScore, ChatMessage, TodoItem, FinanceEntry, HabitItem } from "@/types/lifeOs";

interface LifeOsContextType {
  entries: DayEntry[];
  todayEntry: DayEntry | null;
  todayKey: string;
  addMessage: (msg: ChatMessage) => void;
  updateAssistantMessage: (content: string) => void;
  updateDayMeta: (date: string, meta: { emotionTags?: string[]; topicTags?: string[]; todos?: TodoItem[]; emotionScore?: number }) => void;
  toggleTodo: (date: string, todoId: string) => void;
  updateTodo: (date: string, todoId: string, updates: Partial<TodoItem>) => void;
  addTodoToDate: (date: string, todo: TodoItem) => void;
  deleteEntry: (id: string) => void;
  allTodos: TodoItem[];
  wheelScores: WheelScore[];
  addWheelScore: (score: WheelScore) => void;
  onboarded: boolean;
  completeOnboarding: () => void;
  // Finance
  financeEntries: FinanceEntry[];
  addFinanceEntry: (e: Omit<FinanceEntry, 'id' | 'createdAt'>) => void;
  todayFinanceStats: { income: number; expense: number; net: number; entries: FinanceEntry[] };
  monthFinanceStats: { income: number; expense: number; net: number; entries: FinanceEntry[]; count: number };
  // Habits
  habits: HabitItem[];
  addHabit: (h: Omit<HabitItem, 'id' | 'createdAt' | 'checkIns'>) => void;
  checkInHabit: (id: string, date: string) => void;
  deleteHabit: (id: string) => void;
}

const LifeOsContext = createContext<LifeOsContextType | null>(null);

export function LifeOsProvider({ children }: { children: ReactNode }) {
  const {
    entries, todayEntry, todayKey, addMessage, updateAssistantMessage,
    updateDayMeta, toggleTodo, updateTodo, addTodoToDate, deleteEntry, allTodos,
  } = useDayEntries();
  const { scores: wheelScores, addScore: addWheelScore } = useWheelScores();
  const { onboarded, completeOnboarding } = useOnboarding();
  const { entries: financeEntries, addEntry: addFinanceEntry, todayStats: todayFinanceStats, monthStats: monthFinanceStats } = useFinance();
  const { habits, addHabit, checkIn: checkInHabit, deleteHabit } = useHabits();

  return (
    <LifeOsContext.Provider value={{
      entries, todayEntry, todayKey, addMessage, updateAssistantMessage,
      updateDayMeta, toggleTodo, updateTodo, addTodoToDate, deleteEntry, allTodos,
      wheelScores, addWheelScore, onboarded, completeOnboarding,
      financeEntries, addFinanceEntry, todayFinanceStats, monthFinanceStats,
      habits, addHabit, checkInHabit, deleteHabit,
    }}>
      {children}
    </LifeOsContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useLifeOs() {
  const ctx = useContext(LifeOsContext);
  if (!ctx) throw new Error("useLifeOs must be used within LifeOsProvider");
  return ctx;
}
