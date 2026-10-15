import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { remainingMs, pauseAction, resumeAction, toActionRecord, validateSession,
  formatCoachMessage, parseCoachMessage, coachRecords, visibleCoachContent, backupCoachMessage, nextAction, localDay } from '../src/lib/actionCoach.ts';
import { GoogleLifeSheet, parseTasks, meetingRow, spreadsheetId } from '../src/lib/googleLifeSheet.ts';

const start = Date.parse('2026-10-15T10:00:00Z');
const session = () => ({ id: '00000000-0000-4000-8000-000000000001', task: '整理资料', step: '先打开一份文档',
  source: { kind: 'free' }, duration: 120, remainingMs: 120000, endAt: start + 120000, status: 'running', startedAt: new Date(start).toISOString() });
const meeting = () => ({ kind: 'morning', id: 'meeting-test-1', date: '2026-10-15', completedAt: new Date(start).toISOString(),
  mainline: '推进一个项目', domain: '工作', top3: ['打开文档，写一个标题'], resources: '先把材料放好', energy: 2, sleep: '6h', achieved: 0, obstacle: '', optimize: '' });
const HEADERS = ['ID','事项','领域','优先级','创建日期','截止日期','状态','完成日期','来源','所属项目/目标','下一步动作（具体到第一步）','预计时长(h)','责任方','复审日期（无截止则创建+7天）'];
const ROW = ['1','整理资料','学习','高','2026-10-01','','待办','','手动','项目 A','先打开一份文档','0.2','本人',''];
const actionHeaders = ['记录ID','完成时间','来源','待办ID','事项','两分钟动作','已计时(秒)','做到的证据','下一步'];
const dailyHeaders = ['日期','会议(早/晚)','今日主线','所属领域','Top3','方法与资源(早)','Top3达成(0-3)','未完成原因','明天怎么优化','课时(h)','收入AED','支出AED','待收AED','精力1-5','情绪1-5','睡眠(h)','固定块(英语/太极/骑马)','学习与阅读','人际与情感','问题与反思','明日待办','原始记录','手机屏幕时间(h)（目标<8）'];

function fakeSheet({ taskRows = [HEADERS, ROW], hasAction = true, blankActionHeaders = false, changed = false } = {}) {
  const calls = [], logIds = [], dailyMarkers = [];
  let actionExists = hasAction, actualActionHeaders = blankActionHeaders ? [] : actionHeaders;
  const tabs = () => ['待办','每日记录','周计划', ...(actionExists ? ['LifeOS行动记录'] : [])].map((title,index) => ({ properties: { title, sheetId: index, gridProperties: { rowCount: 100, columnCount: title === '每日记录' ? 26 : 15 } } }));
  const request = async (address, init = {}) => {
    const url = new URL(address), path = decodeURIComponent(url.pathname);
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ path, method: init.method || 'GET', body, input: url.searchParams.get('valueInputOption') });
    assert.equal(init.headers.Authorization, 'Bearer test-only-token');
    const reply = payload => Promise.resolve(new Response(JSON.stringify(payload), {status:200,headers:{'Content-Type':'application/json'}}));
    if (!path.includes('/values') && !path.endsWith(':batchUpdate')) return reply({properties:{title:'Synthetic life workbook',timeZone:'Asia/Dubai'},sheets:tabs()});
    if (path.endsWith(':batchUpdate') && !path.includes('/values')) { actionExists = true; return reply({replies:[{}]}); }
    if (path.endsWith('/values:batchUpdate')) return reply({totalUpdatedCells:2});
    if (path.includes(':append')) {
      assert.equal(url.searchParams.get('valueInputOption'), 'RAW');
      if (path.includes('LifeOS行动记录')) logIds.push([body.values[0][0]]);
      if (path.includes('每日记录')) dailyMarkers.push([body.values[0][21]]);
      return reply({updates:{updatedRows:1}});
    }
    const range = path.split('/values/')[1];
    if (init.method === 'PUT') { actualActionHeaders = body.values[0]; return reply({updatedCells:9}); }
    if (range === "'LifeOS行动记录'!A1:I1") return reply({values:actualActionHeaders.length ? [actualActionHeaders] : []});
    if (range.startsWith("'LifeOS行动记录'!A2:A")) return reply({values:logIds});
    if (range.startsWith("'LifeOS行动记录'!A2:I")) return reply({values:[]});
    if (range === "'每日记录'!A1:W1") return reply({values:[dailyHeaders]});
    if (range.startsWith("'每日记录'!V2:V")) return reply({values:dailyMarkers});
    if (range.startsWith("'待办'!")) {
      const rows = changed ? taskRows.map((row,index) => index ? row.map((value,col) => col === 6 ? '进行中' : value) : row) : taskRows;
      return reply({values:range === "'待办'!A1:O1" ? [HEADERS] : rows});
    }
    return reply({values:[]});
  };
  return { client: new GoogleLifeSheet('synthetic-spreadsheet-identifier', 'test-only-token', request), calls, logIds, dailyMarkers };
}

test('absolute timer restores after reload and never creates completion by itself', () => {
  const restored = validateSession(JSON.parse(JSON.stringify(session())));
  assert.equal(remainingMs(restored, start+30000), 90000);
  assert.equal(remainingMs(restored, start+86400000), 0);
  assert.equal(remainingMs(restored, start-10000), 120000);
});
test('pause excludes reflection and other paused time; resume preserves remainder', () => {
  const paused = pauseAction(session(),start+30000);
  assert.equal(remainingMs(paused,start+999999),90000);
  const resumed = resumeAction(paused,start+60000);
  assert.equal(remainingMs(resumed,start+90000),60000);
  assert.equal(toActionRecord(paused,'写了标题','展开一段',start+999999).seconds,30);
});
test('late confirmation counts at most selected duration; zero-second confirmations are explicit', () => {
  assert.equal(toActionRecord(session(),'','',start+999999).seconds,120);
  assert.equal(toActionRecord(session(),'','',start).seconds,0);
});
test('malformed timer state is rejected without silently trusting source references', () => {
  for (const changed of [{status:'invalid'},{remainingMs:-1},{endAt:null},{duration:0},{source:{kind:'sheet'}}])
    assert.throws(() => validateSession({...session(),...changed}));
});
test('journal preserves Unicode evidence and stable event IDs without displaying metadata', () => {
  const record = toActionRecord(session(),'我写了第一行🙂 <script>bad</script>','明天继续',start+45000);
  const message = formatCoachMessage(record);
  assert.deepEqual(parseCoachMessage({content:message}),record);
  assert.match(visibleCoachContent(message),/我写了第一行🙂/);
  assert.doesNotMatch(visibleCoachContent(message),/lifeos-coach-v1/);
  assert.equal(coachRecords([{content:message},{content:message}]).length,1);
  assert.equal(parseCoachMessage({content:'普通日记'}),null);
  assert.equal(parseCoachMessage({content:'<!--lifeos-coach-v1:invalid==-->'}),null);
});
test('morning and evening meetings round-trip with exactly three priorities at most', () => {
  for (const kind of ['morning','evening']) {
    const record = {...meeting(),kind};
    assert.deepEqual(parseCoachMessage({content:formatCoachMessage(record)}),record);
  }
  assert.equal(parseCoachMessage({content:formatCoachMessage({...meeting(),top3:['a','b','c','d']})}),null);
});
test('readable cloud messages retain their structured action through an existing JSON backup', () => {
  const record = toActionRecord(session(),'留下了证据','继续',start+1000);
  const loaded = {role:'user',content:visibleCoachContent(formatCoachMessage(record)),timestamp:record.completedAt,coachRecord:record};
  const restored = JSON.parse(JSON.stringify(backupCoachMessage(loaded)));
  assert.deepEqual(parseCoachMessage(restored),record);
  assert.equal(restored.timestamp,loaded.timestamp);
});
test('action suggestions prefer existing subtasks, keeping original task status untouched', () => {
  const todo = {text:'写报告',status:'todo',subTasks:[{text:'第一项已做',done:true},{text:'核对一个数字',done:false}]};
  assert.equal(nextAction(todo),'核对一个数字');
  assert.equal(todo.status,'todo');
  assert.match(nextAction({text:'核对课时',subTasks:[]}),/一条/);
});
test('dates follow spreadsheet timezone, including midnight in Dubai', () => {
  assert.equal(localDay(new Date('2026-10-15T21:00:00Z'),'Asia/Dubai'),'2026-10-16');
  assert.equal(localDay(new Date('2026-10-15T21:00:00Z'),'UTC'),'2026-10-15');
});
test('spreadsheet links are validated without making private sheets public', () => {
  assert.equal(spreadsheetId('https://docs.google.com/spreadsheets/d/abc123-identifier-example/edit#gid=0'),'abc123-identifier-example');
  assert.throws(() => spreadsheetId('https://untrusted.example/spreadsheets/d/abc'));
});
test('task import uses actual headers and stable IDs; missing or duplicate IDs reject mapping', () => {
  const parsed = parseTasks([HEADERS,ROW]);
  assert.equal(parsed[0].id,'1'); assert.equal(parsed[0].nextAction,'先打开一份文档');
  assert.throws(() => parseTasks([HEADERS,ROW,ROW]));
  assert.throws(() => parseTasks([['事项'],['任务']]));
  assert.throws(() => parseTasks([HEADERS,['','任务']]));
});
test('meeting mapping preserves unused finance columns and targets observed early/evening fields', () => {
  const early = meetingRow(meeting());
  assert.equal(early[1],'早');assert.equal(early[13],'2');assert.equal(early[15],'6h');
  assert.deepEqual(early.slice(9,13),['','','','']);
  const late = meetingRow({...meeting(),kind:'evening',achieved:2,obstacle:'精力不足',optimize:'缩小第一步'});
  assert.equal(late[6],'2');assert.equal(late[7],'精力不足');assert.equal(late[8],'缩小第一步');
});
test('live reads ground exact sheet titles and bounded ranges from metadata', async () => {
  const {client,calls} = fakeSheet();
  const snapshot = await client.snapshot();
  assert.equal(snapshot.timeZone,'Asia/Dubai');assert.equal(snapshot.tasks.length,1);
  assert.match(calls[0].path,/synthetic-spreadsheet-identifier$/);
  assert.ok(calls.some(call => call.path.endsWith("'待办'!A1:O100")));
  assert.ok(calls.every(call => !call.path.includes('Sheet1')));
});
test('meeting appends are RAW, limited to one record and idempotent on retry', async () => {
  const {client,calls} = fakeSheet();
  const record = {...meeting(),mainline:'=IMPORTXML("untrusted")'};
  await client.appendMeeting(record);await client.appendMeeting(record);
  const writes = calls.filter(call => call.path.endsWith(':append'));
  assert.equal(writes.length,1);assert.equal(writes[0].body.values[0][2],record.mainline);
  assert.equal(writes[0].input,'RAW');
});
test('actions create their own audit tab and retry does not append the same ID twice', async () => {
  const {client,calls} = fakeSheet({hasAction:false});
  const record = toActionRecord(session(),'第一步好了','下一步',start+120000);
  await client.appendAction(record);await client.appendAction(record);
  assert.equal(calls.filter(call => call.path.endsWith(':append')).length,1);
  assert.equal(calls.filter(call => call.body?.requests?.[0]?.addSheet).length,1);
});
test('an interrupted empty audit-tab initialization can resume without overwriting data', async () => {
  const {client,calls} = fakeSheet({blankActionHeaders:true});
  await client.appendAction(toActionRecord(session(),'','',start+120000));
  assert.ok(calls.some(call => call.method === 'PUT' && call.body.values[0][0] === '记录ID'));
});
test('task completion follows stable ID after row insertion and writes only G:H', async () => {
  const expected = parseTasks([HEADERS,ROW])[0];
  const {client,calls} = fakeSheet({taskRows:[HEADERS,['2','另外的任务','','','','','待办'],ROW]});
  await client.completeTask(expected,'2026-10-15');
  const write = calls.find(call => call.path.endsWith('/values:batchUpdate'));
  assert.deepEqual(write.body.data,[{range:"'待办'!G3:H3",values:[['完成','2026-10-15']]}]);
});
test('changed remote task prevents a stale completion write', async () => {
  const {client,calls} = fakeSheet({changed:true});
  await assert.rejects(client.completeTask(parseTasks([HEADERS,ROW])[0],'2026-10-15'),/已在表格中改变/);
  assert.ok(!calls.some(call => call.method === 'POST'));
});
test('authorization and permission failures are actionable and do not expose tokens', async () => {
  for (const status of [401,403,404,429]) {
    const client = new GoogleLifeSheet('synthetic-id','test-only-token',async () => new Response('{}',{status}));
    await assert.rejects(client.snapshot(),error => !error.message.includes('test-only-token') && /授权|权限|表格|请求/.test(error.message));
  }
});
test('integration keeps credentials out of local storage and task completion explicit', () => {
  const hook = readFileSync(new URL('../src/hooks/useGoogleLifeSheet.ts',import.meta.url),'utf8');
  assert.doesNotMatch(hook,/localStorage\.setItem\([^;]*(?:access_token|current\.token)/s);
  const page = readFileSync(new URL('../src/pages/ActionPage.tsx',import.meta.url),'utf8');
  assert.match(page,/不自动划掉整件待办/);
  assert.match(page,/window\.confirm\(`确认整件待办/);
  assert.match(page,/key=\{user.id\}/);
});
