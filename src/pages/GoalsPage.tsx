import { useState, useMemo, useCallback, useEffect } from "react";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Plus, Trash2, ChevronDown, ChevronUp, Target } from "lucide-react";
import { CardSkeleton } from "@/components/SkeletonLoaders";
import { toast } from "sonner";
import { useLanguage } from "@/contexts/LanguageContext";

interface KeyResult {
  id: string;
  text: string;
  progress: number;
  linkedTodoCount: number;
}

interface Goal {
  id: string;
  title: string;
  quarter: string;
  keyResults: KeyResult[];
  createdAt: string;
}

const getCurrentQuarter = () => {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `${now.getFullYear()}-Q${q}`;
};

// Export for use in HomePage auto-link
export async function updateKRProgressFromGoalHints(
  goalHints: Array<{ krText: string; todoText: string }>,
  userId: string
) {
  if (!goalHints || goalHints.length === 0) return;
  
  const { data: goals } = await supabase
    .from("goals")
    .select("*")
    .eq("user_id", userId);
  
  if (!goals) return;

  for (const goal of goals) {
    const krs = (goal.key_results as any[]) || [];
    let updated = false;
    
    const newKrs = krs.map((kr: any) => {
      const matched = goalHints.filter(hint => {
        const krWords = kr.text.split(/[，,、\s]/).filter((w: string) => w.length >= 2);
        return krWords.some((w: string) => hint.krText.includes(w) || hint.todoText.includes(w));
      });
      if (matched.length > 0) {
        updated = true;
        return { ...kr, linkedTodoCount: (kr.linkedTodoCount || 0) + matched.length };
      }
      return kr;
    });

    if (updated) {
      await supabase.from("goals").update({ key_results: newKrs as any }).eq("id", goal.id);
    }
  }
}

const GoalsPage = () => {
  const { allTodos } = useLifeOs();
  const { user } = useAuth();
  const { t } = useLanguage();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newKRs, setNewKRs] = useState(["", "", ""]);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("goals")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (data) {
        setGoals(data.map((g: any) => ({
          id: g.id,
          title: g.title,
          quarter: g.quarter,
          keyResults: (g.key_results as any[]) || [],
          createdAt: g.created_at,
        })));
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const createGoal = useCallback(async () => {
    if (!newTitle.trim() || !user) return;
    const krs: KeyResult[] = newKRs
      .filter(k => k.trim())
      .map(k => ({ id: crypto.randomUUID(), text: k, progress: 0, linkedTodoCount: 0 }));
    if (krs.length === 0) return;

    const { data, error } = await supabase.from("goals").insert({
      user_id: user.id,
      title: newTitle,
      quarter: getCurrentQuarter(),
      key_results: krs as any,
    }).select().single();

    // 之前这里无论插入成功与否都会清空并收起表单，一旦insert因为网络/RLS
    // 失败，用户看到表单收起以为保存成功，实际这条目标完全没有落库——
    // 现在只有真正插入成功才清表单，失败则保留用户已填内容并提示重试。
    if (data && !error) {
      setGoals(prev => [{
        id: data.id,
        title: data.title,
        quarter: data.quarter,
        keyResults: (data.key_results as any[]) || [],
        createdAt: data.created_at,
      }, ...prev]);
      setNewTitle("");
      setNewKRs(["", "", ""]);
      setShowCreate(false);
    } else {
      console.error("[GoalsPage] 创建目标失败:", error);
      toast.error(t("goals.toast.create_failed"));
    }
  }, [newTitle, newKRs, user]);

  const deleteGoal = useCallback(async (id: string) => {
    const prevGoals = goals;
    setGoals(prev => prev.filter(g => g.id !== id));
    const { error } = await supabase.from("goals").delete().eq("id", id);
    // 之前这里不检查error，删除失败(网络/RLS)时UI已经把目标移除，用户
    // 却完全不知道云端其实还留着（或者其实没删掉）。失败时把本地状态还原
    // 并提示，避免"看起来删了、其实没删"的假象。
    if (error) {
      console.error("[GoalsPage] 删除目标失败:", error);
      setGoals(prevGoals);
      toast.error(t("goals.toast.delete_failed"));
    }
  }, [goals]);

  const updateKRProgress = useCallback(async (goalId: string, krId: string, progress: number) => {
    const prevGoals = goals;
    setGoals(prev => prev.map(g =>
      g.id === goalId
        ? { ...g, keyResults: g.keyResults.map(kr => kr.id === krId ? { ...kr, progress } : kr) }
        : g
    ));
    const goal = goals.find(g => g.id === goalId);
    if (goal) {
      const updated = goal.keyResults.map(kr => kr.id === krId ? { ...kr, progress } : kr);
      const { error } = await supabase.from("goals").update({ key_results: updated as any }).eq("id", goalId);
      if (error) {
        console.error("[GoalsPage] 更新KR进度失败:", error);
        setGoals(prevGoals);
        toast.error(t("goals.toast.progress_failed"));
      }
    }
  }, [goals]);

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

  if (loading) return <CardSkeleton count={3} />;

  return (
    <div className="h-full overflow-y-auto px-4 max-w-[600px] mx-auto pb-4">
      <div className="py-4 flex items-center justify-between">
        <div>
          <h1 className="font-serif-sc text-lg text-foreground">🎯 {t("goals.title")}</h1>
          <p className="text-[10px] text-muted-foreground">{t("goals.subtitle")} · {getCurrentQuarter()}</p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-primary text-primary-foreground text-xs px-3 py-1.5 rounded-full flex items-center gap-1"
        >
          <Plus size={12} /> {t("goals.new_goal")}
        </button>
      </div>

      {showCreate && (
        <div className="bg-card border border-border rounded-xl p-4 mb-4 animate-in fade-in">
          <input
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder={t("goals.title_placeholder")}
            className="w-full bg-muted border border-border rounded-lg px-3 py-2 text-sm text-foreground mb-3 focus:outline-none focus:border-primary"
          />
          <p className="text-[10px] text-muted-foreground mb-2">{t("goals.kr_label")}</p>
          {newKRs.map((kr, i) => (
            <input
              key={i}
              value={kr}
              onChange={e => { const next = [...newKRs]; next[i] = e.target.value; setNewKRs(next); }}
              placeholder={t("goals.kr_placeholder", { n: i + 1 })}
              className="w-full bg-muted border border-border rounded-lg px-3 py-1.5 text-xs text-foreground mb-1.5 focus:outline-none focus:border-primary"
            />
          ))}
          <button onClick={createGoal} className="w-full bg-primary text-primary-foreground text-xs py-2 rounded-lg mt-2">
            {t("goals.create")}
          </button>
        </div>
      )}

      {goalsWithLinked.length === 0 ? (
        <div className="text-center py-16">
          <Target size={32} className="text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-xs text-muted-foreground">{t("goals.empty_title")}</p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">{t("goals.empty_desc")}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {goalsWithLinked.map(goal => {
            const isExpanded = expandedId === goal.id;
            const totalProgress = goal.keyResults.length > 0
              ? Math.round(goal.keyResults.reduce((s, kr) => s + kr.progress, 0) / goal.keyResults.length)
              : 0;
            return (
              <div key={goal.id} className="bg-card border border-border rounded-xl overflow-hidden">
                <button onClick={() => setExpandedId(isExpanded ? null : goal.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-sm text-foreground font-serif-sc">{goal.title}</span>
                      <span className="text-[9px] text-muted-foreground font-mono-jb">{goal.quarter}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 h-1.5 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${totalProgress}%` }} />
                      </div>
                      <span className="text-[10px] text-primary font-mono-jb">{totalProgress}%</span>
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
                          <span className="text-[9px] text-muted-foreground font-mono-jb">
                            {kr.linkedTodoCount > 0 ? t("goals.kr_linked", { count: kr.linkedTodoCount }) : t("goals.kr_no_link")}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* linkedTodoCount>0时，goalsWithLinked已经把progress强制算成
                              doneCount/linked.length——之前这里滑块仍然可拖动，但下一次
                              渲染就会被自动进度覆盖回去，看起来像"拖了没反应"。改为对
                              有关联待办的KR禁用手动拖动，只对纯手动KR保留可拖动滑块。*/}
                          <input type="range" min={0} max={100} value={kr.progress}
                            disabled={kr.linkedTodoCount > 0}
                            onChange={e => updateKRProgress(goal.id, kr.id, +e.target.value)}
                            className="flex-1 accent-primary h-1 disabled:opacity-50 disabled:cursor-not-allowed" />
                          <span className="text-[10px] text-primary font-mono-jb w-8 text-right">{kr.progress}%</span>
                        </div>
                      </div>
                    ))}
                    <button onClick={() => deleteGoal(goal.id)} className="text-[10px] text-muted-foreground hover:text-destructive flex items-center gap-1 mt-2">
                      <Trash2 size={11} /> {t("goals.delete")}
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
