import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";

const APP_VERSION = "1.4.0";
const LAST_UPDATED = "2026-03-29";

const changelog = [
  { version: "1.4.0", date: "2026-03-29", items: ["统一待办视图，合并看板与列表", "时间线提取自动更新待办用时", "新增设置页面，整合主题/账号/退出", "使用指南自动跟随版本更新"] },
  { version: "1.3.0", date: "2026-03-28", items: ["时间统计仪表盘升级（热力图、效率评分）", "AI时间分析与日记时间线提取", "参考 Toggl/RescueTime 重设计可视化"] },
  { version: "1.2.0", date: "2026-03-27", items: ["语音输入支持中英阿三语", "AI语音自动纠错", "换肤系统（深浅模式+6种主题色）", "待办看板+矩阵+习惯打卡+番茄钟"] },
  { version: "1.1.0", date: "2026-03-26", items: ["Go Deeper 追问按钮", "脑清空 Brain Dump", "聚焦任务模式", "日落复盘卡片", "自然语言记账"] },
  { version: "1.0.0", date: "2026-03-25", items: ["核心对话日记系统", "AI自动提取待办/情绪/话题", "财富板块自动记账", "生命罗盘7维度评估", "周/月复盘报告生成"] },
];

const quickStart = [
  { emoji: "💬", title: "直接说话就行", desc: "打开应用，在底部输入框写下任何想法。不用分类、不用格式化，AI自动整理一切。" },
  { emoji: "🤖", title: "AI导师自动回应", desc: "发送后AI导师会回复你——不是冷冰冰的分析，而是像朋友一样陪你想清楚。" },
  { emoji: "✅", title: "待办自动生成", desc: "对话中提到的任务，AI自动拆分优先级并加入待办清单，无需手动创建。" },
  { emoji: "💰", title: "聊天即记账", desc: "说'我花了200买书'或'收入5000'，系统自动识别并记录到财富面板。只有明确说'我花了/我付了'才会记录为你的支出。" },
  { emoji: "⚖️", title: "生命之轮自动评估", desc: "AI根据你近30天的对话内容，自动为7大生命维度打分，你只需微调确认。" },
  { emoji: "⚡", title: "精力随手记", desc: "输入框旁的⚡按钮，快速记录当前精力状态（高/中/低），积累后发现规律。" },
  { emoji: "🎤", title: "语音输入", desc: "支持中英阿三语语音识别，AI自动纠错语法和用词错误，也可手动修改。" },
  { emoji: "🧠", title: "脑清空模式", desc: "点击🧠按钮，把脑子里所有想法倒出来，AI自动整理成结构化待办清单。" },
];

const features = [
  { icon: "🧭", title: "今天（首页）", desc: "核心对话界面。每日一问引导深度思考，AI导师对话+自动提取待办/情绪/财务。", path: "/" },
  { icon: "✅", title: "待办清单", desc: "智能任务管理：统一视图按状态分组、四象限矩阵、习惯打卡、番茄钟计时。", path: "/todos" },
  { icon: "⚖️", title: "生命罗盘", desc: "7大维度雷达图+AI洞察卡片+认知清单+本月行动计划。", path: "/wheel" },
  { icon: "💰", title: "财富面板", desc: "收支自动记录、分类统计、可编辑删除。对话中明确提到'我花了'自动入账。", path: "/wealth" },
  { icon: "📊", title: "时间统计", desc: "效率评分环、活跃热力图、分类堆叠图、情绪波动、日记时间线提取、AI深度分析。", path: "/time-stats" },
  { icon: "🕐", title: "历史记录", desc: "365天情绪热力图，点击任意一天查看当天对话摘要和情绪标签。", path: "/history" },
  { icon: "💡", title: "破局手册", desc: "从所有AI回复中提取的行动建议精华库，可收藏、可搜索。", path: "/insights" },
  { icon: "🎯", title: "目标系统", desc: "季度OKR管理，AI自动将待办关联到关键结果，追踪完成进度。", path: "/goals" },
  { icon: "📈", title: "复盘报告", desc: "周报/月报一键生成，AI以'老朋友写信'的方式总结你的成长轨迹。", path: "/review" },
  { icon: "⚙️", title: "设置", desc: "深浅模式切换、6种主题色、账号管理、退出登录。", path: "/settings" },
];

const algorithms = [
  { num: "01", emoji: "📖", title: "生活作业", desc: "捕捉每日最有故事价值的瞬间，构建人生叙事资产库。", trigger: "默认模式 ｜ 输入 /story" },
  { num: "02", emoji: "🌅", title: "晨间笔记", desc: "清晨无压力意识流，捕捉潜意识最真实的声音。", trigger: "早晨7点第一条消息" },
  { num: "03", emoji: "💔", title: "心情日记", desc: "情绪排毒通道。不分析，只见证。先承认，再提问。", trigger: "关键词：难受/崩溃/愤怒/委屈" },
  { num: "04", emoji: "🙏", title: "感恩日记", desc: "每日3件感恩，科学证明可提升底层心理能量基线。", trigger: "早晨结构化日记自动包含" },
  { num: "05", emoji: "🚀", title: "奥德赛计划", desc: "斯坦福方法：设想5年后3条人生路径。", trigger: "关键词：迷茫/方向 ｜ /odyssey" },
  { num: "06", emoji: "⚖️", title: "生命之轮", desc: "7大领域打分，可视化生命平衡度。", trigger: "周复盘 ｜ /wheel" },
  { num: "07", emoji: "😨", title: "恐惧设定", desc: "Tim Ferriss框架：写最坏情况、预防和补救。", trigger: "关键词：害怕/不敢 ｜ /fear" },
  { num: "08", emoji: "👴", title: "所罗门悖论", desc: "模拟85岁的自己回望今天，获得高维视角。", trigger: "关键词：后悔/纠结 ｜ /elder" },
];

const commands = [
  { cmd: "/story", desc: "生活作业——记录今日故事" },
  { cmd: "/odyssey", desc: "奥德赛计划——5年路径规划" },
  { cmd: "/wheel", desc: "生命之轮——7维度评估" },
  { cmd: "/elder", desc: "所罗门悖论——85岁回望" },
  { cmd: "/now", desc: "情绪急救——当下疏导模式" },
  { cmd: "/fear", desc: "恐惧设定——直面恐惧练习" },
  { cmd: "/review", desc: "触发周/月复盘信生成" },
];

const cognitiveTips = [
  { emoji: "🧠", title: "认知升维模式", desc: "当你表达迷茫、焦虑或瓶颈时，AI自动切换为'认知教练'，推荐具体书籍、课程和方法论。" },
  { emoji: "🔄", title: "反直觉对冲", desc: "每日晚间对话自动包含'反向视角'，挑战当日固有判断，防止陷入虚假勤奋。" },
  { emoji: "🌍", title: "地缘文化滤镜", desc: "商业类话题自动加地缘文化视角（如迪拜/中东市场洞察），提供本地化建议。" },
  { emoji: "⚡", title: "心流捕捉", desc: "情绪高分时AI追问：在做什么、什么环境触发的？帮你固化高效模板。" },
  { emoji: "🤝", title: "人际CRM", desc: "提到'认识了/见了/聊了'某人时，自动标记并3天后提醒跟进关系。" },
];

const GuidePage = () => {
  const navigate = useNavigate();

  return (
    <div className="pb-24 px-4 max-w-[600px] mx-auto overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center gap-3 py-4">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-serif-sc text-lg text-foreground">使用指南</h1>
        <span className="ml-auto text-[9px] text-muted-foreground font-mono-jb">v{APP_VERSION} · {LAST_UPDATED}</span>
      </div>

      {/* Philosophy */}
      <section className="mb-6">
        <div className="bg-gradient-to-br from-gold/10 to-transparent border border-gold/20 rounded-xl px-4 py-4">
          <p className="text-sm text-foreground leading-[1.8] font-serif-sc">
            Life OS 的核心理念很简单：<span className="text-gold">你只需要说话，其余全部自动完成。</span>
          </p>
          <p className="text-xs text-muted-foreground leading-[1.8] mt-2">
            日记、待办、记账、情绪追踪、生命评估——所有整理工作都由AI在后台自动完成。你不需要学习任何操作，打开应用，说出你的想法，就够了。
          </p>
        </div>
      </section>

      {/* Quick Start */}
      <section className="mb-6">
        <h2 className="text-xs text-gold font-mono-jb mb-3">🚀 30秒上手</h2>
        <div className="space-y-2">
          {quickStart.map(tip => (
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

      {/* Feature Map */}
      <section className="mb-6">
        <h2 className="text-xs text-gold font-mono-jb mb-3">📱 功能地图</h2>
        <div className="space-y-2">
          {features.map(f => (
            <button
              key={f.path}
              onClick={() => navigate(f.path)}
              className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 flex items-center gap-3 hover:border-gold/40 transition-colors text-left"
            >
              <span className="text-lg flex-shrink-0">{f.icon}</span>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-foreground font-serif-sc">{f.title}</span>
                <p className="text-[10px] text-muted-foreground leading-[1.6] mt-0.5">{f.desc}</p>
              </div>
              <span className="text-muted-foreground text-xs flex-shrink-0">→</span>
            </button>
          ))}
        </div>
      </section>

      {/* Slash Commands */}
      <section className="mb-6">
        <h2 className="text-xs text-gold font-mono-jb mb-3">⌨️ 快捷指令</h2>
        <p className="text-xs text-muted-foreground mb-2 leading-[1.8]">
          在输入框中输入以下指令，可快速触发对应模式：
        </p>
        <div className="bg-surface-2 border border-border rounded-xl overflow-hidden">
          {commands.map((c, i) => (
            <div key={c.cmd} className={`flex items-center gap-3 px-4 py-2.5 ${i > 0 ? "border-t border-border" : ""}`}>
              <code className="text-gold font-mono-jb text-xs bg-gold/10 px-2 py-0.5 rounded">{c.cmd}</code>
              <span className="text-xs text-muted-foreground">{c.desc}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 8 Algorithms */}
      <section className="mb-6">
        <h2 className="text-xs text-gold font-mono-jb mb-3">🧠 八大日记算法</h2>
        <p className="text-xs text-muted-foreground mb-3 leading-[1.8]">
          AI根据你的消息内容、情绪和时间自动切换算法，你不需要手动选择。
        </p>
        <div className="grid grid-cols-1 gap-2">
          {algorithms.map(algo => (
            <div key={algo.num} className="bg-surface-2 border border-border rounded-xl px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span>{algo.emoji}</span>
                  <span className="text-sm text-foreground font-serif-sc">{algo.title}</span>
                </div>
                <span className="text-gold/30 font-mono-jb text-lg">{algo.num}</span>
              </div>
              <p className="text-xs text-muted-foreground leading-[1.8] mb-1">{algo.desc}</p>
              <p className="text-[10px] text-muted-foreground/60 font-mono-jb">触发：{algo.trigger}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Cognitive Tips */}
      <section className="mb-6">
        <h2 className="text-xs text-gold font-mono-jb mb-3">🧬 智能增强系统</h2>
        <div className="grid grid-cols-1 gap-2">
          {cognitiveTips.map(p => (
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

      {/* Daily Routine */}
      <section className="mb-6">
        <h2 className="text-xs text-gold font-mono-jb mb-3">📅 推荐使用节奏</h2>
        <div className="bg-surface-2 border border-border rounded-xl px-4 py-4 space-y-3">
          <div>
            <p className="text-xs text-gold font-mono-jb mb-1">🌅 早晨（5分钟）</p>
            <p className="text-xs text-muted-foreground leading-[1.8]">打开应用 → 回应「今日一问」→ 写下3件感恩 → 记录精力状态</p>
          </div>
          <div className="border-t border-border pt-3">
            <p className="text-xs text-gold font-mono-jb mb-1">🌞 白天（随时）</p>
            <p className="text-xs text-muted-foreground leading-[1.8]">有想法随时说 → 提到花销自动记账 → 提到任务自动加待办</p>
          </div>
          <div className="border-t border-border pt-3">
            <p className="text-xs text-gold font-mono-jb mb-1">🌙 晚间（10分钟）</p>
            <p className="text-xs text-muted-foreground leading-[1.8]">回顾今天 → AI自动生成日记摘要 → 查看待办完成情况 → 提取时间线</p>
          </div>
          <div className="border-t border-border pt-3">
            <p className="text-xs text-gold font-mono-jb mb-1">📊 每周日</p>
            <p className="text-xs text-muted-foreground leading-[1.8]">查看生命罗盘 → 生成周复盘信 → 查看时间统计AI分析 → 调整下周焦点</p>
          </div>
        </div>
      </section>

      {/* Changelog */}
      <section className="mb-6">
        <h2 className="text-xs text-gold font-mono-jb mb-3">📋 版本更新记录</h2>
        <div className="space-y-2">
          {changelog.map(v => (
            <div key={v.version} className="bg-surface-2 border border-border rounded-xl px-4 py-3">
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-xs text-gold font-mono-jb">v{v.version}</span>
                <span className="text-[9px] text-muted-foreground font-mono-jb">{v.date}</span>
              </div>
              <ul className="space-y-0.5">
                {v.items.map((item, i) => (
                  <li key={i} className="text-[10px] text-muted-foreground leading-[1.6] flex gap-1.5">
                    <span className="text-gold/50">·</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default GuidePage;
