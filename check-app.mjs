import { chromium } from 'playwright';

const base = 'http://127.0.0.1:8080';
const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
const errors = [];
// 这个沙箱容器本身没有到 Supabase 的公网出口(egress allowlist 不含它)，所以每个页面
// 都会看到"连不上 Supabase"的预期噪音——这不是代码问题，过滤掉才能看出真实回归。
const isExpectedNetworkNoise = (t) =>
  /Failed to connect to Supabase|ERR_TUNNEL_CONNECTION_FAILED|status of 503|Failed to load resource/.test(t);
page.on('console', msg => { if (msg.type() === 'error' && !isExpectedNetworkNoise(msg.text())) errors.push(`[控制台][${page.url()}] ${msg.text()}`); });
page.on('pageerror', err => errors.push(`[运行时崩溃][${page.url()}] ${err.message}`));

await page.goto(base, { waitUntil: 'networkidle', timeout: 20000 });
try { await page.getByText('访客模式体验', { exact: false }).click({ timeout: 5000 }); await page.waitForTimeout(1500); } catch {}
try { await page.getByText('跳过介绍，直接开始', { exact: false }).click({ timeout: 5000 }); await page.waitForTimeout(1000); } catch {}

const routes = [
  '/', '/todos', '/history', '/review', '/wheel', '/wealth', '/guide', '/settings',
  '/goals', '/time-stats', '/calendar', '/projects', '/search', '/health', '/map',
  '/privacy', '/insights',
];

const results = [];
for (const r of routes) {
  const before = errors.length;
  try {
    await page.goto(base + r, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(600);
    const newErrs = errors.length - before;
    results.push({ route: r, ok: true, newErrors: newErrs });
    console.log(`${newErrs === 0 ? '✅' : '⚠️'} ${r} — ${newErrs} 个新错误`);
  } catch (e) {
    results.push({ route: r, ok: false, detail: e.message });
    console.log(`❌ ${r} — 加载失败: ${e.message}`);
  }
}

await browser.close();

console.log('\n===== 全路由检测报告 =====\n');
const okRoutes = results.filter(r => r.ok && r.newErrors === 0).length;
console.log(`路由: ${okRoutes}/${routes.length} 正常（0 新增控制台错误）`);
console.log(`累计控制台/运行时错误: ${errors.length} 个`);
errors.forEach(e => console.log('   ' + e));
