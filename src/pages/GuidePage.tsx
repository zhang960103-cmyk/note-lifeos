import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, Sparkles, BookOpen, Clock, Zap, Target, MessageSquare, BarChart3, Heart } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const APP_VERSION = "2.2.0";

const SECTIONS = [
  {
    id: "core",
    icon: <Sparkles size={16} />,
    title: "核心理念",
    content: (
      <div className="space-y-3">
        <p className="text-sm text-foreground leading-relaxed">
          Life OS 的设计哲学：<span className="text-primary font-medium">你只需要说话，其余全部自动完成。</span>
        </p>
        <div className="grid grid-cols-3 gap-2 text-center">
          {[
            { emoji: "💬", label: "说出想法" },
            { emoji: "🤖", label: "AI 整理" },
            { emoji: "✅", label: "自动归档" },
          ].map(s => (
            <div key={s.label} className="bg-muted rounded-xl py-3">
              <div className="text-xl mb-1">{s.emoji}</div>
              <div className="text-[10px] text-muted-foreground">{s.label}</div>
            </div>
          ))}
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          日记、待办、记账、情绪追踪、生命评估——所有整理工作都在后台自动完成。你不需要学习任何操作。
        </p>
      </div>
    ),
  },
  {
    id: "quick",
    icon: <Zap size={16} />,
    title: "30秒上手",
    content: (
      <div className="space-y-2">
        {[
          { step: "1", text: "打开应用，在输入框写下任何想法", sub: "AI 自动识别意图" },
          { step: "2", text: "提到任务 → 自动加入待办", sub: "\"明天要开会\" → ✅ 待办已创建" },
          { step: "3", text: "提到花销 → 自动记账", sub: "\"我买了本书花了40\" → 💰 已记录" },
          { step: "4", text: "按 + 按钮打开更多工具", sub: "精力记录、快捷记账、脑清空" },
        ].map(s => (
          <div key={s.step} className="flex gap-3 items-start">
            <div className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs flex items-center justify-center flex-shrink-0 mt-0.5">{s.step}</div>
            <div>
              <p className="text-sm text-foreground">{s.text}</p>
              <p className="text-[10px] text-muted-foreground">{s.sub}</p>
            </div>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "features",
    icon: <Target size={16} />,
    title: "功能总览",
    content: (
      <FeatureMap />
    ),
  },
  {
    id: "commands",
    icon: <MessageSquare size={16} />,
    title: "快捷指令",
    content: (
      <div className="space-y-1.5">
        <p className="text-xs text-muted-foreground mb-2">在输入框输入以下指令：</p>
        {[
          { cmd: "/story", desc: "生活作业——记录今日故事" },
          { cmd: "/wheel", desc: "生命之轮——7维度评估" },
          { cmd: "/odyssey", desc: "奥德赛计划——5年路径" },
          { cmd: "/elder", desc: "所罗门悖论——85岁回望" },
          { cmd: "/fear", desc: "恐惧设定——直面恐惧" },
          { cmd: "/review", desc: "触发周/月复盘" },
        ].map(c => (
          <div key={c.cmd} className="flex items-center gap-2">
            <code className="text-primary bg-primary/10 px-2 py-0.5 rounded text-xs font-mono">{c.cmd}</code>
            <span className="text-xs text-muted-foreground">{c.desc}</span>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "algorithms",
    icon: <BookOpen size={16} />,
    title: "八大日记算法",
    content: (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground mb-1">AI 根据你的内容自动切换，无需手动选择</p>
        <div className="grid grid-cols-2 gap-1.5">
          {[
            { emoji: "📖", title: "生活作业", trigger: "默认" },
            { emoji: "🌅", title: "晨间笔记", trigger: "早晨" },
            { emoji: "💔", title: "心情日记", trigger: "情绪关键词" },
            { emoji: "🙏", title: "感恩日记", trigger: "晨间自动" },
            { emoji: "🚀", title: "奥德赛计划", trigger: "迷茫/方向" },
            { emoji: "⚖️", title: "生命之轮", trigger: "周复盘" },
            { emoji: "😨", title: "恐惧设定", trigger: "害怕/不敢" },
            { emoji: "👴", title: "所罗门悖论", trigger: "后悔/纠结" },
          ].map(a => (
            <div key={a.title} className="bg-muted rounded-lg px-3 py-2">
              <div className="text-sm">{a.emoji} <span className="text-xs text-foreground">{a.title}</span></div>
              <div className="text-[9px] text-muted-foreground mt-0.5">触发: {a.trigger}</div>
            </div>
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "routine",
    icon: <Clock size={16} />,
    title: "推荐日常节奏",
    content: (
      <div className="space-y-3">
        {[
          { time: "🌅 早晨 5分钟", desc: "回应今日一问 → 记录精力 → 设定聚焦任务" },
          { time: "🌞 白天 随时", desc: "有想法随时说 → 提到任务自动加待办 → 提到花销自动记账" },
          { time: "🌙 晚间 10分钟", desc: "回顾今天 → 日记提取时间线 → 查看情绪趋势" },
          { time: "📊 每周日", desc: "生命罗盘评估 → 周复盘信 → 调整下周焦点" },
        ].map(r => (
          <div key={r.time}>
            <p className="text-xs text-primary font-medium mb-0.5">{r.time}</p>
            <p className="text-xs text-muted-foreground leading-relaxed">{r.desc}</p>
          </div>
        ))}
      </div>
    ),
  },
  {
    id: "finance",
    icon: <BarChart3 size={16} />,
    title: "记账说明",
    content: (
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground leading-relaxed">
          AI 只会在你明确说出「我花了」「我买了」「收到」等第一人称支付动词时才会自动记账。
        </p>
        <div className="bg-muted rounded-lg p-3 space-y-1.5">
          <div className="text-xs"><span className="text-green-500">✓</span> "我花了200买书" → 自动记录支出</div>
          <div className="text-xs"><span className="text-green-500">✓</span> "收到学生转账500" → 自动记录收入</div>
          <div className="text-xs"><span className="text-destructive">✗</span> "这顿饭好贵啊200多" → 不会记录</div>
          <div className="text-xs"><span className="text-destructive">✗</span> "打算花3000买相机" → 不会记录</div>
        </div>
        <p className="text-[10px] text-muted-foreground">也可以用 + 按钮 → 记账，直接输入</p>
      </div>
    ),
  },
  {
    id: "ai",
    icon: <Heart size={16} />,
    title: "AI 智能系统",
    content: (
      <div className="space-y-2">
        {[
          { emoji: "🧠", title: "认知升维", desc: "迷茫时自动切换破局模式，给出具体资源和行动" },
          { emoji: "🔄", title: "反直觉对冲", desc: "晚间对话包含反向视角，防止虚假勤奋" },
          { emoji: "⚡", title: "心流捕捉", desc: "高情绪时追问触发条件，固化高效模板" },
          { emoji: "📚", title: "资源推荐", desc: "根据话题自动推荐书籍/工具/课程" },
        ].map(f => (
          <div key={f.title} className="flex gap-2 items-start">
            <span className="text-sm flex-shrink-0">{f.emoji}</span>
            <div>
              <p className="text-xs text-foreground font-medium">{f.title}</p>
              <p className="text-[10px] text-muted-foreground">{f.desc}</p>
            </div>
          </div>
        ))}
      </div>
    ),
  },
];

function FeatureMap() {
  const navigate = useNavigate();
  const features = [
    { icon: "🧭", title: "今天", desc: "对话日记 + AI 导师", path: "/" },
    { icon: "✅", title: "待办", desc: "任务管理 + 番茄钟", path: "/todos" },
    { icon: "⚖️", title: "生命罗盘", desc: "7维度评估", path: "/wheel" },
    { icon: "💰", title: "财富", desc: "收支统计", path: "/wealth" },
    { icon: "📊", title: "时间统计", desc: "效率分析", path: "/time-stats" },
    { icon: "🎯", title: "目标", desc: "季度 OKR", path: "/goals" },
    { icon: "💡", title: "洞察", desc: "行动建议", path: "/insights" },
    { icon: "📈", title: "复盘", desc: "周报/月报", path: "/review" },
  ];
  return (
    <div className="grid grid-cols-2 gap-1.5">
      {features.map(f => (
        <button key={f.path} onClick={() => navigate(f.path)}
          className="flex items-center gap-2 bg-muted rounded-lg px-3 py-2.5 hover:bg-accent transition text-left">
          <span className="text-base">{f.icon}</span>
          <div>
            <p className="text-xs text-foreground">{f.title}</p>
            <p className="text-[9px] text-muted-foreground">{f.desc}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

const GuidePage = () => {
  const navigate = useNavigate();
  const [openSection, setOpenSection] = useState<string | null>("core");

  return (
    <div className="pb-24 px-4 max-w-[600px] mx-auto overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center gap-3 py-4">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground transition">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="font-serif-sc text-lg text-foreground">使用指南</h1>
          <p className="text-[9px] text-muted-foreground">v{APP_VERSION}</p>
        </div>
      </div>

      {/* Hero card */}
      <div className="bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 rounded-2xl px-5 py-5 mb-4 text-center">
        <div className="text-3xl mb-2">🧭</div>
        <p className="text-sm text-foreground font-medium">Life OS · 生命罗盘</p>
        <p className="text-xs text-muted-foreground mt-1">写下想法，AI 帮你整理一切</p>
      </div>

      {/* Accordion sections */}
      <div className="space-y-1.5">
        {SECTIONS.map(section => (
          <div key={section.id} className="bg-card border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => setOpenSection(openSection === section.id ? null : section.id)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-accent transition"
            >
              <span className="text-muted-foreground">{section.icon}</span>
              <span className="text-sm text-foreground flex-1 text-left">{section.title}</span>
              <ChevronRight size={14} className={`text-muted-foreground transition-transform ${openSection === section.id ? "rotate-90" : ""}`} />
            </button>
            {openSection === section.id && (
              <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-1">
                {section.content}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Version changelog - collapsed */}
      <details className="mt-4 bg-card border border-border rounded-xl">
        <summary className="px-4 py-3 text-xs text-muted-foreground cursor-pointer hover:bg-accent transition rounded-xl">
          📋 版本更新记录
        </summary>
        <div className="px-4 pb-3 space-y-2">
          {[
            { v: "2.2.0", items: ["输入栏工具合并为+菜单", "财务误记修复", "使用指南重设计", "AI模型配置统一"] },
            { v: "2.1.0", items: ["十国语言支持", "多币种财务", "设计系统统一"] },
            { v: "2.0.0", items: ["精力日志系统", "时间统计升级", "目标OKR自动关联"] },
            { v: "1.0.0", items: ["核心对话日记", "AI自动提取", "生命罗盘", "财务记录"] },
          ].map(v => (
            <div key={v.v}>
              <p className="text-xs text-primary font-mono mb-0.5">v{v.v}</p>
              <ul className="text-[10px] text-muted-foreground space-y-0.5">
                {v.items.map((item, i) => <li key={i}>· {item}</li>)}
              </ul>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
};

export default GuidePage;
