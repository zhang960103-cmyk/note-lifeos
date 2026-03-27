import SectionHeader from "../SectionHeader";
import PromptBlock from "../PromptBlock";

const patches = [
  { title: "🔄 反直觉对冲", status: "已集成到 evening.md ✅", desc: '每日晚间强制包含"反向视角"模块，挑战当日某个固有判断。防止陷入虚假勤奋、记流水账没有思维增量。' },
  { title: "🌍 地缘文化滤镜", status: "已集成到 MASTER PROMPT ✅", desc: "商业/内容类日记自动加地缘文化视角。本地节奏、受众结构、文化差异、AI机会——通用AI没有的本地化洞察。" },
  { title: "⚡ 心流状态捕捉", status: "已集成到 router.js + MASTER PROMPT ✅", desc: '情绪分≥9时AI强制追问：在做什么、什么环境、什么触发。把偶然的高效状态固化为可复制的"高效模板"。' },
  { title: "🤝 人际CRM追踪", status: "P2 · 下一版实现", desc: '记录含"认识了/见了/聊了重要人物"时，自动标记。3天后触发跟进提醒。高价值人脉不再烂在日记里。', isP2: true },
];

const SoulPatches = () => (
  <div className="mt-14" id="patch">
    <SectionHeader num="⑧" title="五大灵魂补丁（从工具升维为数字分身）" color="purple" />

    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {patches.map((p) => (
        <div key={p.title} className="bg-surface-2 border border-border rounded-lg p-4">
          <h3 className="font-serif-sc text-sm text-white mb-1.5">{p.title}</h3>
          <p className={`text-[11px] mb-1.5 ${p.isP2 ? "text-los-orange" : "text-gold"}`}>{p.status}</p>
          <p className="text-muted-foreground text-[13px] leading-relaxed">{p.desc}</p>
        </div>
      ))}
    </div>

    <PromptBlock title="optimize.md · /optimize 系统自进化">
{`触发：用户发送/optimize，或系统每月1日月报后自动触发。

🔧 Life OS 本月系统自检

使用数据分析（从Notion读取）：
• 哪种算法模式被触发最多？
• 用户最常跳过/忽略的模块是什么？（可能是阻力点）
• 哪些提问从未被回答？

System Prompt优化建议：
基于以上数据，建议对系统做以下调整：
1. [具体调整 + 原因]
2. [具体调整 + 原因]
3. [具体调整 + 原因]

新增功能建议：
[基于本月使用模式，1-2个新功能点]

📋 请决定是否接受以上建议，回复"确认"后系统自动更新对应Skill文件。`}
    </PromptBlock>
  </div>
);

export default SoulPatches;
