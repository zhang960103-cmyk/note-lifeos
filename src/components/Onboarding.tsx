import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { ChevronRight, Mic, Brain, BarChart3, Wallet, Target, Check } from "lucide-react";

const EXAMPLE_PROMPTS = [
  "今天开了3小时会，感觉很低效，有点焦虑",
  "帮我安排今天：要写周报、回10封邮件、健身",
  "花了80块吃饭，又买了本书150块",
  "刚跟领导谈完，感觉方向不对，不知道怎么办",
];

const FEATURES = [
  { icon: <Mic size={20} className="text-gold" />, title: "说话就记录", desc: "语音或打字，AI自动整理成日记、待办、财务" },
  { icon: <Brain size={20} className="text-gold" />, title: "人生导师", desc: "不只是工具，是陪你想清楚的成长伙伴" },
  { icon: <BarChart3 size={20} className="text-gold" />, title: "时间去哪了", desc: "自动统计你的时间分布，发现被消耗的地方" },
  { icon: <Wallet size={20} className="text-gold" />, title: "钱去哪了", desc: "说话自动记账，预算、订阅、借还一体管理" },
  { icon: <Target size={20} className="text-gold" />, title: "每周复盘", desc: "AI写给你的成长信，发现你自己看不到的模式" },
];

// R3: Activation tasks — guide user to complete 3 key actions in first session
const ACTIVATION_TASKS = [
  {
    id: "first_entry",
    label: "说出今天发生的一件事",
    hint: "随便说，不需要完整",
    action: "/",
    examples: ["今天开会开了3小时，有点累", "吃了顿好吃的火锅，心情不错", "项目遇到问题，有点焦虑"],
  },
  {
    id: "first_todo",
    label: "记录一件今天要做的事",
    hint: "AI会自动提取并创建待办",
    action: "/todos",
    examples: ["今天要回10封邮件", "下午3点要开会", "要写周报"],
  },
  {
    id: "first_wheel",
    label: "做一次生命之轮打分",
    hint: "评估你7个维度的当前状态",
    action: "/wheel",
    examples: [],
  },
];

const STEPS = [
  {
    title: "你的私人生命导师",
    subtitle: "不是工具，是陪你成长的伙伴",
    content: (
      <div className="space-y-2 mt-4">
        {FEATURES.map((f, i) => (
          <div key={i} className="flex items-start gap-3 bg-surface-2 border border-border rounded-xl p-3">
            <div className="mt-0.5">{f.icon}</div>
            <div><p className="text-xs font-semibold text-foreground">{f.title}</p>
              <p className="text-[10px] text-muted-foreground leading-[1.6]">{f.desc}</p></div>
          </div>
        ))}
      </div>
    ),
  },
  {
    title: "你只需要说话",
    subtitle: "任何格式，任何时候，AI处理一切",
    content: (
      <div className="mt-4 space-y-2">
        <p className="text-[10px] text-muted-foreground mb-3">比如这样说：</p>
        {EXAMPLE_PROMPTS.map((p, i) => (
          <div key={i} className="bg-surface-2 border border-border rounded-xl px-4 py-3">
            <p className="text-xs text-foreground leading-[1.7]">「{p}」</p>
          </div>
        ))}
        <p className="text-[10px] text-muted-foreground mt-3 text-center">说完之后，导师会回应你，同时自动记录所有信息</p>
      </div>
    ),
  },
  {
    title: "关于你的数据",
    subtitle: "你的内容，只属于你",
    content: (
      <div className="mt-4 space-y-3">
        <div className="bg-primary/10 border border-primary/30 rounded-xl p-4">
          <p className="text-xs font-semibold text-foreground mb-2">🔒 你的日记只属于你</p>
          <p className="text-[11px] text-foreground/80 leading-[1.7]">你输入的内容存储在你的账号里，不会公开分享，不用于广告。AI处理你的内容是为了更好地帮助你，仅此而已。</p>
        </div>
        <div className="bg-surface-2 border border-border rounded-xl p-4">
          <p className="text-xs font-semibold text-foreground mb-2">💡 最好的起点</p>
          <p className="text-[11px] text-foreground/80 leading-[1.7]">今天就写第一条——不需要完整，不需要整理，随便说说今天发生了什么就行。</p>
        </div>
      </div>
    ),
  },
  {
    title: "快速上手",
    subtitle: "完成这3件事，让导师真正了解你",
    content: null, // rendered separately with navigate support
  },
];

export default function Onboarding() {
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<Set<string>>(new Set());
  const { completeOnboarding } = useLifeOs();
  const navigate = useNavigate();

  const next = () => {
    if (step < STEPS.length - 1) { setStep(step + 1); return; }
    if ("Notification" in window && Notification.permission === "default") Notification.requestPermission();
    completeOnboarding();
  };

  const handleActivationTask = (task: typeof ACTIVATION_TASKS[0]) => {
    setDone(prev => new Set([...prev, task.id]));
    completeOnboarding();
    navigate(task.action);
  };

  const s = STEPS[step];
  const isLastStep = step === STEPS.length - 1;

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-[360px]">
        <div className="text-center mb-2">
          <h1 className="font-serif-sc text-xl text-foreground">{s.title}</h1>
          <p className="text-xs text-muted-foreground mt-1">{s.subtitle}</p>
        </div>

        {isLastStep ? (
          // R3: Activation task step
          <div className="mt-4 space-y-3">
            {ACTIVATION_TASKS.map((task) => (
              <div key={task.id}
                className={`rounded-xl border ${done.has(task.id) ? "bg-los-green/10 border-los-green/30 opacity-60" : "bg-surface-2 border-border"}`}>
                <button onClick={() => handleActivationTask(task)}
                  className="w-full flex items-center gap-3 p-4 text-left">
                  <div className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center border-2
                    ${done.has(task.id) ? "bg-los-green border-los-green" : "border-border"}`}>
                    {done.has(task.id) && <Check size={12} className="text-white" />}
                  </div>
                  <div className="flex-1">
                    <p className="text-xs font-semibold text-foreground">{task.label}</p>
                    <p className="text-caption text-muted-foreground mt-0.5">{task.hint}</p>
                  </div>
                  <ChevronRight size={14} className="text-muted-foreground flex-shrink-0" />
                </button>
                {task.examples.length > 0 && !done.has(task.id) && (
                  <div className="px-4 pb-3 flex gap-1.5 flex-wrap">
                    {task.examples.map(eg => (
                      <button key={eg} onClick={() => handleActivationTask(task)}
                        className="text-label bg-surface-3 hover:bg-primary/10 hover:text-primary text-muted-foreground px-2 py-1 rounded-full transition">
                        「{eg}」
                      </button>
                    ))}
                  </div>
                )}
              </div>
            ))}
            <button onClick={() => completeOnboarding()}
              className="w-full mt-2 text-center text-caption text-muted-foreground hover:text-foreground transition py-2">
              稍后再做，先进入应用
            </button>
          </div>
        ) : (
          <div className="max-h-[55vh] overflow-y-auto">{s.content}</div>
        )}

        {!isLastStep && (
          <div className="flex items-center justify-between mt-6">
            <div className="flex gap-1.5">
              {STEPS.map((_, i) => (
                <div key={i} className={`h-1.5 rounded-full transition-all ${i === step ? "w-6 bg-gold" : "w-1.5 bg-border"}`} />
              ))}
            </div>
            <button onClick={next} className="flex items-center gap-1.5 bg-gold text-background px-5 py-2.5 rounded-full text-sm font-medium hover:bg-gold/90 transition-all">
              {step < STEPS.length - 1 ? "下一步" : "开始使用"}
              <ChevronRight size={14} />
            </button>
          </div>
        )}

        {step === 0 && (
          <button onClick={() => { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); completeOnboarding(); }}
            className="w-full mt-3 text-center text-[10px] text-muted-foreground hover:text-foreground transition">
            跳过介绍，直接开始
          </button>
        )}
      </div>
    </div>
  );
}
