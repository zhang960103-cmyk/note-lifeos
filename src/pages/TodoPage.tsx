import { useState, useMemo, useEffect, useRef } from "react";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { format, startOfWeek, addDays, isToday, subDays } from "date-fns";
import { Play, Pause, X, Check, Trash2, Pencil, MessageCircle, ArrowRight, Clock, BarChart3, Grid3X3, ChevronDown, ChevronRight } from "lucide-react";
import type { TodoItem, HabitItem, Priority, TaskStatus } from "@/types/lifeOs";
import { useNavigate } from "react-router-dom";

const PRIORITY_CONFIG: Record<Priority, { labelKey: string; emoji: string; color: string }> = {
  urgent: { labelKey: "todo.priority.urgent", emoji: "🔴", color: "text-los-red" },
  high: { labelKey: "todo.priority.high", emoji: "🟠", color: "text-los-orange" },
  normal: { labelKey: "todo.priority.normal", emoji: "🔵", color: "text-los-blue" },
  low: { labelKey: "todo.priority.low", emoji: "⚪", color: "text-muted-foreground" },
};

type TabKey = "smart" | "matrix" | "habits" | "templates";
type StatusColumn = "todo" | "doing" | "done";

const COLUMN_CONFIG: Record<StatusColumn, { labelKey: string; emoji: string; bg: string }> = {
  todo: { labelKey: "todo.column.todo", emoji: "📋", bg: "border-gold/30" },
  doing: { labelKey: "todo.column.doing", emoji: "⚡", bg: "border-los-orange/30" },
  done: { labelKey: "todo.column.done", emoji: "✅", bg: "border-los-green/30" },
};

const TodoPage = () => {
  const {
    allTodos, todayKey, toggleTodo, updateTodo, addTodoToDate, deleteTodo,
    habits, addHabit, checkInHabit, deleteHabit,
  } = useLifeOs();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [tab, setTab] = useState<TabKey>("smart");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set(["done"]));

  // Time tracking
  const [trackingTodoId, setTrackingTodoId] = useState<string | null>(null);
  const [trackingStart, setTrackingStart] = useState<number | null>(null);
  const [trackingElapsed, setTrackingElapsed] = useState(0);

  // Pomodoro state
  const [pomodoroActive, setPomodoroActive] = useState(false);
  const [pomodoroTask, setPomodoroTask] = useState<string>("");
  const [pomodoroTime, setPomodoroTime] = useState(25 * 60);
  const [pomodoroRunning, setPomodoroRunning] = useState(false);
  const pomodoroRef = useRef<number | null>(null);

  // Habit create
  const [showHabitCreate, setShowHabitCreate] = useState(false);
  const [habitName, setHabitName] = useState("");
  const [habitEmoji, setHabitEmoji] = useState("💪");

  // Celebration
  const [celebrateId, setCelebrateId] = useState<string | null>(null);

  // Pomodoro timer
  useEffect(() => {
    if (pomodoroRunning && pomodoroTime > 0) {
      pomodoroRef.current = window.setInterval(() => {
        setPomodoroTime(prev => {
          if (prev <= 1) {
            setPomodoroRunning(false);
            if (Notification.permission === "granted") {
              new Notification("🍅 番茄钟结束！", { body: "休息5分钟吧" });
            }
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (pomodoroRef.current) clearInterval(pomodoroRef.current); };
  }, [pomodoroRunning, pomodoroTime]);

  // Time tracking timer
  useEffect(() => {
    if (!trackingTodoId || !trackingStart) return;
    const iv = setInterval(() => setTrackingElapsed(Math.floor((Date.now() - trackingStart) / 1000)), 1000);
    return () => clearInterval(iv);
  }, [trackingTodoId, trackingStart]);

  const startTracking = (todoId: string) => {
    setTrackingTodoId(todoId);
    setTrackingStart(Date.now());
    setTrackingElapsed(0);
  };
  const stopTracking = () => {
    setTrackingTodoId(null);
    setTrackingStart(null);
    setTrackingElapsed(0);
  };
  const formatTracking = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  // Eisenhower matrix
  const eisenhowerMatrix = useMemo(() => {
    const active = allTodos.filter(t => t.status !== "done" && t.status !== "dropped");
    return {
      urgentImportant: active.filter(t => t.priority === "urgent"),
      notUrgentImportant: active.filter(t => t.priority === "high"),
      urgentNotImportant: active.filter(t => t.priority === "normal"),
      notUrgentNotImportant: active.filter(t => t.priority === "low"),
    };
  }, [allTodos]);

  // Smart unified view: group by status, then by priority within each status
  const smartGroups = useMemo(() => {
    const doing = allTodos.filter(t => t.status === "doing");
    const todo = allTodos.filter(t => t.status === "todo" || (t.status !== "done" && t.status !== "dropped" && t.status !== "doing"));
    const done = allTodos.filter(t => t.status === "done");
    const priorityOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
    const sort = (arr: TodoItem[]) => [...arr].sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2));
    return {
      doing: sort(doing),
      todo: sort(todo),
      done: sort(done),
    };
  }, [allTodos]);

  // Stats
  const stats = useMemo(() => {
    const total = allTodos.filter(t => t.status !== "dropped").length;
    const done = allTodos.filter(t => t.status === "done").length;
    const doing = allTodos.filter(t => t.status === "doing").length;
    const todo = total - done - doing;
    const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
    return { total, done, doing, todo, completionRate };
  }, [allTodos]);

  const handleToggle = (todo: TodoItem) => {
    const sourceDate = todo.sourceDate || todayKey;
    toggleTodo(sourceDate, todo.id);
    if (todo.status !== "done") {
      setCelebrateId(todo.id);
      setTimeout(() => setCelebrateId(null), 800);
    }
  };

  const moveToStatus = (todo: TodoItem, newStatus: TaskStatus) => {
    const sourceDate = todo.sourceDate || todayKey;
    updateTodo(sourceDate, todo.id, {
      status: newStatus,
      completedAt: newStatus === "done" ? new Date().toISOString() : undefined,
    });
  };

  const toggleSection = (key: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Week days for habits
  const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = addDays(weekStart, i);
    return { date: format(d, "yyyy-MM-dd"), label: ["一", "二", "三", "四", "五", "六", "日"][i], isToday: isToday(d) };
  });

  // Pomodoro overlay
  if (pomodoroActive) {
    const mins = Math.floor(pomodoroTime / 60);
    const secs = pomodoroTime % 60;
    const progress = 1 - pomodoroTime / (25 * 60);
    return (
      <div className="flex flex-col items-center justify-center h-full bg-background">
        <p className="text-xs text-muted-foreground mb-6">{pomodoroTask}</p>
        <div className="relative w-48 h-48 mb-8">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
            <circle cx="50" cy="50" r="45" fill="none" stroke="hsl(var(--border))" strokeWidth="2" />
            <circle
              cx="50" cy="50" r="45" fill="none" stroke="hsl(var(--gold))" strokeWidth="3"
              strokeDasharray={`${progress * 283} 283`} strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-3xl font-mono-jb text-foreground">{mins}:{secs.toString().padStart(2, "0")}</span>
          </div>
        </div>
        <div className="flex gap-4">
          <button onClick={() => setPomodoroRunning(!pomodoroRunning)} className="bg-surface-2 p-3 rounded-full">
            {pomodoroRunning ? <Pause size={20} className="text-foreground" /> : <Play size={20} className="text-foreground" />}
          </button>
          <button onClick={() => { setPomodoroActive(false); setPomodoroTime(25 * 60); setPomodoroRunning(false); }} className="bg-surface-2 p-3 rounded-full">
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
        <span className="font-serif-sc text-lg text-foreground">待办</span>
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("/time-stats")}
            className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-full flex items-center gap-1.5 hover:bg-primary/20 transition font-medium"
            title="时间统计">
            <BarChart3 size={12} /> <span>时间去哪了</span>
          </button>
          <button onClick={() => navigate("/")} className="text-xs text-gold bg-gold/10 px-3 py-1 rounded-full flex items-center gap-1">
            <MessageCircle size={12} /> 对话
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="px-4 mb-3">
        <div className="bg-surface-2 border border-border rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex gap-3 text-center">
              <div>
                <div className="text-lg font-mono-jb text-gold">{stats.completionRate}%</div>
                <div className="text-[9px] text-muted-foreground">完成率</div>
              </div>
              <div className="w-px bg-border" />
              <div>
                <div className="text-sm font-mono-jb text-foreground">{stats.todo}</div>
                <div className="text-[9px] text-muted-foreground">待办</div>
              </div>
              <div>
                <div className="text-sm font-mono-jb text-los-orange">{stats.doing}</div>
                <div className="text-[9px] text-muted-foreground">进行</div>
              </div>
              <div>
                <div className="text-sm font-mono-jb text-los-green">{stats.done}</div>
                <div className="text-[9px] text-muted-foreground">完成</div>
              </div>
            </div>
          </div>
          <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden flex">
            <div className="h-full bg-los-green rounded-l-full transition-all" style={{ width: `${stats.total > 0 ? (stats.done / stats.total) * 100 : 0}%` }} />
            <div className="h-full bg-los-orange transition-all" style={{ width: `${stats.total > 0 ? (stats.doing / stats.total) * 100 : 0}%` }} />
          </div>
        </div>
      </div>

      {/* Tabs - simplified */}
      <div className="flex gap-1 px-4 mb-3">
        {([
          { key: "smart" as TabKey, labelKey: "todo.smart", icon: "⚡" },
          { key: "matrix" as TabKey, labelKey: "todo.matrix", icon: "📊" },
          { key: "habits" as TabKey, labelKey: "todo.habits", icon: "💪" },
          { key: "templates" as TabKey, labelKey: "todo.templates", icon: "📋" },
        ]).map(tb => (
          <button
            key={tb.key}
            onClick={() => setTab(tb.key)}
            className={`text-xs px-3 py-1.5 rounded-full transition flex items-center gap-1 ${tab === tb.key ? "bg-gold text-background" : "bg-surface-2 text-muted-foreground"}`}
          >
            {tb.icon} {t(tb.labelKey)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* Smart unified view - merged list + kanban */}
        {tab === "smart" && (
          <div className="space-y-3">
            {/* Doing section */}
            {smartGroups.doing.length > 0 && (
              <SmartSection
                title="进行中" emoji="⚡" count={smartGroups.doing.length}
                borderColor="border-los-orange/30"
                collapsed={collapsedSections.has("doing")}
                onToggle={() => toggleSection("doing")}
              >
                {smartGroups.doing.map(todo => (
                  <TodoCard
                    key={todo.id} todo={todo} onToggle={handleToggle}
                    expanded={expandedId === todo.id}
                    onExpand={() => setExpandedId(expandedId === todo.id ? null : todo.id)}
                    celebrating={celebrateId === todo.id}
                    onStartPomodoro={() => { setPomodoroTask(todo.text); setPomodoroActive(true); setPomodoroRunning(true); setPomodoroTime(25 * 60); }}
                    onStartTracking={() => startTracking(todo.id)}
                    isTracking={trackingTodoId === todo.id}
                    trackingTime={trackingTodoId === todo.id ? formatTracking(trackingElapsed) : undefined}
                    editing={editingId === todo.id}
                    onEdit={() => setEditingId(editingId === todo.id ? null : todo.id)}
                    onUpdate={(updates) => { updateTodo(todo.sourceDate || todayKey, todo.id, updates); setEditingId(null); }}
                    onDelete={() => deleteTodo(todo.sourceDate || todayKey, todo.id)}
                    onMove={moveToStatus}
                  />
                ))}
              </SmartSection>
            )}

            {/* Todo section */}
            <SmartSection
              title="待办" emoji="📋" count={smartGroups.todo.length}
              borderColor="border-gold/30"
              collapsed={collapsedSections.has("todo")}
              onToggle={() => toggleSection("todo")}
            >
              {smartGroups.todo.length === 0 ? (
                <div className="text-center py-6">
                  <div className="text-muted-foreground text-xs">暂无待办 🎉</div>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">和罗盘说说你的计划吧</p>
                </div>
              ) : smartGroups.todo.map(todo => (
                <TodoCard
                  key={todo.id} todo={todo} onToggle={handleToggle}
                  expanded={expandedId === todo.id}
                  onExpand={() => setExpandedId(expandedId === todo.id ? null : todo.id)}
                  celebrating={celebrateId === todo.id}
                  onStartPomodoro={() => { setPomodoroTask(todo.text); setPomodoroActive(true); setPomodoroRunning(true); setPomodoroTime(25 * 60); }}
                  onStartTracking={() => startTracking(todo.id)}
                  isTracking={trackingTodoId === todo.id}
                  trackingTime={trackingTodoId === todo.id ? formatTracking(trackingElapsed) : undefined}
                  editing={editingId === todo.id}
                  onEdit={() => setEditingId(editingId === todo.id ? null : todo.id)}
                  onUpdate={(updates) => { updateTodo(todo.sourceDate || todayKey, todo.id, updates); setEditingId(null); }}
                  onDelete={() => deleteTodo(todo.sourceDate || todayKey, todo.id)}
                  onMove={moveToStatus}
                />
              ))}
            </SmartSection>

            {/* Done section - collapsed by default */}
            {smartGroups.done.length > 0 && (
              <SmartSection
                title="已完成" emoji="✅" count={smartGroups.done.length}
                borderColor="border-los-green/30"
                collapsed={collapsedSections.has("done")}
                onToggle={() => toggleSection("done")}
              >
                {smartGroups.done.map(todo => (
                  <TodoCard
                    key={todo.id} todo={todo} onToggle={handleToggle}
                    expanded={expandedId === todo.id}
                    onExpand={() => setExpandedId(expandedId === todo.id ? null : todo.id)}
                    celebrating={celebrateId === todo.id}
                    onStartPomodoro={() => {}}
                    onStartTracking={() => {}}
                    isTracking={false}
                    editing={editingId === todo.id}
                    onEdit={() => setEditingId(editingId === todo.id ? null : todo.id)}
                    onUpdate={(updates) => { updateTodo(todo.sourceDate || todayKey, todo.id, updates); setEditingId(null); }}
                    onDelete={() => deleteTodo(todo.sourceDate || todayKey, todo.id)}
                    onMove={moveToStatus}
                  />
                ))}
              </SmartSection>
            )}
          </div>
        )}

        {/* Eisenhower Matrix */}
        {tab === "matrix" && (
          <div className="grid grid-cols-2 gap-2">
            {([
              { key: "urgentImportant", label: "🔴 紧急重要", desc: "立即做", bg: "border-los-red/30" },
              { key: "notUrgentImportant", label: "🟠 重要不紧急", desc: "计划做", bg: "border-los-orange/30" },
              { key: "urgentNotImportant", label: "🔵 紧急不重要", desc: "委托做", bg: "border-los-blue/30" },
              { key: "notUrgentNotImportant", label: "⚪ 不紧急不重要", desc: "考虑删", bg: "border-muted-foreground/20" },
            ] as const).map(q => {
              const items = eisenhowerMatrix[q.key];
              return (
                <div key={q.key} className={`border-l-2 ${q.bg} bg-surface-2 rounded-xl p-2.5 min-h-[120px]`}>
                  <div className="text-[10px] text-foreground font-serif-sc mb-0.5">{q.label}</div>
                  <div className="text-[8px] text-muted-foreground/60 mb-2">{q.desc}</div>
                  <div className="space-y-1">
                    {items.length === 0 ? (
                      <p className="text-[9px] text-muted-foreground/40">空</p>
                    ) : items.slice(0, 5).map(t => (
                      <div key={t.id} className="flex items-center gap-1.5">
                        <button onClick={() => handleToggle(t)} className="flex-shrink-0">
                          <div className={`w-3.5 h-3.5 rounded-full border ${t.status === "doing" ? "bg-los-orange border-los-orange" : "border-muted-foreground"}`} />
                        </button>
                        <span className="text-[10px] text-foreground truncate">{t.text}</span>
                      </div>
                    ))}
                    {items.length > 5 && <p className="text-[8px] text-muted-foreground/50">+{items.length - 5} 更多</p>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Habits tab */}
        {tab === "habits" && (
          <div className="space-y-3">
            {habits.map(habit => (
              <div key={habit.id} className="bg-surface-2 border border-border rounded-xl p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm">{habit.emoji} {habit.name}</span>
                  <button onClick={() => deleteHabit(habit.id)} className="text-muted-foreground hover:text-destructive"><Trash2 size={12} /></button>
                </div>
                <div className="flex gap-1.5 items-center">
                  {weekDays.map(d => {
                    const checked = habit.checkIns.includes(d.date);
                    return (
                      <button
                        key={d.date}
                        onClick={() => checkInHabit(habit.id, d.date)}
                        className="flex flex-col items-center gap-0.5"
                      >
                        <span className="text-[8px] text-muted-foreground">{d.label}</span>
                        <div className={`w-5 h-5 rounded-full border transition-all ${checked ? "bg-gold border-gold scale-110" : "border-border"} ${d.isToday ? "ring-1 ring-gold/30" : ""}`} />
                      </button>
                    );
                  })}
                  <button
                    onClick={() => checkInHabit(habit.id, todayKey)}
                    className={`ml-auto text-[10px] px-3 py-1 rounded-full transition ${habit.checkIns.includes(todayKey) ? "bg-gold/20 text-gold" : "bg-surface-3 text-muted-foreground"}`}
                  >
                    {habit.checkIns.includes(todayKey) ? "已打卡 ✓" : "打卡"}
                  </button>
                </div>
              </div>
            ))}
            <button onClick={() => setShowHabitCreate(true)} className="w-full border border-dashed border-border rounded-xl py-3 text-xs text-muted-foreground hover:text-foreground transition">
              + 添加习惯
            </button>
          </div>
        )}

        {/* Plan Templates tab */}
        {tab === "templates" && (
          <PlanTemplates addTodoToDate={addTodoToDate} todayKey={todayKey} />
        )}

        {/* Streak & Reward bar */}
        <StreakReward allTodos={allTodos} />
      </div>

      {/* Habit Create */}
      {showHabitCreate && (
        <div className="absolute inset-x-0 bottom-0 bg-surface-1 border-t border-border rounded-t-2xl p-5 z-50">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs text-foreground font-serif-sc">添加习惯</span>
            <button onClick={() => setShowHabitCreate(false)}><X size={16} className="text-muted-foreground" /></button>
          </div>
          <div className="flex gap-2 mb-3">
            <select value={habitEmoji} onChange={e => setHabitEmoji(e.target.value)}
              className="bg-surface-2 border border-border rounded-xl px-3 py-2 text-lg">
              {["💪", "📚", "🏃", "💧", "🧘", "✍️", "🎯", "😴"].map(e => <option key={e} value={e}>{e}</option>)}
            </select>
            <input value={habitName} onChange={e => setHabitName(e.target.value)} placeholder="习惯名称" autoFocus
              className="flex-1 bg-surface-2 border border-border rounded-xl px-4 py-2 text-sm text-foreground focus:outline-none focus:border-gold-border" />
          </div>
          <button onClick={() => {
            if (habitName.trim()) {
              addHabit({ name: habitName, emoji: habitEmoji, targetDays: [1, 2, 3, 4, 5] });
              setHabitName(""); setShowHabitCreate(false);
            }
          }} disabled={!habitName.trim()} className="w-full bg-gold text-background py-2.5 rounded-xl text-sm disabled:opacity-30">
            保存
          </button>
        </div>
      )}

      {/* Time tracking floating bar */}
      {trackingTodoId && (
        <div className="px-4 py-2 bg-gold/10 border-t border-gold-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock size={14} className="text-gold animate-pulse" />
            <span className="text-[11px] text-foreground truncate max-w-[180px]">
              {allTodos.find(t => t.id === trackingTodoId)?.text || "计时中"}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono-jb text-gold">{formatTracking(trackingElapsed)}</span>
            <button onClick={stopTracking} className="text-[10px] bg-surface-2 text-muted-foreground px-2 py-1 rounded-lg hover:text-foreground">
              停止
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

// Collapsible section for smart view
function SmartSection({ title, emoji, count, borderColor, collapsed, onToggle, children }: {
  title: string; emoji: string; count: number; borderColor: string;
  collapsed: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <div className={`border-l-2 ${borderColor} pl-3`}>
      <button onClick={onToggle} className="flex items-center gap-1.5 mb-2 w-full text-left">
        {collapsed ? <ChevronRight size={12} className="text-muted-foreground" /> : <ChevronDown size={12} className="text-muted-foreground" />}
        <span className="text-xs text-foreground font-serif-sc flex items-center gap-1.5">
          <span>{emoji}</span>
          <span>{title}</span>
          <span className="text-[10px] font-mono-jb text-muted-foreground ml-1">{count}</span>
        </span>
      </button>
      {!collapsed && <div className="space-y-1.5">{children}</div>}
    </div>
  );
}

// TodoCard component
function TodoCard({ todo, onToggle, expanded, onExpand, celebrating, onStartPomodoro, onStartTracking, isTracking, trackingTime, editing, onEdit, onUpdate, onDelete, onMove }: {
  todo: TodoItem; onToggle: (t: TodoItem) => void; expanded: boolean;
  onExpand: () => void; celebrating: boolean; onStartPomodoro: () => void;
  onStartTracking?: () => void; isTracking?: boolean; trackingTime?: string;
  editing: boolean; onEdit: () => void;
  onUpdate: (updates: Partial<TodoItem>) => void;
  onDelete: () => void;
  onMove: (todo: TodoItem, status: TaskStatus) => void;
}) {
  const { t: tr } = useLanguage();
  const isDone = todo.status === "done";
  const isDoing = todo.status === "doing";
  const [editText, setEditText] = useState(todo.text);
  const [editPriority, setEditPriority] = useState(todo.priority);
  const [editDueDate, setEditDueDate] = useState(todo.dueDate || "");
  const [editNote, setEditNote] = useState(todo.note || "");

  return (
    <div className={`bg-surface-2 border border-border rounded-xl overflow-hidden transition-all ${celebrating ? "ring-2 ring-gold animate-pulse" : ""}`}>
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <button onClick={() => onToggle(todo)} className="flex-shrink-0">
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${isDone ? "bg-los-green border-los-green" : isDoing ? "bg-los-orange border-los-orange" : "border-muted-foreground"}`}>
            {isDone && <Check size={10} className="text-background" />}
            {isDoing && <Play size={8} className="text-background" />}
          </div>
        </button>
        <button onClick={onExpand} className="flex-1 text-left min-w-0">
          <div className={`text-xs ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>{todo.text}</div>
          <div className="flex gap-1 mt-0.5 flex-wrap">
            <span className="text-[8px] px-1.5 py-0.5 rounded bg-surface-3 text-muted-foreground">
              {PRIORITY_CONFIG[todo.priority]?.emoji} {tr(PRIORITY_CONFIG[todo.priority]?.labelKey)}
            </span>
            {isDoing && <span className="text-[8px] bg-los-orange/20 text-los-orange px-1.5 rounded">{tr("todo.column.doing")}</span>}
            {todo.dueDate && <span className="text-[8px] text-muted-foreground font-mono-jb">{todo.dueDate}</span>}
            {todo.tags?.map(t => <span key={t} className="text-[8px] bg-gold-light text-gold px-1 rounded">{t}</span>)}
            {todo.subTasks?.length > 0 && (
              <span className="text-[8px] text-muted-foreground font-mono-jb">
                {todo.subTasks.filter(s => s.done).length}/{todo.subTasks.length}
              </span>
            )}
          </div>
        </button>
        <div className="flex gap-1 items-center">
          {isTracking && trackingTime && (
            <span className="text-[9px] font-mono-jb text-gold mr-1">{trackingTime}</span>
          )}
          {!isDone && onStartTracking && !isTracking && (
            <button onClick={onStartTracking} className="text-muted-foreground hover:text-gold transition p-1" title="计时">
              <Clock size={12} />
            </button>
          )}
          {!isDone && !isDoing && (
            <button onClick={() => onMove(todo, "doing")} className="text-muted-foreground hover:text-los-orange transition p-1" title="开始做">
              <Play size={12} />
            </button>
          )}
          {isDoing && (
            <button onClick={() => onMove(todo, "done")} className="text-muted-foreground hover:text-los-green transition p-1" title="完成">
              <Check size={12} />
            </button>
          )}
          <button onClick={onEdit} className="text-muted-foreground hover:text-gold transition p-1">
            <Pencil size={12} />
          </button>
        </div>
      </div>

      {/* Expanded view */}
      {expanded && !editing && (
        <div className="px-3 pb-3 border-t border-border pt-2 space-y-1.5">
          {todo.subTasks?.map(st => (
            <div key={st.id} className="flex items-center gap-2 text-xs">
              <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center ${st.done ? "bg-los-green border-los-green" : "border-muted-foreground"}`}>
                {st.done && <Check size={8} className="text-background" />}
              </div>
              <span className={st.done ? "line-through text-muted-foreground" : "text-foreground"}>{st.text}</span>
            </div>
          ))}
          {todo.note && <p className="text-[10px] text-muted-foreground">{todo.note}</p>}
          {todo.sourceDate && <p className="text-[8px] text-muted-foreground font-mono-jb">来源：{todo.sourceDate}</p>}
          {/* Quick status buttons */}
          <div className="flex gap-1 pt-1">
            {!isDone && !isDoing && (
              <button onClick={() => onMove(todo, "doing")} className="text-[9px] bg-los-orange/10 text-los-orange px-2 py-0.5 rounded-full">→ 开始</button>
            )}
            {isDoing && (
              <button onClick={() => onMove(todo, "done")} className="text-[9px] bg-los-green/10 text-los-green px-2 py-0.5 rounded-full">→ 完成</button>
            )}
            {isDone && (
              <button onClick={() => onMove(todo, "todo")} className="text-[9px] bg-surface-3 text-muted-foreground px-2 py-0.5 rounded-full">← 重新打开</button>
            )}
          </div>
        </div>
      )}

      {/* Inline edit mode */}
      {editing && (
        <div className="px-3 pb-3 border-t border-border pt-2 space-y-2">
          <input
            value={editText}
            onChange={e => setEditText(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-gold-border"
          />
          <div className="flex gap-1">
            {(["urgent", "high", "normal", "low"] as Priority[]).map(p => (
              <button key={p} onClick={() => setEditPriority(p)}
                className={`text-[10px] px-2 py-0.5 rounded-full transition ${editPriority === p ? "bg-gold text-background" : "bg-surface-3 text-muted-foreground"}`}>
                {PRIORITY_CONFIG[p].emoji}
              </button>
            ))}
          </div>
          <input
            type="date" value={editDueDate} onChange={e => setEditDueDate(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none"
          />
          <textarea
            value={editNote} onChange={e => setEditNote(e.target.value)}
            placeholder="备注" rows={2}
            className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground resize-none focus:outline-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => onUpdate({ text: editText, priority: editPriority, dueDate: editDueDate || undefined, note: editNote || undefined })}
              className="flex-1 bg-gold text-background py-1.5 rounded-lg text-xs"
            >
              保存
            </button>
            <button onClick={onDelete} className="px-3 py-1.5 text-xs text-destructive bg-destructive/10 rounded-lg">
              删除
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// Plan Templates component
const PLAN_TEMPLATES = [
  {
    name: "工作日模板",
    emoji: "💼",
    desc: "标准工作日安排",
    tasks: [
      { text: "晨间回顾 & 计划", priority: "high" as const, tags: ["工作"], dueTime: "08:00" },
      { text: "核心工作 - 深度时间", priority: "urgent" as const, tags: ["工作"], dueTime: "09:00" },
      { text: "午休 & 轻运动", priority: "normal" as const, tags: ["休息"], dueTime: "12:00" },
      { text: "下午协作 & 会议", priority: "normal" as const, tags: ["工作"], dueTime: "14:00" },
      { text: "总结复盘 & 记录", priority: "high" as const, tags: ["学习"], dueTime: "17:00" },
      { text: "个人成长时间", priority: "normal" as const, tags: ["学习"], dueTime: "20:00" },
    ],
  },
  {
    name: "休息日模板",
    emoji: "🌴",
    desc: "放松充电日",
    tasks: [
      { text: "自然醒 & 慢早餐", priority: "low" as const, tags: ["生活"], dueTime: "09:00" },
      { text: "阅读/学习新技能", priority: "normal" as const, tags: ["学习"], dueTime: "10:00" },
      { text: "运动健身", priority: "high" as const, tags: ["运动"], dueTime: "14:00" },
      { text: "社交/陪伴家人", priority: "normal" as const, tags: ["社交"], dueTime: "16:00" },
      { text: "兴趣爱好时间", priority: "low" as const, tags: ["娱乐"], dueTime: "19:00" },
      { text: "睡前复盘日记", priority: "high" as const, tags: ["学习"], dueTime: "22:00" },
    ],
  },
  {
    name: "冲刺日模板",
    emoji: "🚀",
    desc: "高强度产出日",
    tasks: [
      { text: "冥想 5min + 目标确认", priority: "high" as const, tags: ["工作"], dueTime: "07:00" },
      { text: "深度工作 Block 1 (3h)", priority: "urgent" as const, tags: ["工作"], dueTime: "08:00" },
      { text: "短休 + 补充能量", priority: "low" as const, tags: ["休息"], dueTime: "11:00" },
      { text: "深度工作 Block 2 (2h)", priority: "urgent" as const, tags: ["工作"], dueTime: "11:30" },
      { text: "午休", priority: "normal" as const, tags: ["休息"], dueTime: "13:30" },
      { text: "创造性工作 (2h)", priority: "high" as const, tags: ["工作"], dueTime: "15:00" },
      { text: "复盘 & 奖励自己", priority: "normal" as const, tags: ["生活"], dueTime: "18:00" },
    ],
  },
];

function PlanTemplates({ addTodoToDate, todayKey }: { addTodoToDate: (date: string, todo: TodoItem) => void; todayKey: string }) {
  const [applied, setApplied] = useState<string | null>(null);

  const applyTemplate = (template: typeof PLAN_TEMPLATES[0]) => {
    template.tasks.forEach(task => {
      const todo: TodoItem = {
        id: crypto.randomUUID(),
        text: task.text,
        status: "todo",
        priority: task.priority,
        tags: task.tags,
        subTasks: [],
        recur: "none",
        dueDate: todayKey,
        dueTime: task.dueTime,
        sourceDate: todayKey,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      addTodoToDate(todayKey, todo);
    });
    setApplied(template.name);
    setTimeout(() => setApplied(null), 2000);
  };

  return (
    <div className="space-y-3">
      <p className="text-[10px] text-muted-foreground">选择一个模板，一键套用到今天的待办</p>
      {PLAN_TEMPLATES.map(tmpl => (
        <div key={tmpl.name} className="bg-surface-2 border border-border rounded-xl p-3">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-foreground">{tmpl.emoji} {tmpl.name}</span>
            <button onClick={() => applyTemplate(tmpl)}
              className={`text-[10px] px-3 py-1 rounded-full transition ${applied === tmpl.name ? "bg-los-green/20 text-los-green" : "bg-gold/10 text-gold hover:bg-gold/20"}`}>
              {applied === tmpl.name ? "✅ 已套用" : "套用"}
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mb-2">{tmpl.desc}</p>
          <div className="space-y-1">
            {tmpl.tasks.map((task, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px]">
                <span className="text-muted-foreground font-mono-jb w-[36px]">{task.dueTime}</span>
                <span className="text-foreground">{task.text}</span>
                {task.tags.map(t => <span key={t} className="bg-surface-3 text-muted-foreground px-1 rounded text-[8px]">{t}</span>)}
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// Streak & Reward component
function StreakReward({ allTodos }: { allTodos: TodoItem[] }) {
  const streak = useMemo(() => {
    let count = 0;
    const now = new Date();
    for (let i = 0; i < 60; i++) {
      const d = format(subDays(now, i), "yyyy-MM-dd");
      const hasDone = allTodos.some(t => t.completedAt?.split("T")[0] === d);
      if (hasDone) count++;
      else if (i > 0) break;
    }
    return count;
  }, [allTodos]);

  const totalDone = allTodos.filter(t => t.status === "done").length;
  const level = totalDone >= 100 ? "🏆 大师" : totalDone >= 50 ? "⭐ 达人" : totalDone >= 20 ? "🌟 进阶" : "🌱 新手";

  const milestones = [
    { target: 10, reward: "🎯 初心者", unlocked: totalDone >= 10 },
    { target: 30, reward: "⚡ 行动派", unlocked: totalDone >= 30 },
    { target: 50, reward: "🔥 效率达人", unlocked: totalDone >= 50 },
    { target: 100, reward: "🏆 时间大师", unlocked: totalDone >= 100 },
  ];

  if (streak < 1 && totalDone < 3) return null;

  return (
    <div className="bg-card border border-primary/20 rounded-2xl p-3 mt-2">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm">🔥</span>
          <span className="text-xs text-foreground font-serif-sc">成就</span>
        </div>
        <span className="text-[10px] text-muted-foreground">{level}</span>
      </div>
      <div className="flex items-center gap-4 mb-2">
        <div className="text-center">
          <div className="text-lg font-mono-jb text-primary">{streak}</div>
          <div className="text-[8px] text-muted-foreground">连续天数</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-mono-jb text-foreground">{totalDone}</div>
          <div className="text-[8px] text-muted-foreground">总完成</div>
        </div>
      </div>
      <div className="flex gap-1">
        {milestones.map((m, i) => (
          <div key={i} className={`flex-1 text-center py-1 rounded-lg text-[8px] ${m.unlocked ? "bg-primary/10 text-primary" : "bg-surface-2 text-muted-foreground/40"}`}>
            {m.reward}
          </div>
        ))}
      </div>
    </div>
  );
}

export default TodoPage;
