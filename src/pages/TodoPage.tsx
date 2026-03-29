import { useState, useMemo, useEffect, useRef } from "react";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { format, startOfWeek, addDays, isToday } from "date-fns";
import { Play, Pause, X, Check, Trash2, Pencil, MessageCircle, LayoutGrid, List, ArrowRight, Clock, Palette, BarChart3, Grid3X3 } from "lucide-react";
import type { TodoItem, HabitItem, Priority, TaskStatus } from "@/types/lifeOs";
import { useNavigate } from "react-router-dom";
import ThemeSettings from "@/components/ThemeSettings";

const PRIORITY_CONFIG: Record<Priority, { label: string; emoji: string; color: string }> = {
  urgent: { label: "紧急", emoji: "🔴", color: "text-los-red" },
  high: { label: "重要", emoji: "🟠", color: "text-los-orange" },
  normal: { label: "普通", emoji: "🔵", color: "text-los-blue" },
  low: { label: "可选", emoji: "⚪", color: "text-muted-foreground" },
};

type ViewMode = "list" | "board";
type StatusColumn = "todo" | "doing" | "done";

const COLUMN_CONFIG: Record<StatusColumn, { label: string; emoji: string; bg: string }> = {
  todo: { label: "待办", emoji: "📋", bg: "border-gold/30" },
  doing: { label: "进行中", emoji: "⚡", bg: "border-los-orange/30" },
  done: { label: "已完成", emoji: "✅", bg: "border-los-green/30" },
};

const TodoPage = () => {
  const {
    allTodos, todayKey, toggleTodo, updateTodo, addTodoToDate, deleteTodo,
    habits, addHabit, checkInHabit, deleteHabit,
  } = useLifeOs();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"all" | "today" | "board" | "habits">("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);

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

  const todayTodos = useMemo(() =>
    allTodos.filter(t => t.status !== "done" && t.status !== "dropped" && (!t.dueDate || t.dueDate === todayKey)),
    [allTodos, todayKey]
  );

  const groupedByPriority = useMemo(() => {
    const groups: Record<Priority, TodoItem[]> = { urgent: [], high: [], normal: [], low: [] };
    allTodos.filter(t => t.status !== "done" && t.status !== "dropped")
      .forEach(t => groups[t.priority]?.push(t));
    return groups;
  }, [allTodos]);

  // Kanban columns
  const boardColumns = useMemo(() => {
    const cols: Record<StatusColumn, TodoItem[]> = { todo: [], doing: [], done: [] };
    allTodos.forEach(t => {
      if (t.status === "done") cols.done.push(t);
      else if (t.status === "doing") cols.doing.push(t);
      else if (t.status !== "dropped") cols.todo.push(t);
    });
    // Sort by priority within each column
    const priorityOrder: Record<string, number> = { urgent: 0, high: 1, normal: 2, low: 3 };
    Object.values(cols).forEach(col =>
      col.sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2))
    );
    return cols;
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

  const todayDoneCount = useMemo(() =>
    allTodos.filter(t => t.status === "done" && t.completedAt?.startsWith(todayKey)).length,
    [allTodos, todayKey]
  );

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
        <button
          onClick={() => navigate("/")}
          className="text-xs text-gold bg-gold/10 px-3 py-1 rounded-full flex items-center gap-1"
        >
          <MessageCircle size={12} /> 对话生成任务
        </button>
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

      {/* Tabs */}
      <div className="flex gap-1 px-4 mb-3">
        {([
          { key: "all" as const, label: "列表", icon: <List size={10} /> },
          { key: "board" as const, label: "看板", icon: <LayoutGrid size={10} /> },
          { key: "today" as const, label: "今日" },
          { key: "habits" as const, label: "习惯" },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-xs px-3 py-1.5 rounded-full transition flex items-center gap-1 ${tab === t.key ? "bg-gold text-background" : "bg-surface-2 text-muted-foreground"}`}
          >
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* Board (Kanban) view */}
        {tab === "board" && (
          <div className="space-y-4">
            {(["todo", "doing", "done"] as StatusColumn[]).map(col => {
              const items = boardColumns[col];
              const cfg = COLUMN_CONFIG[col];
              return (
                <div key={col} className={`border-l-2 ${cfg.bg} pl-3`}>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs text-foreground font-serif-sc flex items-center gap-1.5">
                      <span>{cfg.emoji}</span>
                      <span>{cfg.label}</span>
                      <span className="text-[10px] font-mono-jb text-muted-foreground ml-1">{items.length}</span>
                    </div>
                  </div>
                  {items.length === 0 ? (
                    <div className="text-[10px] text-muted-foreground/50 py-3">暂无任务</div>
                  ) : (
                    <div className="space-y-1.5">
                      {items.map(todo => (
                        <BoardCard
                          key={todo.id}
                          todo={todo}
                          column={col}
                          onMove={moveToStatus}
                          onToggle={handleToggle}
                          onStartPomodoro={() => { setPomodoroTask(todo.text); setPomodoroActive(true); setPomodoroRunning(true); setPomodoroTime(25 * 60); }}
                          onEdit={() => setEditingId(editingId === todo.id ? null : todo.id)}
                          editing={editingId === todo.id}
                          onUpdate={(updates) => { updateTodo(todo.sourceDate || todayKey, todo.id, updates); setEditingId(null); }}
                          onDelete={() => deleteTodo(todo.sourceDate || todayKey, todo.id)}
                        />
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* All (list) tab */}
        {tab === "all" && (
          <div className="space-y-4">
            {(["urgent", "high", "normal", "low"] as Priority[]).map(p => {
              const items = groupedByPriority[p];
              if (!items.length) return null;
              const cfg = PRIORITY_CONFIG[p];
              return (
                <div key={p}>
                  <div className="text-[10px] text-muted-foreground mb-1.5 font-mono-jb">{cfg.emoji} {cfg.label}</div>
                  <div className="space-y-1.5">
                    {items.map(todo => (
                      <TodoCard
                        key={todo.id} todo={todo} onToggle={handleToggle}
                        expanded={expandedId === todo.id}
                        onExpand={() => setExpandedId(expandedId === todo.id ? null : todo.id)}
                        celebrating={celebrateId === todo.id}
                        onStartPomodoro={() => { setPomodoroTask(todo.text); setPomodoroActive(true); setPomodoroRunning(true); setPomodoroTime(25 * 60); }}
                        editing={editingId === todo.id}
                        onEdit={() => setEditingId(editingId === todo.id ? null : todo.id)}
                        onUpdate={(updates) => { updateTodo(todo.sourceDate || todayKey, todo.id, updates); setEditingId(null); }}
                        onDelete={() => deleteTodo(todo.sourceDate || todayKey, todo.id)}
                        onMove={moveToStatus}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
            {allTodos.filter(t => t.status !== "done" && t.status !== "dropped").length === 0 && (
              <div className="text-center py-12">
                <div className="text-3xl mb-3">📝</div>
                <div className="text-muted-foreground text-xs mb-2">暂无待办</div>
                <p className="text-[10px] text-muted-foreground/60">回到「今天」和罗盘聊聊，说出你要做的事</p>
              </div>
            )}
          </div>
        )}

        {/* Today tab */}
        {tab === "today" && (
          <div>
            <div className="bg-surface-2 rounded-xl p-3 mb-3">
              <div className="flex justify-between items-center text-xs mb-1.5">
                <span className="text-muted-foreground">今日进度</span>
                <span className="text-gold font-mono-jb">{todayDoneCount}/{todayTodos.length + todayDoneCount}</span>
              </div>
              <div className="h-1.5 bg-surface-3 rounded-full overflow-hidden">
                <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${(todayDoneCount / Math.max(todayTodos.length + todayDoneCount, 1)) * 100}%` }} />
              </div>
            </div>
            <div className="space-y-1.5">
              {todayTodos.map(todo => (
                <TodoCard
                  key={todo.id} todo={todo} onToggle={handleToggle}
                  expanded={expandedId === todo.id}
                  onExpand={() => setExpandedId(expandedId === todo.id ? null : todo.id)}
                  celebrating={celebrateId === todo.id}
                  onStartPomodoro={() => { setPomodoroTask(todo.text); setPomodoroActive(true); setPomodoroRunning(true); setPomodoroTime(25 * 60); }}
                  editing={editingId === todo.id}
                  onEdit={() => setEditingId(editingId === todo.id ? null : todo.id)}
                  onUpdate={(updates) => { updateTodo(todo.sourceDate || todayKey, todo.id, updates); setEditingId(null); }}
                  onDelete={() => deleteTodo(todo.sourceDate || todayKey, todo.id)}
                  onMove={moveToStatus}
                />
              ))}
              {todayTodos.length === 0 && (
                <div className="text-center py-12">
                  <div className="text-muted-foreground text-xs">今天没有待办 🎉</div>
                  <p className="text-[10px] text-muted-foreground/60 mt-1">和罗盘说说你的计划吧</p>
                </div>
              )}
            </div>
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
    </div>
  );
};

// Board Card for Kanban view
function BoardCard({ todo, column, onMove, onToggle, onStartPomodoro, editing, onEdit, onUpdate, onDelete }: {
  todo: TodoItem; column: StatusColumn;
  onMove: (todo: TodoItem, status: TaskStatus) => void;
  onToggle: (t: TodoItem) => void;
  onStartPomodoro: () => void;
  editing: boolean; onEdit: () => void;
  onUpdate: (updates: Partial<TodoItem>) => void;
  onDelete: () => void;
}) {
  const [editText, setEditText] = useState(todo.text);
  const [editPriority, setEditPriority] = useState(todo.priority);

  const nextStatus: Record<StatusColumn, StatusColumn | null> = {
    todo: "doing",
    doing: "done",
    done: null,
  };
  const prevStatus: Record<StatusColumn, StatusColumn | null> = {
    todo: null,
    doing: "todo",
    done: "doing",
  };

  return (
    <div className="bg-surface-2 border border-border rounded-lg p-2.5 group">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <div className="text-xs text-foreground leading-relaxed">{todo.text}</div>
          <div className="flex gap-1 mt-1 flex-wrap">
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-3 text-muted-foreground">
              {PRIORITY_CONFIG[todo.priority]?.emoji} {PRIORITY_CONFIG[todo.priority]?.label}
            </span>
            {todo.dueDate && <span className="text-[9px] px-1.5 py-0.5 rounded bg-surface-3 text-muted-foreground font-mono-jb">{todo.dueDate}</span>}
            {todo.tags?.map(t => <span key={t} className="text-[9px] bg-gold-light text-gold px-1.5 py-0.5 rounded">{t}</span>)}
          </div>
          {todo.note && <p className="text-[9px] text-muted-foreground/70 mt-1 italic">{todo.note}</p>}
        </div>
        <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {prevStatus[column] && (
            <button onClick={() => onMove(todo, prevStatus[column]!)} className="text-muted-foreground hover:text-foreground p-0.5" title="移回上一步">
              <ArrowRight size={10} className="rotate-180" />
            </button>
          )}
          {nextStatus[column] && (
            <button onClick={() => onMove(todo, nextStatus[column]!)} className="text-muted-foreground hover:text-gold p-0.5" title="移到下一步">
              <ArrowRight size={10} />
            </button>
          )}
          <button onClick={onEdit} className="text-muted-foreground hover:text-gold p-0.5">
            <Pencil size={10} />
          </button>
          <button onClick={onStartPomodoro} className="text-muted-foreground hover:text-gold p-0.5">
            <Play size={10} />
          </button>
        </div>
      </div>

      {/* Inline edit */}
      {editing && (
        <div className="mt-2 pt-2 border-t border-border space-y-2">
          <input value={editText} onChange={e => setEditText(e.target.value)}
            className="w-full bg-background border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-gold-border" />
          <div className="flex gap-1">
            {(["urgent", "high", "normal", "low"] as Priority[]).map(p => (
              <button key={p} onClick={() => setEditPriority(p)}
                className={`text-[10px] px-2 py-0.5 rounded-full transition ${editPriority === p ? "bg-gold text-background" : "bg-surface-3 text-muted-foreground"}`}>
                {PRIORITY_CONFIG[p].emoji}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            <button onClick={() => onUpdate({ text: editText, priority: editPriority })} className="flex-1 bg-gold text-background py-1 rounded-lg text-xs">保存</button>
            <button onClick={onDelete} className="px-3 py-1 text-xs text-destructive bg-destructive/10 rounded-lg">删除</button>
          </div>
        </div>
      )}
    </div>
  );
}

// TodoCard component for list view
function TodoCard({ todo, onToggle, expanded, onExpand, celebrating, onStartPomodoro, editing, onEdit, onUpdate, onDelete, onMove }: {
  todo: TodoItem; onToggle: (t: TodoItem) => void; expanded: boolean;
  onExpand: () => void; celebrating: boolean; onStartPomodoro: () => void;
  editing: boolean; onEdit: () => void;
  onUpdate: (updates: Partial<TodoItem>) => void;
  onDelete: () => void;
  onMove: (todo: TodoItem, status: TaskStatus) => void;
}) {
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
          <div className="flex gap-1 mt-0.5">
            {isDoing && <span className="text-[8px] bg-los-orange/20 text-los-orange px-1.5 rounded">进行中</span>}
            {todo.dueDate && <span className="text-[8px] text-muted-foreground font-mono-jb">{todo.dueDate}</span>}
            {todo.tags?.map(t => <span key={t} className="text-[8px] bg-gold-light text-gold px-1 rounded">{t}</span>)}
            {todo.subTasks?.length > 0 && (
              <span className="text-[8px] text-muted-foreground font-mono-jb">
                {todo.subTasks.filter(s => s.done).length}/{todo.subTasks.length}
              </span>
            )}
          </div>
        </button>
        <div className="flex gap-1">
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
          <button onClick={onStartPomodoro} className="text-muted-foreground hover:text-gold transition p-1">
            <Play size={12} />
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

export default TodoPage;
