/**
 * Intent Recognition Engine
 * 本地快速意图识别层 — 在发送给AI之前先分类，实现即时反馈
 * 无需网络请求，毫秒级响应
 */

export type Intent =
  | "plan_day"        // 帮我安排今天
  | "plan_week"       // 帮我规划这周
  | "replan"          // 突发情况重排
  | "finance_expense" // 花钱了
  | "finance_income"  // 收入
  | "complete_task"   // 任务完成了
  | "add_task"        // 要做某件事
  | "emotion"         // 情绪表达
  | "time_record"     // 时间记录
  | "gap_check"       // 检查计划漏洞
  | "briefing"        // 今日简报
  | "review"          // 复盘
  | "general";        // 普通对话

export interface IntentResult {
  intent: Intent;
  confidence: number;       // 0-1
  extracted: {
    amount?: number;
    category?: string;
    taskText?: string;
    timeHint?: string;
    emotion?: string;
  };
}

// ─── 关键词规则 ─────────────────────────────────────────────────────────────

const PLAN_DAY_PATTERNS = [
  /帮我(安排|规划|计划|排一下)(今天|今日|今天的)/,
  /今天(怎么安排|怎么规划|的计划|应该怎么过)/,
  /安排(一下|下)今天/,
  /今天(有什么要做|要做什么|应该做什么)/,
];

const PLAN_WEEK_PATTERNS = [
  /帮我(安排|规划|计划)(这周|本周|这个星期|这周的)/,
  /(这周|本周|这个星期)(怎么安排|怎么规划|的计划)/,
  /周计划|周规划|本周计划/,
];

const REPLAN_PATTERNS = [
  /临时(有|来了|出现|增加)/,
  /突发|突然(有|来了|出现)/,
  /(临时|突然)(开会|会议|任务|事情|事儿)/,
  /计划(变了|变更|调整|改了)/,
  /占了.{1,5}(小时|分钟|时间)/,
  /刚刚.{1,10}(小时|分钟)/,
  /重新(安排|规划|排)/,
];

const FINANCE_EXPENSE_PATTERNS = [
  /花了|花了\s*[\d,.]+/,
  /买了|买了\s*[\d,.]+/,
  /消费|支出|付了|付款/,
  /[\d,.]+\s*(元|块|¥|rmb)/i,
  /吃饭|外卖|打车|购物|买单/,
];

const FINANCE_INCOME_PATTERNS = [
  /收到|收入|到账|打款|转账给我/,
  /收了\s*[\d,.]+/,
  /工资|薪水|奖金|红包|报销|退款/,
  /赚了|挣了/,
];

const COMPLETE_TASK_PATTERNS = [
  /完成了|做完了|搞定了|弄完了|已经(做|完成|处理)/,
  /今天(做完|完成了)/,
  /(方案|报告|任务|会议|文档).{0,5}(好了|完了|搞定|结束)/,
];

const ADD_TASK_PATTERNS = [
  /要(做|完成|处理|提交|写|发|联系|安排|准备)/,
  /需要(做|完成|处理|提交|写|发|联系|安排|准备)/,
  /记一下|记录一下|提醒(我|一下)/,
  /待办|to.?do/i,
  /明天要|后天要|这周要|下周要/,
];

const EMOTION_PATTERNS = [
  /今天(很|比较|有点|特别|非常|超级|好|不|还|挺)(累|开心|高兴|焦虑|烦|难受|压力|兴奋|满足|郁闷|失落)/,
  /感觉(很|比较|有点|特别|非常|超)(累|开心|高兴|焦虑|烦|难受|压力|兴奋|满足)/,
  /心情(很|比较|有点|不|还)(好|差|复杂|平静|低落|焦虑)/,
  /状态(很|比较|有点|不)(好|差|糟|棒)/,
];

const TIME_RECORD_PATTERNS = [
  /\d{1,2}:\d{2}(到|-|至)\d{1,2}:\d{2}/,
  /(上午|下午|晚上|早上)\d{1,2}(点|时)/,
  /用了\s*\d+\s*(小时|分钟)/,
  /花了\s*\d+\s*(小时|分钟)/,
  /耗了\s*\d+\s*(小时|分钟)/,
];

const AMOUNT_REGEX = /[\d,]+(\.\d+)?/;
const EXPENSE_CATEGORIES: Record<string, string[]> = {
  "餐饮": ["吃", "饭", "餐", "外卖", "咖啡", "奶茶", "饮料", "早餐", "午餐", "晚餐"],
  "交通": ["打车", "地铁", "公交", "滴滴", "高铁", "机票", "油费", "停车"],
  "购物": ["买", "购", "淘宝", "京东", "超市", "便利店"],
  "娱乐": ["电影", "游戏", "KTV", "演唱会", "健身", "运动"],
  "医疗": ["医院", "药", "看病", "体检"],
  "学习": ["课程", "书", "培训", "教材"],
};

function detectExpenseCategory(text: string): string {
  for (const [cat, keywords] of Object.entries(EXPENSE_CATEGORIES)) {
    if (keywords.some(kw => text.includes(kw))) return cat;
  }
  return "其他";
}

function extractAmount(text: string): number | undefined {
  const match = text.match(AMOUNT_REGEX);
  if (match) {
    const num = parseFloat(match[0].replace(",", ""));
    if (num > 0 && num < 1000000) return num;
  }
  return undefined;
}

// ─── 主识别函数 ───────────────────────────────────────────────────────────────

export function recognizeIntent(text: string): IntentResult {
  const t = text.trim();

  // 计划今天
  if (PLAN_DAY_PATTERNS.some(p => p.test(t))) {
    return { intent: "plan_day", confidence: 0.95, extracted: {} };
  }

  // 计划本周
  if (PLAN_WEEK_PATTERNS.some(p => p.test(t))) {
    return { intent: "plan_week", confidence: 0.95, extracted: {} };
  }

  // 突发重排
  if (REPLAN_PATTERNS.some(p => p.test(t))) {
    return { intent: "replan", confidence: 0.9, extracted: {} };
  }

  // 支出
  if (FINANCE_EXPENSE_PATTERNS.some(p => p.test(t))) {
    return {
      intent: "finance_expense",
      confidence: 0.85,
      extracted: {
        amount: extractAmount(t),
        category: detectExpenseCategory(t),
      },
    };
  }

  // 收入
  if (FINANCE_INCOME_PATTERNS.some(p => p.test(t))) {
    return {
      intent: "finance_income",
      confidence: 0.85,
      extracted: { amount: extractAmount(t) },
    };
  }

  // 完成任务
  if (COMPLETE_TASK_PATTERNS.some(p => p.test(t))) {
    return { intent: "complete_task", confidence: 0.8, extracted: {} };
  }

  // 添加任务
  if (ADD_TASK_PATTERNS.some(p => p.test(t))) {
    return { intent: "add_task", confidence: 0.75, extracted: { taskText: t } };
  }

  // 时间记录
  if (TIME_RECORD_PATTERNS.some(p => p.test(t))) {
    return { intent: "time_record", confidence: 0.8, extracted: { timeHint: t } };
  }

  // 情绪
  if (EMOTION_PATTERNS.some(p => p.test(t))) {
    return { intent: "emotion", confidence: 0.75, extracted: {} };
  }

  return { intent: "general", confidence: 0.5, extracted: {} };
}

// ─── 计划完整性检查 ──────────────────────────────────────────────────────────

export interface PlanGap {
  type: "overdue" | "habit_missing" | "no_rest" | "budget_risk" | "no_focus";
  message: string;
  severity: "high" | "medium" | "low";
}

export interface GapCheckInput {
  todayTodos: Array<{ text: string; status: string; dueDate?: string }>;
  allTodos: Array<{ text: string; status: string; dueDate?: string; sourceDate?: string }>;
  habits: Array<{ name: string; targetDays: number[]; checkIns: string[] }>;
  todayKey: string;
  todaySpend?: number;
  monthBudgetTotal?: number;
  monthSpend?: number;
  todayHasRest?: boolean;
}

export function detectPlanGaps(input: GapCheckInput): PlanGap[] {
  const gaps: PlanGap[] = [];
  const todayDate = new Date(input.todayKey);
  const todayDow = todayDate.getDay();

  // 1. 逾期任务检查
  const overdue = input.allTodos.filter(t =>
    t.status !== "done" && t.status !== "dropped" &&
    t.dueDate && t.dueDate < input.todayKey
  );
  if (overdue.length > 0) {
    gaps.push({
      type: "overdue",
      message: `有 ${overdue.length} 个逾期任务未完成：${overdue.slice(0, 2).map(t => t.text).join("、")}${overdue.length > 2 ? "等" : ""}`,
      severity: "high",
    });
  }

  // 2. 今天无专注任务
  const doingOrTodo = input.todayTodos.filter(t => t.status === "todo" || t.status === "doing");
  if (doingOrTodo.length === 0) {
    gaps.push({
      type: "no_focus",
      message: "今天还没有安排任何待办事项，要不要说一下今天的计划？",
      severity: "medium",
    });
  }

  // 3. 习惯检查 — 今天应该做但没打卡
  const today = input.todayKey;
  input.habits.forEach(habit => {
    const shouldToday = habit.targetDays.includes(todayDow);
    const checkedToday = habit.checkIns.includes(today);
    if (shouldToday && !checkedToday) {
      gaps.push({
        type: "habit_missing",
        message: `「${habit.name}」今天还没打卡`,
        severity: "low",
      });
    }
  });

  // 4. 预算风险
  if (input.monthBudgetTotal && input.monthSpend) {
    const usedPct = input.monthSpend / input.monthBudgetTotal;
    const dayOfMonth = todayDate.getDate();
    const expectedPct = dayOfMonth / 30;
    if (usedPct > expectedPct + 0.2) {
      gaps.push({
        type: "budget_risk",
        message: `本月已用 ${Math.round(usedPct * 100)}% 预算，但才到月份 ${Math.round(expectedPct * 100)}%，支出节奏偏快`,
        severity: "medium",
      });
    }
  }

  return gaps;
}

// ─── 时间规划生成器 ──────────────────────────────────────────────────────────

export interface TimeBlock {
  startTime: string;
  endTime: string;
  label: string;
  type: "focus" | "meeting" | "exercise" | "rest" | "routine";
}

export function generateDayPlan(
  tasks: string[],
  energyLevel: "high" | "medium" | "low" = "medium",
  existingEvents: TimeBlock[] = []
): TimeBlock[] {
  // 根据精力水平确定高效时间段
  const focusStart = energyLevel === "high" ? "09:00" : energyLevel === "medium" ? "09:30" : "10:00";
  const plan: TimeBlock[] = [
    { startTime: "07:30", endTime: "08:30", label: "晨间例行（洗漱/早餐/回顾今日计划）", type: "routine" },
    { startTime: focusStart, endTime: "11:30", label: tasks[0] ? `深度工作：${tasks[0]}` : "深度工作时间", type: "focus" },
    { startTime: "11:30", endTime: "13:00", label: "午餐 + 短休", type: "rest" },
    { startTime: "13:30", endTime: "15:30", label: tasks[1] ? `专注：${tasks[1]}` : "次要任务处理", type: "focus" },
    { startTime: "15:30", endTime: "16:00", label: "碎片处理（邮件/消息/杂事）", type: "routine" },
    { startTime: "16:00", endTime: "17:30", label: tasks[2] ? `收尾：${tasks[2]}` : "协作/沟通事项", type: "meeting" },
    { startTime: "18:00", endTime: "19:00", label: "运动/锻炼", type: "exercise" },
    { startTime: "21:00", endTime: "22:00", label: "复盘今日 + 明日预演", type: "routine" },
    { startTime: "22:30", endTime: "23:00", label: "关闭屏幕，准备入睡", type: "rest" },
  ];

  // 如果任务超过3个，塞入下午
  if (tasks.length > 3) {
    plan.push({
      startTime: "19:30",
      endTime: "20:30",
      label: `额外：${tasks.slice(3).join("、")}`,
      type: "focus",
    });
  }

  return plan;
}

export function formatDayPlan(plan: TimeBlock[], tasks: string[]): string {
  const typeEmoji: Record<TimeBlock["type"], string> = {
    focus: "🎯", meeting: "💬", exercise: "💪", rest: "😴", routine: "⚙️",
  };
  let result = `好，我帮你规划了今天的时间安排：\n\n`;
  plan.forEach(block => {
    result += `${typeEmoji[block.type]} ${block.startTime}–${block.endTime}　${block.label}\n`;
  });
  result += `\n总共安排了 ${tasks.length} 个核心任务。如果有突发情况随时告诉我，我来帮你调整。`;
  return result;
}
