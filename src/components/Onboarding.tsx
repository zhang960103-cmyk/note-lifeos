import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { ChevronRight, Mic, Brain, BarChart3, Wallet, Target, Check } from "lucide-react";

type T = (key: string) => string;

function getExamplePrompts(t: T) {
  return [
    t("onboarding.slide2.example1"),
    t("onboarding.slide2.example2"),
    t("onboarding.slide2.example3"),
    t("onboarding.slide2.example4"),
  ];
}

function getFeatures(t: T) {
  return [
    { icon: <Mic size={20} className="text-gold" />, title: t("onboarding.feature1.title"), desc: t("onboarding.feature1.desc") },
    { icon: <Brain size={20} className="text-gold" />, title: t("onboarding.feature2.title"), desc: t("onboarding.feature2.desc") },
    { icon: <BarChart3 size={20} className="text-gold" />, title: t("onboarding.feature3.title"), desc: t("onboarding.feature3.desc") },
    { icon: <Wallet size={20} className="text-gold" />, title: t("onboarding.feature4.title"), desc: t("onboarding.feature4.desc") },
    { icon: <Target size={20} className="text-gold" />, title: t("onboarding.feature5.title"), desc: t("onboarding.feature5.desc") },
  ];
}

// R3: Activation tasks — guide user to complete 3 key actions in first session
function getActivationTasks(t: T) {
  return [
    {
      id: "first_entry",
      label: t("onboarding.task1.label"),
      hint: t("onboarding.task1.hint"),
      action: "/",
      examples: [t("onboarding.task1.example1"), t("onboarding.task1.example2"), t("onboarding.task1.example3")],
    },
    {
      id: "first_todo",
      label: t("onboarding.task2.label"),
      hint: t("onboarding.task2.hint"),
      action: "/todos",
      examples: [t("onboarding.task2.example1"), t("onboarding.task2.example2"), t("onboarding.task2.example3")],
    },
    {
      id: "first_wheel",
      label: t("onboarding.task3.label"),
      hint: t("onboarding.task3.hint"),
      action: "/wheel",
      examples: [],
    },
  ];
}

function getSteps(t: T, features: ReturnType<typeof getFeatures>, examplePrompts: string[]) {
  return [
    {
      title: t("onboarding.slide1.title"),
      subtitle: t("onboarding.slide1.subtitle"),
      content: (
        <div className="space-y-2 mt-4">
          {features.map((f, i) => (
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
      title: t("onboarding.slide2.title"),
      subtitle: t("onboarding.slide2.subtitle"),
      content: (
        <div className="mt-4 space-y-2">
          <p className="text-[10px] text-muted-foreground mb-3">{t("onboarding.slide2.intro")}</p>
          {examplePrompts.map((p, i) => (
            <div key={i} className="bg-surface-2 border border-border rounded-xl px-4 py-3">
              <p className="text-xs text-foreground leading-[1.7]">「{p}」</p>
            </div>
          ))}
          <p className="text-[10px] text-muted-foreground mt-3 text-center">{t("onboarding.slide2.footer")}</p>
        </div>
      ),
    },
    {
      title: t("onboarding.slide3.title"),
      subtitle: t("onboarding.slide3.subtitle"),
      content: (
        <div className="mt-4 space-y-3">
          <div className="bg-primary/10 border border-primary/30 rounded-xl p-4">
            <p className="text-xs font-semibold text-foreground mb-2">🔒 {t("onboarding.slide3.privacy_title")}</p>
            <p className="text-[11px] text-foreground/80 leading-[1.7]">{t("onboarding.slide3.privacy_body")}</p>
          </div>
          <div className="bg-surface-2 border border-border rounded-xl p-4">
            <p className="text-xs font-semibold text-foreground mb-2">💡 {t("onboarding.slide3.start_title")}</p>
            <p className="text-[11px] text-foreground/80 leading-[1.7]">{t("onboarding.slide3.start_body")}</p>
          </div>
        </div>
      ),
    },
    {
      title: t("onboarding.slide4.title"),
      subtitle: t("onboarding.slide4.subtitle"),
      content: null, // rendered separately with navigate support
    },
  ];
}

export default function Onboarding() {
  const { t } = useLanguage();
  const [step, setStep] = useState(0);
  const [done, setDone] = useState<Set<string>>(new Set());
  const { completeOnboarding } = useLifeOs();
  const navigate = useNavigate();

  const FEATURES = getFeatures(t);
  const EXAMPLE_PROMPTS = getExamplePrompts(t);
  const ACTIVATION_TASKS = getActivationTasks(t);
  const STEPS = getSteps(t, FEATURES, EXAMPLE_PROMPTS);

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
              {t("onboarding.button.later")}
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
              {step < STEPS.length - 1 ? t("onboarding.button.next") : t("onboarding.button.start")}
              <ChevronRight size={14} />
            </button>
          </div>
        )}

        {step === 0 && (
          <button onClick={() => { if ("Notification" in window && Notification.permission === "default") Notification.requestPermission(); completeOnboarding(); }}
            className="w-full mt-3 text-center text-[10px] text-muted-foreground hover:text-foreground transition">
            {t("onboarding.button.skip")}
          </button>
        )}
      </div>
    </div>
  );
}
