import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { useAuth } from "@/hooks/useAuth";
import { useProjects, PROJECT_COLORS } from "@/hooks/useProjects";
import { useLanguage } from "@/contexts/LanguageContext";
import { format, startOfWeek, addDays, isToday, subDays } from "date-fns";
import {
  Play, Pause, X, Check, Trash2, Pencil, Clock, ChevronDown,
  ChevronRight, Wand2, Loader2, Plus, Timer, Flame,
  LayoutGrid, List, Zap, Calendar, CalendarClock, Folder
} from "lucide-react";
import type { TodoItem, HabitItem, Priority, TaskStatus } from "@/types/lifeOs";
import { callLifeMentorJSON } from "@/lib/streamChat";
import { buildMemoryContext, getKeyPatterns } from "@/lib/memoryEngine";
import { toast } from "sonner";

const PRIORITY_KEYS: Record<string, { labelKey: string; dot: string; ring: string }> = {
  urgent: { labelKey: "todo.priority.urgent", dot: "bg-destructive", ring: "ring-destructive/30" },
  high: { labelKey: "todo.priority.high", dot: "bg-los-orange", ring: "ring-los-orange/30" },
  normal: { labelKey: "todo.priority.normal", dot: "bg-primary", ring: "ring-primary/30" },
  low: { labelKey: "todo.priority.low", dot: "bg-muted-foreground", ring: "ring-muted-foreground/30" },
};
const getPriority = (p: string) => PRIORITY_KEYS[p] ?? PRIORITY_KEYS["normal"];

// Tags are stored/matched internally as Chinese literals (e.g. from PLAN_TEMPLATES) —
// this is a display-only lookup for rendering, mirroring CalendarPage's CATEGORY_LABEL_KEYS.
const TAG_LABEL_KEYS: Record<string, string> = {
  "工作": "calendar.category_work",
  "学习": "calendar.category_study",
  "运动": "calendar.category_exercise",
  "生活": "calendar.category_life",
  "娱乐": "calendar.category_entertainment",
  "休息": "todo.tag.rest",
};

type ViewMode = "list" | "matrix" | "timeline";

const TodoPage = () => {
  const {
    allTodos, todayKey, toggleTodo, updateTodo, addTodoToDate, deleteTodo,
    habits, addHabit, checkInHabit, deleteHabit, entries,
  } = useLifeOs();
  const { user } = useAuth();
  const { activeProjects } = useProjects(user?.id);
  const { t } = useLanguage();
  const navigate = useNavigate();

  const [view, setView] = useState<ViewMode>("list");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set(["done"]));
  const [showAdd, setShowAdd] = useState(false);
  const [newText, setNewText] = useState("");
  const [newPriority, setNewPriority] = useState<Priority>("normal");
  const [selectedProjectFilter, setSelectedProjectFilter] = useState<string | null>(null);
  const [showHabits, setShowHabits] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);

  // Time tracking
  const [trackingTodoId, setTrackingTodoId] = useState<string | null>(null);
  const [trackingStart, setTrackingStart] = useState<number | null>(null);
  const [trackingElapsed, setTrackingElapsed] = useState(0);

  // Pomodoro
  const [pomodoroActive, setPomodoroActive] = useState(false);
  const [pomodoroTask, setPomodoroTask] = useState("");
  const [pomodoroTime, setPomodoroTime] = useState(25 * 60);
  const [pomodoroRunning, setPomodoroRunning] = useState(false);
  const pomodoroRef = useRef<number | null>(null);

  // Habit create
  const [showHabitCreate, setShowHabitCreate] = useState(false);
  const [habitName, setHabitName] = useState("");
  const [habitEmoji, setHabitEmoji] = useState("💪");

  // Celebrate
  const [celebrateId, setCelebrateId] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  // Pomodoro timer
  useEffect(() => {
    if (pomodoroRunning && pomodoroTime > 0) {
      pomodoroRef.current = window.setInterval(() => {
        setPomodoroTime(prev => {
          if (prev <= 1) {
            setPomodoroRunning(false);
            if (Notification.permission === "granted") new Notification(t("todo.pomodoro.done_title"), { body: t("todo.pomodoro.done_body") });
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (pomodoroRef.current) clearInterval(pomodoroRef.current); };
  }, [pomodoroRunning, pomodoroTime, t]);

  // Time tracking timer
  useEffect(() => {
    if (!trackingTodoId || !trackingStart) return;
    const iv = setInterval(() => setTrackingElapsed(Math.floor((Date.now() - trackingStart) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [trackingTodoId, trackingStart]);

  // 统一「开始专注」= 时间追踪 + 番茄钟同时启动
  const startFocus = (id: string, text: string) => {
    // Start time tracking
    setTrackingTodoId(id); setTrackingStart(Date.now()); setTrackingElapsed(0);
    // Start pomodoro
    setPomodoroTask(text); setPomodoroTime(25 * 60); setPomodoroRunning(true); setPomodoroActive(true);
  };
  const startTracking = (id: string) => startFocus(id, allTodos.find(t => t.id === id)?.text || "");
  const stopTracking = () => {
    if (trackingTodoId && trackingStart && trackingElapsed > 0) {
      const todo = allTodos.find(t => t.id === trackingTodoId);
      if (todo) {
        const startDate = new Date(trackingStart);
        const endDate = new Date();
        const startStr = format(startDate, "HH:mm");
        const endStr = format(endDate, "HH:mm");
        const minutes = Math.round(trackingElapsed / 60);
        const timeNote = `⏱ ${startStr}-${endStr} (${minutes}分钟)`;
        const newNote = todo.note ? `${todo.note}\n${timeNote}` : timeNote;
        updateTodo(todo.sourceDate || todayKey, trackingTodoId, { note: newNote });
      }
    }
    setTrackingTodoId(null); setTrackingStart(null); setTrackingElapsed(0);
  };
  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  // Data
  const filteredByProject = useMemo(() =>
    selectedProjectFilter
      ? allTodos.filter(t => t.projectId === selectedProjectFilter)
      : allTodos,
    [allTodos, selectedProjectFilter]
  );

  const smartGroups = useMemo(() => {
    const priorityOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
    const sort = (arr: TodoItem[]) => [...arr].sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2));
    return {
      doing: sort(filteredByProject.filter(t => t.status === "doing")),
      todo: sort(filteredByProject.filter(t => t.status === "todo" || (t.status !== "done" && t.status !== "dropped" && t.status !== "doing"))),
      done: sort(filteredByProject.filter(t => t.status === "done")),
    };
  }, [filteredByProject]);

  const stats = useMemo(() => {
    const total = allTodos.filter(t => t.status !== "dropped").length;
    const done = allTodos.filter(t => t.status === "done").length;
    const doing = allTodos.filter(t => t.status === "doing").length;
    return { total, done, doing, todo: total - done - doing, rate: total > 0 ? Math.round((done / total) * 100) : 0 };
  }, [allTodos]);

  const eisenhower = useMemo(() => {
    const active = allTodos.filter(t => t.status !== "done" && t.status !== "dropped");
    return [
      { key: "ui", label: `🔴 ${t("todo.priority.urgent")}`, sub: t("todo.matrix.do_now") || "立即做", items: active.filter(t => t.priority === "urgent"), color: "border-destructive/40" },
      { key: "ni", label: `🟠 ${t("todo.priority.high")}`, sub: t("todo.matrix.plan") || "计划做", items: active.filter(t => t.priority === "high"), color: "border-los-orange/40" },
      { key: "un", label: `🔵 ${t("todo.priority.normal")}`, sub: t("todo.matrix.delegate") || "委托做", items: active.filter(t => t.priority === "normal"), color: "border-primary/40" },
      { key: "nn", label: `⚪ ${t("todo.priority.low")}`, sub: t("todo.matrix.drop") || "考虑删", items: active.filter(t => t.priority === "low"), color: "border-muted-foreground/30" },
    ];
  }, [allTodos, t]);

  // Streak
  const streak = useMemo(() => {
    let count = 0;
    const now = new Date();
    for (let i = 0; i < 60; i++) {
      const d = format(subDays(now, i), "yyyy-MM-dd");
      if (allTodos.some(t => t.completedAt?.split("T")[0] === d)) count++;
      else if (i > 0) break;
    }
    return count;
  }, [allTodos]);

  const handleToggle = (todo: TodoItem) => {
    if (isProcessing) return;

    setIsProcessing(true);
    toggleTodo(todo.sourceDate || todayKey, todo.id);

    if (todo.status !== "done") {
      setCelebrateId(todo.id);
      setTimeout(() => setCelebrateId(null), 800);
    }

    setTimeout(() => setIsProcessing(false), 300);
  };

  const moveToStatus = (todo: TodoItem, s: TaskStatus) => {
    updateTodo(todo.sourceDate || todayKey, todo.id, { status: s, completedAt: s === "done" ? new Date().toISOString() : undefined });
  };

  const toggleSection = (k: string) => setCollapsedSections(p => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });

  const handleAddTodo = () => {
    if (!newText.trim()) return;
    const todo: TodoItem = {
      id: crypto.randomUUID(), text: newText.trim(), status: "todo", priority: newPriority,
      tags: [], subTasks: [], recur: "none", sourceDate: todayKey,
      createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
    addTodoToDate(todayKey, todo);
    setNewText(""); setShowAdd(false);
  };

  // Week days for habits
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDayKeys = ["calendar.day_mon", "calendar.day_tue", "calendar.day_wed", "calendar.day_thu", "calendar.day_fri", "calendar.day_sat", "calendar.day_sun"];
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    return { date: format(d, "yyyy-MM-dd"), label: t(weekDayKeys[i]), isToday: isToday(d) };
  });

  // Pomodoro overlay
  if (pomodoroActive) {
    const mins = Math.floor(pomodoroTime / 60);
    const secs = pomodoroTime % 60;
    const progress = 1 - pomodoroTime / (25 * 60);
    return (
      <div className="flex flex-col items-center justify-center h-full bg-background">
        <p className="text-xs text-muted-foreground mb-6">{pomodoroTask}</p>
        <div className="relative w-40 h-40 mb-8">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="hsl(var(--border))" strokeWidth="2" />
            <circle cx="50" cy="50" r="45" fill="none" stroke="hsl(var(--primary))" strokeWidth="3"
              strokeDasharray={`${progress * 283} 283`} strokeLinecap="round" />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl font-mono text-foreground">{mins}:{secs.toString().padStart(2, "0")}</span>
          </div>
        </div>
        <div className="flex gap-4">
          <button onClick={() => setPomodoroRunning(!pomodoroRunning)} className="bg-muted p-3 rounded-full">
            {pomodoroRunning ? <Pause size={20} className="text-foreground" /> : <Play size={20} className="text-foreground" />}
          </button>
          <button onClick={() => { setPomodoroActive(false); setPomodoroTime(25 * 60); setPomodoroRunning(false); }} className="bg-muted p-3 rounded-full">
            <X size={20} className="text-muted-foreground" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-w-[700px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <div>
          <h1 className="font-serif-sc text-lg text-foreground">{t("tab.todo")}</h1>
          {streak > 0 && <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Flame size={10} className="text-primary" />{t("todo.streak", { days: streak })}</p>}
        </div>
        <div className="flex items-center gap-1.5">
          <div className="flex items-center gap-0.5 bg-muted rounded-lg p-0.5">
            {([
              { key: "list" as const, icon: <List size={14} />, label: t("todo.view.list") },
              { key: "matrix" as const, icon: <LayoutGrid size={14} />, label: t("todo.view.matrix") },
              { key: "timeline" as const, icon: <CalendarClock size={14} />, label: t("todo.view.timeline") },
            ]).map(v => (
              <button key={v.key} onClick={() => setView(v.key)}
                className={`p-1.5 rounded-md transition text-xs flex items-center gap-1 ${view === v.key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                title={v.label}>
                {v.icon}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Progress bar - minimal */}
      <div className="px-4 mb-3">
        <div className="flex items-center gap-3 mb-1.5">
          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden flex">
            <div className="h-full bg-primary rounded-l-full transition-all" style={{ width: `${stats.total > 0 ? (stats.done / stats.total) * 100 : 0}%` }} />
            <div className="h-full bg-los-orange transition-all" style={{ width: `${stats.total > 0 ? (stats.doing / stats.total) * 100 : 0}%` }} />
          </div>
          <span className="text-xs font-mono text-primary">{stats.rate}%</span>
        </div>
        <div className="flex gap-4 text-[10px] text-muted-foreground">
          <span>{stats.todo} {t("tab.todo")}</span>
          <span className="text-los-orange">{stats.doing} {t("todo.stats.doing")}</span>
          <span className="text-primary">{stats.done} {t("todo.action.complete")}</span>
        </div>
      </div>

      {/* Quick access row */}
      <div className="px-4 flex gap-2 mb-3 overflow-x-auto scrollbar-none">
        <button onClick={() => setShowHabits(!showHabits)}
          className={`text-[11px] px-3 py-1.5 rounded-full border transition flex items-center gap-1 flex-shrink-0 ${showHabits ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
          <Zap size={12} /> {t("todo.habits")}
        </button>
        <button onClick={() => setShowTemplates(!showTemplates)}
          className={`text-[11px] px-3 py-1.5 rounded-full border transition flex items-center gap-1 flex-shrink-0 ${showTemplates ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
          <Calendar size={12} /> {t("todo.templates")}
        </button>
        {/* Project filter pills */}
        {activeProjects.map(p => {
          const c = PROJECT_COLORS[p.color];
          const isActive = selectedProjectFilter === p.id;
          return (
            <button key={p.id}
              onClick={() => setSelectedProjectFilter(isActive ? null : p.id)}
              className={`text-[11px] px-3 py-1.5 rounded-full border transition flex items-center gap-1 flex-shrink-0
                ${isActive ? `${c.bg} ${c.border} ${c.text}` : "border-border text-muted-foreground hover:text-foreground"}`}>
              {p.emoji} {p.name}
            </button>
          );
        })}
        {activeProjects.length > 0 && (
          <button onClick={() => navigate("/projects")}
            className="text-[11px] px-3 py-1.5 rounded-full border border-border text-muted-foreground hover:text-foreground transition flex items-center gap-1 flex-shrink-0">
            <Folder size={12} /> {t("todo.projects_manage")}
          </button>
        )}
      </div>

      {/* Habits inline panel */}
      {showHabits && (
        <div className="px-4 mb-3 animate-in fade-in slide-in-from-top-2">
          <div className="bg-card border border-border rounded-xl p-3 space-y-2">
            {habits.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-2">{t("todo.habit.empty")}</p>
            ) : habits.map(habit => (
              <div key={habit.id} className="flex items-center gap-2">
                <span className="text-sm">{habit.emoji}</span>
                <span className="text-xs text-foreground flex-1 truncate">{habit.name}</span>
                <div className="flex gap-0.5">
                  {weekDays.map(d => {
                    const checked = habit.checkIns.includes(d.date);
                    return (
                      <button key={d.date} onClick={() => checkInHabit(habit.id, d.date)}
                        className={`w-5 h-5 rounded-md text-[8px] flex items-center justify-center transition ${checked ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"} ${d.isToday ? "ring-1 ring-primary/40" : ""}`}>
                        {checked ? "✓" : d.label}
                      </button>
                    );
                  })}
                </div>
                <button onClick={() => deleteHabit(habit.id)} className="p-1 text-muted-foreground hover:text-destructive"><Trash2 size={10} /></button>
              </div>
            ))}
            {showHabitCreate ? (
              <div className="flex gap-2 pt-1">
                <select value={habitEmoji} onChange={e => setHabitEmoji(e.target.value)} className="bg-muted border border-border rounded-lg px-2 py-1 text-sm">
                  {["💪", "📚", "🏃", "💧", "🧘", "✍️", "🎯", "😴"].map(e => <option key={e} value={e}>{e}</option>)}
                </select>
                <input value={habitName} onChange={e => setHabitName(e.target.value)} placeholder={t("todo.habit.name")} autoFocus
                  className="flex-1 bg-muted border border-border rounded-lg px-3 py-1 text-xs text-foreground focus:outline-none focus:border-primary" />
                <button onClick={() => {
                  if (habitName.trim()) { addHabit({ name: habitName, emoji: habitEmoji, targetDays: [1, 2, 3, 4, 5] }); setHabitName(""); setShowHabitCreate(false); }
                }} className="text-xs bg-primary text-primary-foreground px-3 rounded-lg">+</button>
              </div>
            ) : (
              <button onClick={() => setShowHabitCreate(true)} className="text-[10px] text-primary hover:text-primary/80 transition">+ {t("todo.habit.add")}</button>
            )}
          </div>
        </div>
      )}

      {/* Templates inline panel */}
      {showTemplates && (
        <div className="px-4 mb-3 animate-in fade-in slide-in-from-top-2">
          <TemplatesPanel addTodoToDate={addTodoToDate} todayKey={todayKey} />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 overflow-y-auto px-4 pb-20">
        {view === "list" ? (
          <div className="space-y-2">
            {/* Doing */}
            {smartGroups.doing.length > 0 && (
              <Section title={t("todo.column.doing")} icon={<Play size={12} className="text-los-orange" />} count={smartGroups.doing.length}
                accent="border-l-los-orange" collapsed={collapsedSections.has("doing")} onToggle={() => toggleSection("doing")}>
                {smartGroups.doing.map(todo => (
                  <TodoRow key={todo.id} todo={todo} onToggle={handleToggle} onMove={moveToStatus}
                    expanded={expandedId === todo.id} onExpand={() => setExpandedId(expandedId === todo.id ? null : todo.id)}
                    celebrating={celebrateId === todo.id} editing={editingId === todo.id}
                    onEdit={() => setEditingId(editingId === todo.id ? null : todo.id)}
                    onUpdate={(u) => { updateTodo(todo.sourceDate || todayKey, todo.id, u); setEditingId(null); }}
                    onDelete={() => deleteTodo(todo.sourceDate || todayKey, todo.id)}
                    onPomodoro={() => { setPomodoroTask(todo.text); setPomodoroActive(true); setPomodoroRunning(true); setPomodoroTime(25 * 60); }}
                    isTracking={trackingTodoId === todo.id} trackingTime={trackingTodoId === todo.id ? fmtTime(trackingElapsed) : undefined}
                    onStartTracking={() => startTracking(todo.id)}
                  />
                ))}
              </Section>
            )}
            {/* Todo */}
            <Section title={t("todo.column.todo")} icon={<List size={12} className="text-foreground" />} count={smartGroups.todo.length}
              accent="border-l-primary" collapsed={collapsedSections.has("todo")} onToggle={() => toggleSection("todo")}>
              {smartGroups.todo.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">{t("todo.empty.todo")}</p>
              ) : smartGroups.todo.map(todo => (
                <TodoRow key={todo.id} todo={todo} onToggle={handleToggle} onMove={moveToStatus}
                  expanded={expandedId === todo.id} onExpand={() => setExpandedId(expandedId === todo.id ? null : todo.id)}
                  celebrating={celebrateId === todo.id} editing={editingId === todo.id}
                  onEdit={() => setEditingId(editingId === todo.id ? null : todo.id)}
                  onUpdate={(u) => { updateTodo(todo.sourceDate || todayKey, todo.id, u); setEditingId(null); }}
                  onDelete={() => deleteTodo(todo.sourceDate || todayKey, todo.id)}
                  onPomodoro={() => { setPomodoroTask(todo.text); setPomodoroActive(true); setPomodoroRunning(true); setPomodoroTime(25 * 60); }}
                  isTracking={trackingTodoId === todo.id} trackingTime={trackingTodoId === todo.id ? fmtTime(trackingElapsed) : undefined}
                  onStartTracking={() => startTracking(todo.id)}
                />
              ))}
            </Section>
            {/* Done */}
            {smartGroups.done.length > 0 && (
              <Section title={t("todo.column.done")} icon={<Check size={12} className="text-primary" />} count={smartGroups.done.length}
                accent="border-l-primary/40" collapsed={collapsedSections.has("done")} onToggle={() => toggleSection("done")}>
                {smartGroups.done.map(todo => (
                  <TodoRow key={todo.id} todo={todo} onToggle={handleToggle} onMove={moveToStatus}
                    expanded={expandedId === todo.id} onExpand={() => setExpandedId(expandedId === todo.id ? null : todo.id)}
                    celebrating={celebrateId === todo.id} editing={editingId === todo.id}
                    onEdit={() => setEditingId(editingId === todo.id ? null : todo.id)}
                    onUpdate={(u) => { updateTodo(todo.sourceDate || todayKey, todo.id, u); setEditingId(null); }}
                    onDelete={() => deleteTodo(todo.sourceDate || todayKey, todo.id)}
                    onPomodoro={() => {}} isTracking={false} onStartTracking={() => {}}
                  />
                ))}
              </Section>
            )}
          </div>
        ) : view === "matrix" ? (
          /* Matrix view */
          <div className="grid grid-cols-2 gap-2">
            {eisenhower.map(q => (
              <div key={q.key} className={`border-l-2 ${q.color} bg-card rounded-xl p-3 min-h-[100px]`}>
                <p className="text-[10px] text-foreground font-medium mb-0.5">{q.label}</p>
                <p className="text-[8px] text-muted-foreground mb-2">{q.sub}</p>
                <div className="space-y-1">
                  {q.items.length === 0 ? (
                    <p className="text-[9px] text-muted-foreground/40">{t("todo.matrix.empty")}</p>
                  ) : q.items.slice(0, 5).map(t => (
                    <div key={t.id} className="flex items-center gap-1.5">
                      <button onClick={() => handleToggle(t)} className="flex-shrink-0 p-2 -m-2">
                        <div className={`w-3 h-3 rounded-full border ${t.status === "doing" ? "bg-los-orange border-los-orange" : "border-muted-foreground"}`} />
                      </button>
                      <span className="text-[10px] text-foreground truncate">{t.text}</span>
                    </div>
                  ))}
                  {q.items.length > 5 && <p className="text-[8px] text-muted-foreground/50">+{q.items.length - 5}</p>}
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Timeline view - integrated from diary */
          <InlineTimeline entries={entries} allTodos={allTodos} todayKey={todayKey} updateTodo={updateTodo} />
        )}
      </div>

      {/* Time tracking bar */}
      {trackingTodoId && (
        <div className="px-4 py-2 bg-primary/5 border-t border-primary/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Timer size={14} className="text-primary animate-pulse" />
            <span className="text-[11px] text-foreground truncate max-w-[180px]">
              {allTodos.find(t => t.id === trackingTodoId)?.text}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono text-primary">{fmtTime(trackingElapsed)}</span>
            <button onClick={stopTracking} className="text-[10px] bg-muted text-muted-foreground px-2 py-1 rounded-lg hover:text-foreground">{t("todo.tracking.stop")}</button>
          </div>
        </div>
      )}

      {/* FAB: Add todo */}
      <button onClick={() => setShowAdd(true)}
        className="fixed bottom-20 right-4 w-12 h-12 bg-primary text-primary-foreground rounded-full shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all z-40">
        <Plus size={22} />
      </button>

      {/* Add todo sheet */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end">
          <div className="fixed inset-0 bg-black/30" onClick={() => setShowAdd(false)} />
          <div className="relative w-full bg-background border-t border-border rounded-t-2xl p-4 animate-in slide-in-from-bottom z-50">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-foreground">{t("todo.add.title")}</span>
              <button onClick={() => setShowAdd(false)}><X size={16} className="text-muted-foreground" /></button>
            </div>
            <input value={newText} onChange={e => setNewText(e.target.value)} placeholder={t("todo.add.placeholder")} autoFocus
              onKeyDown={e => { if (e.key === "Enter") handleAddTodo(); }}
              className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none focus:border-primary mb-3" />
            <div className="flex gap-1.5 mb-3">
              {(["urgent", "high", "normal", "low"] as Priority[]).map(p => (
                <button key={p} onClick={() => setNewPriority(p)}
                  className={`text-[10px] px-3 py-1.5 rounded-full transition flex items-center gap-1 ${newPriority === p ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  <span className={`w-2 h-2 rounded-full ${getPriority(p).dot}`} />
                  {t(getPriority(p).labelKey)}
                </button>
              ))}
            </div>
            <button onClick={handleAddTodo} disabled={!newText.trim()}
              className="w-full bg-primary text-primary-foreground py-2.5 rounded-xl text-sm disabled:opacity-30 transition">
              {t("todo.add.submit")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

/* --- Sub-components --- */

function Section({ title, icon, count, accent, collapsed, onToggle, children }: {
  title: string; icon: React.ReactNode; count: number; accent: string;
  collapsed: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className={`border-l-2 ${accent} pl-3`}>
      <button onClick={onToggle} className="flex items-center gap-2 mb-1.5 w-full">
        {collapsed ? <ChevronRight size={12} className="text-muted-foreground" /> : <ChevronDown size={12} className="text-muted-foreground" />}
        {icon}
        <span className="text-xs text-foreground font-medium">{title}</span>
        <span className="text-[10px] font-mono text-muted-foreground">{count}</span>
      </button>
      {!collapsed && <div className="space-y-1">{children}</div>}
    </div>
  );
}

function TodoRow({ todo, onToggle, onMove, expanded, onExpand, celebrating, editing, onEdit, onUpdate, onDelete, onPomodoro, isTracking, trackingTime, onStartTracking }: {
  todo: TodoItem; onToggle: (t: TodoItem) => void; onMove: (t: TodoItem, s: TaskStatus) => void;
  expanded: boolean; onExpand: () => void; celebrating: boolean;
  editing: boolean; onEdit: () => void; onUpdate: (u: Partial<TodoItem>) => void; onDelete: () => void;
  onPomodoro: () => void; isTracking: boolean; trackingTime?: string; onStartTracking: () => void;
}) {
  const { t } = useLanguage();
  const { defaultModelProfileId } = useLifeOs();
  const isDone = todo.status === "done";
  const isDoing = todo.status === "doing";
  const [editText, setEditText] = useState(todo.text);
  const [editPriority, setEditPriority] = useState(todo.priority);
  const [editDueDate, setEditDueDate] = useState(todo.dueDate || "");
  const [editNote, setEditNote] = useState(todo.note || "");
  const [decomposing, setDecomposing] = useState(false);

  const handleDecompose = useCallback(async () => {
    setDecomposing(true);
    try {
      const data = await callLifeMentorJSON("decompose", [{ role: "user", content: todo.text }], { modelProfileId: defaultModelProfileId });
      if (data.subTasks?.length) {
        onUpdate({ subTasks: [...(todo.subTasks || []), ...data.subTasks.map((s: any) => ({ id: crypto.randomUUID(), text: s.text, done: false }))] });
      } else {
        toast.error(t("todo.toast.decompose_empty"), { id: "decompose-empty" });
      }
    } catch (e) {
      console.error("Decompose error:", e);
      toast.error(t("todo.toast.decompose_error"), { id: "decompose-error" });
    }
    setDecomposing(false);
  }, [todo.text, todo.subTasks, onUpdate, defaultModelProfileId, t]);

  const prio = getPriority(todo.priority);

  return (
    <div className={`bg-card border border-border rounded-xl transition-all ${celebrating ? "ring-2 ring-primary animate-pulse" : ""}`}>
      {/* Main row */}
      <div className="flex items-center gap-2 px-3 py-2">
        {/* Checkbox — p-2 ensures 40px+ touch target */}
        <button onClick={() => onToggle(todo)} className="flex-shrink-0 p-2 -mx-1">
          <div className={`w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center transition ${isDone ? "bg-primary border-primary" : isDoing ? "bg-los-orange border-los-orange" : "border-muted-foreground/50 hover:border-primary"}`}>
            {isDone && <Check size={10} className="text-primary-foreground" />}
            {isDoing && <Play size={8} className="text-primary-foreground" />}
          </div>
        </button>
        {/* Content */}
        <button onClick={onExpand} className="flex-1 text-left min-w-0">
          <p className={`text-sm leading-snug ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>{todo.text}</p>
          <div className="flex gap-1 mt-0.5 items-center flex-wrap">
            <span className={`w-1.5 h-1.5 rounded-full ${prio.dot}`} />
            {todo.dueDate && <span className="text-caption text-muted-foreground font-mono">{todo.dueDate.slice(5)}</span>}
            {todo.tags?.map(tag => <span key={tag} className="text-label bg-primary/10 text-primary px-1.5 rounded">{t(TAG_LABEL_KEYS[tag] || tag)}</span>)}
            {todo.subTasks?.length > 0 && <span className="text-label text-muted-foreground font-mono">{todo.subTasks.filter(s => s.done).length}/{todo.subTasks.length}</span>}
            {isTracking && trackingTime && <span className="text-caption font-mono text-primary">⏱ {trackingTime}</span>}
          </div>
        </button>
        {/* Quick actions - always visible */}
        <div className="flex items-center gap-0.5">
          {!isDone && !isDoing && (
            <button onClick={() => onMove(todo, "doing")} className="p-1.5 rounded-lg hover:bg-muted transition text-muted-foreground hover:text-los-orange" title={t("todo.action.start")}>
              <Play size={12} />
            </button>
          )}
          {isDoing && (
            <button onClick={() => onMove(todo, "done")} className="p-1.5 rounded-lg hover:bg-muted transition text-muted-foreground hover:text-primary" title={t("todo.action.complete")}>
              <Check size={12} />
            </button>
          )}
        </div>
      </div>

      {/* Expanded detail */}
      {expanded && !editing && (
        <div className="px-3 pb-3 border-t border-border pt-2 space-y-2">
          {/* Sub-tasks */}
          {todo.subTasks?.map(st => (
            <button key={st.id}
              onClick={() => onUpdate({ subTasks: todo.subTasks.map(s => s.id === st.id ? { ...s, done: !s.done } : s) })}
              className="flex items-center gap-2 text-xs ml-1 py-1 -my-1 w-full text-left">
              <div className={`w-3 h-3 rounded border flex items-center justify-center flex-shrink-0 ${st.done ? "bg-primary border-primary" : "border-muted-foreground/50"}`}>
                {st.done && <Check size={7} className="text-primary-foreground" />}
              </div>
              <span className={st.done ? "line-through text-muted-foreground" : "text-foreground"}>{st.text}</span>
            </button>
          ))}
          {todo.note && <p className="text-[10px] text-muted-foreground bg-muted rounded-lg px-2 py-1.5">{todo.note}</p>}
          {/* Action bar */}
          <div className="flex gap-1 flex-wrap">
            {!isDone && (
              <>
                <button onClick={onStartTracking} className="text-[9px] bg-muted text-muted-foreground px-2 py-1 rounded-lg flex items-center gap-1 hover:text-foreground">
                  <Clock size={10} /> {t("todo.action.timer")}
                </button>
                <button onClick={onPomodoro} className="text-[9px] bg-muted text-muted-foreground px-2 py-1 rounded-lg flex items-center gap-1 hover:text-foreground">
                  <Timer size={10} /> {t("todo.action.pomodoro")}
                </button>
                <button onClick={handleDecompose} disabled={decomposing} className="text-[9px] bg-muted text-muted-foreground px-2 py-1 rounded-lg flex items-center gap-1 hover:text-primary">
                  {decomposing ? <Loader2 size={10} className="animate-spin" /> : <Wand2 size={10} />} {t("todo.action.decompose")}
                </button>
              </>
            )}
            <button onClick={onEdit} className="text-[9px] bg-muted text-muted-foreground px-2 py-1 rounded-lg flex items-center gap-1 hover:text-foreground">
              <Pencil size={10} /> {t("common.edit")}
            </button>
            {isDone && (
              <button onClick={() => onMove(todo, "todo")} className="text-[9px] bg-muted text-muted-foreground px-2 py-1 rounded-lg hover:text-foreground">{t("todo.action.reopen")}</button>
            )}
          </div>
        </div>
      )}

      {/* Edit mode */}
      {editing && (
        <div className="px-3 pb-3 border-t border-border pt-2 space-y-2">
          <input value={editText} onChange={e => setEditText(e.target.value)}
            className="w-full bg-muted border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary" />
          <div className="flex gap-1">
            {(["urgent", "high", "normal", "low"] as Priority[]).map(p => (
              <button key={p} onClick={() => setEditPriority(p)}
                className={`text-[10px] px-2 py-0.5 rounded-full transition flex items-center gap-1 ${editPriority === p ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${getPriority(p).dot}`} /> {t(getPriority(p).labelKey)}
              </button>
            ))}
          </div>
          <input type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)}
            className="w-full bg-muted border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none" />
          <textarea value={editNote} onChange={e => setEditNote(e.target.value)} placeholder={t("todo.note.placeholder")} rows={2}
            className="w-full bg-muted border border-border rounded-lg px-3 py-1.5 text-xs text-foreground resize-none focus:outline-none" />
          <div className="flex gap-2">
            <button onClick={() => onUpdate({ text: editText, priority: editPriority, dueDate: editDueDate || undefined, note: editNote || undefined })}
              className="flex-1 bg-primary text-primary-foreground py-1.5 rounded-lg text-xs">{t("common.save")}</button>
            <button onClick={onDelete} className="px-3 py-1.5 text-xs text-destructive bg-destructive/10 rounded-lg">{t("common.delete")}</button>
          </div>
        </div>
      )}
    </div>
  );
}

/* Templates panel */
// `name` is used internally as a matching/React key (see `applied === tmpl.name` below) and
// stays a Chinese literal — display goes through TEMPLATE_LABEL_KEYS, mirroring CalendarPage's
// CATEGORY_LABEL_KEYS pattern. Task text/tags are freshly generated content (not matched
// against anything), so they're translated straight from their keys at apply time.
const PLAN_TEMPLATES = [
  {
    name: "工作日", emoji: "💼",
    tasks: [
      { textKey: "todo.template.workday.task1", priority: "high" as const, tags: ["工作"], dueTime: "08:00" },
      { textKey: "todo.template.workday.task2", priority: "urgent" as const, tags: ["工作"], dueTime: "09:00" },
      { textKey: "todo.template.workday.task3", priority: "normal" as const, tags: ["休息"], dueTime: "12:00" },
      { textKey: "todo.template.workday.task4", priority: "normal" as const, tags: ["工作"], dueTime: "14:00" },
      { textKey: "todo.template.workday.task5", priority: "high" as const, tags: ["学习"], dueTime: "17:00" },
    ],
  },
  {
    name: "休息日", emoji: "🌴",
    tasks: [
      { textKey: "todo.template.restday.task1", priority: "low" as const, tags: ["生活"], dueTime: "09:00" },
      { textKey: "todo.template.restday.task2", priority: "normal" as const, tags: ["学习"], dueTime: "10:00" },
      { textKey: "todo.template.restday.task3", priority: "high" as const, tags: ["运动"], dueTime: "14:00" },
      { textKey: "todo.template.restday.task4", priority: "low" as const, tags: ["娱乐"], dueTime: "16:00" },
      { textKey: "todo.template.restday.task5", priority: "high" as const, tags: ["学习"], dueTime: "22:00" },
    ],
  },
  {
    name: "冲刺日", emoji: "🚀",
    tasks: [
      { textKey: "todo.template.sprintday.task1", priority: "high" as const, tags: ["工作"], dueTime: "07:00" },
      { textKey: "todo.template.sprintday.task2", priority: "urgent" as const, tags: ["工作"], dueTime: "08:00" },
      { textKey: "todo.template.sprintday.task3", priority: "urgent" as const, tags: ["工作"], dueTime: "11:30" },
      { textKey: "todo.template.sprintday.task4", priority: "high" as const, tags: ["工作"], dueTime: "15:00" },
      { textKey: "todo.template.sprintday.task5", priority: "normal" as const, tags: ["生活"], dueTime: "18:00" },
    ],
  },
];

const TEMPLATE_LABEL_KEYS: Record<string, string> = {
  "工作日": "todo.template.workday",
  "休息日": "todo.template.restday",
  "冲刺日": "todo.template.sprintday",
};

function TemplatesPanel({ addTodoToDate, todayKey }: { addTodoToDate: (d: string, t: TodoItem) => void; todayKey: string }) {
  const { t } = useLanguage();
  const [applied, setApplied] = useState<string | null>(null);

  const apply = (tmpl: typeof PLAN_TEMPLATES[0]) => {
    tmpl.tasks.forEach(task => {
      addTodoToDate(todayKey, {
        id: crypto.randomUUID(), text: t(task.textKey), status: "todo", priority: task.priority,
        tags: task.tags, subTasks: [], recur: "none", dueDate: todayKey, dueTime: task.dueTime,
        sourceDate: todayKey, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
      });
    });
    setApplied(tmpl.name);
    setTimeout(() => setApplied(null), 2000);
  };

  return (
    <div className="bg-card border border-border rounded-xl p-3 space-y-2">
      <p className="text-[10px] text-muted-foreground">{t("todo.template.hint")}</p>
      <div className="grid grid-cols-3 gap-1.5">
        {PLAN_TEMPLATES.map(tmpl => (
          <button key={tmpl.name} onClick={() => apply(tmpl)}
            className={`rounded-lg p-2.5 text-center transition ${applied === tmpl.name ? "bg-primary/10 border border-primary/30" : "bg-muted hover:bg-accent"}`}>
            <div className="text-xl mb-1">{tmpl.emoji}</div>
            <div className="text-[10px] text-foreground">{t(TEMPLATE_LABEL_KEYS[tmpl.name] || tmpl.name)}</div>
            {applied === tmpl.name && <div className="text-[8px] text-primary mt-0.5">✓ {t("todo.template.applied")}</div>}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ─── Inline Timeline (diary-extracted, editable) ─── */
const CATEGORY_COLORS: Record<string, string> = {
  "工作": "hsl(39 58% 53%)", "学习": "hsl(211 55% 60%)", "生活": "hsl(152 41% 49%)",
  "运动": "hsl(26 78% 57%)", "社交": "hsl(268 48% 63%)", "娱乐": "hsl(340 65% 65%)",
  "休息": "hsl(174 40% 51%)", "其他": "hsl(30 12% 37%)",
};

type TimeBlock = { activity: string; category: string; startTime: string; endTime: string; durationMinutes: number; };

function InlineTimeline({ entries, allTodos, todayKey, updateTodo }: {
  entries: any[]; allTodos: TodoItem[]; todayKey: string;
  updateTodo: (date: string, id: string, u: Partial<TodoItem>) => void;
}) {
  const { t } = useLanguage();
  const { defaultModelProfileId } = useLifeOs();
  const [timeBlocks, setTimeBlocks] = useState<TimeBlock[]>([]);
  const [loading, setLoading] = useState(false);
  const [extracted, setExtracted] = useState(false);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editBlock, setEditBlock] = useState<TimeBlock | null>(null);

  const todayEntry = entries.find((e: any) => e.date === todayKey);
  const hasMessages = todayEntry && todayEntry.messages.length > 0;

  // Also build timeline from completed todos with time notes
  const todoTimeline = useMemo(() => {
    return allTodos
      .filter(t => t.status === "done" && t.note?.includes("⏱"))
      .map(t => {
        const match = t.note?.match(/⏱\s*(\d{1,2}:\d{2})-(\d{1,2}:\d{2})\s*\((\d+)分钟\)/);
        if (!match) return null;
        return { activity: t.text, category: "工作", startTime: match[1], endTime: match[2], durationMinutes: parseInt(match[3]) };
      })
      .filter(Boolean) as TimeBlock[];
  }, [allTodos]);

  const extractTimeline = async () => {
    if (!todayEntry) return;
    setLoading(true);
    try {
      const memoryContext = buildMemoryContext(entries, 14);
      const patterns = getKeyPatterns(entries);
      const data = await callLifeMentorJSON(
        "time-extract",
        todayEntry.messages.map((m: any) => ({ role: m.role, content: m.content })),
        { memoryContext, patterns, modelProfileId: defaultModelProfileId }
      );
      setTimeBlocks(data.timeBlocks || []);
      setExtracted(true);
      // Auto-match to todos
      (data.timeBlocks || []).forEach((block: TimeBlock) => {
        const match = allTodos.find(t => {
          const a = block.activity.toLowerCase(), txt = t.text.toLowerCase();
          return a.includes(txt) || txt.includes(a);
        });
        if (match && !match.note?.includes("⏱")) {
          updateTodo(match.sourceDate || todayKey, match.id, {
            note: `${match.note || ""}\n⏱ ${block.startTime}-${block.endTime} (${block.durationMinutes}分钟)`.trim()
          });
        }
      });
    } catch (e) {
      console.error("Extract timeline error:", e);
      toast.error(t("todo.toast.extract_timeline_error"), { id: "extract-timeline-error" });
    } finally { setLoading(false); setExtracted(true); }
  };

  useEffect(() => {
    if (hasMessages && !extracted && !loading) extractTimeline();
  }, [hasMessages]);

  const saveEdit = (idx: number) => {
    if (!editBlock) return;
    const [sh, sm] = editBlock.startTime.split(":").map(Number);
    const [eh, em] = editBlock.endTime.split(":").map(Number);
    const dur = (eh * 60 + em) - (sh * 60 + sm);
    const newBlocks = [...timeBlocks];
    newBlocks[idx] = { ...editBlock, durationMinutes: Math.max(dur, 1) };
    setTimeBlocks(newBlocks);
    setEditingIdx(null); setEditBlock(null);
  };

  const allBlocks = [...timeBlocks, ...todoTimeline].sort((a, b) => a.startTime.localeCompare(b.startTime));
  // Deduplicate by startTime
  const blocks = allBlocks.filter((b, i, arr) => i === 0 || b.startTime !== arr[i - 1].startTime);
  const totalMinutes = blocks.reduce((s, b) => s + b.durationMinutes, 0);

  return (
    <div className="space-y-3">
      {/* Visual timeline bar */}
      {blocks.length > 0 && (
        <div className="bg-card border border-primary/20 rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <CalendarClock size={13} className="text-primary" />
              <span className="text-[11px] font-serif-sc text-foreground">{t("timestats.title")}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] font-mono text-muted-foreground">{(totalMinutes / 60).toFixed(1)}h</span>
              <button onClick={extractTimeline} className="text-[9px] text-muted-foreground hover:text-primary">↻</button>
            </div>
          </div>
          {/* Stacked bar */}
          <div className="h-[6px] rounded-full bg-muted mb-3 flex overflow-hidden">
            {blocks.map((b, i) => (
              <div key={i} className="h-full" style={{
                width: `${(b.durationMinutes / totalMinutes) * 100}%`,
                background: CATEGORY_COLORS[b.category] || CATEGORY_COLORS["其他"]
              }} title={`${b.activity} ${b.durationMinutes}m`} />
            ))}
          </div>
          {/* Timeline items */}
          <div className="space-y-1.5">
            {blocks.map((block, i) => (
              <div key={i} className="flex items-center gap-2 group">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: CATEGORY_COLORS[block.category] || CATEGORY_COLORS["其他"] }} />
                {editingIdx === i && editBlock ? (
                  <div className="flex-1 flex items-center gap-1">
                    <input value={editBlock.startTime} onChange={e => setEditBlock({ ...editBlock, startTime: e.target.value })}
                      className="w-12 bg-muted border border-border rounded px-1 py-0.5 text-[9px] text-foreground font-mono" />
                    <span className="text-[9px] text-muted-foreground">-</span>
                    <input value={editBlock.endTime} onChange={e => setEditBlock({ ...editBlock, endTime: e.target.value })}
                      className="w-12 bg-muted border border-border rounded px-1 py-0.5 text-[9px] text-foreground font-mono" />
                    <input value={editBlock.activity} onChange={e => setEditBlock({ ...editBlock, activity: e.target.value })}
                      className="flex-1 bg-muted border border-border rounded px-1 py-0.5 text-[9px] text-foreground" />
                    <button onClick={() => saveEdit(i)} className="text-primary"><Check size={12} /></button>
                    <button onClick={() => { setEditingIdx(null); setEditBlock(null); }} className="text-muted-foreground"><X size={12} /></button>
                  </div>
                ) : (
                  <>
                    <span className="text-[9px] font-mono text-muted-foreground w-[72px] flex-shrink-0">{block.startTime}-{block.endTime}</span>
                    <span className="text-[10px] text-foreground flex-1 truncate">{block.activity}</span>
                    <span className="text-[8px] text-muted-foreground font-mono">{block.durationMinutes}m</span>
                    <button onClick={() => { setEditingIdx(i); setEditBlock({ ...block }); }}
                      className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-primary transition-opacity">
                      <Pencil size={10} />
                    </button>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {loading && (
        <div className="bg-card border border-border rounded-xl p-4 flex items-center justify-center gap-2">
          <Loader2 size={14} className="animate-spin text-primary" />
          <span className="text-[11px] text-muted-foreground">{t("todo.timeline.extracting")}</span>
        </div>
      )}

      {!loading && blocks.length === 0 && (
        <div className="bg-card border border-border rounded-xl p-6 text-center space-y-2">
          <CalendarClock size={24} className="text-muted-foreground/30 mx-auto" />
          <p className="text-xs text-muted-foreground">{t("todo.timeline.empty_hint1")}</p>
          <p className="text-[10px] text-muted-foreground/50">{t("todo.timeline.empty_hint2")}</p>
          {hasMessages && (
            <button onClick={extractTimeline} className="text-[10px] text-primary mt-1">{t("todo.timeline.extract_cta")}</button>
          )}
        </div>
      )}

      {/* Today's completed tasks with time */}
      {allTodos.filter(t => t.status === "done" && (t.completedAt?.split("T")[0] === todayKey || t.sourceDate === todayKey)).length > 0 && (
        <div className="bg-card border border-border rounded-xl p-3">
          <div className="flex items-center gap-2 mb-2">
            <Check size={12} className="text-primary" />
            <span className="text-[11px] font-serif-sc text-foreground">{t("todo.timeline.today_completed")}</span>
          </div>
          <div className="space-y-1">
            {allTodos
              .filter(t => t.status === "done" && (t.completedAt?.split("T")[0] === todayKey || t.sourceDate === todayKey))
              .map(t => (
                <div key={t.id} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary/40" />
                  <span className="text-[10px] text-muted-foreground line-through flex-1 truncate">{t.text}</span>
                  {t.note?.includes("⏱") && (
                    <span className="text-[8px] font-mono text-primary/60">{t.note.match(/⏱\s*(\S+)/)?.[1]}</span>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default TodoPage;
