import type { ChatMessage, TodoItem } from '@/types/lifeOs';

export type ActionSource = { kind: 'lifeos'; taskId: string } | { kind: 'sheet'; taskId: string; spreadsheetId: string } | { kind: 'free' };
export interface ActionSession {
  id: string; task: string; step: string; source: ActionSource;
  duration: number; remainingMs: number; endAt: number | null;
  status: 'running' | 'paused'; startedAt: string;
}
export interface ActionRecord {
  kind: 'action'; id: string; task: string; step: string; source: ActionSource;
  seconds: number; evidence: string; nextStep: string; completedAt: string;
}
export interface MeetingRecord {
  kind: 'morning' | 'evening'; id: string; date: string; completedAt: string;
  mainline: string; domain: string; top3: string[]; resources: string;
  energy: number; sleep: string; achieved: number; obstacle: string; optimize: string;
}
export type CoachRecord = ActionRecord | MeetingRecord;
export const ACTION_PREFIX = '↗ 行动进展';
const MARKER = 'lifeos-coach-v1:';
function validSource(value: ActionSource): boolean {
  return !!value && (value.kind === 'free' || (['lifeos', 'sheet'].includes(value.kind)
    && typeof value.taskId === 'string' && !!value.taskId
    && (value.kind !== 'sheet' || (typeof value.spreadsheetId === 'string' && !!value.spreadsheetId))));
}

export function localDay(value: Date | number = new Date(), timeZone?: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', ...(timeZone ? { timeZone } : {}) }).formatToParts(value);
  const get = (key: string) => parts.find(part => part.type === key)!.value;
  return `${get('year')}-${get('month')}-${get('day')}`;
}
export function nextAction(todo?: Pick<TodoItem, 'text' | 'subTasks'>): string {
  const explicit = todo?.subTasks.find(task => !task.done && task.text.trim());
  if (explicit) return explicit.text;
  const title = todo?.text || '';
  if (/报告|方案|文案|论文|写/.test(title)) return '打开文档，只写一个暂定标题';
  if (/课时|费用|核对|对账|统计/.test(title)) return '打开原始记录，先核对一条';
  if (/备课|教学|课件/.test(title)) return '打开课件，写下这节课的一个重点';
  if (/整理|打扫|收拾/.test(title)) return '先把眼前的三件物品放回原位';
  if (/运动|走路|骑|太极/.test(title)) return '准备好要用的东西，轻松活动两分钟';
  if (/阅读|读书/.test(title)) return '翻到上次停下的地方，读一段';
  return '打开需要的材料，写下一个具体的第一步';
}
export function remainingMs(session: ActionSession, now = Date.now()): number {
  return session.status === 'running' ? Math.max(0, Math.min(session.duration * 1000, (session.endAt || now) - now)) : session.remainingMs;
}
export function pauseAction(session: ActionSession, now = Date.now()): ActionSession {
  return { ...session, remainingMs: remainingMs(session, now), status: 'paused', endAt: null };
}
export function resumeAction(session: ActionSession, now = Date.now()): ActionSession {
  return { ...session, status: 'running', endAt: now + session.remainingMs };
}
export function validateSession(value: unknown): ActionSession {
  const s = value as ActionSession;
  if (!s || typeof s.id !== 'string' || typeof s.step !== 'string' || !s.step.trim()
    || typeof s.task !== 'string' || !['running', 'paused'].includes(s.status)
    || ![120, 600, 1500].includes(s.duration) || !Number.isFinite(s.remainingMs)
    || s.remainingMs < 0 || s.remainingMs > s.duration * 1000
    || (s.status === 'running' && !Number.isFinite(s.endAt))
    || !validSource(s.source)) throw new Error('计时数据无法读取，请保留原始数据。');
  const pending = (s as ActionSession & { pendingRecord?: ActionRecord }).pendingRecord;
  if (pending) {
    try {
      if (pending.id !== s.id || pending.kind !== 'action' || !parseCoachMessage({ content: formatCoachMessage(pending) })) throw new Error();
    } catch { throw new Error('未确认的行动记录无法读取，请保留原始数据。'); }
  }
  return s;
}
export function toActionRecord(session: ActionSession, evidence: string, nextStep: string, now = Date.now()): ActionRecord {
  return { kind: 'action', id: session.id, task: session.task, step: session.step, source: session.source,
    seconds: Math.floor((session.duration * 1000 - remainingMs(session, now)) / 1000),
    evidence: evidence.trim().slice(0, 1000), nextStep: nextStep.trim().slice(0, 300), completedAt: new Date(now).toISOString() };
}
function encode(value: unknown): string {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  return btoa(Array.from(bytes, byte => String.fromCharCode(byte)).join(''));
}
function literal(value: string): string { return value.replace(/[\\`*_{}[\]<>#|]/g, char => `\\${char}`); }
export function formatCoachMessage(record: CoachRecord): string {
  const lines = record.kind === 'action'
    ? [ACTION_PREFIX, `事项：${record.task}`, `这一小步：${record.step}`, `做到：${record.evidence || '已亲手确认完成这一小步'}`,
      `计时：${Math.floor(record.seconds / 60)} 分 ${record.seconds % 60} 秒`, ...(record.nextStep ? [`下次：${record.nextStep}`] : [])]
    : [record.kind === 'morning' ? '☀️ 早会 · 今日行动' : '🌙 晚会 · 今日复盘', `主线：${record.mainline}`,
      `领域：${record.domain || '未指定'}`, ...record.top3.map((task, index) => `${index + 1}. ${task}`),
      ...(record.kind === 'morning' ? [`方法与资源：${record.resources || '先做眼前第一步'}`, `精力：${record.energy}/5；睡眠：${record.sleep || '未填写'}`]
        : [`Top3 达成：${record.achieved}/3`, `未完成主因：${record.obstacle}`, `明天优化：${record.optimize || '把第一步再缩小一点'}`])];
  return lines.map(literal).join('  \n') + `\n\n<!--${MARKER}${encode(record)}-->`;
}
export function parseCoachMessage(message: Pick<ChatMessage, 'content'>): CoachRecord | null {
  const match = message.content.match(/<!--lifeos-coach-v1:([A-Za-z0-9+/=]+)-->/);
  if (!match || match[1].length > 30000) return null;
  try {
    const decoded = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(match[1]), c => c.charCodeAt(0))));
    if (!decoded || typeof decoded.id !== 'string' || !Number.isFinite(Date.parse(decoded.completedAt))) return null;
    if (decoded.kind === 'action' && typeof decoded.step === 'string' && typeof decoded.task === 'string'
      && typeof decoded.evidence === 'string' && typeof decoded.nextStep === 'string'
      && validSource(decoded.source)
      && Number.isFinite(decoded.seconds) && decoded.seconds >= 0 && decoded.seconds <= 1500) return decoded;
    if (['morning', 'evening'].includes(decoded.kind) && typeof decoded.mainline === 'string'
      && Array.isArray(decoded.top3) && decoded.top3.length <= 3 && decoded.top3.every((value: unknown) => typeof value === 'string')
      && typeof decoded.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(decoded.date)
      && Number.isInteger(decoded.energy) && decoded.energy >= 1 && decoded.energy <= 5
      && Number.isInteger(decoded.achieved) && decoded.achieved >= 0 && decoded.achieved <= 3
      && ['domain', 'resources', 'sleep', 'obstacle', 'optimize'].every(key => typeof decoded[key] === 'string')) return decoded;
  } catch { /* Unrecognized content remains an ordinary journal message. */ }
  return null;
}
export function visibleCoachContent(content: string): string {
  return content.replace(/\s*<!--lifeos-coach-v1:[A-Za-z0-9+/=]+-->/g, '').trimEnd();
}
export function coachRecords(messages: ChatMessage[]): CoachRecord[] {
  const unique = new Map<string, CoachRecord>();
  for (const message of messages) { const record = parseCoachMessage(message); if (record) unique.set(record.id, record); }
  return [...unique.values()].sort((a, b) => b.completedAt.localeCompare(a.completedAt));
}
