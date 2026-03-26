import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { ALL_DOMAINS, ALGORITHM_INFO } from "@/types/lifeOs";
import { ArrowLeft } from "lucide-react";
import { subDays, isAfter, subMonths } from "date-fns";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";

const ReviewPage = () => {
  const { entries } = useLifeOs();
  const navigate = useNavigate();

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

    // Top keywords
    const kwCounts: Record<string, number> = {};
    data.forEach((e) => e.keywords.forEach((k) => (kwCounts[k] = (kwCounts[k] || 0) + 1)));
    const topKw = Object.entries(kwCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    // Empty domains
    const emptyDomains = ALL_DOMAINS.filter((d) => domainCounts[d] === 0);

    return { avgHappy, avgEmotion, domainData, leveragePct, algoList, topKw, emptyDomains, count: data.length, tasksDone: allTasks.filter(t => t.completed).length, tasksTotal: allTasks.length };
  };

  const weekStats = useMemo(() => buildStats(weekEntries), [weekEntries]);
  const monthStats = useMemo(() => buildStats(monthEntries), [monthEntries]);

  const renderSection = (title: string, stats: ReturnType<typeof buildStats>) => (
    <div className="bg-surface-2 border border-border rounded-xl p-4 mb-5">
      <h2 className="font-serif-sc text-base text-white mb-4">{title}</h2>

      {stats.count === 0 ? (
        <p className="text-muted-foreground text-xs text-center py-6">暂无数据</p>
      ) : (
        <>
          {/* Stats grid */}
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

          {/* Radar */}
          <ResponsiveContainer width="100%" height={200}>
            <RadarChart data={stats.domainData}>
              <PolarGrid stroke="hsl(30 28% 11%)" />
              <PolarAngleAxis dataKey="domain" tick={{ fill: "hsl(30 12% 37%)", fontSize: 9, fontFamily: "'Noto Serif SC', serif" }} />
              <Radar dataKey="value" stroke="hsl(39 58% 53%)" fill="hsl(39 58% 53% / 0.2)" />
            </RadarChart>
          </ResponsiveContainer>

          {/* Empty domains warning */}
          {stats.emptyDomains.length > 0 && (
            <div className="bg-los-orange-light border border-los-orange/20 rounded-lg p-3 mt-3">
              <p className="text-[11px] text-los-orange">
                ⚠️ 空白领域：{stats.emptyDomains.join("、")}——建议主动关注
              </p>
            </div>
          )}

          {/* Algo distribution */}
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

          {/* Top keywords */}
          {stats.topKw.length > 0 && (
            <div className="mt-4">
              <div className="text-[9px] text-muted-foreground font-mono-jb uppercase tracking-wider mb-1">高频关键词</div>
              <div className="flex gap-1.5 flex-wrap">
                {stats.topKw.map(([kw, count]) => (
                  <span key={kw} className="text-[10px] bg-gold-light text-gold px-2 py-0.5 rounded font-mono-jb">
                    #{kw} ×{count}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Task completion */}
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
        <h1 className="font-serif-sc text-lg text-white">数据复盘</h1>
      </div>

      {renderSection("📊 本周复盘", weekStats)}
      {renderSection("📈 本月复盘", monthStats)}
    </div>
  );
};

export default ReviewPage;
