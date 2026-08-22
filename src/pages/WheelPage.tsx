import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { ALL_DOMAINS, type LifeDomain } from "@/types/lifeOs";
import { ArrowLeft, Save, Sparkles, Loader2, Plus, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, BarChart3, Target, History, Lightbulb } from "lucide-react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area } from "recharts";
import { format, parseISO } from "date-fns";
import { callLifeMentorJSON } from "@/lib/streamChat";
import { buildMemoryContext, getKeyPatterns } from "@/lib/memoryEngine";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

const SUB_DOMAINS: Record<LifeDomain, string[]> = {
  "学习成长": ["知识积累", "技能精进", "思维升级", "输出创作"],
  "事业财务": ["收入来源", "职业发展", "财务健康", "影响力建设"],
  "身心健康": ["体能精力", "睡眠质量", "情绪稳定", "心理韧性"],
  "感情婚姻": ["亲密关系质量", "沟通深度", "共同成长", "安全感"],
  "家庭关系": ["与父母关系", "家庭氛围", "责任履行", "归属感"],
  "社会连接": ["友谊质量", "社群参与", "人脉价值", "贡献感"],
  "人生意义": ["价值观清晰度", "使命方向", "日常满足感", "未来愿景"],
};

// 子维度标签展示 key（内部仍用中文做 SUB_DOMAINS 的匹配 key，展示时走翻译）
const SUB_DOMAIN_LABEL_KEYS: Record<LifeDomain, string[]> = {
  "学习成长": ["wheel.sub_growth_knowledge", "wheel.sub_growth_skill", "wheel.sub_growth_mindset", "wheel.sub_growth_output"],
  "事业财务": ["wheel.sub_career_income", "wheel.sub_career_growth", "wheel.sub_career_finance", "wheel.sub_career_influence"],
  "身心健康": ["wheel.sub_health_energy", "wheel.sub_health_sleep", "wheel.sub_health_emotion", "wheel.sub_health_resilience"],
  "感情婚姻": ["wheel.sub_relationship_intimacy", "wheel.sub_relationship_communication", "wheel.sub_relationship_growth", "wheel.sub_relationship_security"],
  "家庭关系": ["wheel.sub_family_parents", "wheel.sub_family_atmosphere", "wheel.sub_family_responsibility", "wheel.sub_family_belonging"],
  "社会连接": ["wheel.sub_social_friendship", "wheel.sub_social_community", "wheel.sub_social_network", "wheel.sub_social_contribution"],
  "人生意义": ["wheel.sub_meaning_values", "wheel.sub_meaning_mission", "wheel.sub_meaning_fulfillment", "wheel.sub_meaning_vision"],
};

const DOMAIN_EMOJI: Record<LifeDomain, string> = {
  "学习成长": "📚", "事业财务": "💼", "身心健康": "🏃", "感情婚姻": "💕",
  "家庭关系": "🏠", "社会连接": "🤝", "人生意义": "🌟",
};

// 维度展示名 key（内部仍用中文做数据匹配 key，展示时走翻译，见下方 t(DOMAIN_LABEL_KEYS[domain]) 用法）
const DOMAIN_LABEL_KEYS: Record<LifeDomain, string> = {
  "学习成长": "wheel.domain_growth",
  "事业财务": "wheel.domain_career",
  "身心健康": "wheel.domain_health",
  "感情婚姻": "wheel.domain_relationship",
  "家庭关系": "wheel.domain_family",
  "社会连接": "wheel.domain_social",
  "人生意义": "wheel.domain_meaning",
};

const CONFIDENCE_ICON: Record<string, string> = { high: "●", medium: "◐", low: "○" };

type DomainInsight = { insight: string; questions: string[]; action: string };
type InferResult = Record<string, { score: number; reason: string; confidence: string }>;
type InsightResult = Record<string, DomainInsight> & {
  monthlyFocus?: { domain: string; reason: string; steps: string[] };
};

type TabKey = "scores" | "insights" | "trends" | "history";

const WheelPage = () => {
  const { wheelScores, addWheelScore, entries, addTodoToDate, todayKey, defaultModelProfileId } = useLifeOs();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const insightRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [scores, setScores] = useState<Record<LifeDomain, number>>(
    () => Object.fromEntries(ALL_DOMAINS.map(d => [d, 5])) as Record<LifeDomain, number>
  );
  const [inferData, setInferData] = useState<InferResult>({});
  const [adjustedDomains, setAdjustedDomains] = useState<Set<LifeDomain>>(new Set());
  const [isInferring, setIsInferring] = useState(false);
  const [insights, setInsights] = useState<InsightResult | null>(null);
  const [isLoadingInsight, setIsLoadingInsight] = useState(false);
  const [expandedCards, setExpandedCards] = useState<Set<LifeDomain>>(new Set());
  const [selectedTrend, setSelectedTrend] = useState<LifeDomain>("学习成长");
  const [radarAnimated, setRadarAnimated] = useState(false);
  const [activeTab, setActiveTab] = useState<TabKey>("scores");

  useEffect(() => { setTimeout(() => setRadarAnimated(true), 100); }, []);

  useEffect(() => {
    if (entries.length === 0) return;
    const msgCount = entries.slice(0, 30)
      .reduce((acc, e) => acc + e.messages.filter(m => m.role === "user").length, 0);
    if (msgCount >= 3 && !isInferring) handleInfer();
  }, [entries.length]); // eslint-disable-line

  const handleInfer = async () => {
    setIsInferring(true);
    try {
      const recentEntries = entries.slice(0, 30);
      const allMessages = recentEntries.flatMap(e =>
        e.messages.filter(m => m.role === "user").map(m => ({ role: m.role, content: m.content }))
      );
      if (allMessages.length === 0) { setIsInferring(false); return; }
      const memoryContext = buildMemoryContext(entries, 14);
      const patterns = getKeyPatterns(entries);
      const data = await callLifeMentorJSON<InferResult>("wheel-inference", allMessages, { memoryContext, patterns, modelProfileId: defaultModelProfileId });
      const newScores = { ...scores };
      const newInfer: InferResult = {};
      ALL_DOMAINS.forEach(d => {
        if (data[d]) { newScores[d] = data[d].score; newInfer[d] = data[d]; }
      });
      setScores(newScores);
      setInferData(newInfer);
      setAdjustedDomains(new Set());
    } catch (e) {
      console.error("Wheel inference error:", e);
      toast.error(t("wheel.toast_infer_error"), { id: "wheel-infer-error" });
    }
    setIsInferring(false);
  };

  const handleGetInsights = async () => {
    setIsLoadingInsight(true);
    try {
      const recentEntries = entries.slice(0, 30);
      const allMessages = recentEntries.flatMap(e =>
        e.messages.filter(m => m.role === "user").map(m => ({ role: m.role, content: m.content }))
      );
      const memoryContext = buildMemoryContext(entries, 14);
      const patterns = getKeyPatterns(entries);
      const data = await callLifeMentorJSON<InsightResult>("wheel-insight", allMessages, { scores, memoryContext, patterns, modelProfileId: defaultModelProfileId });
      setInsights(data);
      setActiveTab("insights");
      setTimeout(() => insightRef.current?.scrollIntoView({ behavior: "smooth" }), 300);
    } catch (e) {
      console.error("Wheel insight error:", e);
      toast.error(t("wheel.toast_insight_error"), { id: "wheel-insight-error" });
    }
    setIsLoadingInsight(false);
  };

  const handleSave = () => {
    addWheelScore({ date: new Date().toISOString(), scores });
    handleGetInsights();
  };

  const handleAdjustScore = (domain: LifeDomain, value: number) => {
    setScores(prev => ({ ...prev, [domain]: value }));
    setAdjustedDomains(prev => new Set(prev).add(domain));
  };

  const toggleCard = (domain: LifeDomain) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      next.has(domain) ? next.delete(domain) : next.add(domain);
      return next;
    });
  };

  const addActionToTodo = (action: string) => {
    addTodoToDate(todayKey, {
      id: crypto.randomUUID(), text: action, status: "todo", priority: "high",
      tags: ["生命之轮"], subTasks: [], recur: "none",
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    });
  };

  const scrollToDomainCard = (domain: string) => {
    setActiveTab("insights");
    setTimeout(() => {
      const el = cardRefs.current[domain];
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    }, 100);
  };

  const prevScores = wheelScores.length > 0 ? wheelScores[0].scores : null;

  const getScoreColor = (s: number) => s >= 7 ? "text-los-green" : s >= 4 ? "text-gold" : "text-los-red";
  const getScoreBg = (s: number) => s >= 7 ? "bg-los-green/15" : s >= 4 ? "bg-gold/15" : "bg-los-red/15";
  const getBorderColor = (s: number) => s >= 8 ? "border-l-los-green" : s >= 5 ? "border-l-gold" : "border-l-los-red";

  const getTrendIcon = (domain: LifeDomain) => {
    if (!prevScores) return null;
    const diff = scores[domain] - (prevScores[domain] ?? 5);
    if (diff > 0) return <TrendingUp size={10} className="text-los-green" />;
    if (diff < 0) return <TrendingDown size={10} className="text-los-red" />;
    return null;
  };

  const radarData = ALL_DOMAINS.map(d => ({
    domain: d,
    value: radarAnimated ? scores[d] : 0,
    prev: prevScores ? (prevScores[d] ?? 5) : null,
    fullMark: 10,
  }));

  const sortedDomains = [...ALL_DOMAINS].sort((a, b) => scores[a] - scores[b]);

  const avgScore = useMemo(() => {
    const vals = ALL_DOMAINS.map(d => scores[d]);
    return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
  }, [scores]);

  const lowestDomain = sortedDomains[0];
  const highestDomain = sortedDomains[sortedDomains.length - 1];

  const trendData = useMemo(() =>
    wheelScores.slice(0, 8).reverse().map(ws => ({
      date: format(parseISO(ws.date), "M/d"),
      value: ws.scores[selectedTrend] ?? 5,
    })),
  [wheelScores, selectedTrend]);

  const balanceHistory = useMemo(() =>
    wheelScores.slice(0, 8).reverse().map(ws => {
      const vals = ALL_DOMAINS.map(d => ws.scores[d] ?? 5);
      const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
      const std = Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / vals.length);
      return { date: format(parseISO(ws.date), "M/d"), balance: Math.round((10 - std) * 10) / 10 };
    }),
  [wheelScores]);

  const tabs: { key: TabKey; label: string; icon: React.ReactNode }[] = [
    { key: "scores", label: t("wheel.tab_scores"), icon: <Target size={14} /> },
    { key: "insights", label: t("wheel.tab_insights"), icon: <Lightbulb size={14} /> },
    { key: "trends", label: t("wheel.tab_trends"), icon: <BarChart3 size={14} /> },
    { key: "history", label: t("wheel.tab_history"), icon: <History size={14} /> },
  ];

  return (
    <div className="pb-24 max-w-[600px] mx-auto overflow-y-auto h-full">
      {/* Unified header */}
      <div className="flex items-center justify-between px-4 h-[52px] border-b border-border sticky top-0 bg-surface-1/90 backdrop-blur-sm z-10">
        <div className="flex items-center gap-1">
          <button onClick={() => navigate(-1)} className="touch-target text-muted-foreground hover:text-foreground rounded-xl" style={{transform:"scale(0.85)"}}>
            <ArrowLeft size={22} />
          </button>
          <div>
            <h1 className="font-serif-sc text-base text-foreground">{t("wheel.header_title")}</h1>
            <p className="text-caption text-muted-foreground">{format(new Date(), t("wheel.date_format"))}</p>
          </div>
        </div>
        {!isInferring && (
          <div className="text-right">
            <span className="text-xl font-mono-jb text-gold font-bold">{avgScore}</span>
            <p className="text-label text-muted-foreground">{t("wheel.avg_label")}</p>
            </div>
          )}
      </div>

      {/* Quick stats row */}
      {!isInferring && (
        <div className="grid grid-cols-3 gap-2 mb-3 px-4 pt-3">
            <div className="bg-surface-2 border border-border rounded-lg px-2.5 py-2 text-center">
              <p className="text-[9px] text-muted-foreground mb-0.5">{t("wheel.strongest_domain")}</p>
              <p className="text-xs font-serif-sc text-los-green truncate">{DOMAIN_EMOJI[highestDomain]} {t(DOMAIN_LABEL_KEYS[highestDomain])}</p>
              <p className={`text-sm font-mono-jb font-bold text-los-green`}>{scores[highestDomain]}</p>
            </div>
            <div className="bg-surface-2 border border-border rounded-lg px-2.5 py-2 text-center">
              <p className="text-[9px] text-muted-foreground mb-0.5">{t("wheel.needs_attention")}</p>
              <p className="text-xs font-serif-sc text-los-red truncate">{DOMAIN_EMOJI[lowestDomain]} {t(DOMAIN_LABEL_KEYS[lowestDomain])}</p>
              <p className={`text-sm font-mono-jb font-bold text-los-red`}>{scores[lowestDomain]}</p>
            </div>
            <div className="bg-surface-2 border border-border rounded-lg px-2.5 py-2 text-center">
              <p className="text-[9px] text-muted-foreground mb-0.5">{t("wheel.eval_count_label")}</p>
              <p className="text-sm font-mono-jb font-bold text-foreground mt-1">{wheelScores.length}</p>
            </div>
          </div>
      )}

      {/* Loading state */}
      {isInferring && (
        <div className="mx-4 bg-surface-2 border border-border rounded-xl px-4 py-8 mb-4 flex flex-col items-center gap-3">
          <Loader2 size={24} className="animate-spin text-gold" />
          <p className="text-xs text-muted-foreground">{t("wheel.loading_message")}</p>
          <div className="w-full space-y-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-3 bg-surface-3 rounded-full animate-pulse" style={{ width: `${70 + i * 10}%` }} />
            ))}
          </div>
        </div>
      )}

      {/* Radar Chart - always visible */}
      {!isInferring && (
        <div className="mx-4 bg-surface-2 border border-border rounded-xl p-3 mb-3">
          <ResponsiveContainer width="100%" height={240}>
            <RadarChart data={radarData} cx="50%" cy="50%">
              <PolarGrid stroke="hsl(var(--border))" />
              <PolarAngleAxis
                dataKey="domain"
                tick={({ x, y, payload }: any) => (
                  <text x={x} y={y} fill="hsl(var(--muted-foreground))" fontSize={9}
                    textAnchor="middle" style={{ cursor: "pointer" }}
                    onClick={() => scrollToDomainCard(payload.value)}>
                    {t(DOMAIN_LABEL_KEYS[payload.value as LifeDomain])} {scores[payload.value as LifeDomain]}
                  </text>
                )}
              />
              <Radar dataKey="value" stroke="hsl(39 58% 53%)" fill="hsl(39 58% 53% / 0.15)" strokeWidth={2}
                isAnimationActive animationDuration={800} animationEasing="ease-out" />
              {prevScores && (
                <Radar dataKey="prev" stroke="hsl(var(--muted-foreground))" fill="transparent"
                  strokeWidth={1} strokeDasharray="4 4" isAnimationActive={false} />
              )}
            </RadarChart>
          </ResponsiveContainer>
          <div className="flex items-center justify-center gap-4 text-[9px] text-muted-foreground">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-los-red" /> {t("wheel.legend_low")}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gold" /> {t("wheel.legend_mid")}</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-los-green" /> {t("wheel.legend_high")}</span>
            {prevScores && <span className="border-b border-dashed border-muted-foreground px-2">{t("wheel.legend_previous")}</span>}
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      {!isInferring && (
        <div className="mx-4 flex bg-surface-2 border border-border rounded-lg p-0.5 mb-3">
          {tabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-md text-xs transition-all ${
                activeTab === tab.key
                  ? "bg-gold text-background font-medium"
                  : "text-muted-foreground hover:text-foreground"
              }`}>
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* Tab Content */}
      <div className="px-4">
        {/* === Scores Tab === */}
        {activeTab === "scores" && !isInferring && (
          <>
            <p className="text-[10px] text-muted-foreground mb-2 font-mono-jb">
              {Object.keys(inferData).length > 0 ? t("wheel.ai_inferred_hint") : t("wheel.manual_adjust_hint")}
            </p>
            <div className="grid grid-cols-1 gap-1.5 mb-4">
              {ALL_DOMAINS.map(domain => (
                <div key={domain} className="bg-surface-2 border border-border rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{DOMAIN_EMOJI[domain]}</span>
                    <span className="text-xs text-foreground font-serif-sc w-14 flex-shrink-0">{t(DOMAIN_LABEL_KEYS[domain])}</span>
                    {/* BUG-08 根因：这个滑块旁边虽然有一个视觉上的 <span> 显示维度名称，
                        但两者之间没有任何程序化关联（没有 <label htmlFor>、aria-label
                        或 aria-labelledby）——读屏用户只能听到"滑块，7"，完全不知道这是
                        在给哪个维度打分，键盘/读屏用户可能改错维度。这里直接用
                        aria-label 关联维度名称；aria-valuetext 补充一句完整的读法
                        （"维度名：7 分，满分 10 分"），min/max/value 原生 range 语义
                        浏览器已经会自动暴露，不需要再手写 aria-valuemin/max/now。 */}
                    <input type="range" min={1} max={10} value={scores[domain]}
                      onChange={e => handleAdjustScore(domain, +e.target.value)}
                      aria-label={t(DOMAIN_LABEL_KEYS[domain])}
                      aria-valuetext={t("wheel.slider_valuetext", { domain: t(DOMAIN_LABEL_KEYS[domain]), score: scores[domain] })}
                      className="flex-1 accent-gold h-1" />
                    <span className={`font-mono-jb text-sm w-5 text-right font-bold ${getScoreColor(scores[domain])}`}>
                      {scores[domain]}
                    </span>
                    {getTrendIcon(domain)}
                  </div>
                  {inferData[domain] && (
                    <p className="text-[9px] text-muted-foreground/70 mt-0.5 pl-7 truncate">
                      {adjustedDomains.has(domain) ? t("wheel.adjusted_label") : `${CONFIDENCE_ICON[inferData[domain].confidence]} ${inferData[domain].reason}`}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <button onClick={handleSave} disabled={isLoadingInsight}
              className="w-full bg-gold text-background text-sm py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-gold/90 transition-all mb-4 disabled:opacity-50 font-medium">
              {isLoadingInsight ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {isLoadingInsight ? t("wheel.generating_insights") : t("wheel.save_and_get_insights")}
            </button>
          </>
        )}

        {/* === Insights Tab === */}
        {activeTab === "insights" && (
          <div ref={insightRef}>
            {!insights ? (
              <div className="bg-surface-2 border border-border rounded-xl p-8 text-center">
                <Lightbulb size={32} className="mx-auto text-muted-foreground mb-3 opacity-40" />
                <p className="text-sm text-muted-foreground mb-3">{t("wheel.insights_empty_hint")}</p>
                <button onClick={() => setActiveTab("scores")} className="text-xs text-gold hover:underline">
                  ← {t("wheel.back_to_scores")}
                </button>
              </div>
            ) : (
              <div className="space-y-2.5 mb-4">
                {/* Monthly focus card */}
                {insights.monthlyFocus && (
                  <div className="bg-surface-2 border border-gold/30 rounded-xl p-4 mb-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Target size={14} className="text-gold" />
                      <h3 className="text-xs text-gold font-mono-jb font-medium">{t("wheel.monthly_focus_title")}</h3>
                    </div>
                    <p className="text-sm text-foreground font-serif-sc mb-1">{insights.monthlyFocus.domain}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed mb-3">{insights.monthlyFocus.reason}</p>
                    <div className="space-y-1.5 mb-3">
                      {insights.monthlyFocus.steps?.map((step, i) => (
                        <p key={i} className="text-xs text-foreground leading-relaxed pl-3 border-l-2 border-gold/40">{step}</p>
                      ))}
                    </div>
                    <button
                      onClick={() => {
                        const now = new Date();
                        insights.monthlyFocus!.steps?.forEach((step, i) => {
                          const dueDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() + (i + 1) * 7);
                          addTodoToDate(todayKey, {
                            id: crypto.randomUUID(), text: step, status: "todo", priority: "high",
                            tags: ["生命之轮", "月度计划"], subTasks: [], recur: "none",
                            dueDate: format(dueDate, "yyyy-MM-dd"),
                            createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
                          });
                        });
                      }}
                      className="w-full bg-gold text-background text-xs py-2 rounded-lg flex items-center justify-center gap-1.5 hover:bg-gold/90 transition-all font-medium">
                      <Sparkles size={12} /> {t("wheel.add_to_monthly_plan")}
                    </button>
                  </div>
                )}

                {/* Domain insight cards */}
                <p className="text-[10px] text-muted-foreground font-mono-jb">{t("wheel.domain_insights_header")}</p>
                {sortedDomains.map(domain => {
                  const data = insights[domain] as DomainInsight | undefined;
                  if (!data) return null;
                  const expanded = expandedCards.has(domain);
                  return (
                    <div key={domain} ref={el => { cardRefs.current[domain] = el; }}
                      className={`bg-surface-2 border border-border rounded-xl overflow-hidden border-l-4 ${getBorderColor(scores[domain])}`}>
                      <button onClick={() => toggleCard(domain)} className="w-full flex items-center justify-between px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-sm">{DOMAIN_EMOJI[domain]}</span>
                          <span className={`font-mono-jb text-sm font-bold ${getScoreColor(scores[domain])}`}>{scores[domain]}</span>
                          <span className="text-sm text-foreground font-serif-sc">{t(DOMAIN_LABEL_KEYS[domain])}</span>
                          {getTrendIcon(domain)}
                        </div>
                        {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                      </button>
                      <div className="overflow-hidden transition-all duration-300" style={{ maxHeight: expanded ? "600px" : "0", opacity: expanded ? 1 : 0 }}>
                        <div className="px-3 pb-3 space-y-2.5">
                          <div className="flex gap-1 flex-wrap">
                            {SUB_DOMAIN_LABEL_KEYS[domain].map(subKey => (
                              <span key={subKey} className="text-[9px] bg-surface-1 text-muted-foreground px-2 py-0.5 rounded-full">{t(subKey)}</span>
                            ))}
                          </div>
                          <div className="bg-surface-1 rounded-lg px-3 py-2">
                            <p className="text-xs text-foreground leading-relaxed">{data.insight}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground font-mono-jb mb-1">{t("wheel.cognitive_checklist")}</p>
                            <div className="space-y-1">
                              {data.questions?.map((q, i) => (
                                <p key={i} className="text-xs text-foreground/80 leading-relaxed pl-3 border-l-2 border-gold/30">{q}</p>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-start justify-between gap-2 bg-gold/10 rounded-lg px-3 py-2">
                            <div>
                              <p className="text-[10px] text-gold font-mono-jb mb-0.5">{t("wheel.monthly_action")}</p>
                              <p className="text-xs text-foreground leading-relaxed">{data.action}</p>
                            </div>
                            <button onClick={() => addActionToTodo(data.action)} className="text-gold hover:text-gold/80 mt-1 flex-shrink-0" title={t("wheel.add_to_todo")}>
                              <Plus size={16} />
                            </button>
                          </div>
                          {/* 低分维度关联目标 */}
                          {scores[domain] <= 5 && (
                            <button onClick={() => navigate("/goals")}
                              className="w-full flex items-center gap-2 text-left px-3 py-2 bg-surface-1 rounded-lg hover:bg-surface-2 transition">
                              <Target size={12} className="text-primary flex-shrink-0" />
                              <span className="text-caption text-muted-foreground">
                                {t(DOMAIN_LABEL_KEYS[domain])} {t("wheel.low_score_suggestion")}
                              </span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* === Trends Tab === */}
        {activeTab === "trends" && (
          <div className="space-y-3 mb-4">
            {wheelScores.length < 2 ? (
              <div className="bg-surface-2 border border-border rounded-xl p-8 text-center">
                <BarChart3 size={32} className="mx-auto text-muted-foreground mb-3 opacity-40" />
                <p className="text-sm text-muted-foreground">{t("wheel.trends_need_more_data")}</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">{t("wheel.trends_save_hint")}</p>
              </div>
            ) : (
              <>
                {/* Domain selector */}
                <div className="flex gap-1 flex-wrap">
                  {ALL_DOMAINS.map(d => (
                    <button key={d} onClick={() => setSelectedTrend(d)}
                      className={`text-[10px] px-2.5 py-1 rounded-full transition-colors ${
                        selectedTrend === d ? "bg-gold text-background font-medium" : "bg-surface-2 text-muted-foreground hover:text-foreground"
                      }`}>
                      {DOMAIN_EMOJI[d]} {t(DOMAIN_LABEL_KEYS[d])}
                    </button>
                  ))}
                </div>

                {/* Trend chart */}
                <div className="bg-surface-2 border border-border rounded-xl p-3">
                  <p className="text-[10px] text-muted-foreground font-mono-jb mb-2">
                    {DOMAIN_EMOJI[selectedTrend]} {t(DOMAIN_LABEL_KEYS[selectedTrend])} {t("wheel.trend_suffix")}
                  </p>
                  <ResponsiveContainer width="100%" height={160}>
                    <AreaChart data={trendData}>
                      <defs>
                        <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(39 58% 53%)" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="hsl(39 58% 53%)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                      <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} />
                      <YAxis domain={[0, 10]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} width={20} />
                      <Tooltip contentStyle={{ background: "hsl(var(--surface-2))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                      <Area type="monotone" dataKey="value" stroke="hsl(39 58% 53%)" strokeWidth={2} fill="url(#trendGrad)" dot={{ fill: "hsl(39 58% 53%)", r: 3 }} />
                    </AreaChart>
                  </ResponsiveContainer>
                  {trendData.length >= 2 && (() => {
                    const vals = trendData.map(d => d.value);
                    const trend = vals[vals.length - 1] > vals[0] ? t("wheel.trend_rising") : vals[vals.length - 1] < vals[0] ? t("wheel.trend_declining") : t("wheel.trend_flat");
                    return (
                      <div className="flex items-center justify-between mt-2 text-[9px] text-muted-foreground">
                        <span>{t("wheel.stat_min")} {Math.min(...vals)} · {t("wheel.stat_max")} {Math.max(...vals)}</span>
                        <span>{trend}</span>
                      </div>
                    );
                  })()}
                </div>

                {/* Balance chart */}
                {balanceHistory.length > 0 && (
                  <div className="bg-surface-2 border border-border rounded-xl p-3">
                    <p className="text-[10px] text-muted-foreground font-mono-jb mb-2">{t("wheel.balance_title")}</p>
                    <ResponsiveContainer width="100%" height={120}>
                      <AreaChart data={balanceHistory}>
                        <defs>
                          <linearGradient id="balGrad" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="hsl(142 71% 45%)" stopOpacity={0.3} />
                            <stop offset="100%" stopColor="hsl(142 71% 45%)" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                        <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} />
                        <YAxis domain={[0, 10]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} width={20} />
                        <Area type="monotone" dataKey="balance" stroke="hsl(142 71% 45%)" strokeWidth={2} fill="url(#balGrad)" dot={{ fill: "hsl(142 71% 45%)", r: 3 }} />
                      </AreaChart>
                    </ResponsiveContainer>
                    <p className="text-[9px] text-muted-foreground/60 mt-1 text-center">{t("wheel.balance_hint")}</p>
                  </div>
                )}

                {/* All domains overview */}
                <div className="bg-surface-2 border border-border rounded-xl p-3">
                  <p className="text-[10px] text-muted-foreground font-mono-jb mb-2">{t("wheel.all_domains_overview")}</p>
                  <div className="space-y-1.5">
                    {sortedDomains.map(d => (
                      <div key={d} className="flex items-center gap-2">
                        <span className="text-[10px] w-14 text-muted-foreground truncate font-serif-sc">{t(DOMAIN_LABEL_KEYS[d])}</span>
                        <div className="flex-1 h-2 bg-surface-1 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all duration-500 ${
                            scores[d] >= 7 ? "bg-los-green" : scores[d] >= 4 ? "bg-gold" : "bg-los-red"
                          }`} style={{ width: `${scores[d] * 10}%` }} />
                        </div>
                        <span className={`text-[10px] font-mono-jb font-bold w-4 text-right ${getScoreColor(scores[d])}`}>{scores[d]}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* === History Tab === */}
        {activeTab === "history" && (
          <div className="space-y-2 mb-4">
            {wheelScores.length === 0 ? (
              <div className="bg-surface-2 border border-border rounded-xl p-8 text-center">
                <History size={32} className="mx-auto text-muted-foreground mb-3 opacity-40" />
                <p className="text-sm text-muted-foreground">{t("wheel.history_empty")}</p>
              </div>
            ) : (
              wheelScores.slice(0, 10).map((ws, i) => {
                const vals = ALL_DOMAINS.map(d => ws.scores[d] ?? 5);
                const avg = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
                return (
                  <div key={i} className="bg-surface-2 border border-border rounded-xl px-3 py-2.5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-muted-foreground font-mono-jb">
                        {format(parseISO(ws.date), t("wheel.date_format"))}
                      </span>
                      <span className="text-xs font-mono-jb text-gold font-bold">{t("wheel.label_avg_score")} {avg}</span>
                    </div>
                    <div className="flex gap-1 flex-wrap">
                      {ALL_DOMAINS.map(d => (
                        <span key={d} className={`text-[9px] font-mono-jb px-1.5 py-0.5 rounded ${getScoreBg(ws.scores[d] ?? 5)} ${getScoreColor(ws.scores[d] ?? 5)}`}>
                          {DOMAIN_EMOJI[d]} {ws.scores[d] ?? 5}
                        </span>
                      ))}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default WheelPage;
