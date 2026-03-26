import type { AlgorithmType } from "@/types/lifeOs";

const keywords = {
  fear:   ["担心", "害怕", "不敢", "万一", "后果", "失败", "拖延", "不想"],
  future: ["未来", "方向", "迷茫", "不知道", "选择", "何去何从"],
  regret: ["后悔", "纠结", "值不值", "如果当时", "早知道"],
  sad:    ["难受", "崩溃", "愤怒", "委屈", "伤心", "绝望", "好烦"],
  flow:   ["超级", "很爽", "心流", "状态好", "效率高", "停不下来"],
};

export function routeAlgorithm(text: string, emotionScore: number = 5): AlgorithmType {
  const t = text.toLowerCase();
  const hour = new Date().getHours();

  // 心流检测
  if (emotionScore >= 9 || keywords.flow.some((w) => t.includes(w))) return "flow";

  // 情绪急救
  if (emotionScore >= 8 || keywords.sad.some((w) => t.includes(w))) return "emotion";

  // 关键词路由
  if (keywords.regret.some((w) => t.includes(w))) return "solomon";
  if (keywords.future.some((w) => t.includes(w))) return "odyssey";
  if (keywords.fear.some((w) => t.includes(w))) return "fear";

  // 时间路由
  if (hour >= 5 && hour < 12) return "morning";
  if (hour >= 20 || hour < 5) return "story";

  return "story";
}
