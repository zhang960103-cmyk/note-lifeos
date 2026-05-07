import SectionHeader from "../SectionHeader";
import Alert from "../Alert";

const issues = [
  ["Telegram Webhook URL格式不一致", "致命", "消息无法触发工作流", "OpenClaw原生grammY库，无此问题"],
  ["Telegram只允许一个webhook，测试/生产互斥", "致命", "切换环境导致失效", "OpenClaw本地运行，无webhook冲突"],
  ["Railway重新部署后encryptionKey变化", "致命", "所有凭证解密失败，系统瘫痪", "配置存本地~/.openclaw/，不依赖Railway加密"],
  ["WEBHOOK_URL环境变量不匹配", "致命", '404/403，看起来"系统坏了"', "OpenClaw无此配置项"],
  ["DeepSeek Authorization格式错误", "致命", "AI调用失败", "重写为标准HTTP Request格式"],
  ["工作流C月度报告节点未连接", "致命", "触发后无动作", "OpenClaw Cron直接调用Skill，无此问题"],
  ["Whisper URL写死host.docker.internal", "重要", "Linux服务器迁移会失败", "环境变量化，支持任意主机名"],
  ["环境变量存提示词接近4KB上限", "半年", "加内容就截断", "提示词存本地文件，无限制"],
  ["ngrok免费版URL每次重启变化", "持续", "需手动更新Railway变量", "Cloudflare Tunnel固定域名，永不变"],
];

const WhyUpgrade = () => (
  <div className="mt-14" id="why">
    <SectionHeader num="①" title="为何从n8n升级到OpenClaw（Flowith审查结论）" color="red" />

    <Alert variant="red" icon="🔴" title="Flowith审查发现：n8n方案有7个会导致系统瘫痪的硬伤">
      这不是理论上的风险，都是GitHub有Issue记录、多人踩过的真实坑。
    </Alert>

    <div className="overflow-x-auto my-3">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr>
            <th className="text-left p-2.5 px-3 bg-surface-3 text-muted-foreground font-mono-jb text-[9px] uppercase tracking-wider border-b-2 border-border">硬伤</th>
            <th className="text-left p-2.5 px-3 bg-surface-3 text-muted-foreground font-mono-jb text-[9px] uppercase tracking-wider border-b-2 border-border">影响</th>
            <th className="text-left p-2.5 px-3 bg-surface-3 text-muted-foreground font-mono-jb text-[9px] uppercase tracking-wider border-b-2 border-border">v4.1修复方式</th>
          </tr>
        </thead>
        <tbody>
          {issues.map(([issue, severity, impact, fix]) => (
            <tr key={issue} className="hover:bg-surface-2 transition-colors">
              <td className="p-2.5 px-3 border-b border-border text-foreground">{issue}</td>
              <td className="p-2.5 px-3 border-b border-border text-muted-foreground">
                <span className={`inline-block px-2 py-0.5 rounded text-[9px] font-mono-jb mx-0.5 ${
                  severity === "致命" ? "bg-los-red-light text-los-red" :
                  severity === "重要" ? "bg-los-red-light text-los-red" :
                  "bg-los-blue-light text-los-blue"
                }`}>{severity}</span> {impact}
              </td>
              <td className="p-2.5 px-3 border-b border-border text-muted-foreground">{fix}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>

    {/* Compare */}
    <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-0 my-5 items-start">
      <div className="bg-los-red-light border border-los-red/20 rounded-lg md:rounded-r-none p-4">
        <div className="font-mono-jb text-[9px] uppercase tracking-wide mb-2 text-los-red">v4.0 · n8n方案（有7个硬伤）</div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          Railway云 + n8n + ngrok + Docker<br />配置分散在5个地方<br />任何一个环节报错，全链路瘫痪<br />买家无法独立排错<br />不可商业化出售
        </p>
      </div>
      <div className="hidden md:flex bg-surface-3 items-center justify-center text-lg px-3 min-h-[100px] text-muted-foreground">→</div>
      <div className="bg-los-green-light border border-los-green/20 rounded-lg md:rounded-l-none p-4">
        <div className="font-mono-jb text-[9px] uppercase tracking-wide mb-2 text-los-green">v4.1 · OpenClaw方案（零硬伤）</div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          OpenClaw + Cloudflare Tunnel<br />配置统一在~/.openclaw/<br />任何节点失败有fallback<br />日志清晰，买家可自查<br />MIT License，可商业化
        </p>
      </div>
    </div>

    <Alert variant="green" icon="✅" title="保留的全部卖点">
      架构换了，但8大算法、7大领域、防AI偏见、迪拜文化滤镜、5大灵魂补丁、所有提示词、周月年复盘、商业化定价——<strong className="text-white">一个都没少</strong>，全部保留并增强。
    </Alert>
  </div>
);

export default WhyUpgrade;
