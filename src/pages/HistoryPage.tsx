import { useLifeOs } from "@/contexts/LifeOsContext";
import { ALGORITHM_INFO } from "@/types/lifeOs";
import { ArrowLeft, Trash2, CheckSquare, Square } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";

const HistoryPage = () => {
  const { entries, deleteEntry, toggleTask } = useLifeOs();
  const navigate = useNavigate();

  return (
    <div className="pb-24 px-4 max-w-[600px] mx-auto">
      <div className="flex items-center gap-3 py-4">
        <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={20} />
        </button>
        <h1 className="font-serif-sc text-lg text-white flex-1">日记历史</h1>
        <span className="text-[10px] text-muted-foreground font-mono-jb">{entries.length} 篇</span>
      </div>

      {entries.length === 0 ? (
        <div className="bg-surface-2 border border-border rounded-xl p-10 text-center text-muted-foreground text-xs mt-4">
          还没有日记记录 📝
        </div>
      ) : (
        <div className="space-y-3">
          {entries.map((entry) => {
            const info = ALGORITHM_INFO[entry.algorithm];
            return (
              <div key={entry.id} className="bg-surface-2 border border-border rounded-xl p-4">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">{info.icon}</span>
                  <span className="text-[10px] text-gold font-mono-jb">{info.name}</span>
                  <span className="text-[10px] text-muted-foreground font-mono-jb ml-auto">
                    {format(new Date(entry.createdAt), "yyyy/MM/dd HH:mm")}
                  </span>
                  <button
                    onClick={() => deleteEntry(entry.id)}
                    className="text-muted-foreground hover:text-los-red transition-colors ml-1"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <p className="text-sm text-foreground leading-relaxed mb-3 whitespace-pre-line">{entry.content}</p>

                {/* Scores */}
                <div className="flex gap-3 mb-2">
                  <span className="text-[10px] text-muted-foreground font-mono-jb">😊 幸福 {entry.happinessScore}/10</span>
                  <span className="text-[10px] text-muted-foreground font-mono-jb">💭 情绪 {entry.emotionScore}/10</span>
                </div>

                {/* Domains & Keywords */}
                <div className="flex gap-1 flex-wrap mb-2">
                  {entry.domains.map((d) => (
                    <span key={d} className="text-[9px] bg-gold-light text-gold px-1.5 py-0.5 rounded font-mono-jb">{d}</span>
                  ))}
                  {entry.keywords.map((k) => (
                    <span key={k} className="text-[9px] bg-surface-3 text-muted-foreground px-1.5 py-0.5 rounded font-mono-jb">#{k}</span>
                  ))}
                </div>

                {/* Tasks */}
                {entry.tasks.length > 0 && (
                  <div className="border-t border-border pt-2 mt-2 space-y-1">
                    {entry.tasks.map((task) => (
                      <button
                        key={task.id}
                        onClick={() => toggleTask(entry.id, task.id)}
                        className="flex items-center gap-2 w-full text-left text-xs group"
                      >
                        {task.completed ? (
                          <CheckSquare size={14} className="text-los-green flex-shrink-0" />
                        ) : (
                          <Square size={14} className="text-muted-foreground group-hover:text-gold flex-shrink-0" />
                        )}
                        <span className={`flex-1 ${task.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                          {task.text}
                        </span>
                        <span className={`text-[9px] font-mono-jb px-1.5 py-0.5 rounded ${task.type === "建系统" ? "bg-los-green-light text-los-green" : "bg-los-blue-light text-los-blue"}`}>
                          {task.type}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default HistoryPage;
