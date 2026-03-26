import { createContext, useContext, ReactNode } from "react";
import { useEntries, useWheelScores } from "@/hooks/useLifeOs";
import type { DiaryEntry, WheelScore } from "@/types/lifeOs";

interface LifeOsContextType {
  entries: DiaryEntry[];
  addEntry: (entry: DiaryEntry) => void;
  deleteEntry: (id: string) => void;
  updateEntry: (id: string, updates: Partial<DiaryEntry>) => void;
  toggleTask: (entryId: string, taskId: string) => void;
  wheelScores: WheelScore[];
  addWheelScore: (score: WheelScore) => void;
}

const LifeOsContext = createContext<LifeOsContextType | null>(null);

export function LifeOsProvider({ children }: { children: ReactNode }) {
  const { entries, addEntry, deleteEntry, updateEntry, toggleTask } = useEntries();
  const { scores: wheelScores, addScore: addWheelScore } = useWheelScores();

  return (
    <LifeOsContext.Provider value={{ entries, addEntry, deleteEntry, updateEntry, toggleTask, wheelScores, addWheelScore }}>
      {children}
    </LifeOsContext.Provider>
  );
}

export function useLifeOs() {
  const ctx = useContext(LifeOsContext);
  if (!ctx) throw new Error("useLifeOs must be used within LifeOsProvider");
  return ctx;
}
