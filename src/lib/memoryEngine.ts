import type { DayEntry } from "@/types/lifeOs";

export function buildMemoryContext(entries: DayEntry[], maxDays = 14): string {
  const recent = entries.slice(0, maxDays);
  if (recent.length === 0) return '';

  const lines = recent.map(entry => {
    const userMsgs = entry.messages
      .filter(m => m.role === 'user')
      .map(m => m.content.slice(0, 80))
      .join('；');
    if (!userMsgs) return null;
    return `[${entry.date}] ${userMsgs}`;
  }).filter(Boolean);

  return lines.join('\n');
}

export function getKeyPatterns(entries: DayEntry[]): string {
  const tagCounts: Record<string, number> = {};
  entries.forEach(e => {
    e.emotionTags.forEach(t => { tagCounts[t] = (tagCounts[t] || 0) + 1; });
  });
  const frequent = Object.entries(tagCounts)
    .filter(([, c]) => c >= 2)
    .map(([t, c]) => `${t}(${c}次)`)
    .join('、');
  return frequent ? `用户近期高频情绪：${frequent}` : '';
}
