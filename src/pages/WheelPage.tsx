import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { ALL_DOMAINS, type LifeDomain } from "@/types/lifeOs";
import { ArrowLeft, Save } from "lucide-react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";

const WheelPage = () => {
  const { wheelScores, addWheelScore } = useLifeOs();
  const navigate = useNavigate();

  const [scores, setScores] = useState<Record<LifeDomain, number>>(
    () => Object.fromEntries(ALL_DOMAINS.map(d => [d, 5])) as Record<LifeDomain, number>
  );

  const radarData = ALL_DOMAINS.map(d => ({ domain: d, value: scores[d], fullMark: 10 }));

  const handleSave = () => {
    addWheelScore({ date: new Date().toISOString(), scores });
    setScores(Object.fromEntries(ALL_DOMAINS.map(d => [d, 5])) as Record<LifeDomain, number>);
  };

  return (
    <div className="pb-24 px-4 max-w-[600px] mx-auto">
      <div className="flex items-center gap-3 py-4">
        <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-serif-sc text-lg text-foreground">生命之轮</h1>
      </div>

      <div className="bg-surface-2 border border-border rounded-xl p-4 mb-5">
        <ResponsiveContainer width="100%" height={240}>
          <RadarChart data={radarData} cx="50%" cy="50%">
            <PolarGrid stroke="hsl(30 28% 11%)" />
            <PolarAngleAxis
              dataKey="domain"
              tick={{ fill: "hsl(30 12% 37%)", fontSize: 10, fontFamily: "'Noto Serif SC', serif" }}
            />
            <Radar dataKey="value" stroke="hsl(39 58% 53%)" fill="hsl(39 58% 53% / 0.2)" strokeWidth={1.5} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <div className="space-y-2 mb-5">
        {ALL_DOMAINS.map(domain => (
          <div key={domain} className="flex items-center gap-3 bg-surface-2 border border-border rounded-xl px-4 py-2.5">
            <span className="text-xs text-foreground font-serif-sc w-16 flex-shrink-0">{domain}</span>
            <input
              type="range"
              min={1}
              max={10}
              value={scores[domain]}
              onChange={e => setScores(prev => ({ ...prev, [domain]: +e.target.value }))}
              className="flex-1 accent-gold h-1"
            />
            <span className="text-gold font-mono-jb text-sm w-5 text-right">{scores[domain]}</span>
          </div>
        ))}
      </div>

      <button
        onClick={handleSave}
        className="w-full bg-gold text-background text-sm py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-gold/90 transition-all mb-6"
      >
        <Save size={16} /> 保存评分
      </button>

      {wheelScores.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-xs text-muted-foreground font-mono-jb">历史</h2>
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
