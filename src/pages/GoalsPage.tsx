import { useState, useMemo, useCallback } from "react";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { Plus, Trash2, ChevronDown, ChevronUp, Target } from "lucide-react";

interface KeyResult {
  id: string;
  text: string;
  progress: number; // 0-100
  linkedTodoCount: number;
}

interface Goal {
  id: string;
  title: string;
  quarter: string; // e.g. "2026-Q1"
  keyResults: KeyResult[];
  createdAt: string;
}

const getCurrentQuarter = () => {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `${now.getFullYear()}-Q${q}`;
};

const GoalsPage = () => {
  const { allTodos } = useLifeOs();
  const [goals, setGoals] = useState<Goal[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("los-goals") || "[]");
    } catch { return []; }
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newKRs, setNewKRs] = useState(["", "", ""]);

  const saveGoals = useCallback((g: Goal[]) => {
    setGoals(g);
    localStorage.setItem("los-goals", JSON.stringify(g));
  }, []);

  const createGoal = () => {
    if (!newTitle.trim()) return;
    const krs: KeyResult[] = newKRs
      .filter(k => k.trim())
      .map(k => ({ id: crypto.randomUUID(), text: k, progress: 0, linkedTodoCount: 0 }));
    if (krs.length === 0) return;

    const goal: Goal = {
      id: crypto.randomUUID(),
      title: newTitle,
      quarter: getCurrentQuarter(),
      keyResults: krs,
      createdAt: new Date().toISOString(),
    };
    saveGoals([goal, ...goals]);
    setNewTitle("");
    setNewKRs(["", "", ""]);
    setShowCreate(false);
  };

  const deleteGoal = (id: string) => saveGoals(goals.filter(g => g.id !== id));

  const updateKRProgress = (goalId: string, krId: string, progress: number) => {
    saveGoals(goals.map(g =>
      g.id === goalId
        ? { ...g, keyResults: g.keyResults.map(kr => kr.id === krId ? { ...kr, progress } : kr) }
        : g
    ));
  };

  // Auto-link todos to KRs by keyword matching
  const goalsWithLinked = useMemo(() => {
    return goals.map(goal => ({
      ...goal,
      keyResults: goal.keyResults.map(kr => {
        const keywords = kr.text.split(/[，,、\s]/).filter(w => w.length >= 2);
        const linked = allTodos.filter(t =>
          keywords.some(k => t.text.includes(k) || t.tags.some(tag => tag.includes(k)))
        );
        const doneCount = linked.filter(t => t.status === "done").length;
        const autoProgress = linked.length > 0 ? Math.round((doneCount / linked.length) * 100) : kr.progress;
        return { ...kr, linkedTodoCount: linked.length, progress: linked.length > 0 ? autoProgress : kr.progress };
      }),
    }));
  }, [goals, allTodos]);

  return (
    <div className="h-full overflow-y-auto px-4 max-w-[600px] mx-auto pb-4">
      <div className="py-4 flex items-center justify-between">
        <div>
          <h1 className="font-serif-sc text-lg text-foreground">🎯 目标系统</h1>
          <p className="text-[10px] text-muted-foreground">季度OKR · {getCurrentQuarter()}</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-gold text-background text-xs px-3 py-1.5 rounded-full flex items-center gap-1"
        >
          <Plus size={12} /> 新目标
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div className="bg-surface-2 border border-gold-border rounded-xl p-4 mb-4 animate-in fade-in">
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="目标名称（如：建立内容创作系统）"
            className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-sm text-foreground mb-3 focus:outline-none focus:border-gold-border"
          />
          <p className="text-[10px] text-muted-foreground mb-2">关键结果（KR）</p>
          {newKRs.map((kr, i) => (
            <input
              key={i}
              value={kr}
              onChange={e => {
                const next = [...newKRs];
                next[i] = e.target.value;
                setNewKRs(next);
              }}
              placeholder={`KR${i + 1}（如：每周发布2篇文章）`}
              className="w-full bg-surface-3 border border-border rounded-lg px-3 py-1.5 text-xs text-foreground mb-1.5 focus:outline-none focus:border-gold-border"
            />
          ))}
          <button onClick={createGoal} className="w-full bg-gold text-background text-xs py-2 rounded-lg mt-2">
            创建目标
          </button>
        </div>
      )}

      {/* Goals list */}
      {goalsWithLinked.length === 0 ? (
        <div className="text-center py-16">
          <Target size={32} className="text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-xs text-muted-foreground">还没有设定目标</p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">设定季度大目标，AI会自动关联你的待办</p>
        </div>
      ) : (
        <div className="space-y-3">
          {goalsWithLinked.map(goal => {
            const isExpanded = expandedId === goal.id;
            const totalProgress = goal.keyResults.length > 0
              ? Math.round(goal.keyResults.reduce((s, kr) => s + kr.progress, 0) / goal.keyResults.length)
              : 0;
            return (
              <div key={goal.id} className="bg-surface-2 border border-border rounded-xl overflow-hidden">
                <button onClick={() => setExpandedId(isExpanded ? null : goal.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-foreground font-serif-sc">{goal.title}</span>
                      <span className="text-[9px] text-muted-foreground font-mono-jb">{goal.quarter}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-surface-3 rounded-full overflow-hidden">
                        <div className="h-full bg-gold rounded-full transition-all" style={{ width: `${totalProgress}%` }} />
                      </div>
                      <span className="text-[10px] text-gold font-mono-jb">{totalProgress}%</span>
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp size={14} className="text-muted-foreground" /> : <ChevronDown size={14} className="text-muted-foreground" />}
                </button>

                {isExpanded && (
                  <div className="px-4 pb-4 border-t border-border space-y-3 pt-3">
                    {goal.keyResults.map(kr => (
                      <div key={kr.id} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-foreground">{kr.text}</span>
                          <span className="text-[9px] text-muted-foreground font-mono-jb">{kr.linkedTodoCount} 关联</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="range"
                            min={0}
                            max={100}
                            value={kr.progress}
                            onChange={e => updateKRProgress(goal.id, kr.id, +e.target.value)}
                            className="flex-1 accent-gold h-1"
                          />
                          <span className="text-[10px] text-gold font-mono-jb w-8 text-right">{kr.progress}%</span>
                        </div>
                      </div>
                    ))}
                    <button onClick={() => deleteGoal(goal.id)} className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-1 mt-2">
                      <Trash2 size={11} /> 删除目标
                    </button>
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

export default GoalsPage;
