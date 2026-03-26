export type AlgorithmType =
  | "story"      // 生活作业
  | "morning"    // 晨间笔记
  | "emotion"    // 心情日记
  | "gratitude"  // 感恩日记
  | "odyssey"    // 奥德赛计划
  | "wheel"      // 生命之轮
  | "fear"       // 恐惧设定
  | "solomon"    // 所罗门悖论
  | "emergency"  // 突发急救
  | "flow";      // 心流捕捉

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

export interface DiaryEntry {
  id: string;
  createdAt: string;
  content: string;
  algorithm: AlgorithmType;
  domains: LifeDomain[];
  keywords: string[];
  emotionScore: number;    // 1-10
  happinessScore: number;  // 1-10
  tasks: Task[];
  aiResponse?: string;
}

export interface Task {
  id: string;
  text: string;
  type: "建系统" | "卖时间";
  completed: boolean;
}

export interface WheelScore {
  date: string;
  scores: Record<LifeDomain, number>;
}

export const ALGORITHM_INFO: Record<AlgorithmType, { icon: string; name: string; color: string }> = {
  story:     { icon: "📖", name: "生活作业", color: "gold" },
  morning:   { icon: "🌅", name: "晨间笔记", color: "blue" },
  emotion:   { icon: "💔", name: "心情日记", color: "red" },
  gratitude: { icon: "🙏", name: "感恩日记", color: "green" },
  odyssey:   { icon: "🚀", name: "奥德赛计划", color: "purple" },
  wheel:     { icon: "⚖️", name: "生命之轮", color: "teal" },
  fear:      { icon: "😨", name: "恐惧设定", color: "red" },
  solomon:   { icon: "👴", name: "所罗门悖论", color: "gold" },
  emergency: { icon: "🔴", name: "突发急救", color: "red" },
  flow:      { icon: "🔥", name: "心流捕捉", color: "orange" },
};
