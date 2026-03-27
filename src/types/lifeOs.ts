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

export interface TodoItem {
  id: string;
  text: string;
  completed: boolean;
  createdAt: string;
}

export interface WheelScore {
  date: string;
  scores: Record<LifeDomain, number>;
}
