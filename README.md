# Life OS · 生命罗盘

中文说明如下；[English documentation](#english) follows.

## 中文

### 功能与数据存储

生命罗盘是一款个人生活管理前端，支持中英切换、移动端布局和 PWA 安装。

- AI 对话、日记、情绪记录、待办和重复任务。
- 日历、时间统计、目标与关键结果、生命之轮、周期复盘。
- 收支记录、预算、订阅、借还记录、健康指标和 Three.js 足迹地图。
- 设置页提供 JSON 备份导出/导入、待办 CSV 导出及财务 CSV 导入。

核心记录使用 Supabase；预算、订阅、借还记录、项目分组保存在按账号隔离的
浏览器 localStorage 中。JSON 备份包含这些本地扩展数据，但不等于完整数据库快照。
登录、访客体验均需要可用的 Supabase 项目；访客体验使用匿名认证。
AI 功能还依赖已经部署的 `life-mentor-chat` Supabase Edge Function。

### 技术栈

React 18、TypeScript、Vite 5、React Router、TanStack Query、Supabase JS、
Tailwind CSS、shadcn/ui 与 Radix、Tiptap、Recharts、Three.js。
验证工具为 Vitest、Testing Library、ESLint，浏览器辅助脚本使用 Playwright。

### 本地开发

当前云环境已验证 Node 24.19.0 和 npm 11.9.0；仓库没有独立的 Node 版本锁定文件。

```bash
git clone https://github.com/zhang960103-cmyk/note-lifeos.git
cd note-lifeos
npm ci
npm run dev
```

开发服务器默认端口为 8080。云任务中直接使用已有 checkout，不需要另建 worktree。
锁文件有部分下载地址指向 npmmirror；若该域名被网络策略阻止，使用环境设置中
已保存的安装脚本。该脚本在仓库外准备临时安装副本，将下载地址改为官方 npm 源，
保留锁定版本及 integrity 校验，不修改仓库中的锁文件。

运行前通过开发环境设置或本地未提交配置提供以下变量；这里只列名称：

| 变量名 | 用途 |
| --- | --- |
| `VITE_SUPABASE_URL` | Supabase 项目 URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | 浏览器客户端公开 publishable/anon key |

`VITE_` 变量会被编译进浏览器资源；不能放入 service-role key、AI 私钥或 R2 凭据。
当前缺少配置时会显示配置提示页。Vitest 使用测试占位配置与 mock，不访问真实后端。

```bash
npx tsc --noEmit -p tsconfig.app.json
npm test
npm run build
npm run lint
npm run preview
```

`build` 输出到 `dist`。Playwright 辅助脚本 `check-app.mjs` 和
`check-interactions.mjs` 依赖本机浏览器路径及可用后端；它们不是 `npm test` 的一部分，
且其汇总输出不能仅靠进程退出码判断成功。运行交互检查应使用测试账号。

### Vercel 部署

1. 导入 GitHub 仓库，选择 Vite；安装命令使用 `npm ci`，构建命令使用
   `npm run build`，输出目录为 `dist`。
2. 在 Vercel 项目环境变量设置中配置上面的两个变量，并选择适用的部署环境。
3. 在 Vercel 设置或独立部署配置中为 SPA 深层路由配置回退到 `index.html`，
   保留静态资源的正常访问；仓库目前未提供 `vercel.json`。
4. 在已有 Supabase 项目的认证设置中登记部署站点及必要的 OAuth/密码恢复重定向，
   使用访客模式时需启用匿名认证。这里不包含数据库 schema 或迁移操作。
5. 部署后检查首页、刷新深层路由、登录/退出和密码恢复。
   `VITE_` 变量是构建时配置，修改后需重新部署。

### JSON 与 R2 备份

本仓库没有 R2 自动备份任务或 R2 上传客户端；页面预览图的 R2 地址不是数据备份。
可以通过以下人工流程使用已有 R2 服务，无需修改应用配置：

1. 在设置页导出全部数据 JSON，确认备份包含 `schemaVersion`、核心集合和
   `localExtras`。当前备份格式版本为 2。
2. 使用 Cloudflare 控制台或独立的受信任服务端工具，将 JSON 上传到已有私有 R2
   bucket，采用不同日期/版本的对象名，避免覆盖唯一副本。凭据保留在外部工具中。
3. 下载备份，在测试账号中通过设置页导入并核对记录。
   导入会写入当前账号的 Supabase 数据，本地扩展键会映射到当前账号；已有非空
   本地扩展数据不会被覆盖，部分导入失败会显示警告。

该流程保存导出文件，不会自动备份每张数据库表，也不包含数据库结构、所有认证数据
或任何未包含在导出集合中的记录。请保留现有 R2 配置并定期验证恢复。

## English

### Features and storage

Life OS is a personal life management frontend with Chinese/English UI, mobile layouts
and PWA installation. It includes AI chat, journaling, moods, recurring tasks, calendar
and time statistics, goals/key results, life-wheel scores, reviews, financial records,
budgets, subscriptions, IOUs, health metrics and a Three.js travel map.
Settings supports JSON backup import/export, todo CSV export and finance CSV import.

Core records use Supabase. Budgets, subscriptions, IOUs and project groups live in
account-scoped browser localStorage and are included in JSON backups. A JSON export
is not a full database snapshot. Both regular login and guest mode require a working
Supabase project; guest mode uses anonymous authentication. AI features also require
an existing deployed `life-mentor-chat` Supabase Edge Function.

### Stack and setup

React 18, TypeScript, Vite 5, React Router, TanStack Query, Supabase JS, Tailwind CSS,
shadcn/ui/Radix, Tiptap, Recharts and Three.js. Tests use Vitest and Testing Library;
lint uses ESLint, and browser helper scripts use Playwright.

The cloud environment was verified with Node 24.19.0 and npm 11.9.0; the repository
does not pin Node separately. Clone the repository, enter its directory, run `npm ci`
and `npm run dev` (default port 8080). Reuse the existing checkout in cloud tasks.
Some locked download URLs use npmmirror. If network policy blocks that registry,
use the saved cloud install script: it installs from a temporary external copy using
official npm URLs while retaining versions and integrity checks and leaving the
repository lockfile unchanged.

Provide these names through your development/deployment environment configuration:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

Use only the public browser publishable/anon key. Vite embeds these values in frontend
assets; service-role keys, AI private keys and R2 credentials must stay outside them.
Missing configuration shows a setup-required screen. Unit tests use mocks and test
configuration and do not establish live backend readiness.

Run `npx tsc --noEmit -p tsconfig.app.json`, `npm test`, `npm run build` and
`npm run lint` to verify changes. `npm run preview` serves the production `dist`
output. The two `check-*.mjs` browser helpers need their configured browser path and
a backend/test account; inspect their step reports rather than only the exit status.

### Vercel deployment

Import the repository with the Vite preset, install with `npm ci`, build with
`npm run build`, and publish `dist`. Set the two frontend variables for the appropriate
deployment environments. Configure an SPA fallback to `index.html` for deep routes
without breaking static assets; the repository has no `vercel.json`.
Register the site URL and required OAuth/password-recovery redirect URLs in the
existing Supabase authentication settings; enable anonymous auth for guest mode.
No database schema changes or migrations are part of these instructions.
Check login, logout, password recovery and direct route refresh after deployment.
Changing Vite variables requires a rebuild/redeployment.

### JSON and R2 backups

There is no R2 backup job or upload client in this repository. The R2 social-preview
image is not a data backup. Export JSON from Settings, inspect its core collections,
`schemaVersion` (currently 2) and `localExtras`, then upload the file to an existing
private R2 bucket through the Cloudflare dashboard or a trusted external server tool.
Keep dated/versioned objects and external credentials; do not change the app's R2
configuration or add R2 credentials to frontend variables.

Download a saved object and test restoration through Settings using a test account.
Import writes to that account's Supabase records and remaps local extension keys;
nonempty existing local extension data is preserved and partial failures are reported.
This stores an exported file, not a complete database/schema/authentication backup.
Records absent from the export are not backed up. Verify restoration regularly.
