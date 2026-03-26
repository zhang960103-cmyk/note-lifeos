import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { ALL_DOMAINS, type LifeDomain } from "@/types/lifeOs";
import { ArrowLeft, Save } from "lucide-react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { format } from "date-fns";

const WheelPage = () => {
  const { wheelScores, addWheelScore } = useLifeOs();
  const navigate = useNavigate();

  const [scores, setScores] = useState<Record<LifeDomain, number>>(
    () => Object.fromEntries(ALL_DOMAINS.map((d) => [d, 5])) as Record<LifeDomain, number>
  );

  const radarData = ALL_DOMAINS.map((d) => ({ domain: d, value: scores[d], fullMark: 10 }));

  const handleSave = () => {
    addWheelScore({ date: new Date().toISOString(), scores });
    // Reset to 5
    setScores(Object.fromEntries(ALL_DOMAINS.map((d) => [d, 5])) as Record<LifeDomain, number>);
  };

  const latestScores = wheelScores.slice(0, 5);

  return (
    <div className="pb-24 px-4 max-w-[600px] mx-auto">
      <div className="flex items-center gap-3 py-4">
        <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-serif-sc text-lg text-white">生命之轮评分</h1>
      </div>

      {/* Live Radar Preview */}
      <div className="bg-surface-2 border border-border rounded-xl p-4 mb-5">
        <ResponsiveContainer width="100%" height={250}>
          <RadarChart data={radarData} cx="50%" cy="50%">
            <PolarGrid stroke="hsl(30 28% 11%)" />
            <PolarAngleAxis
              dataKey="domain"
              tick={{ fill: "hsl(30 12% 37%)", fontSize: 10, fontFamily: "'Noto Serif SC', serif" }}
            />
            <Radar dataKey="value" stroke="hsl(39 58% 53%)" fill="hsl(39 58% 53% / 0.2)" strokeWidth={2} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Score Sliders */}
      <div className="space-y-3 mb-5">
        {ALL_DOMAINS.map((domain) => (
          <div key={domain} className="bg-surface-2 border border-border rounded-xl p-3">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-foreground font-serif-sc">{domain}</span>
              <span className="text-gold font-mono-jb text-sm font-bold">{scores[domain]}</span>
            </div>
            <input
              type="range"
              min={1}
              max={10}
              value={scores[domain]}
              onChange={(e) => setScores((prev) => ({ ...prev, [domain]: +e.target.value }))}
              className="w-full accent-gold h-1"
            />
            <div className="flex justify-between text-[8px] text-muted-foreground font-mono-jb mt-1">
              <span>1 低</span>
              <span>5 中</span>
              <span>10 高</span>
            </div>
          </div>
        ))}
      </div>

      {/* Save */}
      <button
        onClick={handleSave}
        className="w-full bg-gold text-background font-serif-sc text-sm py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-gold/90 transition-all mb-6"
      >
        <Save size={16} />
        保存本次评分
      </button>

      {/* History */}
      {latestScores.length > 0 && (
        <div className="bg-surface-2 border border-border rounded-xl p-4">
          <h2 className="font-serif-sc text-sm text-white mb-3">历史评分</h2>
          <div className="space-y-3">
            {latestScores.map((ws, i) => (
              <div key={i} className="border-b border-border pb-3 last:border-0 last:pb-0">
                <div className="text-[10px] text-muted-foreground font-mono-jb mb-1.5">
                  {format(new Date(ws.date), "yyyy/MM/dd HH:mm")}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {ALL_DOMAINS.map((d) => (
                    <span
                      key={d}
                      className={`text-[9px] font-mono-jb px-1.5 py-0.5 rounded ${
                        ws.scores[d] >= 7
                          ? "bg-los-green-light text-los-green"
                          : ws.scores[d] >= 4
                          ? "bg-gold-light text-gold"
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
        </div>
      )}
    </div>
  );
};

export default WheelPage;
