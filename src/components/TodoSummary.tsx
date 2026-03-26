import { useLifeOs } from "@/contexts/LifeOsContext";
import { useMemo } from "react";
import { CheckSquare, Square, ListTodo } from "lucide-react";

export default function TodoSummary() {
  const { entries, toggleTask } = useLifeOs();

  const pendingTasks = useMemo(() => {
    return entries
      .flatMap((e) =>
        e.tasks
          .filter((t) => !t.completed)
          .map((t) => ({ ...t, entryId: e.id, date: e.createdAt }))
      )
      .slice(0, 10);
  }, [entries]);

  const completedToday = useMemo(() => {
    const today = new Date().toDateString();
    return entries
      .filter((e) => new Date(e.createdAt).toDateString() === today)
      .flatMap((e) => e.tasks.filter((t) => t.completed)).length;
  }, [entries]);

  if (pendingTasks.length === 0 && completedToday === 0) return null;

  return (
    <div className="bg-surface-2 border border-border rounded-xl p-4 mb-5">
      <div className="flex items-center gap-2 mb-3">
        <ListTodo size={14} className="text-gold" />
        <h2 className="font-serif-sc text-sm text-white">待办汇总</h2>
        {completedToday > 0 && (
          <span className="text-[9px] bg-los-green-light text-los-green px-1.5 py-0.5 rounded font-mono-jb ml-auto">
            今日完成 {completedToday}
          </span>
        )}
      </div>

      {pendingTasks.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-2">🎉 全部完成！</p>
      ) : (
        <div className="space-y-1.5">
          {pendingTasks.map((task) => (
            <button
              key={task.id}
              onClick={() => toggleTask(task.entryId, task.id)}
              className="flex items-center gap-2 w-full text-left text-xs group"
            >
              <Square size={14} className="text-muted-foreground group-hover:text-gold flex-shrink-0 transition-colors" />
              <span className="text-foreground flex-1 truncate">{task.text}</span>
              <span
                className={`text-[9px] font-mono-jb px-1.5 py-0.5 rounded ${
                  task.type === "建系统" ? "bg-los-green-light text-los-green" : "bg-los-blue-light text-los-blue"
                }`}
              >
                {task.type}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
