import { useState, useMemo, useEffect, useRef } from "react";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { format, parseISO, startOfWeek, addDays, isToday } from "date-fns";
import { Plus, Zap, Play, Pause, RotateCcw, X, Check, Trash2 } from "lucide-react";
import { parseTodoNL } from "@/lib/streamChat";
import type { TodoItem, HabitItem, Priority } from "@/types/lifeOs";

const PRIORITY_CONFIG: Record<Priority, { label: string; emoji: string; color: string }> = {
  urgent: { label: "紧急", emoji: "🔴", color: "text-los-red" },
  high: { label: "重要", emoji: "🟠", color: "text-los-orange" },
  normal: { label: "普通", emoji: "🔵", color: "text-los-blue" },
  low: { label: "可选", emoji: "⚪", color: "text-muted-foreground" },
};

const TodoPage = () => {
  const {
    allTodos, todayKey, toggleTodo, updateTodo, addTodoToDate, entries,
    habits, addHabit, checkInHabit, deleteHabit,
  } = useLifeOs();
  const [tab, setTab] = useState<"all" | "today" | "habits">("all");
  const [showCreate, setShowCreate] = useState(false);
  const [showNL, setShowNL] = useState(false);
  const [nlInput, setNLInput] = useState("");
  const [nlLoading, setNLLoading] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Pomodoro state
  const [pomodoroActive, setPomodoroActive] = useState(false);
  const [pomodoroTask, setPomodoroTask] = useState<string>("");
  const [pomodoroTime, setPomodoroTime] = useState(25 * 60);
  const [pomodoroRunning, setPomodoroRunning] = useState(false);
  const pomodoroRef = useRef<number | null>(null);

  // Create form state
  const [newText, setNewText] = useState("");
  const [newPriority, setNewPriority] = useState<Priority>("normal");
  const [newDueDate, setNewDueDate] = useState("");
  const [newDueTime, setNewDueTime] = useState("");
  const [newTags, setNewTags] = useState<string[]>([]);
  const [newTagInput, setNewTagInput] = useState("");
  const [newNote, setNewNote] = useState("");
  const [newSubTasks, setNewSubTasks] = useState<string[]>([]);
  const [newSubInput, setNewSubInput] = useState("");

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

  const handleCreate = () => {
    if (!newText.trim()) return;
    const now = new Date().toISOString();
    const todo: TodoItem = {
      id: crypto.randomUUID(),
      text: newText,
      status: "todo",
      priority: newPriority,
      dueDate: newDueDate || undefined,
      dueTime: newDueTime || undefined,
      tags: newTags,
      subTasks: newSubTasks.map(t => ({ id: crypto.randomUUID(), text: t, done: false })),
      recur: "none",
      note: newNote || undefined,
      sourceDate: todayKey,
      createdAt: now,
      updatedAt: now,
    };
    addTodoToDate(todayKey, todo);
    resetCreateForm();
  };

  const resetCreateForm = () => {
    setNewText(""); setNewPriority("normal"); setNewDueDate(""); setNewDueTime("");
    setNewTags([]); setNewNote(""); setNewSubTasks([]); setShowCreate(false);
  };

  const handleNLParse = async () => {
    if (!nlInput.trim()) return;
    setNLLoading(true);
    const result = await parseTodoNL(nlInput);
    setNLLoading(false);
    if (result) {
      setNewText(result.text || nlInput);
      setNewPriority(result.priority || "normal");
      setNewDueDate(result.dueDate || "");
      setNewDueTime(result.dueTime || "");
      setNewTags(result.tags || []);
      setNewNote(result.note || "");
      setNewSubTasks(result.subTasks?.map((s: any) => s.text) || []);
      setShowNL(false);
      setNLInput("");
      setShowCreate(true);
    }
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
    <div className="flex flex-col h-full max-w-[600px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="font-serif-sc text-lg text-foreground">待办</span>
        <div className="flex gap-2">
          <button onClick={() => setShowNL(true)} className="text-xs text-gold bg-gold/10 px-3 py-1 rounded-full flex items-center gap-1">
            <Zap size={12} /> 快速
          </button>
          <button onClick={() => setShowCreate(true)} className="text-xs text-gold bg-gold/10 px-3 py-1 rounded-full flex items-center gap-1">
            <Plus size={12} /> 新建
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 px-4 mb-3">
        {(["all", "today", "habits"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-xs px-4 py-1.5 rounded-full transition ${tab === t ? "bg-gold text-background" : "bg-surface-2 text-muted-foreground"}`}
          >
            {t === "all" ? "全部" : t === "today" ? "今日" : "习惯"}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4">
        {/* All tab */}
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
                      <TodoCard key={todo.id} todo={todo} onToggle={handleToggle} expanded={expandedId === todo.id}
                        onExpand={() => setExpandedId(expandedId === todo.id ? null : todo.id)}
                        celebrating={celebrateId === todo.id}
                        onStartPomodoro={() => { setPomodoroTask(todo.text); setPomodoroActive(true); setPomodoroRunning(true); setPomodoroTime(25 * 60); }}
                      />
                    ))}
                  </div>
                </div>
              );
            })}
            {allTodos.filter(t => t.status !== "done" && t.status !== "dropped").length === 0 && (
              <div className="text-center py-12 text-muted-foreground text-xs">暂无待办</div>
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
                <TodoCard key={todo.id} todo={todo} onToggle={handleToggle} expanded={expandedId === todo.id}
                  onExpand={() => setExpandedId(expandedId === todo.id ? null : todo.id)}
                  celebrating={celebrateId === todo.id}
                  onStartPomodoro={() => { setPomodoroTask(todo.text); setPomodoroActive(true); setPomodoroRunning(true); setPomodoroTime(25 * 60); }}
                />
              ))}
              {todayTodos.length === 0 && <div className="text-center py-12 text-muted-foreground text-xs">今天没有待办 🎉</div>}
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

      {/* NL Input Modal */}
      {showNL && (
        <div className="absolute inset-0 bg-background/90 z-50 flex items-center justify-center p-6">
          <div className="bg-surface-1 border border-border rounded-2xl p-5 w-full max-w-md">
            <div className="flex justify-between items-center mb-3">
              <span className="text-xs text-foreground font-serif-sc">⚡ 快速创建</span>
              <button onClick={() => setShowNL(false)}><X size={16} className="text-muted-foreground" /></button>
            </div>
            <input
              value={nlInput}
              onChange={e => setNLInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleNLParse()}
              placeholder="用自然语言描述任务，如：明天下午3点联系客户谈合作"
              className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-gold-border mb-3"
              autoFocus
            />
            <button onClick={handleNLParse} disabled={nlLoading || !nlInput.trim()} className="w-full bg-gold text-background py-2 rounded-xl text-sm disabled:opacity-30">
              {nlLoading ? "解析中..." : "解析并创建"}
            </button>
          </div>
        </div>
      )}

      {/* Create Sheet */}
      {showCreate && (
        <div className="absolute inset-x-0 bottom-0 bg-surface-1 border-t border-border rounded-t-2xl p-5 z-50 max-h-[80vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <span className="text-xs text-foreground font-serif-sc">新建任务</span>
            <button onClick={resetCreateForm}><X size={16} className="text-muted-foreground" /></button>
          </div>
          <input value={newText} onChange={e => setNewText(e.target.value)} placeholder="任务名称" autoFocus
            className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-foreground text-base mb-3 focus:outline-none focus:border-gold-border" />

          {/* Priority */}
          <div className="flex gap-1.5 mb-3">
            {(["urgent", "high", "normal", "low"] as Priority[]).map(p => (
              <button key={p} onClick={() => setNewPriority(p)}
                className={`text-xs px-3 py-1.5 rounded-full transition ${newPriority === p ? "bg-gold text-background" : "bg-surface-2 text-muted-foreground"}`}>
                {PRIORITY_CONFIG[p].emoji} {PRIORITY_CONFIG[p].label}
              </button>
            ))}
          </div>

          {/* Date & Time */}
          <div className="flex gap-2 mb-3">
            <input type="date" value={newDueDate} onChange={e => setNewDueDate(e.target.value)}
              className="flex-1 bg-surface-2 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none" />
            <input type="time" value={newDueTime} onChange={e => setNewDueTime(e.target.value)}
              className="w-28 bg-surface-2 border border-border rounded-xl px-3 py-2 text-xs text-foreground focus:outline-none" />
          </div>

          {/* Sub tasks */}
          <div className="mb-3">
            <div className="space-y-1 mb-1.5">
              {newSubTasks.map((s, i) => (
                <div key={i} className="flex items-center gap-2 text-xs text-foreground">
                  <span className="w-1.5 h-1.5 bg-muted-foreground rounded-full" />
                  <span className="flex-1">{s}</span>
                  <button onClick={() => setNewSubTasks(prev => prev.filter((_, j) => j !== i))} className="text-muted-foreground"><X size={10} /></button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newSubInput} onChange={e => setNewSubInput(e.target.value)} placeholder="+ 添加子任务"
                onKeyDown={e => { if (e.key === "Enter" && newSubInput.trim()) { setNewSubTasks(prev => [...prev, newSubInput.trim()]); setNewSubInput(""); } }}
                className="flex-1 bg-surface-2 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none" />
            </div>
          </div>

          {/* Tags */}
          <div className="flex gap-1 flex-wrap mb-3">
            {newTags.map(t => (
              <span key={t} className="text-[9px] bg-gold-light text-gold px-2 py-0.5 rounded-full flex items-center gap-1">
                {t} <button onClick={() => setNewTags(prev => prev.filter(x => x !== t))}><X size={8} /></button>
              </span>
            ))}
            <input value={newTagInput} onChange={e => setNewTagInput(e.target.value)} placeholder="标签"
              onKeyDown={e => { if (e.key === "Enter" && newTagInput.trim()) { setNewTags(prev => [...prev, newTagInput.trim()]); setNewTagInput(""); } }}
              className="bg-transparent text-xs text-foreground focus:outline-none w-16" />
          </div>

          {/* Note */}
          <textarea value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="备注（可选）" rows={2}
            className="w-full bg-surface-2 border border-border rounded-xl px-3 py-2 text-xs text-foreground resize-none focus:outline-none mb-3" />

          <button onClick={handleCreate} disabled={!newText.trim()} className="w-full bg-gold text-background py-2.5 rounded-xl text-sm disabled:opacity-30 hover:bg-gold/90 transition">
            保存
          </button>
        </div>
      )}

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

// TodoCard component
function TodoCard({ todo, onToggle, expanded, onExpand, celebrating, onStartPomodoro }: {
  todo: TodoItem; onToggle: (t: TodoItem) => void; expanded: boolean;
  onExpand: () => void; celebrating: boolean; onStartPomodoro: () => void;
}) {
  const isDone = todo.status === "done";
  return (
    <div className={`bg-surface-2 border border-border rounded-xl overflow-hidden transition-all ${celebrating ? "ring-2 ring-gold animate-pulse" : ""}`}>
      <div className="flex items-center gap-2.5 px-3 py-2.5">
        <button onClick={() => onToggle(todo)} className="flex-shrink-0">
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition ${isDone ? "bg-los-green border-los-green" : "border-muted-foreground"}`}>
            {isDone && <Check size={10} className="text-background" />}
          </div>
        </button>
        <button onClick={onExpand} className="flex-1 text-left min-w-0">
          <div className={`text-xs ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>{todo.text}</div>
          <div className="flex gap-1 mt-0.5">
            {todo.dueDate && <span className="text-[8px] text-muted-foreground font-mono-jb">{todo.dueDate}</span>}
            {todo.tags?.map(t => <span key={t} className="text-[8px] bg-gold-light text-gold px-1 rounded">{t}</span>)}
            {todo.subTasks?.length > 0 && (
              <span className="text-[8px] text-muted-foreground font-mono-jb">
                {todo.subTasks.filter(s => s.done).length}/{todo.subTasks.length}
              </span>
            )}
          </div>
        </button>
        <button onClick={onStartPomodoro} className="text-muted-foreground hover:text-gold transition p-1">
          <Play size={12} />
        </button>
      </div>
      {expanded && (
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
    </div>
  );
}

export default TodoPage;
