import { useNavigate } from "react-router-dom";
import { ArrowLeft, Compass } from "lucide-react";

const algorithms = [
  { num: "01", tag: "日常", emoji: "📖", title: "生活作业", desc: "捕捉每日最有故事价值的瞬间，构建人生叙事资产库。", trigger: "默认 ｜ /story" },
  { num: "02", tag: "晨间", emoji: "🌅", title: "晨间笔记", desc: "清晨15分钟无压力意识流，捕捉潜意识最真实的声音。Morning Pages方法。", trigger: "7:00 AM 第一条提醒" },
  { num: "03", tag: "情绪", emoji: "💔", title: "心情日记", desc: "记录痛苦与混乱，情绪排毒。不分析，只见证。先承认，再提问。", trigger: "难受/崩溃/愤怒/委屈/伤心" },
  { num: "04", tag: "正向", emoji: "🙏", title: "感恩日记", desc: "强制关注美好，每日3件感恩，提升底层心理能量基线，科学证明有效。", trigger: "早晨结构化日记固定包含" },
  { num: "05", tag: "长线", emoji: "🚀", title: "奥德赛计划", desc: "斯坦福方法：设想5年后的3条不同人生路径，驱动长线战略布局。", trigger: "未来/方向/迷茫/不知道 ｜ /odyssey" },
  { num: "06", tag: "平衡", emoji: "⚖️", title: "生命之轮", desc: "7大领域各维度打分，可视化生命平衡度，识别哪个维度是空白。", trigger: "周复盘固定 ｜ /wheel" },
  { num: "07", tag: "恐惧", emoji: "😨", title: "恐惧设定", desc: "Tim Ferriss框架：直面害怕的事，写最坏情况、预防和补救。消解拖延根源。", trigger: "担心/害怕/不敢/万一 ｜ 任务3天未动" },
  { num: "08", tag: "智慧", emoji: "👴", title: "所罗门悖论", desc: "模拟85岁的自己回望今天，获得跨时空高维视角。打破局限性自我认知。", trigger: "后悔/纠结/值不值/要不要 ｜ /elder" },
];

const commands = [
  { cmd: "/story", desc: "触发生活作业算法" },
  { cmd: "/odyssey", desc: "启动奥德赛5年规划" },
  { cmd: "/wheel", desc: "生命之轮评估" },
  { cmd: "/elder", desc: "所罗门悖论——85岁回望" },
  { cmd: "/now", desc: "情绪急救模式" },
  { cmd: "/fear", desc: "恐惧设定练习" },
];

const tips = [
  { emoji: "💡", title: "不用整理格式", desc: "想到什么说什么，AI会自动整理成结构化日记、提取待办、标记情绪。" },
  { emoji: "🏷️", title: "标签自动生成", desc: "每次对话后，系统自动提取情绪标签和主题标签，无需手动分类。" },
  { emoji: "💰", title: "聊天即记账", desc: "提到'花了200买书'，系统自动识别并记录到财务面板。" },
  { emoji: "🎯", title: "生命之轮自动评", desc: "基于你近7天日记内容，AI自动评估7大领域得分，无需手动打分。" },
  { emoji: "📊", title: "周/月复盘信", desc: "在复盘页面一键生成，AI以'老朋友写信'的方式总结你的成长轨迹。" },
  { emoji: "🔔", title: "定时提醒", desc: "晨间7:30、晚间21:00自动提醒写日记，养成习惯。" },
];

const soulPatches = [
  { emoji: "🔄", title: "反直觉对冲", desc: "每日晚间强制包含'反向视角'，挑战当日固有判断，防止陷入虚假勤奋。" },
  { emoji: "🌍", title: "地缘文化滤镜", desc: "商业/内容类日记自动加地缘文化视角，提供通用AI没有的本地化洞察。" },
  { emoji: "⚡", title: "心流状态捕捉", desc: "情绪分≥9时AI强制追问：在做什么、什么环境、什么触发。固化高效模板。" },
  { emoji: "🤝", title: "人际CRM追踪", desc: "记录含'认识了/见了/聊了'重要人物时，自动标记并3天后提醒跟进。" },
];

const GuidePage = () => {
  const navigate = useNavigate();

  return (
    <div className="pb-24 px-4 max-w-[600px] mx-auto overflow-y-auto h-full">
      <div className="flex items-center gap-3 py-4">
        <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-serif-sc text-lg text-foreground">使用指南</h1>
      </div>

      {/* Quick tips */}
      <section className="mb-6">
        <h2 className="text-xs text-gold font-mono-jb mb-3">💡 核心操作技巧</h2>
        <div className="space-y-2">
          {tips.map(tip => (
            <div key={tip.title} className="bg-surface-2 border border-border rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <span>{tip.emoji}</span>
                <span className="text-sm text-foreground font-serif-sc">{tip.title}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-[1.8]">{tip.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Slash commands */}
      <section className="mb-6">
        <h2 className="text-xs text-gold font-mono-jb mb-3">⌨️ 快捷指令</h2>
        <div className="bg-surface-2 border border-border rounded-xl overflow-hidden">
          {commands.map((c, i) => (
            <div key={c.cmd} className={`flex items-center gap-3 px-4 py-2.5 ${i > 0 ? "border-t border-border" : ""}`}>
              <code className="text-gold font-mono-jb text-xs bg-gold-light px-2 py-0.5 rounded">{c.cmd}</code>
              <span className="text-xs text-muted-foreground">{c.desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 8 Algorithms */}
      <section className="mb-6">
        <h2 className="text-xs text-gold font-mono-jb mb-3">🧠 八大日记算法</h2>
        <p className="text-xs text-muted-foreground mb-3 leading-[1.8]">
          AI根据你的消息关键词、情绪、时间自动切换算法。你不需要手动选择。
        </p>
        <div className="grid grid-cols-1 gap-2">
          {algorithms.map(algo => (
            <div key={algo.num} className="bg-surface-2 border border-border rounded-xl px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span>{algo.emoji}</span>
                  <span className="text-sm text-foreground font-serif-sc">{algo.title}</span>
                </div>
                <span className="text-gold/40 font-mono-jb text-lg">{algo.num}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-[1.8] mb-1">{algo.desc}</p>
              <p className="text-[10px] text-muted-foreground/60 font-mono-jb">触发：{algo.trigger}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Life Wheel Entry */}
      <section className="mb-6">
        <button
          onClick={() => navigate("/wheel")}
          className="w-full bg-surface-2 border border-border rounded-xl px-4 py-4 flex items-center gap-3 hover:border-gold/40 transition-colors"
        >
          <Compass size={20} className="text-gold" />
          <div className="text-left flex-1">
            <span className="text-sm text-foreground font-serif-sc">生命之轮评估</span>
            <p className="text-xs text-muted-foreground mt-0.5">7大领域打分，可视化你的生命平衡度</p>
          </div>
          <span className="text-muted-foreground text-xs">→</span>
        </button>
      </section>

      {/* Soul Patches */}
      <section className="mb-6">
        <h2 className="text-xs text-gold font-mono-jb mb-3">🧬 灵魂补丁（从工具升维为数字分身）</h2>
        <div className="grid grid-cols-1 gap-2">
          {soulPatches.map(p => (
            <div key={p.title} className="bg-surface-2 border border-border rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 mb-1">
                <span>{p.emoji}</span>
                <span className="text-sm text-foreground font-serif-sc">{p.title}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-[1.8]">{p.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default GuidePage;
