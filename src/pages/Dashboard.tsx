import { useLifeOs } from "@/contexts/LifeOsContext";
import { ALL_DOMAINS, ALGORITHM_INFO } from "@/types/lifeOs";
import { Link } from "react-router-dom";
import { PenLine, TrendingUp, Target } from "lucide-react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { useMemo } from "react";
import { format, subDays, isAfter } from "date-fns";
import TodoSummary from "@/components/TodoSummary";
import ReminderSettings from "@/components/ReminderSettings";

const Dashboard = () => {
  const { entries } = useLifeOs();

  const weekEntries = useMemo(() => {
    const cutoff = subDays(new Date(), 7);
    return entries.filter((e) => isAfter(new Date(e.createdAt), cutoff));
  }, [entries]);

  const avgHappiness = useMemo(() => {
    if (!weekEntries.length) return 0;
    return +(weekEntries.reduce((s, e) => s + e.happinessScore, 0) / weekEntries.length).toFixed(1);
  }, [weekEntries]);

  const avgEmotion = useMemo(() => {
    if (!weekEntries.length) return 0;
    return +(weekEntries.reduce((s, e) => s + e.emotionScore, 0) / weekEntries.length).toFixed(1);
  }, [weekEntries]);

  const domainData = useMemo(() => {
    const counts: Record<string, number> = {};
    ALL_DOMAINS.forEach((d) => (counts[d] = 0));
    weekEntries.forEach((e) => e.domains.forEach((d) => (counts[d] = (counts[d] || 0) + 1)));
    const max = Math.max(...Object.values(counts), 1);
    return ALL_DOMAINS.map((d) => ({ domain: d, value: Math.round((counts[d] / max) * 10) || 0, fullMark: 10 }));
  }, [weekEntries]);

  const leverageRatio = useMemo(() => {
    const allTasks = weekEntries.flatMap((e) => e.tasks);
    const system = allTasks.filter((t) => t.type === "建系统").length;
    const sell = allTasks.filter((t) => t.type === "卖时间").length;
    const total = system + sell;
    return total ? Math.round((system / total) * 100) : 0;
  }, [weekEntries]);

  const algoDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    weekEntries.forEach((e) => (counts[e.algorithm] = (counts[e.algorithm] || 0) + 1));
    return Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5);
  }, [weekEntries]);

  return (
    <div className="pb-20 px-4 max-w-[600px] mx-auto">
      {/* Header */}
      <div className="pt-6 pb-4 text-center">
        <div className="inline-flex items-center gap-2 border border-gold-border text-gold px-3 py-1 rounded-full font-mono-jb text-[9px] tracking-[2px] uppercase mb-3">
          <span className="w-1.5 h-1.5 rounded-full bg-los-green animate-pulse-dot" />
          LIFE OS v4.1
        </div>
        <h1 className="font-serif-sc text-2xl text-white">生命罗盘</h1>
        <p className="text-muted-foreground text-xs mt-1">{format(new Date(), "yyyy年M月d日 EEEE")}</p>
      </div>

      {/* Quick Action */}
      <Link
        to="/diary"
        className="flex items-center gap-3 bg-gold-light border border-gold-border rounded-xl p-4 mb-5 group hover:bg-gold/10 transition-all"
      >
        <div className="w-10 h-10 rounded-full bg-gold flex items-center justify-center text-background">
          <PenLine size={18} />
        </div>
        <div>
          <div className="text-white text-sm font-medium">开始写日记</div>
          <div className="text-muted-foreground text-[11px]">AI 会自动选择最适合的算法</div>
        </div>
      </Link>

      {/* Stats Row */}
      <div className="grid grid-cols-4 gap-2 mb-5">
        {[
          { label: "本周日记", value: weekEntries.length, unit: "篇" },
          { label: "平均幸福", value: avgHappiness, unit: "/10" },
          { label: "情绪均分", value: avgEmotion, unit: "/10" },
          { label: "杠杆比", value: leverageRatio, unit: "%" },
        ].map(({ label, value, unit }) => (
          <div key={label} className="bg-surface-2 border border-border rounded-lg p-3 text-center">
            <div className="font-serif-sc text-xl text-gold leading-none">
              {value}<span className="text-xs text-muted-foreground">{unit}</span>
            </div>
            <div className="text-[9px] text-muted-foreground font-mono-jb mt-1 uppercase tracking-wider">{label}</div>
          </div>
        ))}
      </div>

      {/* Todo Summary */}
      <TodoSummary />

      {/* Life Wheel */}
      <div className="bg-surface-2 border border-border rounded-xl p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Target size={14} className="text-gold" />
          <h2 className="font-serif-sc text-sm text-white">本周生命之轮</h2>
        </div>
        {weekEntries.length > 0 ? (
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={domainData} cx="50%" cy="50%">
              <PolarGrid stroke="hsl(30 28% 11%)" />
              <PolarAngleAxis
                dataKey="domain"
                tick={{ fill: "hsl(30 12% 37%)", fontSize: 10, fontFamily: "'Noto Serif SC', serif" }}
              />
              <Radar dataKey="value" stroke="hsl(39 58% 53%)" fill="hsl(39 58% 53% / 0.2)" />
            </RadarChart>
          </ResponsiveContainer>
        ) : (
          <div className="text-center py-10 text-muted-foreground text-xs">
            还没有日记数据，开始写第一篇吧 ✨
          </div>
        )}
      </div>

      {/* Algorithm Distribution */}
      {algoDistribution.length > 0 && (
        <div className="bg-surface-2 border border-border rounded-xl p-4 mb-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp size={14} className="text-gold" />
            <h2 className="font-serif-sc text-sm text-white">本周算法使用</h2>
          </div>
          <div className="space-y-2">
            {algoDistribution.map(([algo, count]) => {
              const info = ALGORITHM_INFO[algo as keyof typeof ALGORITHM_INFO];
              if (!info) return null;
              const pct = Math.round((count / weekEntries.length) * 100);
              return (
                <div key={algo} className="flex items-center gap-2">
                  <span className="text-sm w-5">{info.icon}</span>
                  <span className="text-xs text-foreground flex-1">{info.name}</span>
                  <div className="w-24 h-1.5 bg-border rounded-full overflow-hidden">
                    <div className="h-full bg-gold rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono-jb w-8 text-right">{count}次</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Reminder Settings */}
      <ReminderSettings />

      {/* Recent Entries */}
      <div className="mb-5 mt-5">
        <h2 className="font-serif-sc text-sm text-white mb-3">最近日记</h2>
        {entries.length === 0 ? (
          <div className="bg-surface-2 border border-border rounded-xl p-6 text-center text-muted-foreground text-xs">
            空空如也，去写第一篇日记吧 🌟
          </div>
        ) : (
          <div className="space-y-2">
            {entries.slice(0, 5).map((entry) => {
              const info = ALGORITHM_INFO[entry.algorithm];
              return (
                <Link
                  key={entry.id}
                  to={`/history?id=${entry.id}`}
                  className="block bg-surface-2 border border-border rounded-lg p-3 hover:border-gold-border transition-all"
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm">{info.icon}</span>
                    <span className="text-[10px] text-gold font-mono-jb">{info.name}</span>
                    <span className="text-[10px] text-muted-foreground font-mono-jb ml-auto">
                      {format(new Date(entry.createdAt), "M/d HH:mm")}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground line-clamp-2">{entry.content}</p>
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {entry.domains.map((d) => (
                      <span key={d} className="text-[9px] bg-gold-light text-gold px-1.5 py-0.5 rounded font-mono-jb">
                        {d}
                      </span>
                    ))}
                    <span className="text-[9px] text-muted-foreground font-mono-jb ml-auto">
                      😊{entry.happinessScore} 💭{entry.emotionScore}
                    </span>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
