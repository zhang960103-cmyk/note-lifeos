import SectionHeader from "../SectionHeader";
import CodeBlock from "../CodeBlock";

const Architecture = () => (
  <div className="mt-14" id="arch">
    <SectionHeader num="②" title="v4.1 新架构：OpenClaw + Cloudflare" color="green" />

    <div className="bg-surface-2 border border-border rounded-xl p-5 my-4">
      <div className="font-mono-jb text-[10px] text-gold uppercase tracking-wide mb-4">系统数据流</div>
      {[
        [
          { dot: "bg-gold", label: "📱 Telegram（手机/电脑）" },
          { dot: "bg-los-blue", label: "OpenClaw · grammY Bot" },
          { dot: "bg-los-purple", label: "🎙️ Whisper 语音转录" },
        ],
      ].map((row, i) => (
        <div key={i} className="flex items-center gap-2 mb-2 flex-wrap">
          {row.map((node, j) => (
            <div key={j} className="flex items-center gap-2">
              {j > 0 && <span className="text-muted-foreground text-sm">→</span>}
              <div className="bg-surface-3 border border-border rounded-md px-3 py-1.5 font-mono-jb text-[11px] whitespace-nowrap flex items-center gap-1.5">
                <span className={`w-[7px] h-[7px] rounded-full flex-shrink-0 ${node.dot}`} />
                {node.label}
              </div>
            </div>
          ))}
        </div>
      ))}
      <div className="ml-5 text-muted-foreground text-sm mb-2">↓</div>
      <div className="flex items-center gap-2 mb-2 flex-wrap">
        <div className="bg-surface-3 border border-border rounded-md px-3 py-1.5 font-mono-jb text-[11px] flex items-center gap-1.5">
          <span className="w-[7px] h-[7px] rounded-full bg-gold" />🎯 8算法路由 Skill
        </div>
        <span className="text-muted-foreground text-sm">→</span>
        <div className="bg-surface-3 border border-border rounded-md px-3 py-1.5 font-mono-jb text-[11px] flex items-center gap-1.5">
          <span className="w-[7px] h-[7px] rounded-full bg-los-green" />🧠 本地Qwen/Ollama（电脑开）
        </div>
      </div>
      <div className="ml-40 text-muted-foreground text-sm mb-2">↘</div>
      <div className="ml-10 mb-2">
        <div className="bg-surface-3 border border-los-blue/30 rounded-md px-3 py-1.5 font-mono-jb text-[11px] inline-flex items-center gap-1.5">
          <span className="w-[7px] h-[7px] rounded-full bg-los-blue" />☁️ DeepSeek备用（电脑关）
        </div>
      </div>
      <div className="ml-5 text-muted-foreground text-sm mb-2">↓</div>
      <div className="flex items-center gap-2 flex-wrap">
        <div className="bg-surface-3 border border-border rounded-md px-3 py-1.5 font-mono-jb text-[11px] flex items-center gap-1.5">
          <span className="w-[7px] h-[7px] rounded-full bg-los-green" />💾 Notion统一数据库
        </div>
        <span className="text-muted-foreground text-sm">→</span>
        <div className="bg-surface-3 border border-border rounded-md px-3 py-1.5 font-mono-jb text-[11px] flex items-center gap-1.5">
          <span className="w-[7px] h-[7px] rounded-full bg-gold" />📊 auto-daily-report
        </div>
      </div>
    </div>

    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      <div className="bg-surface-2 border border-border rounded-lg p-4">
        <h3 className="font-serif-sc text-sm text-white mb-1.5">🏠 电脑开着时</h3>
        <p className="text-muted-foreground text-[13px] leading-relaxed">OpenClaw检测本地Ollama在线 → 调用Qwen处理 → 质量最好，完全免费，数据不出门</p>
      </div>
      <div className="bg-surface-2 border border-border rounded-lg p-4">
        <h3 className="font-serif-sc text-sm text-white mb-1.5">☁️ 电脑关着时</h3>
        <p className="text-muted-foreground text-[13px] leading-relaxed">OpenClaw自动fallback → DeepSeek API处理 → 提醒照发，日记照存，无感切换</p>
      </div>
    </div>

    <h3 className="font-serif-sc text-sm text-white mt-5 mb-2">Cloudflare Tunnel 替代 ngrok（一次配置，永久固定）</h3>
    <CodeBlock title="bash · Cloudflare Tunnel 一次性配置">
{`# 安装（只需一次）
brew install cloudflared  # Mac
# Windows: 去 cloudflare.com/products/tunnel 下载

# 登录免费账号
cloudflared tunnel login

# 创建固定隧道（只需一次，域名永久不变）
cloudflared tunnel create life-os-local
cloudflared tunnel route dns life-os-local n8n.你的域名.com

# 设置开机自动启动（之后电脑重启自动重连，不用管）
sudo cloudflared service install
# 以后地址永远是 https://n8n.你的域名.com，不会变`}
    </CodeBlock>
  </div>
);

export default Architecture;
