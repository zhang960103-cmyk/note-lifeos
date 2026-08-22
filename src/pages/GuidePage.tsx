import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight, Sparkles, BookOpen, Clock, Zap, Target, MessageSquare, BarChart3, Heart } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const APP_VERSION = "2.2.0";

type T = (key: string) => string;

function getSections(t: T) {
  return [
    {
      id: "core",
      icon: <Sparkles size={16} />,
      title: t("guide.section.core.title"),
      content: (
        <div className="space-y-3">
          <p className="text-sm text-foreground leading-relaxed">
            {t("guide.core.philosophy_prefix")}
            <span className="text-primary font-medium">{t("guide.core.philosophy_highlight")}</span>
          </p>
          <div className="grid grid-cols-3 gap-2 text-center">
            {[
              { emoji: "💬", label: t("guide.core.step1") },
              { emoji: "🤖", label: t("guide.core.step2") },
              { emoji: "✅", label: t("guide.core.step3") },
            ].map(s => (
              <div key={s.label} className="bg-muted rounded-xl py-3">
                <div className="text-xl mb-1">{s.emoji}</div>
                <div className="text-[10px] text-muted-foreground">{s.label}</div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t("guide.core.footer")}
          </p>
        </div>
      ),
    },
    {
      id: "quick",
      icon: <Zap size={16} />,
      title: t("guide.section.quick.title"),
      content: (
        <div className="space-y-2">
          {[
            { step: "1", text: t("guide.quick.step1.text"), sub: t("guide.quick.step1.sub") },
            { step: "2", text: t("guide.quick.step2.text"), sub: t("guide.quick.step2.sub") },
            { step: "3", text: t("guide.quick.step3.text"), sub: t("guide.quick.step3.sub") },
            { step: "4", text: t("guide.quick.step4.text"), sub: t("guide.quick.step4.sub") },
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
      title: t("guide.section.features.title"),
      content: (
        <FeatureMap />
      ),
    },
    {
      id: "commands",
      icon: <MessageSquare size={16} />,
      title: t("guide.section.commands.title"),
      content: (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground mb-2">{t("guide.commands.intro")}</p>
          {[
            { cmd: "/story", desc: t("guide.commands.story") },
            { cmd: "/wheel", desc: t("guide.commands.wheel") },
            { cmd: "/odyssey", desc: t("guide.commands.odyssey") },
            { cmd: "/elder", desc: t("guide.commands.elder") },
            { cmd: "/fear", desc: t("guide.commands.fear") },
            { cmd: "/review", desc: t("guide.commands.review") },
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
      title: t("guide.section.algorithms.title"),
      content: (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground mb-1">{t("guide.algorithms.intro")}</p>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { emoji: "📖", title: t("guide.algorithms.item1.title"), trigger: t("guide.algorithms.item1.trigger") },
              { emoji: "🌅", title: t("guide.algorithms.item2.title"), trigger: t("guide.algorithms.item2.trigger") },
              { emoji: "💔", title: t("guide.algorithms.item3.title"), trigger: t("guide.algorithms.item3.trigger") },
              { emoji: "🙏", title: t("guide.algorithms.item4.title"), trigger: t("guide.algorithms.item4.trigger") },
              { emoji: "🚀", title: t("guide.algorithms.item5.title"), trigger: t("guide.algorithms.item5.trigger") },
              { emoji: "⚖️", title: t("guide.algorithms.item6.title"), trigger: t("guide.algorithms.item6.trigger") },
              { emoji: "😨", title: t("guide.algorithms.item7.title"), trigger: t("guide.algorithms.item7.trigger") },
              { emoji: "👴", title: t("guide.algorithms.item8.title"), trigger: t("guide.algorithms.item8.trigger") },
            ].map(a => (
              <div key={a.title} className="bg-muted rounded-lg px-3 py-2">
                <div className="text-sm">{a.emoji} <span className="text-xs text-foreground">{a.title}</span></div>
                <div className="text-[9px] text-muted-foreground mt-0.5">{t("guide.algorithms.trigger_label")}: {a.trigger}</div>
              </div>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "routine",
      icon: <Clock size={16} />,
      title: t("guide.section.routine.title"),
      content: (
        <div className="space-y-3">
          {[
            { time: t("guide.routine.item1.time"), desc: t("guide.routine.item1.desc") },
            { time: t("guide.routine.item2.time"), desc: t("guide.routine.item2.desc") },
            { time: t("guide.routine.item3.time"), desc: t("guide.routine.item3.desc") },
            { time: t("guide.routine.item4.time"), desc: t("guide.routine.item4.desc") },
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
      title: t("guide.section.finance.title"),
      content: (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            {t("guide.finance.intro")}
          </p>
          <div className="bg-muted rounded-lg p-3 space-y-1.5">
            <div className="text-xs"><span className="text-los-green">✓</span> {t("guide.finance.example1")}</div>
            <div className="text-xs"><span className="text-los-green">✓</span> {t("guide.finance.example2")}</div>
            <div className="text-xs"><span className="text-destructive">✗</span> {t("guide.finance.example3")}</div>
            <div className="text-xs"><span className="text-destructive">✗</span> {t("guide.finance.example4")}</div>
          </div>
          <p className="text-[10px] text-muted-foreground">{t("guide.finance.footer")}</p>
        </div>
      ),
    },
    {
      id: "ai",
      icon: <Heart size={16} />,
      title: t("guide.section.ai.title"),
      content: (
        <div className="space-y-2">
          {[
            { emoji: "🧠", title: t("guide.ai.item1.title"), desc: t("guide.ai.item1.desc") },
            { emoji: "🔄", title: t("guide.ai.item2.title"), desc: t("guide.ai.item2.desc") },
            { emoji: "⚡", title: t("guide.ai.item3.title"), desc: t("guide.ai.item3.desc") },
            { emoji: "📚", title: t("guide.ai.item4.title"), desc: t("guide.ai.item4.desc") },
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
}

function getChangelog(t: T) {
  return [
    { v: "2.2.0", items: [t("guide.changelog.v220.item1"), t("guide.changelog.v220.item2"), t("guide.changelog.v220.item3"), t("guide.changelog.v220.item4")] },
    { v: "2.1.0", items: [t("guide.changelog.v210.item1"), t("guide.changelog.v210.item2"), t("guide.changelog.v210.item3")] },
    { v: "2.0.0", items: [t("guide.changelog.v200.item1"), t("guide.changelog.v200.item2"), t("guide.changelog.v200.item3")] },
    { v: "1.0.0", items: [t("guide.changelog.v100.item1"), t("guide.changelog.v100.item2"), t("guide.changelog.v100.item3"), t("guide.changelog.v100.item4")] },
  ];
}

function FeatureMap() {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const features = [
    { icon: "🧭", title: t("guide.features.today.title"), desc: t("guide.features.today.desc"), path: "/" },
    { icon: "✅", title: t("guide.features.todos.title"), desc: t("guide.features.todos.desc"), path: "/todos" },
    { icon: "⚖️", title: t("guide.features.wheel.title"), desc: t("guide.features.wheel.desc"), path: "/wheel" },
    { icon: "💰", title: t("guide.features.wealth.title"), desc: t("guide.features.wealth.desc"), path: "/wealth" },
    { icon: "📊", title: t("guide.features.timestats.title"), desc: t("guide.features.timestats.desc"), path: "/time-stats" },
    { icon: "🎯", title: t("guide.features.goals.title"), desc: t("guide.features.goals.desc"), path: "/goals" },
    { icon: "💡", title: t("guide.features.insights.title"), desc: t("guide.features.insights.desc"), path: "/insights" },
    { icon: "📈", title: t("guide.features.review.title"), desc: t("guide.features.review.desc"), path: "/review" },
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
  const { t } = useLanguage();
  const [openSection, setOpenSection] = useState<string | null>("core");
  const SECTIONS = getSections(t);
  const CHANGELOG = getChangelog(t);

  return (
    <div className="pb-24 px-4 max-w-[600px] mx-auto overflow-y-auto h-full">
      {/* Header */}
      <div className="flex items-center gap-3 py-4">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground transition">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="font-serif-sc text-lg text-foreground">{t("guide.title")}</h1>
          <p className="text-[9px] text-muted-foreground">v{APP_VERSION}</p>
        </div>
      </div>

      {/* Hero card */}
      <div className="bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 rounded-2xl px-5 py-5 mb-4 text-center">
        <div className="text-3xl mb-2">🧭</div>
        <p className="text-sm text-foreground font-medium">{t("guide.hero.title")}</p>
        <p className="text-xs text-muted-foreground mt-1">{t("guide.hero.tagline")}</p>
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
          📋 {t("guide.changelog.title")}
        </summary>
        <div className="px-4 pb-3 space-y-2">
          {CHANGELOG.map(v => (
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
