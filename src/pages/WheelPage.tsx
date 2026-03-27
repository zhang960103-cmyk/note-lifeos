import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { ALL_DOMAINS, type LifeDomain } from "@/types/lifeOs";
import { ArrowLeft, Save, Sparkles, Loader2 } from "lucide-react";
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer } from "recharts";
import { format, parseISO } from "date-fns";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/life-mentor-chat`;

const WheelPage = () => {
  const { wheelScores, addWheelScore, entries } = useLifeOs();
  const navigate = useNavigate();

  const [scores, setScores] = useState<Record<LifeDomain, number>>(
    () => Object.fromEntries(ALL_DOMAINS.map(d => [d, 5])) as Record<LifeDomain, number>
  );
  const [isEvaluating, setIsEvaluating] = useState(false);
  const [blindSpots, setBlindSpots] = useState<string[]>([]);
  const [aiInsight, setAiInsight] = useState("");

  const radarData = ALL_DOMAINS.map(d => ({ domain: d, value: scores[d], fullMark: 10 }));

  const handleAiEval = async () => {
    setIsEvaluating(true);
    setBlindSpots([]);
    setAiInsight("");
    try {
      // Gather recent messages from last 7 days
      const recentEntries = entries.slice(0, 7);
      const allMessages = recentEntries.flatMap(e =>
        e.messages.map(m => ({ role: m.role, content: m.content }))
      );

      if (allMessages.length === 0) {
        setAiInsight("最近没有日记记录，请先写几天日记再来评估。");
        setIsEvaluating(false);
        return;
      }

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: allMessages, mode: "wheel-eval" }),
      });

      if (!resp.ok) throw new Error("评估失败");
      const data = await resp.json();

      if (data.scores) {
        const newScores = { ...scores };
        ALL_DOMAINS.forEach(d => {
          if (data.scores[d] !== undefined) newScores[d] = data.scores[d];
        });
        setScores(newScores);
      }
      if (data.insights) setAiInsight(data.insights);
      if (data.blind_spots) setBlindSpots(data.blind_spots);
    } catch {
      setAiInsight("评估暂时不可用，请稍后重试。");
    }
    setIsEvaluating(false);
  };

  const handleSave = () => {
    addWheelScore({ date: new Date().toISOString(), scores });
    setScores(Object.fromEntries(ALL_DOMAINS.map(d => [d, 5])) as Record<LifeDomain, number>);
    setBlindSpots([]);
    setAiInsight("");
  };

  return (
    <div className="pb-24 px-4 max-w-[600px] mx-auto overflow-y-auto h-full">
      <div className="flex items-center gap-3 py-4">
        <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-serif-sc text-lg text-foreground">生命之轮</h1>
      </div>

      {/* AI Auto Eval Button */}
      <button
        onClick={handleAiEval}
        disabled={isEvaluating}
        className="w-full bg-surface-2 border border-gold-border text-gold text-sm py-3 rounded-xl flex items-center justify-center gap-2 hover:bg-gold-light transition-all mb-4 disabled:opacity-50"
      >
        {isEvaluating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
        {isEvaluating ? "AI 正在分析你的日记..." : "🧠 AI 智能评估（基于近7天日记）"}
      </button>

      {/* AI Insight */}
      {aiInsight && (
        <div className="bg-gold-light border border-gold-border rounded-xl px-4 py-3 mb-4">
          <p className="text-xs text-gold leading-[1.8]">💡 {aiInsight}</p>
        </div>
      )}

      {/* Blind spots */}
      {blindSpots.length > 0 && (
        <div className="bg-surface-2 border border-border rounded-xl px-4 py-3 mb-4 space-y-1.5">
          <p className="text-[10px] text-muted-foreground font-mono-jb">🔍 你可能忽略了：</p>
          {blindSpots.map((spot, i) => (
            <p key={i} className="text-xs text-foreground leading-[1.8]">• {spot}</p>
          ))}
        </div>
      )}

      <div className="bg-surface-2 border border-border rounded-xl p-4 mb-5">
        <ResponsiveContainer width="100%" height={240}>
          <RadarChart data={radarData} cx="50%" cy="50%">
            <PolarGrid stroke="hsl(var(--border))" />
            <PolarAngleAxis
              dataKey="domain"
              tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
            />
            <Radar dataKey="value" stroke="hsl(39 58% 53%)" fill="hsl(39 58% 53% / 0.2)" strokeWidth={1.5} />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      <p className="text-[10px] text-muted-foreground mb-2 font-mono-jb">手动微调（可选）：</p>
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
