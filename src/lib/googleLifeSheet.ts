import type { ActionRecord, MeetingRecord } from './actionCoach';

export interface SheetTask {
  id: string; title: string; domain: string; priority: string; status: string;
  created: string; due: string; completed: string; nextAction: string; project: string;
  snapshot: string; row: number;
}
export interface SheetTab { sheetId: number; title: string; gridProperties: { rowCount: number; columnCount: number } }
export interface SheetSnapshot {
  title: string; timeZone: string; tabs: SheetTab[]; tasks: SheetTask[];
  morning: string[][]; weekly: string[][];
}
export const SHEETS_READ_SCOPE = 'https://www.googleapis.com/auth/spreadsheets.readonly';
export const SHEETS_WRITE_SCOPE = 'https://www.googleapis.com/auth/spreadsheets';
const cell = (value: unknown) => value == null ? '' : String(value);
export function spreadsheetId(input: string): string {
  const trimmed = input.trim();
  const match = trimmed.match(/^https:\/\/docs\.google\.com\/spreadsheets\/d\/([\w-]+)(?:\/|$)/);
  const id = match?.[1] || (/^[\w-]{20,200}$/.test(trimmed) ? trimmed : '');
  if (!id) throw new Error('请填写 Google 表格的网址或表格 ID。');
  return id;
}
export function parseTasks(values: unknown[][]): SheetTask[] {
  if (!values.length) return [];
  const headers = values[0].map(cell);
  const required = ['ID', '事项', '状态', '下一步动作（具体到第一步）'];
  if (required.some(header => !headers.includes(header))) throw new Error('待办表的表头不匹配，需要 ID、事项、状态和下一步动作列。');
  const at = (row: unknown[], header: string) => cell(row[headers.indexOf(header)]);
  const seen = new Set<string>();
  return values.slice(1).flatMap((row, index) => {
    const id = at(row, 'ID').trim(); const title = at(row, '事项').trim();
    if (!id && !title) return [];
    if (id && !title) throw new Error('有待办缺少事项名称，请先在表格中补齐。');
    if (!id || seen.has(id)) throw new Error('待办 ID 缺失或重复，请先在表格中修正，避免改错事项。');
    seen.add(id);
    return [{ id, title, domain: at(row, '领域'), priority: at(row, '优先级'), status: at(row, '状态'),
      created: at(row, '创建日期'), due: at(row, '截止日期'), completed: at(row, '完成日期'),
      project: at(row, '所属项目/目标'), nextAction: at(row, '下一步动作（具体到第一步）'),
      snapshot: JSON.stringify(row.map(cell)), row: index + 2 }];
  });
}
export function meetingRow(record: MeetingRecord): string[] {
  const row = Array(23).fill('');
  row[0] = record.date; row[1] = record.kind === 'morning' ? '早' : '晚';
  row[2] = record.mainline; row[3] = record.domain;
  row[4] = record.top3.map((task, index) => `${index + 1}. ${task}`).join('\n');
  if (record.kind === 'morning') { row[5] = record.resources; row[13] = String(record.energy); row[15] = record.sleep; }
  else { row[6] = String(record.achieved); row[7] = record.obstacle; row[8] = record.optimize; row[13] = String(record.energy); }
  row[21] = `Life OS ${record.kind === 'morning' ? '早会' : '晚会'}；记录标识〔${record.id}〕`;
  return row;
}

export class GoogleLifeSheet {
  constructor(readonly id: string, private token: string, private request: typeof fetch = fetch) {}
  private async api(path: string, init: RequestInit = {}) {
    const response = await this.request(`https://sheets.googleapis.com/v4/spreadsheets/${this.id}${path}`, {
      ...init, headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${this.token}`, ...init.headers },
      signal: AbortSignal.timeout(20000),
    });
    if (!response.ok) {
      if (response.status === 401) throw new Error('Google 授权已过期，请重新连接。');
      if (response.status === 403) throw new Error('无法访问表格，请检查账号、共享权限，以及是否已允许写回。');
      if (response.status === 404) throw new Error('没有找到这份表格，请检查链接。');
      throw new Error(`表格请求未完成（${response.status}），请稍后重试。`);
    }
    return response.json();
  }
  async metadata() {
    return this.api('?fields=properties(title,timeZone),sheets(properties(sheetId,title,gridProperties))');
  }
  async values(range: string): Promise<string[][]> {
    const result = await this.api(`/values/${encodeURIComponent(range)}?valueRenderOption=FORMATTED_VALUE`);
    return result.values || [];
  }
  async snapshot(): Promise<SheetSnapshot> {
    const meta = await this.metadata();
    const tabs: SheetTab[] = meta.sheets.map((sheet: { properties: SheetTab }) => sheet.properties);
    const named = (name: string) => tabs.find(tab => tab.title === name);
    if (!named('待办')) throw new Error('表格中没有找到“待办”页，请确认选择了人生表格。');
    const bounded = (name: string, lastColumn: string, limit: number) => ` '${name}'!A1:${lastColumn}${Math.min(named(name)?.gridProperties.rowCount || 1, limit)}`.trim();
    if (named('待办')!.gridProperties.rowCount > 3000) throw new Error('待办表超过 3,000 行，请先归档旧记录后再连接。');
    const [tasks, morning, weekly] = await Promise.all([
      this.values(bounded('待办', 'O', 3000)),
      named('每日记录') ? this.values(bounded('每日记录', 'W', 3000)) : Promise.resolve([]),
      named('周计划') ? this.values(bounded('周计划', 'L', 500)) : Promise.resolve([]),
    ]);
    return { title: meta.properties.title, timeZone: meta.properties.timeZone, tabs, tasks: parseTasks(tasks), morning, weekly };
  }
  private async append(range: string, values: string[][]) {
    // RAW preserves user text and prevents a note beginning with '=' becoming a formula.
    return this.api(`/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
      { method: 'POST', body: JSON.stringify({ values }) });
  }
  async appendMeeting(record: MeetingRecord) {
    const meta = await this.metadata();
    const tab: SheetTab | undefined = meta.sheets.map((sheet: { properties: SheetTab }) => sheet.properties).find((t: SheetTab) => t.title === '每日记录');
    if (!tab || tab.gridProperties.columnCount < 23) throw new Error('“每日记录”页结构不匹配，请保留原表并核对列。');
    if (tab.gridProperties.rowCount > 10000) throw new Error('每日记录超过 10,000 行，请先归档后同步。');
    const markers = await this.values(`'每日记录'!V2:V${Math.max(2, tab.gridProperties.rowCount)}`);
    if (markers.some(row => cell(row[0]).includes(`〔${record.id}〕`))) return;
    const header = (await this.values("'每日记录'!A1:W1"))[0] || [];
    if (header[0] !== '日期' || header[1] !== '会议(早/晚)' || header[4] !== 'Top3' || header[21] !== '原始记录')
      throw new Error('每日记录列顺序已变化，未写入，请重新核对映射。');
    await this.append("'每日记录'!A:W", [meetingRow(record)]);
  }
  async appendAction(record: ActionRecord) {
    const title = 'LifeOS行动记录';
    const meta = await this.metadata();
    const tab: SheetTab | undefined = meta.sheets.map((s: { properties: SheetTab }) => s.properties).find((t: SheetTab) => t.title === title);
    const headers = ['记录ID', '完成时间', '来源', '待办ID', '事项', '两分钟动作', '已计时(秒)', '做到的证据', '下一步'];
    if (!tab) {
      await this.api(':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: [{ addSheet: { properties: { title, gridProperties: { rowCount: 1000, columnCount: 9, frozenRowCount: 1 } } } }] }) });
      await this.api(`/values/${encodeURIComponent(`'${title}'!A1:I1`)}?valueInputOption=RAW`, { method: 'PUT', body: JSON.stringify({ values: [headers] }) });
    } else {
      if (tab.gridProperties.rowCount > 20000) throw new Error('行动记录超过 20,000 行，请先归档后同步。');
      const actualHeaders = (await this.values(`'${title}'!A1:I1`))[0] || [];
      if (!actualHeaders.some(cell => cell)) {
        const existingData = await this.values(`'${title}'!A2:I2`);
        if (existingData.some(row => row.some(cell => cell))) throw new Error('行动记录页缺少表头但已有数据，未作改动。');
        await this.api(`/values/${encodeURIComponent(`'${title}'!A1:I1`)}?valueInputOption=RAW`, { method: 'PUT', body: JSON.stringify({ values: [headers] }) });
      } else if (JSON.stringify(actualHeaders) !== JSON.stringify(headers)) throw new Error('行动记录页表头不同，未写入，请核对表格。');
      const ids = await this.values(`'${title}'!A2:A${Math.max(2, tab.gridProperties.rowCount)}`);
      if (ids.some(row => row[0] === record.id)) return;
    }
    await this.append(`'${title}'!A:I`, [[record.id, record.completedAt, record.source.kind,
      record.source.kind === 'free' ? '' : record.source.taskId, record.task, record.step,
      String(record.seconds), record.evidence, record.nextStep]]);
  }
  async completeTask(expected: SheetTask, completedDate: string) {
    const snapshot = await this.snapshot();
    const live = snapshot.tasks.find(task => task.id === expected.id);
    if (!live || live.snapshot !== expected.snapshot) throw new Error('这条待办已在表格中改变，请刷新并核对后再标完成。');
    const headers = (await this.values("'待办'!A1:O1"))[0];
    if (headers[6] !== '状态' || headers[7] !== '完成日期') throw new Error('待办状态列已移动，未写入。');
    await this.api('/values:batchUpdate', { method: 'POST', body: JSON.stringify({ valueInputOption: 'RAW',
      data: [{ range: `'待办'!G${live.row}:H${live.row}`, values: [['完成', completedDate]] }] }) });
  }
}
