import { useEffect, useRef } from "react";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { format } from "date-fns";

export function useReminders() {
  const { allTodos } = useLifeOs();
  const notifiedRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const interval = setInterval(() => {
      if (Notification.permission !== "granted") return;

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
}
