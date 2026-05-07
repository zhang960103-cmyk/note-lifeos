/**
 * 本地时间块快速提取器
 * 毫秒级响应，无需 AI 调用
 * 支持中文口语时间表达
 */

export interface LocalTimeBlock {
  startTime: string;  // HH:mm
  endTime: string;    // HH:mm
  label: string;
  durationMin: number;
}

// 中文数字转阿拉伯数字
const CN_NUM: Record<string, number> = {
  "零": 0, "一": 1, "二": 2, "两": 2, "三": 3, "四": 4,
  "五": 5, "六": 6, "七": 7, "八": 8, "九": 9, "十": 10,
  "十一": 11, "十二": 12,
};

function parseCN(s: string): number {
  return CN_NUM[s] ?? parseInt(s) ?? 0;
}

function padTime(h: number, m = 0): string {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

// 上午/下午/晚上 → 24小时
function resolveHour(h: number, period?: string): number {
  if (!period) return h;
  if (period === "下午" || period === "傍晚") return h < 12 ? h + 12 : h;
  if (period === "晚上" || period === "夜里") return h < 12 ? h + 12 : h;
  if (period === "上午" || period === "早上" || period === "早") return h;
  return h;
}

const PERIOD = "(?:(上午|下午|早上|早|晚上|傍晚|夜里)\\s*)?";
const HOUR = "([零一二两三四五六七八九十十一十二]|\\d{1,2})";
const MIN = "(?:[点:：]([零一二三四五六七八九]?[零一二三四五六七八九十]?|\\d{1,2})(?:分)?)?";
const DURATION_CN = "([零一二三四五六七八九十百]|\\d+)\\s*(小时|分钟|分)";

export function extractTimeBlocks(text: string): LocalTimeBlock[] {
  const blocks: LocalTimeBlock[] = [];

  // 模式1: HH:mm-HH:mm 或 HH:mm到HH:mm（已有⏱格式）
  const explicit = text.matchAll(/(\d{1,2}):(\d{2})\s*[-到至~]\s*(\d{1,2}):(\d{2})/g);
  for (const m of explicit) {
    const start = parseTimeToMinutes(`${m[1]}:${m[2]}`);
    const end = parseTimeToMinutes(`${m[3]}:${m[4]}`);
    blocks.push({
      startTime: padTime(parseInt(m[1]), parseInt(m[2])),
      endTime: padTime(parseInt(m[3]), parseInt(m[4])),
      label: extractLabel(text, m.index ?? 0),
      durationMin: end - start,
    });
  }

  if (blocks.length > 0) return blocks;

  // 模式2: (上午|下午)X点(Y分) 开始，持续Z小时/分钟
  const withDuration = new RegExp(
    `${PERIOD}${HOUR}\\s*点${MIN}\\s*(?:开始|起)?[，,。\\s].*?(?:持续|用了|花了|耗了)\\s*${DURATION_CN}`, "g"
  );
  for (const m of text.matchAll(withDuration)) {
    const h = resolveHour(parseCN(m[2]), m[1]);
    const min = m[3] ? parseCN(m[3]) : 0;
    const durNum = parseCN(m[4]);
    const durUnit = m[5];
    const durMin = durUnit === "小时" ? durNum * 60 : durNum;
    const startMin = h * 60 + min;
    blocks.push({
      startTime: padTime(h, min),
      endTime: padTime(Math.floor((startMin + durMin) / 60), (startMin + durMin) % 60),
      label: extractLabel(text, m.index ?? 0),
      durationMin: durMin,
    });
  }

  if (blocks.length > 0) return blocks;

  // 模式3: X点到Y点
  const rangePattern = new RegExp(
    `${PERIOD}${HOUR}\\s*点${MIN}\\s*[-到至~]\\s*${PERIOD}${HOUR}\\s*点${MIN}`, "g"
  );
  for (const m of text.matchAll(rangePattern)) {
    const startH = resolveHour(parseCN(m[2]), m[1]);
    const startMin = m[3] ? parseCN(m[3]) : 0;
    const endH = resolveHour(parseCN(m[5]), m[4]);
    const endMin = m[6] ? parseCN(m[6]) : 0;
    blocks.push({
      startTime: padTime(startH, startMin),
      endTime: padTime(endH, endMin),
      label: extractLabel(text, m.index ?? 0),
      durationMin: (endH * 60 + endMin) - (startH * 60 + startMin),
    });
  }

  return blocks;
}

function parseTimeToMinutes(t: string): number {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + (m || 0);
}

function extractLabel(text: string, pos: number): string {
  // 取时间表达式前后最近的动词短语作为标签
  const before = text.slice(Math.max(0, pos - 20), pos).trim();
  const after = text.slice(pos, pos + 30).trim();
  const labelMatch = (before + after).match(/[开会议|健身|学习|工作|休息|吃饭|通话|培训|面试|报告|写作|复习|读书]/);
  return labelMatch ? labelMatch[0] : before.slice(-8) || "时间块";
}

// 判断一段文字是否包含时间信息（用于快速跳过）
export function hasTimeHints(text: string): boolean {
  return /\d{1,2}[点:：时]\d{0,2}|上午|下午|晚上|早上|持续|小时|分钟/.test(text);
}
