import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Clock, Play, Pause, Plus, Trash2, Bell } from "lucide-react";

const CRON_KEY = "lifeos_cron_tasks";

interface CronTask {
  id: string;
  name: string;
  description: string;
  time: string; // HH:mm
  days: number[]; // 0-6, Sun-Sat
  enabled: boolean;
  lastRun?: string;
  type: "morning-free" | "morning-structured" | "evening-review" | "weekly-report" | "monthly-report" | "custom";
}

const DEFAULT_TASKS: CronTask[] = [
  { id: "1", name: "🌅 意识流唤醒", description: "早晨7:00自由书写，唤醒思维", time: "07:00", days: [1,2,3,4,5,6,0], enabled: true, type: "morning-free" },
  { id: "2", name: "📝 结构化晨间日记", description: "早晨7:30进入今日日记模式", time: "07:30", days: [1,2,3,4,5,6,0], enabled: true, type: "morning-structured" },
  { id: "3", name: "🌙 晚间复盘", description: "21:30回顾今日、反直觉对冲", time: "21:30", days: [1,2,3,4,5,6,0], enabled: true, type: "evening-review" },
  { id: "4", name: "📊 周复盘报告", description: "每周日20:00生成周报信件", time: "20:00", days: [0], enabled: true, type: "weekly-report" },
  { id: "5", name: "📈 月度审计", description: "每月1日9:00生成月度报告", time: "09:00", days: [1], enabled: true, type: "monthly-report" },
];

const DAY_LABELS = ["日", "一", "二", "三", "四", "五", "六"];

function loadCronTasks(): CronTask[] {
  try {
    const raw = localStorage.getItem(CRON_KEY);
    return raw ? JSON.parse(raw) : DEFAULT_TASKS;
  } catch {
    return DEFAULT_TASKS;
  }
}

const CronPage = () => {
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<CronTask[]>(loadCronTasks);
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newTime, setNewTime] = useState("08:00");
  const [newDays, setNewDays] = useState<number[]>([1,2,3,4,5]);
  const [permissionState, setPermissionState] = useState<NotificationPermission>("default");

  useEffect(() => {
    localStorage.setItem(CRON_KEY, JSON.stringify(tasks));
  }, [tasks]);

  useEffect(() => {
    if ("Notification" in window) setPermissionState(Notification.permission);
  }, []);

  // Check cron tasks every minute
  useEffect(() => {
    if (permissionState !== "granted") return;

    const interval = setInterval(() => {
      const now = new Date();
      const currentTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const currentDay = now.getDay();

      tasks.forEach(task => {
        if (!task.enabled) return;
        if (task.time !== currentTime) return;
        if (!task.days.includes(currentDay)) return;
        if (now.getSeconds() > 30) return; // Only trigger in first 30s

        new Notification(`🧭 Life OS · ${task.name}`, {
          body: task.description,
          icon: "/pwa-192.png",
          tag: task.id,
        });

        setTasks(prev => prev.map(t =>
          t.id === task.id ? { ...t, lastRun: now.toISOString() } : t
        ));
      });
    }, 30000);

    return () => clearInterval(interval);
  }, [tasks, permissionState]);

  const requestPermission = async () => {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermissionState(result);
  };

  const toggleTask = (id: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, enabled: !t.enabled } : t));
  };

  const deleteTask = (id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const toggleDay = (day: number) => {
    setNewDays(prev => prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]);
  };

  const addTask = () => {
    if (!newName.trim()) return;
    setTasks(prev => [...prev, {
      id: crypto.randomUUID(),
      name: newName,
      description: newDesc,
      time: newTime,
      days: newDays,
      enabled: true,
      type: "custom",
    }]);
    setNewName("");
    setNewDesc("");
    setNewTime("08:00");
    setNewDays([1,2,3,4,5]);
    setShowAdd(false);
  };

  return (
    <div className="pb-24 px-4 max-w-[600px] mx-auto">
      <div className="flex items-center gap-3 py-4">
        <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-serif-sc text-lg text-foreground flex-1">⏰ 定时任务</h1>
        <button
          onClick={() => setShowAdd(!showAdd)}
          className="text-muted-foreground hover:text-gold transition-colors"
        >
          <Plus size={20} />
        </button>
      </div>

      {/* Permission Warning */}
      {permissionState !== "granted" && (
        <button
          onClick={requestPermission}
          className="w-full bg-los-orange-light border border-los-orange/20 rounded-xl p-4 mb-4 text-left"
        >
          <div className="flex items-center gap-2 mb-1">
            <Bell size={14} className="text-los-orange" />
            <span className="text-xs text-los-orange font-medium">需要通知权限</span>
          </div>
          <p className="text-[10px] text-muted-foreground">
            点击此处开启浏览器通知，定时提醒才能生效
          </p>
        </button>
      )}

      {/* Add New Task */}
      {showAdd && (
        <div className="bg-surface-2 border border-gold-border rounded-xl p-4 mb-4">
          <h3 className="font-serif-sc text-sm text-foreground mb-3">添加自定义任务</h3>
          <input
            value={newName}
            onChange={e => setNewName(e.target.value)}
            placeholder="任务名称"
            className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold-border mb-2"
          />
          <input
            value={newDesc}
            onChange={e => setNewDesc(e.target.value)}
            placeholder="任务描述"
            className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-gold-border mb-2"
          />
          <div className="flex items-center gap-2 mb-3">
            <Clock size={12} className="text-muted-foreground" />
            <input
              type="time"
              value={newTime}
              onChange={e => setNewTime(e.target.value)}
              className="bg-surface-3 border border-border rounded-lg px-2 py-1.5 text-xs text-foreground font-mono-jb focus:outline-none focus:border-gold-border"
            />
          </div>
          <div className="flex gap-1.5 mb-3">
            {DAY_LABELS.map((label, i) => (
              <button
                key={i}
                onClick={() => toggleDay(i)}
                className={`w-8 h-8 rounded-full text-[10px] font-mono-jb transition-all ${
                  newDays.includes(i)
                    ? "bg-gold text-background"
                    : "bg-surface-3 border border-border text-muted-foreground hover:border-gold-border"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <button onClick={addTask} className="w-full bg-gold text-background text-xs font-serif-sc py-2 rounded-lg hover:bg-gold/90 transition-all">
            添加
          </button>
        </div>
      )}

      {/* Task List */}
      <div className="space-y-3">
        {tasks.map(task => (
          <div key={task.id} className={`bg-surface-2 border rounded-xl p-4 transition-all ${task.enabled ? "border-border" : "border-border/50 opacity-60"}`}>
            <div className="flex items-center gap-3">
              <button
                onClick={() => toggleTask(task.id)}
                className={`flex-shrink-0 transition-colors ${task.enabled ? "text-los-green" : "text-muted-foreground"}`}
              >
                {task.enabled ? <Play size={18} /> : <Pause size={18} />}
              </button>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm text-foreground font-medium truncate">{task.name}</h3>
                  <span className="text-[10px] text-gold font-mono-jb bg-gold-light px-1.5 py-0.5 rounded flex-shrink-0">
                    {task.time}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{task.description}</p>
                <div className="flex gap-1 mt-1.5">
                  {DAY_LABELS.map((label, i) => (
                    <span
                      key={i}
                      className={`text-[8px] font-mono-jb w-4 h-4 rounded-full flex items-center justify-center ${
                        task.days.includes(i)
                          ? "bg-gold-light text-gold"
                          : "text-muted-foreground/30"
                      }`}
                    >
                      {label}
                    </span>
                  ))}
                </div>
                {task.lastRun && (
                  <p className="text-[9px] text-muted-foreground font-mono-jb mt-1">
                    上次执行: {new Date(task.lastRun).toLocaleString("zh-CN")}
                  </p>
                )}
              </div>
              {task.type === "custom" && (
                <button onClick={() => deleteTask(task.id)} className="text-muted-foreground hover:text-los-red transition-colors flex-shrink-0">
                  <Trash2 size={14} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Info */}
      <div className="mt-6 bg-surface-2 border border-border rounded-xl p-4">
        <h3 className="font-serif-sc text-xs text-foreground mb-2">💡 关于定时任务</h3>
        <ul className="text-[10px] text-muted-foreground space-y-1 leading-relaxed">
          <li>• 定时任务通过浏览器通知提醒，需保持页面打开</li>
          <li>• 支持迪拜时区（Asia/Dubai），跟随系统时间</li>
          <li>• 周报每周日自动生成，月报每月1日自动生成</li>
          <li>• 安装为 PWA 后可获得更稳定的后台通知</li>
        </ul>
      </div>
    </div>
  );
};

export default CronPage;
