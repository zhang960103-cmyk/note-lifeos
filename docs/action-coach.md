# Life OS 行动与早晚会

新入口是 `/action`，在“今日”、待办页、桌面侧栏和手机“更多”中都可以打开；表格连接也放在设置中。沿用 Life OS 的外观、登录和 Supabase 日记，不另建软件或账号。

## 日常使用

1. **早会**：写主线与最多三个重点、方法资源、睡眠和精力。已连接表格时，带入当天早会或本周目标，不覆盖你正在编辑的字段。
2. **现在行动**：从 Life OS 或 Google 人生表格的待办选一件事。优先使用第一个未完成子任务或表格“下一步动作”，否则提供一个可编辑的小动作。计时可选 2、10、25 分钟。
3. **亲手确认**：计时到站不会自动算完成。点“我做到了”后先暂停，填写证据与下一步，保存为日记中的行动记录。推进了一小步不会自动完成整件待办。
4. **晚会**：展示当天已记录的小行动，手动确认 Top3 实际完成数、未完成主因和明天优化。微行动次数不等于 Top3 完成数。

表格待办另有“整体已经完成”操作，必须再次确认；写入前按稳定任务 ID 重新定位并核对快照，只写状态和完成日期两格。Life OS 自有待办仍在原待办页确认整件完成。

## Google 连接的一次性设置

ChatGPT 内的 Google Drive 连接不等于 Life OS 网页已经获得 Google 授权。网页使用 [Google Identity Services 的令牌模式](https://developers.google.com/identity/oauth2/web/guides/use-token-model)，不嵌入服务账号、客户端密钥或连接器凭证。

管理员需在自己的 Google Cloud 项目：

1. 启用 Google Sheets API。
2. 配置 OAuth 同意屏幕；测试状态下将本人加入测试用户。
3. 创建类型为 Web application 的 OAuth 客户端，将实际 Life OS 域名（本地开发还需 `http://localhost:8080`）加入 Authorized JavaScript origins。
4. 将公开客户端 ID 设置为部署环境变量 `VITE_GOOGLE_CLIENT_ID`，或在 Life OS 的“表格连接 → 首次连接设置”填写。**不要填写 Client Secret、密码或 API Key**。
5. 在软件中填写自己的私人表格链接，保存连接设置，点击“只读连接 Google”，由 Google 弹窗选择有访问权限的账号。

只读连接使用 `spreadsheets.readonly`。需要写回时，点击“允许写回表格”追加 `spreadsheets` 授权。Google 授权令牌只在内存中保留，刷新、过期、断开后需要重新授权。表格无需公开。

参考：[Google 网页客户端设置](https://developers.google.com/identity/oauth2/web/guides/get-google-api-clientid)、[Google Sheets 读写值](https://developers.google.com/workspace/sheets/api/guides/values)。

## 表格约定与写入范围

程序先读取元数据中的页名、尺寸和时区，再使用有限范围。支持的约定来自现有表格结构，源码不包含任何真实表格 ID、个人待办或早晚会原文。

| 页面 | 读取 | 写入 |
| --- | --- | --- |
| 待办 | A:O，最多 3,000 行；按表头定位字段 | 明确确认整体完成后，仅 G:H；ID/标题/快照变化则停止 |
| 周计划 | A:L，最多 500 行 | 无 |
| 每日记录 | A:W，最多 3,000 行用于预填 | 早/晚会追加一行；不改原记录或财务字段 |
| LifeOS行动记录 | 校验页头和记录 ID | 追加独立微行动日志；首次写回时新建此页 |

早会列：A 日期、B 早、C 主线、D 领域、E Top3、F 方法资源、N 精力、P 睡眠、V 来源标识。晚会列：A/B/C/D/E、G 达成数、H 原因、I 优化、N 精力、V 来源标识。金额、课时等字段保持空白，继续由现有流程填写；不会把未填写的金额当成 0。

所有文字通过 `valueInputOption=RAW` 写入，避免以 `=` 开头的笔记成为公式。会议与行动附带稳定记录 ID；重试先查 ID，避免一次网络超时造成普通重试重复追加。Sheets 不提供跨客户端的比较并写事务：同时在两个页面保存同一操作仍可能产生竞争，建议在一个页面完成保存；程序不会宣称严格的双向实时同步。

## 保存、恢复与隐私

- 行动和会议复用 `day_entries` / `chat_messages` 及既有 RLS，按当前 Life OS 用户保存，无需数据库迁移、管理员密钥或新表。
- 一次确认使用稳定消息 UUID；Supabase 重试只插入一次。日记保留可读摘要和隐藏的结构化记录。向首页 AI 发送近期聊天时去掉结构化标记，避免重复内容。
- 计时使用绝对到期时间；暂停不计时，超时不自动完成，后台或刷新后可恢复。更改设备时钟可能影响计时。
- 计时与待写回队列只保存在当前账号的浏览器中，不跨设备同步；已确认行动和会议可从云端日记恢复。
- Google 写回失败时，Life OS 保存成功与表格待同步会明确区分；连接正确表格并允许写入后可重试。历史记录也可以重新加入同步队列。
- 换到另一份表格不会自动把旧队列发送过去；源自表格的行动还会检查来源表格 ID。
- 本地存储不可用或损坏时保留原始内容并提示限制，不静默覆盖。刷新可能丢失尚未存入日记的临时内容。
- 本功能不包含后台自动化、跨设备计时、日历提醒或全量双向同步，也不操作 Claude 的账号或令牌。

## 验证

无需 npm 依赖的核心与适配器测试（Node 24）：

```sh
node --experimental-transform-types tests/coach-core.check.mjs
```

完整项目检查：

```sh
npm ci --ignore-scripts --no-audit --no-fund
npx tsc --noEmit -p tsconfig.app.json
npm test
npm run build
```

新增 CI 对 PR 运行核心测试、TypeScript、现有 Vitest 和生产构建。Google OAuth 的真实同意流程、个人表格写入与生产发布仍需在相应账号配置下验证；模拟测试不会调用个人表格。
