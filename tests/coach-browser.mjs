/* global localStorage, window, document, innerWidth */
import { chromium, expect } from '@playwright/test';
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import assert from 'node:assert/strict';

const origin = 'http://127.0.0.1:4173';
const artifacts = 'artifacts/coach-browser';
const uid = '00000000-0000-4000-8000-000000000099';
const taskId = '00000000-0000-4000-8000-000000000088';
const entryId = '00000000-0000-4000-8000-000000000077';
const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Dubai' }).format(new Date());
const checks = [];
let serverOutput = '';
const server = spawn('npm', ['run', 'dev', '--', '--host', '127.0.0.1', '--port', '4173'], {
  env: { ...process.env, VITE_SUPABASE_URL: 'https://test-project.supabase.co', VITE_SUPABASE_PUBLISHABLE_KEY: 'test-browser-only-placeholder' },
  stdio: ['ignore', 'pipe', 'pipe'],
  detached: true,
});
server.stdout.on('data', data => { serverOutput += data; });
server.stderr.on('data', data => { serverOutput += data; });
let browser;
function pass(label) { checks.push(label); process.stdout.write(`PASS ${label}\n`); }
try {
  await mkdir(artifacts, { recursive: true });
  let ready = false;
  for (let attempt = 0; attempt < 100; attempt++) {
    try { ready = (await fetch(origin)).ok; } catch { /* Vite is starting. */ }
    if (ready) break;
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  assert.ok(ready, serverOutput);
  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, locale: 'zh-CN', timezoneId: 'Asia/Dubai', reducedMotion: 'reduce', serviceWorkers: 'block' });
  const user = { id: uid, email: 'browser-test@example.invalid', aud: 'authenticated', role: 'authenticated', app_metadata: {provider:'email'}, user_metadata: {}, created_at: new Date().toISOString() };
  const enc = value => Buffer.from(JSON.stringify(value)).toString('base64url');
  const accessToken = `${enc({alg:'HS256',typ:'JWT'})}.${enc({sub:uid,aud:'authenticated',exp:Math.floor(Date.now()/1000)+86400,iss:'https://test-project.supabase.co/auth/v1'})}.${Buffer.from('browser-mock').toString('base64url')}`;
  await context.addInitScript(({ user, uid, accessToken }) => {
    localStorage.setItem('sb-test-project-auth-token', JSON.stringify({access_token:accessToken,refresh_token:'test-refresh',expires_in:86400,expires_at:Math.floor(Date.now()/1000)+86400,token_type:'bearer',user}));
    localStorage.setItem(`onboarded_${uid}`, '1');
  }, {user,uid,accessToken});
  const messages = [];
  let failOnceAfterWrite = false;
  let taskWrites = 0;
  await context.route('https://test-project.supabase.co/**', async route => {
    const request = route.request(), url = new URL(request.url()), method = request.method();
    const object = (request.headers().accept || '').includes('vnd.pgrst.object');
    const respond = data => route.fulfill({status:200,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)});
    if (url.pathname.startsWith('/auth/')) return respond(user);
    const table = url.pathname.split('/').pop();
    if (method === 'OPTIONS') return route.fulfill({status:204,headers:{'access-control-allow-origin':origin,'access-control-allow-headers':request.headers()['access-control-request-headers'] || '*','access-control-allow-methods':'*'}});
    if (table === 'profiles') return respond(object ? {id:uid,onboarded:true,currency:'AED',display_name:'测试用户'} : [{id:uid,onboarded:true}]);
    const entry = {id:entryId,user_id:uid,date:today,emotion_tags:[],topic_tags:[],emotion_score:5,updated_at:new Date().toISOString()};
    if (table === 'day_entries') return respond(object ? entry : [entry]);
    if (table === 'chat_messages') {
      if (method === 'POST') {
        const body = request.postDataJSON(); const rows = Array.isArray(body) ? body : [body];
        for (const row of rows) if (!messages.some(message => message.id === row.id)) messages.push(row);
        if (failOnceAfterWrite) { failOnceAfterWrite = false; return route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({message:'synthetic uncertain response'})}); }
        return respond([]);
      }
      return respond(messages);
    }
    if (table === 'todos') {
      if (method !== 'GET') taskWrites++;
      return respond([{id:taskId,entry_id:entryId,user_id:uid,text:'完成本周方案',status:'todo',priority:'high',tags:['工作'],sub_tasks:JSON.stringify([{id:'step-one',text:'写一个标题',done:false}]),recur:'none',source_date:today,created_at:new Date().toISOString(),updated_at:new Date().toISOString()}]);
    }
    return respond([]);
  });
  const page = await context.newPage();
  page.setDefaultTimeout(15000);
  page.setDefaultNavigationTimeout(20000);
  const pageErrors = [];
  page.on('pageerror', error => pageErrors.push(String(error)));
  await page.goto(`${origin}/todos`);
  await page.getByRole('button',{name:'从两分钟开始：完成本周方案'}).click();
  await expect(page.getByRole('heading', {name:'先动一下 · 早晚会'})).toBeVisible();
  await page.getByLabel('从哪里开始？').selectOption(`lifeos:${taskId}`);
  await expect(page.getByLabel('第一步，小到现在能做')).toHaveValue('写一个标题');
  await page.getByLabel('第一步，小到现在能做').fill('只写一个草稿标题');
  await page.reload();
  await expect(page.getByLabel('从哪里开始？')).toHaveValue(`lifeos:${taskId}`);
  await expect(page.getByLabel('第一步，小到现在能做')).toHaveValue('只写一个草稿标题');
  pass('existing Life OS auth, task loading and concrete first step');

  await page.getByRole('button',{name:'就从这一步开始'}).click();
  const sessionKey = `lifeos-coach-session-${uid}`;
  await expect.poll(() => page.evaluate(key => JSON.parse(localStorage.getItem(key))?.id,sessionKey)).toBeTruthy();
  const sessionId = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).id,sessionKey);
  await page.reload();
  await expect(page.getByRole('timer')).toBeVisible();
  assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).id,sessionKey),sessionId);
  await page.getByRole('button',{name:'暂停',exact:true}).click();
  const paused = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).remainingMs,sessionKey);
  await page.reload();
  await expect(page.getByRole('button',{name:'继续',exact:true})).toBeVisible();
  assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key)).remainingMs,sessionKey),paused);
  pass('refresh preserves session identity and paused remainder');

  await page.getByRole('button',{name:/我做到了/}).click();
  await page.getByLabel('做到的证据（可选）').fill('<img src=x onerror="window.__unsafe=1"> 写好了一个标题');
  await page.getByLabel('留给下一次的提示（可选）').fill('展开第二个要点');
  await page.getByRole('button',{name:'记下这一步，不自动划掉整件待办'}).click();
  await expect(page.getByRole('heading',{name:'最近留下的行动证据'})).toBeVisible();
  await expect.poll(() => messages.length).toBe(1);
  await expect(page.getByText('<img src=x onerror="window.__unsafe=1"> 写好了一个标题',{exact:true})).toBeVisible();
  assert.equal(await page.evaluate(() => window.__unsafe),undefined);
  assert.equal(taskWrites,0);
  pass('manual completion saves evidence as text and does not complete the entire task');

  await page.getByRole('button',{name:'就从这一步开始'}).click();
  await page.getByRole('button',{name:/我做到了/}).click();
  await page.getByLabel('做到的证据（可选）').fill('保存重试测试');
  failOnceAfterWrite = true;
  await page.getByRole('button',{name:'记下这一步，不自动划掉整件待办'}).click();
  await expect(page.getByRole('button',{name:'重试保存这一步'})).toBeVisible();
  const pendingId = await page.evaluate(key => JSON.parse(localStorage.getItem(key)).pendingRecord.id,sessionKey);
  await page.reload();
  await expect(page.getByRole('button',{name:'重试保存这一步'})).toBeVisible();
  await page.getByRole('button',{name:'重试保存这一步'}).click();
  await expect.poll(() => messages.filter(message => message.id === pendingId).length).toBe(1);
  await expect(page.getByRole('button',{name:'就从这一步开始'})).toBeVisible();
  pass('uncertain save survives reload and retries the same journal UUID exactly once');

  await page.getByRole('tab',{name:'早会',exact:true}).click();
  await page.getByLabel('今日主线',{exact:true}).fill('把方案推进一点');
  await page.getByLabel('所属领域（可选）').fill('工作');
  await page.getByLabel('Top3，每行一件，写上第一步与时段').fill('先写一个标题\n打开一份资料');
  await page.getByLabel('需要什么资源，可能卡在哪？').fill('只开一个页面');
  await page.getByLabel('今天精力 1–5').selectOption('2');
  await page.getByRole('button',{name:'保存早会，然后动一下 ↗'}).click();
  await expect(page.getByLabel('第一步，小到现在能做')).toHaveValue('先写一个标题');
  await expect.poll(() => messages.length).toBe(3);
  await page.getByRole('tab',{name:'晚会',exact:true}).click();
  await page.getByLabel('Top3 实际完成几件？').selectOption('1');
  await page.getByLabel('没完成的主因（都完成可写“已完成”）').fill('任务太大');
  await page.getByLabel('明天怎样更容易开始？').fill('先核对一条');
  await page.getByRole('button',{name:'保存晚会，让明天好开始一点'}).click();
  await expect.poll(() => messages.length).toBe(4);
  pass('morning hands its first priority into action and evening records actual progress');

  await page.goto(origin);
  await expect(page.getByText(/lifeos-coach-v1:/)).toHaveCount(0);
  await expect(page.getByText(/把方案推进一点/).first()).toBeVisible();
  pass('original journal view displays readable notes without structured metadata');

  for (const width of [320,390,768,1280]) {
    await page.setViewportSize({width,height:900});
    await page.goto(`${origin}/action`);
    await expect(page.getByRole('heading',{name:'先动一下 · 早晚会'})).toBeVisible();
    for (const label of ['现在行动','早会','晚会','表格连接']) {
      await page.getByRole('tab',{name:label,exact:true}).click();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),`${width} / ${label}`);
    }
    if (width === 390 || width === 1280) {
      await page.getByRole('tab',{name:'现在行动',exact:true}).click();
      await page.screenshot({path:`${artifacts}/${width === 390 ? 'mobile' : 'desktop'}.png`,fullPage:true});
    }
  }
  pass('all four panels fit mobile, tablet and desktop widths');
  await page.getByRole('tab',{name:'表格连接',exact:true}).click();
  await expect(page.getByRole('button',{name:'只读连接 Google'})).toBeDisabled();
  assert.equal(taskWrites,0);
  assert.deepEqual(pageErrors,[]);
  pass('unconfigured Google connection stays explicit and no uncaught page errors');
  await writeFile(`${artifacts}/results.json`,JSON.stringify({checks,passed:checks.length,errors:pageErrors},null,2));
  await context.close();
} catch (error) {
  await writeFile(`${artifacts}/failure.txt`,`${error.stack || error}\n\n${serverOutput}`);
  throw error;
} finally {
  await browser?.close();
  try { process.kill(-server.pid, 'SIGTERM'); } catch { server.kill('SIGTERM'); }
  server.stdout.destroy();
  server.stderr.destroy();
}
