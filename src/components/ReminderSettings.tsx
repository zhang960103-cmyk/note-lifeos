import { useState, useEffect } from "react";
import { Bell, BellOff, Clock } from "lucide-react";

const REMINDER_KEY = "lifeos_reminder";

interface ReminderConfig {
  enabled: boolean;
  times: string[]; // HH:mm format
}

function loadReminder(): ReminderConfig {
  try {
    const raw = localStorage.getItem(REMINDER_KEY);
    return raw ? JSON.parse(raw) : { enabled: false, times: ["08:00", "21:00"] };
  } catch {
    return { enabled: false, times: ["08:00", "21:00"] };
  }
}

export default function ReminderSettings() {
  const [config, setConfig] = useState<ReminderConfig>(loadReminder);
  const [permissionState, setPermissionState] = useState<NotificationPermission>("default");

  useEffect(() => {
    if ("Notification" in window) {
      setPermissionState(Notification.permission);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(REMINDER_KEY, JSON.stringify(config));
  }, [config]);

  // Schedule notifications via setInterval checking every minute
  useEffect(() => {
    if (!config.enabled || permissionState !== "granted") return;

    const interval = setInterval(() => {
      const now = new Date();
      const nowTime = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      if (config.times.includes(nowTime) && now.getSeconds() < 60) {
        new Notification("🧭 Life OS 提醒", {
          body: nowTime < "12:00" ? "早安！来写一篇晨间笔记吧 🌅" : "今天过得怎么样？记录一下吧 ✨",
          icon: "/placeholder.svg",
        });
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [config, permissionState]);

  const requestPermission = async () => {
    if (!("Notification" in window)) return;
    const result = await Notification.requestPermission();
    setPermissionState(result);
    if (result === "granted") {
      setConfig((prev) => ({ ...prev, enabled: true }));
    }
  };

  const toggleEnabled = () => {
    if (!config.enabled && permissionState !== "granted") {
      requestPermission();
    } else {
      setConfig((prev) => ({ ...prev, enabled: !prev.enabled }));
    }
  };

  const updateTime = (index: number, value: string) => {
    setConfig((prev) => {
      const times = [...prev.times];
      times[index] = value;
      return { ...prev, times };
    });
  };

  const addTime = () => {
    if (config.times.length >= 4) return;
    setConfig((prev) => ({ ...prev, times: [...prev.times, "12:00"] }));
  };

  const removeTime = (index: number) => {
    if (config.times.length <= 1) return;
    setConfig((prev) => ({ ...prev, times: prev.times.filter((_, i) => i !== index) }));
  };

  return (
    <div className="bg-surface-2 border border-border rounded-xl p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {config.enabled ? <Bell size={14} className="text-gold" /> : <BellOff size={14} className="text-muted-foreground" />}
          <h3 className="font-serif-sc text-sm text-white">定时提醒</h3>
        </div>
        <button
          onClick={toggleEnabled}
          className={`w-10 h-5 rounded-full transition-all relative ${config.enabled ? "bg-gold" : "bg-border"}`}
        >
          <div
            className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${config.enabled ? "left-[22px]" : "left-0.5"}`}
          />
        </button>
      </div>

      {permissionState === "denied" && (
        <p className="text-[10px] text-los-red mb-2">⚠️ 通知权限被拒绝，请在浏览器设置中开启</p>
      )}

      {config.enabled && (
        <div className="space-y-2">
          {config.times.map((time, i) => (
            <div key={i} className="flex items-center gap-2">
              <Clock size={12} className="text-muted-foreground" />
              <input
                type="time"
                value={time}
                onChange={(e) => updateTime(i, e.target.value)}
                className="bg-surface-3 border border-border rounded-lg px-2 py-1.5 text-xs text-foreground font-mono-jb focus:outline-none focus:border-gold-border flex-1"
              />
              {config.times.length > 1 && (
                <button onClick={() => removeTime(i)} className="text-muted-foreground hover:text-los-red text-xs">✕</button>
              )}
            </div>
          ))}
          {config.times.length < 4 && (
            <button onClick={addTime} className="text-[10px] text-gold font-mono-jb hover:underline">+ 添加提醒时间</button>
          )}
        </div>
      )}
    </div>
  );
}
