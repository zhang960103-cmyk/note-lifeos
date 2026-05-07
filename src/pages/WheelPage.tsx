import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { ALL_DOMAINS, type LifeDomain } from "@/types/lifeOs";
import { ArrowLeft, Save, Sparkles, Loader2, Plus, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus, BarChart3, Target, History, Lightbulb } from "lucide-react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, AreaChart, Area } from "recharts";
import { format, parseISO } from "date-fns";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/life-mentor-chat`;

const SUB_DOMAINS: Record<LifeDomain, string[]> = {
  "学习成长": ["知识积累", "技能精进", "思维升级", "输出创作"],
  "事业财务": ["收入来源", "职业发展", "财务健康", "影响力建设"],
  "身心健康": ["体能精力", "睡眠质量", "情绪稳定", "心理韧性"],
  "感情婚姻": ["亲密关系质量", "沟通深度", "共同成长", "安全感"],
  "家庭关系": ["与父母关系", "家庭氛围", "责任履行", "归属感"],
  "社会连接": ["友谊质量", "社群参与", "人脉价值", "贡献感"],
  "人生意义": ["价值观清晰度", "使命方向", "日常满足感", "未来愿景"],
};

const DOMAIN_EMOJI: Record<LifeDomain, string> = {
  "学习成长": "📚", "事业财务": "💼", "身心健康": "🏃", "感情婚姻": "💕",
  "家庭关系": "🏠", "社会连接": "🤝", "人生意义": "🌟",
};

const CONFIDENCE_ICON: Record<string, string> = { high: "●", medium: "◐", low: "○" };

type DomainInsight = { insight: string; questions: string[]; action: string };
type InferResult = Record<string, { score: number; reason: string; confidence: string }>;
type InsightResult = Record<string, DomainInsight> & {
  monthlyFocus?: { domain: string; reason: string; steps: string[] };
};

type TabKey = "scores" | "insights" | "trends" | "history";

const WheelPage = () => {
  const { wheelScores, addWheelScore, entries, addTodoToDate, todayKey } = useLifeOs();
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
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ messages: allMessages, mode: "wheel-inference" }),
      });
      if (!resp.ok) throw new Error("推断失败");
      const data = await resp.json();
      const newScores = { ...scores };
      const newInfer: InferResult = {};
      ALL_DOMAINS.forEach(d => {
        if (data[d]) { newScores[d] = data[d].score; newInfer[d] = data[d]; }
      });
      setScores(newScores);
      setInferData(newInfer);
      setAdjustedDomains(new Set());
    } catch (e) { console.error("Wheel inference error:", e); }
    setIsInferring(false);
  };

  const handleGetInsights = async () => {
    setIsLoadingInsight(true);
    try {
      const recentEntries = entries.slice(0, 30);
      const allMessages = recentEntries.flatMap(e =>
        e.messages.filter(m => m.role === "user").map(m => ({ role: m.role, content: m.content }))
      );
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ messages: allMessages, mode: "wheel-insight", scores }),
      });
      if (!resp.ok) throw new Error("洞察失败");
      const data = await resp.json();
      setInsights(data);
      setActiveTab("insights");
      setTimeout(() => insightRef.current?.scrollIntoView({ behavior: "smooth" }), 300);
    } catch (e) { console.error("Wheel insight error:", e); }
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
    { key: "scores", label: "评分", icon: <Target size={14} /> },
    { key: "insights", label: "洞察", icon: <Lightbulb size={14} /> },
    { key: "trends", label: "趋势", icon: <BarChart3 size={14} /> },
    { key: "history", label: "记录", icon: <History size={14} /> },
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
            <h1 className="font-serif-sc text-base text-foreground">生命之轮</h1>
            <p className="text-caption text-muted-foreground">{format(new Date(), "yyyy年M月d日")}</p>
          </div>
        </div>
        {!isInferring && (
          <div className="text-right">
            <span className="text-xl font-mono-jb text-gold font-bold">{avgScore}</span>
            <p className="text-label text-muted-foreground">综合均分</p>
            </div>
          )}
      </div>

      {/* Quick stats row */}
      {!isInferring && (
        <div className="grid grid-cols-3 gap-2 mb-3 px-4 pt-3">
            <div className="bg-surface-2 border border-border rounded-lg px-2.5 py-2 text-center">
              <p className="text-[9px] text-muted-foreground mb-0.5">最强维度</p>
              <p className="text-xs font-serif-sc text-los-green truncate">{DOMAIN_EMOJI[highestDomain]} {highestDomain}</p>
              <p className={`text-sm font-mono-jb font-bold text-los-green`}>{scores[highestDomain]}</p>
            </div>
            <div className="bg-surface-2 border border-border rounded-lg px-2.5 py-2 text-center">
              <p className="text-[9px] text-muted-foreground mb-0.5">需关注</p>
              <p className="text-xs font-serif-sc text-los-red truncate">{DOMAIN_EMOJI[lowestDomain]} {lowestDomain}</p>
              <p className={`text-sm font-mono-jb font-bold text-los-red`}>{scores[lowestDomain]}</p>
            </div>
            <div className="bg-surface-2 border border-border rounded-lg px-2.5 py-2 text-center">
              <p className="text-[9px] text-muted-foreground mb-0.5">评测次数</p>
              <p className="text-sm font-mono-jb font-bold text-foreground mt-1">{wheelScores.length}</p>
            </div>
          </div>
      )}

      {/* Loading state */}
      {isInferring && (
        <div className="mx-4 bg-surface-2 border border-border rounded-xl px-4 py-8 mb-4 flex flex-col items-center gap-3">
          <Loader2 size={24} className="animate-spin text-gold" />
          <p className="text-xs text-muted-foreground">罗盘正在读取你最近的状态...</p>
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
                    {payload.value} {scores[payload.value as LifeDomain]}
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
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-los-red" /> 1-3 待提升</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gold" /> 4-6 发展中</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-los-green" /> 7-10 优秀</span>
            {prevScores && <span className="border-b border-dashed border-muted-foreground px-2">上次</span>}
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
              {Object.keys(inferData).length > 0 ? "AI 已推断，可手动微调 ↕" : "手动调整各维度评分："}
            </p>
            <div className="grid grid-cols-1 gap-1.5 mb-4">
              {ALL_DOMAINS.map(domain => (
                <div key={domain} className="bg-surface-2 border border-border rounded-lg px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="text-sm">{DOMAIN_EMOJI[domain]}</span>
                    <span className="text-xs text-foreground font-serif-sc w-14 flex-shrink-0">{domain}</span>
                    <input type="range" min={1} max={10} value={scores[domain]}
                      onChange={e => handleAdjustScore(domain, +e.target.value)}
                      className="flex-1 accent-gold h-1" />
                    <span className={`font-mono-jb text-sm w-5 text-right font-bold ${getScoreColor(scores[domain])}`}>
                      {scores[domain]}
                    </span>
                    {getTrendIcon(domain)}
                  </div>
                  {inferData[domain] && (
                    <p className="text-[9px] text-muted-foreground/70 mt-0.5 pl-7 truncate">
                      {adjustedDomains.has(domain) ? "✓ 已调整" : `${CONFIDENCE_ICON[inferData[domain].confidence]} ${inferData[domain].reason}`}
                    </p>
                  )}
                </div>
              ))}
            </div>

            <button onClick={handleSave} disabled={isLoadingInsight}
              className="w-full bg-gold text-background text-sm py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-gold/90 transition-all mb-4 disabled:opacity-50 font-medium">
              {isLoadingInsight ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
              {isLoadingInsight ? "正在生成洞察..." : "保存并获取洞察"}
            </button>
          </>
        )}

        {/* === Insights Tab === */}
        {activeTab === "insights" && (
          <div ref={insightRef}>
            {!insights ? (
              <div className="bg-surface-2 border border-border rounded-xl p-8 text-center">
                <Lightbulb size={32} className="mx-auto text-muted-foreground mb-3 opacity-40" />
                <p className="text-sm text-muted-foreground mb-3">保存评分后自动生成洞察</p>
                <button onClick={() => setActiveTab("scores")} className="text-xs text-gold hover:underline">
                  ← 返回评分
                </button>
              </div>
            ) : (
              <div className="space-y-2.5 mb-4">
                {/* Monthly focus card */}
                {insights.monthlyFocus && (
                  <div className="bg-surface-2 border border-gold/30 rounded-xl p-4 mb-2">
                    <div className="flex items-center gap-2 mb-2">
                      <Target size={14} className="text-gold" />
                      <h3 className="text-xs text-gold font-mono-jb font-medium">本月聚焦</h3>
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
                      <Sparkles size={12} /> 加入月度计划
                    </button>
                  </div>
                )}

                {/* Domain insight cards */}
                <p className="text-[10px] text-muted-foreground font-mono-jb">🔮 维度洞察（按分值升序）</p>
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
                          <span className="text-sm text-foreground font-serif-sc">{domain}</span>
                          {getTrendIcon(domain)}
                        </div>
                        {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                      </button>
                      <div className="overflow-hidden transition-all duration-300" style={{ maxHeight: expanded ? "600px" : "0", opacity: expanded ? 1 : 0 }}>
                        <div className="px-3 pb-3 space-y-2.5">
                          <div className="flex gap-1 flex-wrap">
                            {SUB_DOMAINS[domain].map(sub => (
                              <span key={sub} className="text-[9px] bg-surface-1 text-muted-foreground px-2 py-0.5 rounded-full">{sub}</span>
                            ))}
                          </div>
                          <div className="bg-surface-1 rounded-lg px-3 py-2">
                            <p className="text-xs text-foreground leading-relaxed">{data.insight}</p>
                          </div>
                          <div>
                            <p className="text-[10px] text-muted-foreground font-mono-jb mb-1">💭 认知清单</p>
                            <div className="space-y-1">
                              {data.questions?.map((q, i) => (
                                <p key={i} className="text-xs text-foreground/80 leading-relaxed pl-3 border-l-2 border-gold/30">{q}</p>
                              ))}
                            </div>
                          </div>
                          <div className="flex items-start justify-between gap-2 bg-gold/10 rounded-lg px-3 py-2">
                            <div>
                              <p className="text-[10px] text-gold font-mono-jb mb-0.5">🎯 本月行动</p>
                              <p className="text-xs text-foreground leading-relaxed">{data.action}</p>
                            </div>
                            <button onClick={() => addActionToTodo(data.action)} className="text-gold hover:text-gold/80 mt-1 flex-shrink-0" title="加入待办">
                              <Plus size={16} />
                            </button>
                          </div>
                          {/* 低分维度关联目标 */}
                          {scores[domain] <= 5 && (
                            <button onClick={() => navigate("/goals")}
                              className="w-full flex items-center gap-2 text-left px-3 py-2 bg-surface-1 rounded-lg hover:bg-surface-2 transition">
                              <Target size={12} className="text-primary flex-shrink-0" />
                              <span className="text-caption text-muted-foreground">
                                {domain} 评分较低，设置一个季度目标来改善 →
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
                <p className="text-sm text-muted-foreground">需要至少 2 次评分记录</p>
                <p className="text-[10px] text-muted-foreground/60 mt-1">保存当前评分后再回来查看趋势</p>
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
                      {DOMAIN_EMOJI[d]} {d}
                    </button>
                  ))}
                </div>

                {/* Trend chart */}
                <div className="bg-surface-2 border border-border rounded-xl p-3">
                  <p className="text-[10px] text-muted-foreground font-mono-jb mb-2">
                    {DOMAIN_EMOJI[selectedTrend]} {selectedTrend} 趋势
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
                    const trend = vals[vals.length - 1] > vals[0] ? "📈 上升" : vals[vals.length - 1] < vals[0] ? "📉 需关注" : "→ 稳定";
                    return (
                      <div className="flex items-center justify-between mt-2 text-[9px] text-muted-foreground">
                        <span>最低 {Math.min(...vals)} · 最高 {Math.max(...vals)}</span>
                        <span>{trend}</span>
                      </div>
                    );
                  })()}
                </div>

                {/* Balance chart */}
                {balanceHistory.length > 0 && (
                  <div className="bg-surface-2 border border-border rounded-xl p-3">
                    <p className="text-[10px] text-muted-foreground font-mono-jb mb-2">⚖️ 整体均衡度</p>
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
                    <p className="text-[9px] text-muted-foreground/60 mt-1 text-center">越高 = 各维度越均衡</p>
                  </div>
                )}

                {/* All domains overview */}
                <div className="bg-surface-2 border border-border rounded-xl p-3">
                  <p className="text-[10px] text-muted-foreground font-mono-jb mb-2">📊 全维度对比</p>
                  <div className="space-y-1.5">
                    {sortedDomains.map(d => (
                      <div key={d} className="flex items-center gap-2">
                        <span className="text-[10px] w-14 text-muted-foreground truncate font-serif-sc">{d}</span>
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
                <p className="text-sm text-muted-foreground">暂无评分记录</p>
              </div>
            ) : (
              wheelScores.slice(0, 10).map((ws, i) => {
                const vals = ALL_DOMAINS.map(d => ws.scores[d] ?? 5);
                const avg = (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
                return (
                  <div key={i} className="bg-surface-2 border border-border rounded-xl px-3 py-2.5">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[10px] text-muted-foreground font-mono-jb">
                        {format(parseISO(ws.date), "yyyy年M月d日")}
                      </span>
                      <span className="text-xs font-mono-jb text-gold font-bold">均分 {avg}</span>
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
