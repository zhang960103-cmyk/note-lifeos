import { createContext, useContext, ReactNode } from "react";
import { useDayEntries, useWheelScores, useOnboarding, useFinance, useHabits, useEnergyLogs, type EnergyLog } from "@/hooks/useLifeOs";
import { useModelProfiles } from "@/hooks/useModelProfiles";
import type { DayEntry, WheelScore, ChatMessage, TodoItem, FinanceEntry, HabitItem } from "@/types/lifeOs";

interface LifeOsContextType {
  entries: DayEntry[];
  todayEntry: DayEntry | null;
  todayKey: string;
  addMessage: (msg: ChatMessage) => void;
  updateDayMeta: (date: string, meta: { emotionTags?: string[]; topicTags?: string[]; todos?: TodoItem[]; emotionScore?: number }) => void;
  toggleTodo: (date: string, todoId: string) => void;
  updateTodo: (date: string, todoId: string, updates: Partial<TodoItem>) => void;
  addTodoToDate: (date: string, todo: TodoItem) => void;
  deleteTodo: (date: string, todoId: string) => void;
  deleteEntry: (id: string) => void;
  setFocusTodo: (date: string, todoId: string) => void;
  allTodos: TodoItem[];
  wheelScores: WheelScore[];
  addWheelScore: (score: WheelScore) => void;
  onboarded: boolean | null;
  completeOnboarding: () => void;
  financeEntries: FinanceEntry[];
  addFinanceEntry: (e: Omit<FinanceEntry, 'id' | 'createdAt'>) => void;
  deleteFinanceEntry: (id: string) => void;
  updateFinanceEntry: (id: string, updates: Partial<Omit<FinanceEntry, 'id' | 'createdAt'>>) => void;
  todayFinanceStats: { income: number; expense: number; net: number; entries: FinanceEntry[] };
  monthFinanceStats: { income: number; expense: number; net: number; entries: FinanceEntry[]; count: number };
  habits: HabitItem[];
  addHabit: (h: Omit<HabitItem, 'id' | 'createdAt' | 'checkIns'>) => void;
  checkInHabit: (id: string, date: string) => void;
  deleteHabit: (id: string) => void;
  energyLogs: EnergyLog[];
  addEnergyLog: (level: EnergyLog['level'], note?: string) => Promise<any>;
  energySummary: string;
  consecutiveLowDays: number;
  // 之前 streamChat/callLifeMentorJSON 的 modelProfileId 参数从来没有任何调用方
  // 真正传过——Settings 里切换"默认AI模型"完全是摆设，实际对话请求永远不带
  // profile id，服务端不知道该用哪个模型。这里把"当前默认模型"提升到全局
  // context，所有发起AI请求的页面都能拿到，统一传给后端。
  defaultModelProfileId: string | undefined;
  // usage_tag==="private" 的模型不占用云端每日配额（对应"本地/私有"标签）
  isPrivateModelActive: boolean;
}

const LifeOsContext = createContext<LifeOsContextType | null>(null);

export function LifeOsProvider({ children, userId }: { children: ReactNode; userId: string }) {
  const {
    entries, todayEntry, todayKey, addMessage,
    updateDayMeta, toggleTodo, updateTodo, addTodoToDate, deleteEntry, deleteTodo, setFocusTodo, allTodos,
  } = useDayEntries(userId);
  const { scores: wheelScores, addScore: addWheelScore } = useWheelScores(userId);
  const { onboarded, completeOnboarding } = useOnboarding(userId);
  const { entries: financeEntries, addEntry: addFinanceEntry, deleteEntry: deleteFinanceEntry, updateEntry: updateFinanceEntry, todayStats: todayFinanceStats, monthStats: monthFinanceStats } = useFinance(userId);
  const { habits, addHabit, checkIn: checkInHabit, deleteHabit } = useHabits(userId);
  const { logs: energyLogs, addLog: addEnergyLog, recentSummary: energySummary, consecutiveLowDays } = useEnergyLogs(userId);
  const { getDefault } = useModelProfiles();
  const defaultProfile = getDefault();
  const defaultModelProfileId = defaultProfile?.id;
  const isPrivateModelActive = defaultProfile?.usage_tag === "private";

  return (
    <LifeOsContext.Provider value={{
      entries, todayEntry, todayKey, addMessage,
      updateDayMeta, toggleTodo, updateTodo, addTodoToDate, deleteEntry, deleteTodo, setFocusTodo, allTodos,
      wheelScores, addWheelScore, onboarded, completeOnboarding,
      financeEntries, addFinanceEntry, deleteFinanceEntry, updateFinanceEntry, todayFinanceStats, monthFinanceStats,
      habits, addHabit, checkInHabit, deleteHabit,
      energyLogs, addEnergyLog, energySummary, consecutiveLowDays,
      defaultModelProfileId, isPrivateModelActive,
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
