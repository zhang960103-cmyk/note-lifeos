import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { ALL_DOMAINS, ALGORITHM_INFO } from "@/types/lifeOs";
import { ArrowLeft, Mail, Send, Loader2 } from "lucide-react";
import { subDays, isAfter, subMonths, format } from "date-fns";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { streamChat, type ChatMessage } from "@/lib/streamChat";
import ReactMarkdown from "react-markdown";

const LETTER_TEMPLATES = {
  weekly: {
    title: "📮 本周来信 · 生命罗盘",
    greeting: (name: string) => `亲爱的${name}，\n\n又一周过去了。让我看看你这周的足迹...`,
    closing: "你的数字参谋长，\n🧭 生命罗盘",
  },
  monthly: {
    title: "📬 月度人生审计报告",
    greeting: (name: string) => `${name}，你好。\n\n新的一月开始前，让我们一起回顾上个月的旅程...`,
    closing: "期待你下个月更好的自己。\n🧭 生命罗盘",
  },
};

const ReviewPage = () => {
  const { entries, wheelScores } = useLifeOs();
  const navigate = useNavigate();
  const [aiLetter, setAiLetter] = useState<string | null>(null);
  const [letterType, setLetterType] = useState<"weekly" | "monthly" | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const weekEntries = useMemo(() => {
    const cutoff = subDays(new Date(), 7);
    return entries.filter((e) => isAfter(new Date(e.createdAt), cutoff));
  }, [entries]);

  const monthEntries = useMemo(() => {
    const cutoff = subMonths(new Date(), 1);
    return entries.filter((e) => isAfter(new Date(e.createdAt), cutoff));
  }, [entries]);

  const buildStats = (data: typeof entries) => {
    const avgHappy = data.length ? +(data.reduce((s, e) => s + e.happinessScore, 0) / data.length).toFixed(1) : 0;
    const avgEmotion = data.length ? +(data.reduce((s, e) => s + e.emotionScore, 0) / data.length).toFixed(1) : 0;

    const domainCounts: Record<string, number> = {};
    ALL_DOMAINS.forEach((d) => (domainCounts[d] = 0));
    data.forEach((e) => e.domains.forEach((d) => (domainCounts[d] = (domainCounts[d] || 0) + 1)));
    const max = Math.max(...Object.values(domainCounts), 1);
    const domainData = ALL_DOMAINS.map((d) => ({ domain: d, value: Math.round((domainCounts[d] / max) * 10), fullMark: 10 }));

    const allTasks = data.flatMap((e) => e.tasks);
    const sys = allTasks.filter((t) => t.type === "建系统").length;
    const sell = allTasks.filter((t) => t.type === "卖时间").length;
    const total = sys + sell;
    const leveragePct = total ? Math.round((sys / total) * 100) : 0;

    const algoCounts: Record<string, number> = {};
    data.forEach((e) => (algoCounts[e.algorithm] = (algoCounts[e.algorithm] || 0) + 1));
    const algoList = Object.entries(algoCounts).sort((a, b) => b[1] - a[1]);

    const kwCounts: Record<string, number> = {};
    data.forEach((e) => e.keywords.forEach((k) => (kwCounts[k] = (kwCounts[k] || 0) + 1)));
    const topKw = Object.entries(kwCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const emptyDomains = ALL_DOMAINS.filter((d) => domainCounts[d] === 0);

    return { avgHappy, avgEmotion, domainData, leveragePct, algoList, topKw, emptyDomains, count: data.length, tasksDone: allTasks.filter(t => t.completed).length, tasksTotal: allTasks.length, sys, sell };
  };

  const weekStats = useMemo(() => buildStats(weekEntries), [weekEntries]);
  const monthStats = useMemo(() => buildStats(monthEntries), [monthEntries]);

  const generateAILetter = async (type: "weekly" | "monthly") => {
    setLetterType(type);
    setIsGenerating(true);
    setAiLetter("");

    const stats = type === "weekly" ? weekStats : monthStats;
    const data = type === "weekly" ? weekEntries : monthEntries;
    const template = LETTER_TEMPLATES[type];

    const contextMsg = `请根据以下数据生成${type === "weekly" ? "周复盘信" : "月度报告"}：
- 日记数：${stats.count}篇
- 平均幸福度：${stats.avgHappy}/10
- 平均情绪：${stats.avgEmotion}/10
- 建系统：${stats.sys}个，卖时间：${stats.sell}个（杠杆比${stats.leveragePct}%）
- 空白领域：${stats.emptyDomains.length ? stats.emptyDomains.join("、") : "无"}
- 任务完成率：${stats.tasksTotal ? Math.round((stats.tasksDone / stats.tasksTotal) * 100) : 0}%
- 高频关键词：${stats.topKw.map(([k]) => k).join("、") || "无"}
- 算法使用：${stats.algoList.map(([a, c]) => `${ALGORITHM_INFO[a as keyof typeof ALGORITHM_INFO]?.name || a}${c}次`).join("、")}
${wheelScores[0] ? `- 最新生命之轮：${ALL_DOMAINS.map(d => `${d}${wheelScores[0].scores[d]}`).join("、")}` : ""}

最近日记内容摘要：
${data.slice(0, 5).map(e => `[${format(new Date(e.createdAt), "M/d")}] ${e.content.slice(0, 80)}`).join("\n")}`;

    const msgs: ChatMessage[] = [{ role: "user", content: contextMsg }];

    let full = "";
    try {
      await streamChat({
        messages: msgs,
        mode: type === "weekly" ? "weekly-review" : "monthly-review",
        onDelta: (chunk) => {
          full += chunk;
          setAiLetter(full);
        },
        onDone: () => setIsGenerating(false),
      });
    } catch (e: any) {
      setAiLetter(`❌ ${e.message || "生成失败，请重试"}`);
      setIsGenerating(false);
    }
  };

  const renderSection = (title: string, stats: ReturnType<typeof buildStats>, type: "weekly" | "monthly") => (
    <div className="bg-surface-2 border border-border rounded-xl p-4 mb-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="font-serif-sc text-base text-foreground">{title}</h2>
        <button
          onClick={() => generateAILetter(type)}
          disabled={isGenerating || stats.count === 0}
          className="flex items-center gap-1.5 bg-gold-light border border-gold-border rounded-lg px-3 py-1.5 text-[10px] font-mono-jb text-gold hover:bg-gold/10 transition-all disabled:opacity-30"
        >
          <Mail size={12} />
          {type === "weekly" ? "生成周信" : "生成月报"}
        </button>
      </div>

      {stats.count === 0 ? (
        <p className="text-muted-foreground text-xs text-center py-6">暂无数据</p>
      ) : (
        <>
          <div className="grid grid-cols-4 gap-2 mb-4">
            {[
              { label: "日记数", value: stats.count },
              { label: "幸福均值", value: stats.avgHappy },
              { label: "情绪均值", value: stats.avgEmotion },
              { label: "杠杆比", value: `${stats.leveragePct}%` },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <div className="font-serif-sc text-lg text-gold">{value}</div>
                <div className="text-[8px] text-muted-foreground font-mono-jb uppercase tracking-wider">{label}</div>
              </div>
            ))}
          </div>

          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={stats.domainData}>
              <PolarGrid stroke="hsl(30 28% 11%)" />
              <PolarAngleAxis dataKey="domain" tick={{ fill: "hsl(30 12% 37%)", fontSize: 9, fontFamily: "'Noto Serif SC', serif" }} />
              <Radar dataKey="value" stroke="hsl(39 58% 53%)" fill="hsl(39 58% 53% / 0.2)" />
            </RadarChart>
          </ResponsiveContainer>

          {stats.emptyDomains.length > 0 && (
            <div className="bg-los-orange-light border border-los-orange/20 rounded-lg p-3 mt-3">
              <p className="text-[11px] text-los-orange">⚠️ 空白领域：{stats.emptyDomains.join("、")}——建议主动关注</p>
            </div>
          )}

          <div className="mt-4 space-y-1.5">
            <div className="text-[9px] text-muted-foreground font-mono-jb uppercase tracking-wider mb-1">算法使用分布</div>
            {stats.algoList.map(([algo, count]) => {
              const info = ALGORITHM_INFO[algo as keyof typeof ALGORITHM_INFO];
              if (!info) return null;
              return (
                <div key={algo} className="flex items-center gap-2 text-xs">
                  <span>{info.icon}</span>
                  <span className="text-foreground flex-1">{info.name}</span>
                  <span className="text-muted-foreground font-mono-jb text-[10px]">{count}次</span>
                </div>
              );
            })}
          </div>

          {stats.topKw.length > 0 && (
            <div className="mt-4">
              <div className="text-[9px] text-muted-foreground font-mono-jb uppercase tracking-wider mb-1">高频关键词</div>
              <div className="flex gap-1.5 flex-wrap">
                {stats.topKw.map(([kw, count]) => (
                  <span key={kw} className="text-[10px] bg-gold-light text-gold px-2 py-0.5 rounded font-mono-jb">#{kw} ×{count}</span>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4 text-xs text-muted-foreground">
            ✅ 任务完成率：{stats.tasksTotal > 0 ? Math.round((stats.tasksDone / stats.tasksTotal) * 100) : 0}%（{stats.tasksDone}/{stats.tasksTotal}）
          </div>
        </>
      )}
    </div>
  );

  return (
    <div className="pb-24 px-4 max-w-[600px] mx-auto">
      <div className="flex items-center gap-3 py-4">
        <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-serif-sc text-lg text-foreground">数据复盘</h1>
      </div>

      {renderSection("📊 本周复盘", weekStats, "weekly")}
      {renderSection("📈 本月复盘", monthStats, "monthly")}

      {/* AI Generated Letter */}
      {aiLetter !== null && letterType && (
        <div className="bg-surface-2 border-2 border-gold-border rounded-xl p-5 mb-5">
          <div className="flex items-center gap-2 mb-4">
            <Mail size={16} className="text-gold" />
            <h2 className="font-serif-sc text-sm text-foreground">
              {LETTER_TEMPLATES[letterType].title}
            </h2>
            {isGenerating && <Loader2 size={14} className="animate-spin text-gold ml-auto" />}
          </div>
          <div className="prose prose-sm prose-invert max-w-none text-sm leading-relaxed [&_p]:my-1.5 [&_li]:my-0.5 [&_strong]:text-gold [&_code]:text-gold [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-xs">
            <ReactMarkdown>{aiLetter}</ReactMarkdown>
          </div>
          {!isGenerating && (
            <div className="mt-4 pt-3 border-t border-border text-xs text-muted-foreground italic font-serif-sc">
              {LETTER_TEMPLATES[letterType].closing}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReviewPage;
