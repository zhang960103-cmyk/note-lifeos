import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import WhyUpgrade from "@/components/sections/WhyUpgrade";
import Architecture from "@/components/sections/Architecture";
import Algorithms from "@/components/sections/Algorithms";
import MasterPrompt from "@/components/MasterPrompt";
import SectionHeader from "@/components/SectionHeader";
import Alert from "@/components/Alert";
import AlgoPrompts from "@/components/sections/AlgoPrompts";
import CronTasks from "@/components/sections/CronTasks";
import PeriodicReview from "@/components/sections/PeriodicReview";
import SoulPatches from "@/components/sections/SoulPatches";
import Pricing from "@/components/sections/Pricing";
import DeployChecklist from "@/components/sections/DeployChecklist";
import { ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";

const WhitepaperPage = () => (
  <div className="min-h-screen bg-background pb-24">
    <div className="sticky top-0 z-50 bg-background/97 backdrop-blur-md border-b border-border px-4 h-[42px] flex items-center">
      <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors mr-3">
        <ArrowLeft size={18} />
      </Link>
      <span className="font-serif-sc text-xs text-gold whitespace-nowrap mr-3">🧭 Life OS v4.1 白皮书</span>
      <div className="flex gap-0.5 overflow-x-auto scrollbar-none">
        {[
          { href: "#why", label: "①升级" }, { href: "#arch", label: "②架构" },
          { href: "#algos", label: "③算法" }, { href: "#master", label: "④提示词" },
          { href: "#algo-prompts", label: "⑤算法词" }, { href: "#cron", label: "⑥定时" },
          { href: "#periodic", label: "⑦复盘" }, { href: "#patch", label: "⑧补丁" },
          { href: "#sell", label: "⑨商业" }, { href: "#deploy", label: "⑩部署" },
        ].map((item) => (
          <a key={item.href} href={item.href}
            className="text-muted-foreground no-underline text-[10px] px-2 py-1 rounded flex-shrink-0 font-mono-jb tracking-wide hover:text-gold hover:bg-gold-light transition-all whitespace-nowrap">
            {item.label}
          </a>
        ))}
      </div>
    </div>
    <Hero />
    <div className="max-w-[960px] mx-auto px-6 pb-20">
      <WhyUpgrade />
      <Architecture />
      <Algorithms />
      <div className="mt-14" id="master">
        <SectionHeader num="④" title="核心系统提示词（MASTER SYSTEM PROMPT）" color="blue" />
        <Alert variant="red" icon="📌" title="存储位置改变">
          v4.0存在Railway环境变量（4KB上限，会截断）→ v4.1存在本地文件 <code className="font-mono-jb text-[10px] text-gold">~/.openclaw/skills/life-os/system.md</code>，无长度限制。
        </Alert>
        <MasterPrompt />
      </div>
      <AlgoPrompts />
      <CronTasks />
      <PeriodicReview />
      <SoulPatches />
      <Pricing />
      <DeployChecklist />
    </div>
    <footer className="text-center py-6 text-muted-foreground text-[10px] font-mono-jb border-t border-border mt-10">
      🧭 Life OS v4.1 · v4.0卖点全保留 + Flowith硬伤全修复 · 数据永属于你 · MIT可商业化
    </footer>
  </div>
);

export default WhitepaperPage;
