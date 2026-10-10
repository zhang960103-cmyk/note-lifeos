import { supabase } from "@/integrations/supabase/client";

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

