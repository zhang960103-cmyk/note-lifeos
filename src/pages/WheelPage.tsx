import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { ALL_DOMAINS, type LifeDomain } from "@/types/lifeOs";
import { ArrowLeft, Save, Sparkles, Loader2, Plus, ChevronDown, ChevronUp, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid } from "recharts";
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

const CONFIDENCE_ICON: Record<string, string> = { high: "●", medium: "◐", low: "○" };

type DomainInsight = {
  insight: string;
  questions: string[];
  action: string;
};

type InferResult = Record<string, { score: number; reason: string; confidence: string }>;

type InsightResult = Record<string, DomainInsight> & {
  monthlyFocus?: { domain: string; reason: string; steps: string[] };
};

const WheelPage = () => {
  const { wheelScores, addWheelScore, entries, addTodoToDate, todayKey } = useLifeOs();
  const navigate = useNavigate();
  const insightRef = useRef<HTMLDivElement>(null);

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

  // Animate radar on mount
  useEffect(() => {
    const t = setTimeout(() => setRadarAnimated(true), 100);
    return () => clearTimeout(t);
  }, []);

  // Auto-infer on mount if enough data
  useEffect(() => {
    const recentEntries = entries.slice(0, 30);
    const msgCount = recentEntries.reduce((acc, e) => acc + e.messages.filter(m => m.role === "user").length, 0);
    if (msgCount >= 3) {
      handleInfer();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleInfer = async () => {
    setIsInferring(true);
    try {
      const recentEntries = entries.slice(0, 30);
      const allMessages = recentEntries.flatMap(e =>
        e.messages.filter(m => m.role === "user").map(m => ({ role: m.role, content: m.content }))
      );
      if (allMessages.length === 0) {
        setIsInferring(false);
        return;
      }

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
        if (data[d]) {
          newScores[d] = data[d].score;
          newInfer[d] = data[d];
        }
      });
      setScores(newScores);
      setInferData(newInfer);
      setAdjustedDomains(new Set());
    } catch (e) {
      console.error("Wheel inference error:", e);
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

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ messages: allMessages, mode: "wheel-insight", scores }),
      });
      if (!resp.ok) throw new Error("洞察失败");
      const data = await resp.json();
      setInsights(data);
      setTimeout(() => insightRef.current?.scrollIntoView({ behavior: "smooth" }), 300);
    } catch (e) {
      console.error("Wheel insight error:", e);
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
      id: crypto.randomUUID(),
      text: action,
      status: "todo",
      priority: "high",
      tags: ["生命之轮"],
      subTasks: [],
      recur: "none",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  };

  // Get previous scores for comparison
  const prevScores = wheelScores.length > 0 ? wheelScores[0].scores : null;

  const getScoreColor = (score: number) => {
    if (score >= 7) return "text-los-green";
    if (score >= 4) return "text-gold";
    return "text-los-red";
  };

  const getBorderColor = (score: number) => {
    if (score >= 8) return "border-l-los-green";
    if (score >= 5) return "border-l-gold";
    return "border-l-los-red";
  };

  const getTrendIcon = (domain: LifeDomain) => {
    if (!prevScores) return <Minus size={12} className="text-muted-foreground" />;
    const diff = scores[domain] - prevScores[domain];
    if (diff > 0) return <TrendingUp size={12} className="text-los-green" />;
    if (diff < 0) return <TrendingDown size={12} className="text-los-red" />;
    return <Minus size={12} className="text-muted-foreground" />;
  };

  // Radar data with score display
  const radarData = ALL_DOMAINS.map(d => ({
    domain: `${d} ${radarAnimated ? scores[d] : 0}`,
    value: radarAnimated ? scores[d] : 0,
    fullMark: 10,
  }));

  // Sorted domains by score ascending for cards
  const sortedDomains = [...ALL_DOMAINS].sort((a, b) => scores[a] - scores[b]);

  // History trend data
  const trendData = wheelScores.slice(0, 6).reverse().map(ws => ({
    date: format(parseISO(ws.date), "M/d"),
    value: ws.scores[selectedTrend] ?? 5,
  }));

  // Balance score (std dev)
  const balanceHistory = wheelScores.slice(0, 6).reverse().map(ws => {
    const vals = ALL_DOMAINS.map(d => ws.scores[d] ?? 5);
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const std = Math.sqrt(vals.reduce((a, v) => a + (v - mean) ** 2, 0) / vals.length);
    return { date: format(parseISO(ws.date), "M/d"), balance: Math.round((10 - std) * 10) / 10 };
  });

  return (
    <div className="pb-24 px-4 max-w-[600px] mx-auto overflow-y-auto h-full">
      {/* Header D-8 */}
      <div className="flex items-center gap-3 py-4">
        <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h1 className="font-serif-sc text-lg text-foreground">🧭 生命之轮 · 今日状态</h1>
          <p className="text-[10px] text-muted-foreground font-mono-jb">{format(new Date(), "yyyy年M月d日")}</p>
        </div>
      </div>

      {/* Layer 1: Auto inference loading */}
      {isInferring && (
        <div className="bg-surface-2 border border-border rounded-xl px-4 py-6 mb-4 flex flex-col items-center gap-2">
          <Loader2 size={20} className="animate-spin text-gold" />
          <p className="text-xs text-muted-foreground">罗盘正在读取你最近的状态...</p>
        </div>
      )}

      {/* Layer 2: Radar chart with animation */}
      <div className="bg-surface-2 border border-border rounded-xl p-4 mb-4" style={{ transition: "all 0.8s ease-out" }}>
        <ResponsiveContainer width="100%" height={260}>
          <RadarChart data={radarData} cx="50%" cy="50%">
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis
              dataKey="domain"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }}
            />
            {/* Previous scores as dashed overlay */}
            {prevScores && (
              <Radar
                dataKey="prev"
                data={ALL_DOMAINS.map(d => ({ domain: d, prev: prevScores[d] }))}
                stroke="hsl(var(--muted-foreground))"
                fill="none"
                strokeDasharray="4 4"
                strokeWidth={1}
              />
            )}
            <Radar
              dataKey="value"
              stroke="hsl(39 58% 53%)"
              fill="hsl(39 58% 53% / 0.2)"
              strokeWidth={1.5}
              isAnimationActive={true}
              animationDuration={800}
              animationEasing="ease-out"
            />
          </RadarChart>
        </ResponsiveContainer>
        {prevScores && (
          <p className="text-[9px] text-muted-foreground text-center mt-1 font-mono-jb">虚线 = 上次评分</p>
        )}
      </div>

      {/* Sliders with inference labels */}
      <p className="text-[10px] text-muted-foreground mb-2 font-mono-jb">
        {Object.keys(inferData).length > 0 ? "AI 已推断初始分值，可手动微调：" : "手动调整各维度评分："}
      </p>
      <div className="space-y-2 mb-4">
        {ALL_DOMAINS.map(domain => (
          <div key={domain} className="bg-surface-2 border border-border rounded-xl px-4 py-2.5">
            <div className="flex items-center gap-3">
              <span className="text-xs text-foreground font-serif-sc w-16 flex-shrink-0">{domain}</span>
              <input
                type="range"
                min={1}
                max={10}
                value={scores[domain]}
                onChange={e => handleAdjustScore(domain, +e.target.value)}
                className="flex-1 accent-gold h-1"
              />
              <span className={`font-mono-jb text-sm w-5 text-right ${getScoreColor(scores[domain])}`}>
                {scores[domain]}
              </span>
            </div>
            {/* Inference annotation */}
            {inferData[domain] && (
              <div className="flex items-center gap-1 mt-1">
                <span className="text-[9px] text-muted-foreground font-mono-jb">
                  {adjustedDomains.has(domain) ? "已调整" : `AI推断 ${CONFIDENCE_ICON[inferData[domain].confidence] || "○"}`}
                </span>
                <span className="text-[9px] text-muted-foreground/60 truncate">
                  {inferData[domain].reason}
                </span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Save & Get Insights button */}
      <button
        onClick={handleSave}
        disabled={isLoadingInsight}
        className="w-full bg-gold text-background text-sm py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-gold/90 transition-all mb-6 disabled:opacity-50"
      >
        {isLoadingInsight ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
        {isLoadingInsight ? "正在生成洞察..." : "保存并获取洞察"}
      </button>

      {/* Layer 3-5: Dimension insight cards */}
      {insights && (
        <div ref={insightRef} className="space-y-3 mb-6">
          <h2 className="text-xs text-gold font-mono-jb">🔮 维度洞察（按分值升序）</h2>
          {sortedDomains.map(domain => {
            const data = insights[domain] as DomainInsight | undefined;
            if (!data) return null;
            const expanded = expandedCards.has(domain);
            return (
              <div
                key={domain}
                className={`bg-surface-2 border border-border rounded-xl overflow-hidden border-l-4 ${getBorderColor(scores[domain])}`}
              >
                {/* Card header */}
                <button
                  onClick={() => toggleCard(domain)}
                  className="w-full flex items-center justify-between px-4 py-3"
                >
                  <div className="flex items-center gap-2">
                    <span className={`font-mono-jb text-sm font-bold ${getScoreColor(scores[domain])}`}>
                      {scores[domain]}
                    </span>
                    <span className="text-sm text-foreground font-serif-sc">{domain}</span>
                    {getTrendIcon(domain)}
                  </div>
                  {expanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                </button>

                {/* Expanded content */}
                <div
                  className="overflow-hidden transition-all duration-300"
                  style={{ maxHeight: expanded ? "600px" : "0", opacity: expanded ? 1 : 0 }}
                >
                  <div className="px-4 pb-4 space-y-3">
                    {/* Sub-domains */}
                    <div className="flex gap-1 flex-wrap">
                      {SUB_DOMAINS[domain].map(sub => (
                        <span key={sub} className="text-[9px] bg-surface-1 text-muted-foreground px-2 py-0.5 rounded-full">
                          {sub}
                        </span>
                      ))}
                    </div>

                    {/* Insight */}
                    <div className="bg-surface-1 rounded-lg px-3 py-2">
                      <p className="text-[10px] text-gold font-mono-jb mb-1">🧭 罗盘洞察</p>
                      <p className="text-xs text-foreground leading-[1.8]">{data.insight}</p>
                    </div>

                    {/* Questions */}
                    <div>
                      <p className="text-[10px] text-muted-foreground font-mono-jb mb-1.5">💭 认知清单</p>
                      <div className="space-y-1.5">
                        {data.questions?.map((q, i) => (
                          <p key={i} className="text-xs text-foreground/80 leading-[1.8] pl-3 border-l-2 border-gold/30">
                            {q}
                          </p>
                        ))}
                      </div>
                    </div>

                    {/* Action */}
                    <div className="flex items-start justify-between gap-2 bg-gold-light rounded-lg px-3 py-2">
                      <div>
                        <p className="text-[10px] text-gold font-mono-jb mb-0.5">🎯 本月可做的一件事</p>
                        <p className="text-xs text-foreground leading-[1.8]">{data.action}</p>
                      </div>
                      <button
                        onClick={() => addActionToTodo(data.action)}
                        className="text-gold hover:text-gold/80 mt-1 flex-shrink-0"
                        title="加入待办"
                      >
                        <Plus size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Monthly focus */}
      {insights?.monthlyFocus && (
        <div className="bg-surface-2 border border-gold-border rounded-xl px-4 py-4 mb-6">
          <h3 className="text-xs text-gold font-mono-jb mb-2">🎯 本月聚焦</h3>
          <p className="text-sm text-foreground font-serif-sc mb-1">{insights.monthlyFocus.domain}</p>
          <p className="text-xs text-muted-foreground leading-[1.8] mb-3">{insights.monthlyFocus.reason}</p>
          <div className="space-y-1.5 mb-3">
            {insights.monthlyFocus.steps?.map((step, i) => (
              <p key={i} className="text-xs text-foreground leading-[1.8] pl-3 border-l-2 border-gold/40">
                {step}
              </p>
            ))}
          </div>
          <button
            onClick={() => {
              insights.monthlyFocus!.steps?.forEach((step, i) => {
                const now = new Date();
                const dueDate = new Date(now.getFullYear(), now.getMonth(), i === 0 ? now.getDate() + 7 : i === 1 ? now.getDate() + 21 : now.getDate() + 28);
                addActionToTodo(step);
              });
            }}
            className="w-full bg-gold text-background text-xs py-2 rounded-lg flex items-center justify-center gap-1.5 hover:bg-gold/90 transition-all"
          >
            <Sparkles size={12} /> 开始本月计划
          </button>
        </div>
      )}

      {/* History Trends D-6 */}
      {wheelScores.length > 1 && (
        <div className="mb-6">
          <h2 className="text-xs text-muted-foreground font-mono-jb mb-3">📈 历史趋势</h2>

          {/* Domain selector */}
          <div className="flex gap-1 flex-wrap mb-3">
            {ALL_DOMAINS.map(d => (
              <button
                key={d}
                onClick={() => setSelectedTrend(d)}
                className={`text-[9px] px-2 py-1 rounded-full transition-colors ${
                  selectedTrend === d ? "bg-gold text-background" : "bg-surface-2 text-muted-foreground"
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          {/* Trend line chart */}
          {trendData.length > 0 && (
            <div className="bg-surface-2 border border-border rounded-xl p-3 mb-3">
              <ResponsiveContainer width="100%" height={140}>
                <LineChart data={trendData}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} />
                  <YAxis domain={[0, 10]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} width={20} />
                  <Tooltip contentStyle={{ background: "hsl(var(--surface-2))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                  <Line type="monotone" dataKey="value" stroke="hsl(39 58% 53%)" strokeWidth={2} dot={{ fill: "hsl(39 58% 53%)", r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Balance score */}
          {balanceHistory.length > 0 && (
            <div className="bg-surface-2 border border-border rounded-xl p-3">
              <p className="text-[10px] text-muted-foreground font-mono-jb mb-2">⚖️ 整体均衡度</p>
              <ResponsiveContainer width="100%" height={100}>
                <LineChart data={balanceHistory}>
                  <CartesianGrid stroke="hsl(var(--border))" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} />
                  <YAxis domain={[0, 10]} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 9 }} width={20} />
                  <Line type="monotone" dataKey="balance" stroke="hsl(142 71% 45%)" strokeWidth={2} dot={{ fill: "hsl(142 71% 45%)", r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
              <p className="text-[9px] text-muted-foreground/60 mt-1 text-center">分数越高 = 各维度越均衡</p>
            </div>
          )}
        </div>
      )}

      {/* Simple history list */}
      {wheelScores.length > 0 && (
        <div className="space-y-2 mb-6">
          <h2 className="text-xs text-muted-foreground font-mono-jb">🗂 评分记录</h2>
          {wheelScores.slice(0, 5).map((ws, i) => (
            <div key={i} className="bg-surface-2 border border-border rounded-xl px-4 py-3">
              <div className="text-[10px] text-muted-foreground font-mono-jb mb-1.5">
                {format(parseISO(ws.date), "M月d日")}
              </div>
              <div className="flex gap-1 flex-wrap">
                {ALL_DOMAINS.map(d => (
                  <span
                    key={d}
                    className={`text-[9px] font-mono-jb px-1.5 py-0.5 rounded ${
                      ws.scores[d] >= 7 ? "bg-los-green-light text-los-green"
                        : ws.scores[d] >= 4 ? "bg-gold-light text-gold"
                        : "bg-los-red-light text-los-red"
                    }`}
                  >
                    {d} {ws.scores[d]}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WheelPage;
