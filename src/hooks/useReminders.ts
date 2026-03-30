import { useEffect, useRef } from "react";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { format } from "date-fns";

export function useReminders() {
  const { allTodos, habits } = useLifeOs();
  const notifiedRef = useRef<Set<string>>(new Set());

  // Request notification permission on mount
  useEffect(() => {
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }, []);

  // Todo reminders
  useEffect(() => {
    const interval = setInterval(() => {
      if (!("Notification" in window) || Notification.permission !== "granted") return;

      const now = new Date();
      const todayStr = format(now, "yyyy-MM-dd");
      const nowMinutes = now.getHours() * 60 + now.getMinutes();

      allTodos.forEach(todo => {
        if (todo.status === "done" || todo.status === "dropped") return;
        if (!todo.dueDate || !todo.dueTime) return;
        if (todo.dueDate !== todayStr) return;
        if (notifiedRef.current.has(todo.id)) return;

        const [h, m] = todo.dueTime.split(":").map(Number);
        const todoMinutes = h * 60 + m;
        const reminderOffset = todo.reminderMinutes || 0;
        const targetMinutes = todoMinutes - reminderOffset;

        if (Math.abs(nowMinutes - targetMinutes) <= 1) {
          new Notification("🧭 罗盘提醒", {
            body: todo.text,
            icon: "/pwa-192.png",
          });
          notifiedRef.current.add(todo.id);
        }
      });
    }, 60000);

    return () => clearInterval(interval);
  }, [allTodos]);

  // Habit check-in reminder at 21:00
  useEffect(() => {
    const interval = setInterval(() => {
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      const now = new Date();
      const h = now.getHours();
      const m = now.getMinutes();
      const todayStr = format(now, "yyyy-MM-dd");

      if (h === 21 && m === 0) {
        const unchecked = habits.filter(habit => !habit.checkIns.includes(todayStr));
        if (unchecked.length > 0 && !notifiedRef.current.has(`habit-${todayStr}`)) {
          new Notification("💪 习惯提醒", {
            body: `还有 ${unchecked.length} 个习惯今天未打卡：${unchecked.map(h => h.name).join("、")}`,
            icon: "/pwa-192.png",
          });
          notifiedRef.current.add(`habit-${todayStr}`);
        }
      }
    }, 60000);

    return () => clearInterval(interval);
  }, [habits]);

  // Check overdue todos when app becomes visible
  useEffect(() => {
    const checkOnFocus = () => {
      if (document.visibilityState !== "visible") return;
      if (!("Notification" in window) || Notification.permission !== "granted") return;
      const now = new Date();
      const todayStr = format(now, "yyyy-MM-dd");
      const nowMinutes = now.getHours() * 60 + now.getMinutes();
      allTodos.forEach(todo => {
        if (todo.status === "done") return;
        if (!todo.dueDate || !todo.dueTime) return;
        if (todo.dueDate !== todayStr) return;
        const [h, m] = todo.dueTime.split(":").map(Number);
        const todoMins = h * 60 + m;
        if (nowMinutes >= todoMins && !notifiedRef.current.has(todo.id)) {
          new Notification("🧭 罗盘提醒（逾期）", { body: todo.text });
          notifiedRef.current.add(todo.id);
        }
      });
    };
    document.addEventListener("visibilitychange", checkOnFocus);
    return () => document.removeEventListener("visibilitychange", checkOnFocus);
  }, [allTodos]);
}
