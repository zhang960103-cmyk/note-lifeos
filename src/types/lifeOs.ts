export type LifeDomain =
  | "学习成长"
  | "感情婚姻"
  | "家庭关系"
  | "事业财务"
  | "身心健康"
  | "社会连接"
  | "人生意义";

export const ALL_DOMAINS: LifeDomain[] = [
  "学习成长", "感情婚姻", "家庭关系", "事业财务", "身心健康", "社会连接", "人生意义",
];

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
  timestamp: string;
}

export interface DayEntry {
  id: string;
  date: string; // YYYY-MM-DD
  messages: ChatMessage[];
  emotionTags: string[];
  topicTags: string[];
  todos: TodoItem[];
  emotionScore: number; // 1-10
  updatedAt: string;
}

// === Enhanced Todo System ===
export type Priority = 'urgent' | 'high' | 'normal' | 'low';
export type RecurType = 'none' | 'daily' | 'weekly' | 'weekday' | 'custom';
export type TaskStatus = 'todo' | 'doing' | 'done' | 'dropped';

export interface SubTask {
  id: string;
  text: string;
  done: boolean;
}

export interface TodoItem {
  id: string;
  text: string;
  status: TaskStatus;
  priority: Priority;
  dueDate?: string;
  dueTime?: string;
  tags: string[];
  subTasks: SubTask[];
  recur: RecurType;
  recurDays?: number[];
  reminderMinutes?: number;
  note?: string;
  emotionTag?: string;
  sourceDate?: string;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
  // legacy compat
  completed?: boolean;
}

export interface HabitItem {
  id: string;
  name: string;
  emoji: string;
  targetDays: number[];
  checkIns: string[];
  createdAt: string;
}

// === Finance System ===
export interface FinanceEntry {
  id: string;
  date: string;
  type: 'income' | 'expense';
  amount: number;
  category: string;
  note: string;
  createdAt: string;
}

export interface WheelScore {
  date: string;
  scores: Record<LifeDomain, number>;
}

// Resource recommendation types
export interface ResourceRecommendation {
  type: 'book' | 'website' | 'tool' | 'course';
  title: string;
  url?: string;
  description: string;
}
