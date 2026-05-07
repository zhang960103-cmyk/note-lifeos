/**
 * 健康数据中心
 * 支持：手动录入 / Oura Ring OAuth / Strava OAuth / 华为导入CSV
 * 数据存入 Supabase health_metrics 表
 */
import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { format, subDays } from "date-fns";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer,
  AreaChart, Area
} from "recharts";
import {
  ChevronLeft, Heart, Moon, Activity, Footprints,
  Zap, TrendingUp, Plus, RefreshCw, Link, Check
} from "lucide-react";

interface HealthMetrics {
  date: string;
  sleepHrs: number;
  sleepEff: number;
  hrv: number;
  rhr: number;
  steps: number;
  activeMin: number;
  readinessScore: number;
  energyLevel: string; // 高/中/低
  source: "manual" | "oura" | "strava" | "huawei";
}

function localDateStr(d = new Date()) {
  return format(d, "yyyy-MM-dd");
}

const EMPTY: Omit<HealthMetrics, "date" | "source"> = {
  sleepHrs: 0, sleepEff: 0, hrv: 0, rhr: 0,
  steps: 0, activeMin: 0, readinessScore: 0, energyLevel: "中",
};

export default function HealthPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const today = localDateStr();

  const [metrics, setMetrics] = useState<HealthMetrics[]>([]);
  const [todayMetrics, setTodayMetrics] = useState<Partial<HealthMetrics>>({});
  const [showEdit, setShowEdit] = useState(false);
  const [saving, setSaving] = useState(false);
  const [connectedSources, setConnectedSources] = useState<string[]>([]);
  const [editForm, setEditForm] = useState({ ...EMPTY });

  // Load metrics from Supabase
  useEffect(() => {
    if (!user) return;
    const start = localDateStr(subDays(new Date(), 14));
    supabase.from("health_metrics")
      .select("*")
      .eq("user_id", user.id)
      .gte("date", start)
      .order("date", { ascending: false })
      .then(({ data }) => {
        if (!data) return;
        const rows: HealthMetrics[] = data.map((r: any) => ({
          date: r.date,
          sleepHrs: r.sleep_hrs || 0,
          sleepEff: r.sleep_eff || 0,
          hrv: r.hrv || 0,
          rhr: r.rhr || 0,
          steps: r.steps || 0,
          activeMin: r.active_min || 0,
          readinessScore: r.readiness_score || 0,
          energyLevel: r.energy_level || "中",
          source: r.source || "manual",
        }));
        setMetrics(rows);
        const t = rows.find(r => r.date === today);
        if (t) { setTodayMetrics(t); setEditForm({ ...t }); }
      });

    // Check connected sources from localStorage
    const sources = JSON.parse(localStorage.getItem(`health_sources_${user.id}`) || "[]");
    setConnectedSources(sources);
  }, [user, today]);

  const saveMetrics = async () => {
    if (!user) return;
    setSaving(true);
    const row = {
      user_id: user.id, date: today,
      sleep_hrs: editForm.sleepHrs, sleep_eff: editForm.sleepEff,
      hrv: editForm.hrv, rhr: editForm.rhr,
      steps: editForm.steps, active_min: editForm.activeMin,
      readiness_score: editForm.readinessScore,
      energy_level: editForm.energyLevel, source: "manual",
    };
    await supabase.from("health_metrics").upsert(row, { onConflict: "user_id,date" });
    setTodayMetrics({ ...editForm, date: today, source: "manual" });
    setShowEdit(false);
    setSaving(false);
  };

  // Chart data (last 7 days)
  const chartData = useMemo(() => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = localDateStr(subDays(new Date(), 6 - i));
      const m = metrics.find(r => r.date === d);
      return { date: d.slice(5), sleep: m?.sleepHrs || 0, hrv: m?.hrv || 0, steps: m?.steps ? Math.round(m.steps / 1000) : 0, rhr: m?.rhr || 0 };
    });
  }, [metrics]);

  const sourceLabel = (s: string) => s === "oura" ? "Oura Ring" : s === "strava" ? "Strava" : s === "huawei" ? "华为健康" : "手动";

  return (
    <div className="flex flex-col h-full max-w-[700px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 h-[52px] border-b border-border flex-shrink-0 bg-surface-1/90 backdrop-blur-sm">
        <div className="flex items-center gap-1">
          <button onClick={() => navigate(-1)} className="touch-target text-muted-foreground hover:text-foreground rounded-xl" style={{transform:"scale(0.85)"}}>
            <ChevronLeft size={22} />
          </button>
          <h1 className="font-serif-sc text-base text-foreground">健康数据</h1>
        </div>
        <button onClick={() => setShowEdit(true)} className="touch-target text-primary hover:bg-primary/10 rounded-xl" style={{transform:"scale(0.85)"}}>
          <Plus size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-none px-4 py-3 space-y-4 pb-8">

        {/* Today's metrics */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <p className="text-caption text-muted-foreground">今日 {today}</p>
            {todayMetrics.source && <span className="text-label text-muted-foreground/60">{sourceLabel(todayMetrics.source)}</span>}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { icon: <Moon size={14} className="text-los-blue" />, label: "睡眠时长", value: todayMetrics.sleepHrs ? `${todayMetrics.sleepHrs}h` : "—", sub: todayMetrics.sleepEff ? `效率${todayMetrics.sleepEff}%` : "" },
              { icon: <Heart size={14} className="text-destructive" />, label: "HRV", value: todayMetrics.hrv || "—", sub: todayMetrics.rhr ? `静息${todayMetrics.rhr}bpm` : "" },
              { icon: <Footprints size={14} className="text-los-green" />, label: "步数", value: todayMetrics.steps ? `${(todayMetrics.steps/1000).toFixed(1)}k` : "—", sub: todayMetrics.activeMin ? `活跃${todayMetrics.activeMin}分钟` : "" },
              { icon: <Zap size={14} className="text-gold" />, label: "就绪度", value: todayMetrics.readinessScore || "—", sub: todayMetrics.energyLevel ? `精力${todayMetrics.energyLevel}` : "" },
            ].map((item, i) => (
              <div key={i} className="bg-card border border-border rounded-xl p-3">
                <div className="flex items-center gap-1.5 mb-1">{item.icon}<span className="text-caption text-muted-foreground">{item.label}</span></div>
                <p className="text-xl font-mono-jb font-bold text-foreground">{item.value}</p>
                {item.sub && <p className="text-label text-muted-foreground mt-0.5">{item.sub}</p>}
              </div>
            ))}
          </div>
        </div>

        {/* 7-day trends */}
        {metrics.length > 0 && (
          <div>
            <p className="text-caption text-muted-foreground mb-2">7天趋势</p>
            <div className="space-y-3">
              <div className="bg-card border border-border rounded-xl p-3">
                <p className="text-label text-muted-foreground mb-2">睡眠 (小时)</p>
                <ResponsiveContainer width="100%" height={60}>
                  <AreaChart data={chartData} margin={{top:4,right:4,bottom:0,left:-20}}>
                    <XAxis dataKey="date" tick={{fontSize:9}} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: any) => [`${v}h`, "睡眠"]} />
                    <Area type="monotone" dataKey="sleep" stroke="hsl(211,55%,60%)" fill="hsl(211,55%,60%,0.2)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-card border border-border rounded-xl p-3">
                <p className="text-label text-muted-foreground mb-2">HRV</p>
                <ResponsiveContainer width="100%" height={60}>
                  <LineChart data={chartData} margin={{top:4,right:4,bottom:0,left:-20}}>
                    <XAxis dataKey="date" tick={{fontSize:9}} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: any) => [v, "HRV"]} />
                    <Line type="monotone" dataKey="hrv" stroke="hsl(5,71%,53%)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
              <div className="bg-card border border-border rounded-xl p-3">
                <p className="text-label text-muted-foreground mb-2">步数 (千步)</p>
                <ResponsiveContainer width="100%" height={60}>
                  <AreaChart data={chartData} margin={{top:4,right:4,bottom:0,left:-20}}>
                    <XAxis dataKey="date" tick={{fontSize:9}} axisLine={false} tickLine={false} />
                    <Tooltip formatter={(v: any) => [`${v}k步`, "步数"]} />
                    <Area type="monotone" dataKey="steps" stroke="hsl(152,41%,49%)" fill="hsl(152,41%,49%,0.2)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* Data source connections */}
        <div>
          <p className="text-caption text-muted-foreground mb-2">数据来源</p>
          <div className="space-y-2">
            {[
              { id: "oura", name: "Oura Ring", desc: "睡眠评分、HRV、就绪度", color: "text-los-blue", available: true },
              { id: "strava", name: "Strava", desc: "跑步、骑行、游泳记录", color: "text-los-orange", available: true },
              { id: "huawei", name: "华为运动健康", desc: "导入导出CSV数据", color: "text-destructive", available: true },
              { id: "apple", name: "Apple Health", desc: "需要 iOS 原生应用支持", color: "text-muted-foreground", available: false },
              { id: "garmin", name: "Garmin Connect", desc: "需要 Garmin OAuth 配置", color: "text-muted-foreground", available: false },
            ].map(source => {
              const connected = connectedSources.includes(source.id);
              return (
                <div key={source.id} className={`flex items-center gap-3 bg-card border border-border rounded-xl px-4 py-3 ${!source.available ? "opacity-40" : ""}`}>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${source.color}`}>{source.name}</p>
                    <p className="text-caption text-muted-foreground">{source.desc}</p>
                  </div>
                  {source.available ? (
                    <button
                      onClick={() => {
                        if (connected) {
                          const next = connectedSources.filter(s => s !== source.id);
                          setConnectedSources(next);
                          localStorage.setItem(`health_sources_${user?.id}`, JSON.stringify(next));
                        } else if (source.id === "huawei") {
                          // CSV import
                          const input = document.createElement("input");
                          input.type = "file"; input.accept = ".csv";
                          input.onchange = async (e) => {
                            const file = (e.target as HTMLInputElement).files?.[0];
                            if (!file || !user) return;
                            const text = await file.text();
                            const lines = text.split("\n").filter(l => l.trim());
                            let imported = 0;
                            for (const line of lines.slice(1)) {
                              const cols = line.split(",");
                              if (cols.length < 3) continue;
                              const date = cols[0]?.trim();
                              const steps = parseInt(cols[1]) || 0;
                              const sleepHrs = parseFloat(cols[2]) || 0;
                              if (!date || !date.match(/^\d{4}-\d{2}-\d{2}$/)) continue;
                              await supabase.from("health_metrics").upsert({
                                user_id: user.id, date, steps, sleep_hrs: sleepHrs, source: "huawei"
                              }, { onConflict: "user_id,date" });
                              imported++;
                            }
                            alert(`已导入 ${imported} 条华为健康数据`);
                          };
                          input.click();
                        } else {
                          // OAuth - show instructions
                          alert(`${source.name} 集成需要在 Supabase 配置 OAuth。\n\n请在设置中添加 ${source.id.toUpperCase()}_CLIENT_ID 和 ${source.id.toUpperCase()}_CLIENT_SECRET 环境变量后启用。`);
                        }
                      }}
                      className={`text-caption px-3 py-1.5 rounded-full border transition ${connected ? "bg-los-green/10 border-los-green/30 text-los-green" : "border-border text-muted-foreground hover:border-primary hover:text-primary"}`}>
                      {connected ? <><Check size={10} className="inline mr-1" />已连接</> : <><Link size={10} className="inline mr-1" />连接</>}
                    </button>
                  ) : (
                    <span className="text-label text-muted-foreground/40">暂不支持</span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* Manual entry sheet */}
      {showEdit && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-end">
          <div className="w-full max-w-[600px] mx-auto bg-surface-1 rounded-t-2xl p-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-semibold text-foreground font-serif-sc">手动录入今日健康数据</p>
              <button onClick={() => setShowEdit(false)} className="text-muted-foreground"><ChevronLeft size={16} /></button>
            </div>
            <div className="space-y-3">
              {[
                { key: "sleepHrs", label: "睡眠时长 (小时)", min: 0, max: 12, step: 0.5 },
                { key: "sleepEff", label: "睡眠效率 (%)", min: 0, max: 100, step: 1 },
                { key: "hrv", label: "HRV (ms)", min: 0, max: 200, step: 1 },
                { key: "rhr", label: "静息心率 (bpm)", min: 30, max: 120, step: 1 },
                { key: "steps", label: "步数", min: 0, max: 30000, step: 100 },
                { key: "activeMin", label: "活跃分钟数", min: 0, max: 300, step: 5 },
                { key: "readinessScore", label: "就绪评分 (0-100)", min: 0, max: 100, step: 1 },
              ].map(field => (
                <div key={field.key}>
                  <div className="flex justify-between mb-1">
                    <label className="text-caption text-muted-foreground">{field.label}</label>
                    <span className="text-caption font-mono-jb text-foreground">{(editForm as any)[field.key] || 0}</span>
                  </div>
                  <input type="range" min={field.min} max={field.max} step={field.step}
                    value={(editForm as any)[field.key] || 0}
                    onChange={e => setEditForm(f => ({ ...f, [field.key]: parseFloat(e.target.value) }))}
                    className="w-full accent-primary" />
                </div>
              ))}
              <div>
                <label className="text-caption text-muted-foreground">精力状态</label>
                <div className="flex gap-2 mt-1.5">
                  {["高", "中", "低"].map(l => (
                    <button key={l} onClick={() => setEditForm(f => ({ ...f, energyLevel: l }))}
                      className={`flex-1 py-2 rounded-xl text-sm transition ${editForm.energyLevel === l ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                      {l}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={saveMetrics} disabled={saving}
                className="w-full py-3 bg-primary text-primary-foreground rounded-xl text-sm font-medium mt-2 disabled:opacity-50">
                {saving ? "保存中…" : "保存今日数据"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
