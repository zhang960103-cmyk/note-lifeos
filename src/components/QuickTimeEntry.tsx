import { useState, useEffect, useRef } from "react";
import { Play, Pause, StopCircle, Clock, Plus, X, Check } from "lucide-react";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";

// Category keys stay in Chinese — they're the internal data-matching values
// shared with TimeStatsPage.tsx (stored as todo tags, matched against
// TAG_TO_CATEGORY there). This lookup only controls what's rendered on screen,
// reusing the same time_stats.category_* keys TimeStatsPage already defines.
const CATEGORY_LABEL_KEYS: Record<string, string> = {
  "工作": "time_stats.category_work",
  "学习": "time_stats.category_study",
  "生活": "time_stats.category_life",
  "运动": "time_stats.category_exercise",
  "社交": "time_stats.category_social",
  "娱乐": "time_stats.category_entertainment",
  "休息": "time_stats.category_rest",
  "通勤": "time_stats.category_commute",
};

const CATEGORIES = [
  { key: "工作", emoji: "💼", color: "hsl(39 58% 53%)" },
  { key: "学习", emoji: "📚", color: "hsl(211 55% 60%)" },
  { key: "生活", emoji: "🏠", color: "hsl(152 41% 49%)" },
  { key: "运动", emoji: "🏃", color: "hsl(26 78% 57%)" },
  { key: "社交", emoji: "👥", color: "hsl(268 48% 63%)" },
  { key: "娱乐", emoji: "🎮", color: "hsl(340 65% 65%)" },
  { key: "休息", emoji: "😴", color: "hsl(174 40% 51%)" },
  { key: "通勤", emoji: "🚌", color: "hsl(45 50% 45%)" },
];

interface QuickTimeEntryProps {
  onClose?: () => void;
}

export default function QuickTimeEntry({ onClose }: QuickTimeEntryProps) {
  const { addTodoToDate, todayKey, updateTodo } = useLifeOs();
  const { t } = useLanguage();
  const categoryLabel = (cat: string) => t(CATEGORY_LABEL_KEYS[cat] || cat);

  // Timer mode
  const [timerRunning, setTimerRunning] = useState(false);
  const [timerPaused, setTimerPaused] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(0);
  const [timerCategory, setTimerCategory] = useState("工作");
  const [timerNote, setTimerNote] = useState("");
  const [timerStartTime, setTimerStartTime] = useState<Date | null>(null);
  const timerRef = useRef<number | null>(null);

  // Manual mode
  const [showManual, setShowManual] = useState(false);
  const [manualStart, setManualStart] = useState("");
  const [manualEnd, setManualEnd] = useState("");
  const [manualCategory, setManualCategory] = useState("工作");
  const [manualNote, setManualNote] = useState("");
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (timerRunning && !timerPaused) {
      timerRef.current = window.setInterval(() => setTimerSeconds(s => s + 1), 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerRunning, timerPaused]);

  const formatTime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return h > 0
      ? `${h}:${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`
      : `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const startTimer = () => {
    setTimerStartTime(new Date());
    setTimerRunning(true);
    setTimerPaused(false);
    setTimerSeconds(0);
  };

  const stopAndSave = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    const endTime = new Date();
    const startStr = timerStartTime ? format(timerStartTime, "HH:mm") : "";
    const endStr = format(endTime, "HH:mm");
    const minutes = Math.round(timerSeconds / 60);

    // Create a todo with time info
    const todo = {
      id: crypto.randomUUID(),
      text: timerNote || `${CATEGORIES.find(c => c.key === timerCategory)?.emoji || ""} ${timerCategory}`,
      status: "done" as const,
      priority: "normal" as const,
      tags: [timerCategory],
      subTasks: [],
      recur: "none" as const,
      note: `⏱ ${startStr}-${endStr} (${minutes}分钟)`,
      completedAt: endTime.toISOString(),
      sourceDate: todayKey,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    addTodoToDate(todayKey, todo);

    setTimerRunning(false);
    setTimerPaused(false);
    setTimerSeconds(0);
    setTimerNote("");
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const saveManual = () => {
    if (!manualStart || !manualEnd) return;
    const [sh, sm] = manualStart.split(":").map(Number);
    const [eh, em] = manualEnd.split(":").map(Number);
    const minutes = (eh * 60 + em) - (sh * 60 + sm);
    if (minutes <= 0) return;

    const todo = {
      id: crypto.randomUUID(),
      text: manualNote || `${CATEGORIES.find(c => c.key === manualCategory)?.emoji || ""} ${manualCategory}`,
      status: "done" as const,
      priority: "normal" as const,
      tags: [manualCategory],
      subTasks: [],
      recur: "none" as const,
      note: `⏱ ${manualStart}-${manualEnd} (${minutes}分钟)`,
      completedAt: new Date().toISOString(),
      sourceDate: todayKey,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    addTodoToDate(todayKey, todo);
    setManualStart("");
    setManualEnd("");
    setManualNote("");
    setSaved(true);
    setTimeout(() => { setSaved(false); setShowManual(false); }, 1500);
  };

  const catInfo = CATEGORIES.find(c => c.key === timerCategory) || CATEGORIES[0];

  return (
    <div className="bg-card border border-border rounded-2xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock size={14} className="text-primary" />
          <span className="text-xs font-serif-sc text-foreground">{t("quick_time_entry.title")}</span>
        </div>
        <div className="flex gap-1">
          <button onClick={() => setShowManual(!showManual)}
            className={`text-[10px] px-2 py-1 rounded-full transition ${showManual ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground"}`}>
            {showManual ? t("quick_time_entry.mode_timer") : t("quick_time_entry.mode_manual")}
          </button>
          {onClose && <button onClick={onClose}><X size={14} className="text-muted-foreground" /></button>}
        </div>
      </div>

      {/* Category selector */}
      <div className="flex gap-1.5 flex-wrap">
        {CATEGORIES.map(cat => (
          <button key={cat.key}
            onClick={() => showManual ? setManualCategory(cat.key) : setTimerCategory(cat.key)}
            className={`text-[10px] px-2 py-1 rounded-full transition flex items-center gap-1 ${
              (showManual ? manualCategory : timerCategory) === cat.key
                ? "ring-2 ring-primary bg-primary/10 text-foreground"
                : "bg-secondary text-muted-foreground"
            }`}>
            <span>{cat.emoji}</span> {categoryLabel(cat.key)}
          </button>
        ))}
      </div>

      {saved && (
        <div className="flex items-center justify-center gap-2 py-2 text-los-green">
          <Check size={14} /> <span className="text-xs">{t("quick_time_entry.saved")}</span>
        </div>
      )}

      {!showManual ? (
        /* Timer mode */
        <div className="space-y-3">
          <input value={timerNote} onChange={e => setTimerNote(e.target.value)}
            placeholder={t("quick_time_entry.note_placeholder_optional")}
            className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-gold-border" />
          
          <div className="flex items-center justify-center gap-4">
            {!timerRunning ? (
              <button onClick={startTimer}
                className="w-14 h-14 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition shadow-lg">
                <Play size={24} className="text-primary-foreground ml-1" />
              </button>
            ) : (
              <>
                <div className="text-2xl font-mono-jb text-foreground min-w-[100px] text-center">
                  {formatTime(timerSeconds)}
                </div>
                <button onClick={() => setTimerPaused(!timerPaused)}
                  className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center">
                  {timerPaused ? <Play size={16} className="text-foreground ml-0.5" /> : <Pause size={16} className="text-foreground" />}
                </button>
                <button onClick={stopAndSave}
                  className="w-10 h-10 rounded-full bg-los-red/20 flex items-center justify-center">
                  <StopCircle size={16} className="text-los-red" />
                </button>
              </>
            )}
          </div>
          {timerRunning && (
            <p className="text-[9px] text-center text-muted-foreground">
              {catInfo.emoji} {categoryLabel(timerCategory)} · {t("quick_time_entry.started_at")} {timerStartTime ? format(timerStartTime, "HH:mm") : ""}
            </p>
          )}
        </div>
      ) : (
        /* Manual mode */
        <div className="space-y-2">
          <div className="flex gap-2 items-center">
            <input type="time" value={manualStart} onChange={e => setManualStart(e.target.value)}
              className="flex-1 bg-surface-2 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none" />
            <span className="text-muted-foreground text-xs">→</span>
            <input type="time" value={manualEnd} onChange={e => setManualEnd(e.target.value)}
              className="flex-1 bg-surface-2 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none" />
          </div>
          <input value={manualNote} onChange={e => setManualNote(e.target.value)}
            placeholder={t("quick_time_entry.note_placeholder_required")}
            className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-gold-border" />
          <button onClick={saveManual} disabled={!manualStart || !manualEnd}
            className="w-full bg-primary text-primary-foreground py-2 rounded-xl text-xs disabled:opacity-30 flex items-center justify-center gap-1">
            <Plus size={12} /> {t("quick_time_entry.save_button")}
          </button>
        </div>
      )}
    </div>
  );
}
