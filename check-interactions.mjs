import { chromium } from 'playwright';

const base = 'http://localhost:8080';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
const errors = [];
const steps = [];

page.on('console', msg => { if (msg.type() === 'error') errors.push(`[控制台] ${msg.text()}`); });
page.on('pageerror', err => errors.push(`[运行时崩溃] ${err.message}`));

function step(name, ok, detail = '') {
  steps.push({ name, ok, detail });
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ' — ' + detail : ''}`);
}

try {
  await page.goto(base, { waitUntil: 'networkidle', timeout: 20000 });
  step('打开首页', true);
} catch (e) { step('打开首页', false, e.message); }

try {
  await page.getByText('访客模式体验', { exact: false }).click({ timeout: 5000 });
  await page.waitForTimeout(1500);
  step('访客登录', true);
} catch (e) { step('访客登录', false, '可能已登录: ' + e.message); }

try {
  await page.getByText('跳过介绍，直接开始', { exact: false }).click({ timeout: 5000 });
  await page.waitForTimeout(1000);
  step('跳过引导页', true);
} catch { step('跳过引导页', true, '无需跳过'); }

try {
  await page.goto(base + '/todos', { waitUntil: 'networkidle', timeout: 15000 });
  step('进入待办页', true);
} catch (e) { step('进入待办页', false, e.message); }

const testText = '自动化测试待办-' + Math.random().toString(36).slice(2, 8);

try {
  await page.locator('button[class*="bottom-20"][class*="right-4"]').click({ timeout: 5000 });
  step('点击新建待办按钮', true);
} catch (e) { step('点击新建待办按钮', false, e.message); }

try {
  await page.locator('input[placeholder="输入任务内容..."]').fill(testText, { timeout: 5000 });
  step('输入待办内容', true);
} catch (e) { step('输入待办内容', false, e.message); }

try {
  await page.getByRole('button', { name: '添加', exact: true }).click({ timeout: 5000 });
  await page.waitForTimeout(1000);
  step('提交新建待办', true);
} catch (e) { step('提交新建待办', false, e.message); }

try {
  const found = await page.getByText(testText, { exact: false }).count();
  step('确认待办出现在列表', found > 0, found > 0 ? '' : '没找到刚创建的待办');
} catch (e) { step('确认待办出现在列表', false, e.message); }

// 新建的待办默认是"未开始"状态，"完成"按钮只有点了"开始"之后才会出现，
// 所以要先点"开始"把状态切到"进行中"，再去点"完成"。
try {
  await page.locator('button[title="开始"]').first().click({ timeout: 5000 });
  await page.waitForTimeout(800);
  step('点击开始按钮', true);
} catch (e) { step('点击开始按钮', false, e.message); }

try {
  await page.locator('button[title="完成"]').first().click({ timeout: 5000 });
  await page.waitForTimeout(1000);
  step('点击完成按钮', true);
} catch (e) { step('点击完成按钮', false, e.message); }

await browser.close();

console.log('\n===== 交互测试报告 =====\n');
const failed = steps.filter(s => !s.ok);
console.log(`步骤: ${steps.length - failed.length}/${steps.length} 通过`);
console.log(`过程中控制台错误: ${errors.length} 个`);
errors.forEach(e => console.log('   ' + e));
