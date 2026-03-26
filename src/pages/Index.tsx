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

const Index = () => (
  <div className="min-h-screen bg-background">
    <Navbar />
    <Hero />
    <div className="max-w-[960px] mx-auto px-6 pb-20">
      <WhyUpgrade />
      <Architecture />
      <Algorithms />

      {/* ④ Master Prompt */}
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

export default Index;
