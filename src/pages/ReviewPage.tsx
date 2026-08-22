import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { ALL_DOMAINS } from "@/types/lifeOs";
import { Mail, Loader2, RotateCcw, Copy, Check } from "lucide-react";
import { subDays, isAfter, subMonths, format, parseISO, startOfMonth, endOfMonth } from "date-fns";
import { streamChat, type ChatMsg } from "@/lib/streamChat";

const LETTER_CACHE_KEY = (type: string) => `review_letter_${type}_${format(new Date(), "yyyy-MM")}`;
// 记录本月最后一次生成的是周信还是月报，刷新页面后据此恢复——
// 否则页面固定只读"weekly"缓存，用户生成的月报刷新后就"凭空消失"了。
const LAST_TYPE_KEY = () => `review_letter_last_type_${format(new Date(), "yyyy-MM")}`;

const ReviewPage = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { entries, wheelScores, allTodos, monthFinanceStats, habits, energyLogs, defaultModelProfileId } = useLifeOs();
  const { user } = useAuth();
  const [letter, setLetter] = useState<string | null>(null);
  const [letterType, setLetterType] = useState<"weekly" | "monthly" | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [touchStart, setTouchStart] = useState(0);
  const [goals, setGoals] = useState<any[]>([]);
  // ref 而非 state：state 更新要等下一轮渲染才生效，
  // 在此期间 effect 若因其他依赖变化重新执行，"是否已触发"的判断可能还没更新，
  // 造成 auto=weekly 的自动生成被触发两次。ref 是同步的，没有这个竞态窗口。
  const autoTriggeredRef = useRef(false);
  // 用于取消上一次还没结束的生成请求：重新生成/组件卸载时中止，
  // 避免旧请求的流式回调在新一轮生成开始后还继续写 letter，造成内容错乱。
  const abortRef = useRef<AbortController | null>(null);

  const today = format(new Date(), "yyyy-MM-dd");

  const weekEntries = useMemo(() => {
    const cutoff = subDays(new Date(), 7);
    return entries.filter(e => isAfter(parseISO(e.date), cutoff));
  }, [entries]);

  const monthEntries = useMemo(() => {
    const cutoff = subMonths(new Date(), 1);
    return entries.filter(e => isAfter(parseISO(e.date), cutoff));
  }, [entries]);

  // Fetch goals from Supabase for OKR progress in review
  useEffect(() => {
    if (!user || !supabase) return;
    supabase.from("goals").select("*").eq("user_id", user.id)
      .then(({ data }) => { if (data) setGoals(data); });
  }, [user]);

  // Restore saved letter on mount: show the local cache immediately (fast,
  // works offline), then let the Supabase copy (synced across devices)
  // override it once it comes back, if it's present.
  // 恢复的是"本月最后一次生成"的那封信，不管它是周信还是月报。
  useEffect(() => {
    const lastType = localStorage.getItem(LAST_TYPE_KEY()) as "weekly" | "monthly" | null;
    const type = lastType === "monthly" ? "monthly" : "weekly"; // 旧数据没有标记时按周信兜底
    const saved = localStorage.getItem(LETTER_CACHE_KEY(type));
    if (saved) {
      setLetter(saved);
      setLetterType(type);
    }
  }, []);

  useEffect(() => {
    if (!user || !supabase) return;
    const period = format(new Date(), "yyyy-MM");
    // 不再写死 type="weekly"：按 updated_at 取本月最新的一封（周信或月报都可能是最新），
    // 这样月报也能在跨设备/刷新后正确恢复，而不是被周信缓存逻辑永久忽略。
    supabase.from("review_letters").select("content, type, updated_at")
      .eq("user_id", user.id).eq("period", period)
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) { console.error("Failed to load review letter from Supabase:", error); return; }
        if (data?.content) {
          const type = (data.type === "monthly" ? "monthly" : "weekly") as "weekly" | "monthly";
          setLetter(data.content);
          setLetterType(type);
          localStorage.setItem(LETTER_CACHE_KEY(type), data.content);
          localStorage.setItem(LAST_TYPE_KEY(), type);
        }
      });
  }, [user]);

  const buildSummary = useCallback((data: typeof entries) => {
    const count = data.length;
    const avgEmotion = count ? +(data.reduce((s, e) => s + e.emotionScore, 0) / count).toFixed(1) : 0;
    const allTags = data.flatMap(e => e.emotionTags);
    const tagCounts: Record<string, number> = {};
    allTags.forEach(t => tagCounts[t] = (tagCounts[t] || 0) + 1);
    const topTags = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
    const topicTags = data.flatMap(e => e.topicTags);
    const topicCounts: Record<string, number> = {};
    topicTags.forEach(t => topicCounts[t] = (topicCounts[t] || 0) + 1);
    const topTopics = Object.entries(topicCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);

    const allTodosInRange = data.flatMap(e => e.todos);
    const todoTotal = allTodosInRange.length;
    const todoDone = allTodosInRange.filter(t => t.status === "done").length;
    const overdueTodos = allTodosInRange.filter(t => t.dueDate && t.dueDate < today && t.status !== "done");

    return { count, avgEmotion, topTags, topTopics, todoTotal, todoDone, overdueTodos };
  }, [today]);

  const generateLetter = useCallback(async (type: "weekly" | "monthly") => {
    // 取消上一次还没跑完的生成请求，避免它的流式回调在这次生成开始后
    // 还继续往 letter 里写，导致内容错乱。
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setLetterType(type);
    setIsGenerating(true);
    setLetter("");

    const data = type === "weekly" ? weekEntries : monthEntries;
    const stats = buildSummary(data);

    // Include more diary content (up to 10 entries, up to 300 chars each)
    const recentContent = data.slice(0, 10).map(e => {
      const userMsgs = e.messages.filter(m => m.role === "user").map(m => m.content).join(" ");
      const aiInsights = e.messages.filter(m => m.role === "assistant").map(m => m.content).slice(-1).join(" ");
      return `[${e.date}] 我说：${userMsgs.slice(0, 200)}${aiInsights ? `\n导师回应要点：${aiInsights.slice(0, 100)}` : ""}`;
    }).join("\n\n");

    // Include completed todos context
    const doneTodos = data.flatMap(e => e.todos).filter(t => t.status === "done").map(t => t.text).slice(0, 10).join("、");
    const pendingTodos = data.flatMap(e => e.todos).filter(t => t.status !== "done" && t.status !== "dropped").map(t => t.text).slice(0, 5).join("、");

    // Habits completion this week/month
    const periodStart = type === "weekly" ? subDays(new Date(), 7) : subMonths(new Date(), 1);
    const periodStartStr = format(periodStart, "yyyy-MM-dd");
    const habitSummary = habits.length > 0 ? habits.map(h => {
      const checkins = h.checkIns.filter(c => c >= periodStartStr);
      return `${h.emoji}${h.name}打卡${checkins.length}次`;
    }).join("、") : "";

    // OKR goals progress
    const goalSummary = goals.length > 0 ? goals.slice(0, 3).map((g: any) => {
      const krs = g.key_results || [];
      const avgProgress = krs.length > 0
        ? Math.round(krs.reduce((s: number, kr: any) => s + (kr.progress || 0), 0) / krs.length)
        : 0;
      return `${g.title}(进度${avgProgress}%)`;
    }).join("、") : "";

    // Energy summary
    const recentEnergy = energyLogs.slice(0, 7);
    const energySummary = recentEnergy.length > 0
      ? `精力分布：高${recentEnergy.filter(l => l.level === "高").length}次、中${recentEnergy.filter(l => l.level === "中").length}次、低${recentEnergy.filter(l => l.level === "低").length}次`
      : "";

    // Budget data from localStorage (not in Supabase)
    let budgetSummary = "";
    try {
      const uid = user?.id || "";
      const budgets = JSON.parse(localStorage.getItem(`budgets_${uid}`) || "[]");
      const subs = JSON.parse(localStorage.getItem(`subscriptions_${uid}`) || "[]");
      if (budgets.length > 0) budgetSummary += `设有${budgets.length}个预算类别`;
      if (subs.filter((s: any) => s.active).length > 0) {
        const monthlyFixed = subs.filter((s: any) => s.active)
          .reduce((sum: number, s: any) => sum + (s.billingCycle === "yearly" ? s.amount/12 : s.amount), 0);
        budgetSummary += `，每月固定订阅支出约¥${Math.round(monthlyFixed)}`;
      }
    } catch {}

    const contextMsg = `以下是我${type === "weekly" ? "这周" : "这个月"}的完整记录：

【数据摘要】
- 记录天数：${stats.count}天
- 平均情绪：${stats.avgEmotion}/10
- 常见情绪：${stats.topTags.map(([t]) => t).join("、") || "无"}
- 常见话题：${stats.topTopics.map(([t]) => t).join("、") || "无"}
- 任务完成：${stats.todoDone}/${stats.todoTotal}（${stats.overdueTodos.length}个逾期）
${doneTodos ? `- 已完成：${doneTodos}` : ""}
${pendingTodos ? `- 未完成：${pendingTodos}` : ""}
${monthFinanceStats.count > 0 ? `- 本月财务：收入¥${monthFinanceStats.income}，支出¥${monthFinanceStats.expense}，净值¥${monthFinanceStats.net}` : ""}
${budgetSummary ? `- 固定支出：${budgetSummary}` : ""}
${wheelScores[0] ? `- 生命之轮最新：${ALL_DOMAINS.map(d => `${d}${wheelScores[0].scores[d]}`).join("、")}` : ""}
${wheelScores.length > 1 ? `- 上次轮子：${ALL_DOMAINS.map(d => `${d}${wheelScores[1].scores[d]}`).join("、")}` : ""}
${habitSummary ? `- 习惯打卡：${habitSummary}` : ""}
${goalSummary ? `- 目标进度：${goalSummary}` : ""}
${energySummary ? `- ${energySummary}` : ""}

【日记原文】
${recentContent}

请作为我的私人导师，给我写一封深度${type === "weekly" ? "周" : "月"}回顾信。要结合我的具体内容，不要泛泛而谈。信的结构：
① 看见我这段时间的状态和成长
② 指出我可能忽略的模式或盲点（结合习惯/目标/精力数据）
③ 给出1-2个具体的下周行动建议
④ 推荐1个适合我当前阶段的资源`;

    const msgs: ChatMsg[] = [{ role: "user", content: contextMsg }];
    let full = "";

    try {
      await streamChat({
        messages: msgs,
        mode: type === "weekly" ? "weekly-review" : "monthly-review",
        signal: controller.signal,
        modelProfileId: defaultModelProfileId,
        onDelta: (chunk) => {
          full += chunk;
          setLetter(full);
        },
        onRetry: () => {
          // 上一次尝试的残留内容作废，避免重试后的新增量拼接在旧内容后面
          full = "";
          setLetter("");
        },
        onDone: () => {
          if (controller.signal.aborted) return; // 已被更新的一次生成或卸载取消，不再落地这次结果
          setIsGenerating(false);
          // Keep the localStorage cache (fast local read, works offline)...
          localStorage.setItem(LETTER_CACHE_KEY(type), full);
          localStorage.setItem(LAST_TYPE_KEY(), type);
          // ...and sync it to Supabase so other devices/browsers see it too.
          if (user && supabase) {
            const period = format(new Date(), "yyyy-MM");
            supabase.from("review_letters")
              .upsert(
                { user_id: user.id, type, period, content: full, updated_at: new Date().toISOString() },
                { onConflict: "user_id,type,period" }
              )
              .then(({ error }) => {
                if (error) console.error("Failed to sync review letter to Supabase:", error);
              });
          }
        },
      });
    } catch (e: any) {
      if (controller.signal.aborted) return; // 主动取消，不当作失败展示
      setLetter(`抱歉，生成失败了。${e.message || ""}`);
      setIsGenerating(false);
    }
  }, [weekEntries, monthEntries, buildSummary, monthFinanceStats, wheelScores, user]);

  // 组件卸载时取消还在进行的生成请求
  useEffect(() => () => abortRef.current?.abort(), []);

  // Auto-trigger weekly letter from URL param
  useEffect(() => {
    if (autoTriggeredRef.current) return;
    const auto = searchParams.get("auto");
    if (auto === "weekly" && weekEntries.length >= 3 && !isGenerating && !letter) {
      autoTriggeredRef.current = true;
      const timer = setTimeout(() => generateLetter("weekly"), 1000);
      return () => clearTimeout(timer);
    }
  }, [searchParams, weekEntries.length, isGenerating, letter, generateLetter]);

  const weekStats = useMemo(() => buildSummary(weekEntries), [weekEntries, buildSummary]);
  const monthStats = useMemo(() => buildSummary(monthEntries), [monthEntries, buildSummary]);

  const StatBlock = ({ stats }: { stats: ReturnType<typeof buildSummary> }) => (
    <div className="grid grid-cols-4 gap-2 mb-3">
      <div className="text-center">
        <div className="text-lg text-gold font-serif-sc">{stats.count}</div>
        <div className="text-[8px] text-muted-foreground">天</div>
      </div>
      <div className="text-center">
        <div className="text-lg text-gold font-serif-sc">{stats.avgEmotion}</div>
        <div className="text-[8px] text-muted-foreground">情绪</div>
      </div>
      <div className="text-center">
        <div className="text-lg text-gold font-serif-sc">{stats.todoTotal > 0 ? Math.round((stats.todoDone / stats.todoTotal) * 100) : 0}%</div>
        <div className="text-[8px] text-muted-foreground">完成率</div>
      </div>
      <div className="text-center">
        <div className="text-lg text-los-red font-serif-sc">{stats.overdueTodos.length}</div>
        <div className="text-[8px] text-muted-foreground">逾期</div>
      </div>
    </div>
  );

  return (
    <div className="h-full overflow-y-auto px-4 max-w-[600px] mx-auto pb-4"
      onTouchStart={(e) => setTouchStart(e.touches[0].clientX)}
      onTouchEnd={(e) => { const delta = e.changedTouches[0].clientX - touchStart; if (touchStart < 30 && delta > 70) navigate(-1); }}
    >
      <div className="py-4">
        <h1 className="font-serif-sc text-lg text-foreground">复盘</h1>
      </div>

      {weekStats.count === 0 && monthStats.count === 0 && (
        <div className="text-center py-12">
          <p className="text-sm text-muted-foreground leading-[1.8]">当你有 3 天以上的记录，罗盘就能开始帮你回顾了。</p>
        </div>
      )}
      <div className="bg-surface-2 border border-border rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs text-foreground">本周</h2>
          <button onClick={() => generateLetter("weekly")} disabled={isGenerating || weekStats.count === 0}
            className="flex items-center gap-1 text-[10px] text-gold font-mono-jb disabled:opacity-30">
            <Mail size={12} /> 生成周信
          </button>
        </div>
        <StatBlock stats={weekStats} />
        {weekStats.topTags.length > 0 && (
          <div className="flex gap-1 flex-wrap">
            {weekStats.topTags.map(([t, c]) => (
              <span key={t} className="text-[9px] bg-surface-3 text-muted-foreground px-1.5 py-0.5 rounded">{t} ×{c}</span>
            ))}
          </div>
        )}
      </div>

      {/* Monthly */}
      <div className="bg-surface-2 border border-border rounded-xl p-4 mb-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-xs text-foreground">本月</h2>
          <button onClick={() => generateLetter("monthly")} disabled={isGenerating || monthStats.count === 0}
            className="flex items-center gap-1 text-[10px] text-gold font-mono-jb disabled:opacity-30">
            <Mail size={12} /> 生成月报
          </button>
        </div>
        <StatBlock stats={monthStats} />
      </div>

      {/* Letter */}
      {letter !== null && (
        <div className="bg-surface-2 border border-gold-border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-sm">📮</span>
            <span className="text-xs text-foreground">{letterType === "weekly" ? "周信" : "月报"}</span>
            {isGenerating && <Loader2 size={12} className="animate-spin text-gold ml-auto" />}
            {!isGenerating && (
              <div className="ml-auto flex gap-2">
                <button
                  onClick={async () => {
                    await navigator.clipboard.writeText(letter || "");
                    setCopied(true);
                    setTimeout(() => setCopied(false), 2000);
                  }}
                  className="text-muted-foreground/60 hover:text-gold transition-colors"
                  title="复制全文"
                >
                  {copied ? <Check size={11} className="text-los-green" /> : <Copy size={11} />}
                </button>
                <button
                  onClick={() => generateLetter(letterType || "weekly")}
                  className="text-muted-foreground/40 hover:text-gold transition-colors"
                  title="重新生成"
                >
                  <RotateCcw size={11} />
                </button>
              </div>
            )}
          </div>
          <p className="text-[13px] text-foreground/90 leading-[1.8] whitespace-pre-line">{letter}</p>
          {!isGenerating && <p className="text-[11px] text-muted-foreground mt-4 italic">—— 罗盘</p>}
        </div>
      )}
    </div>
  );
};

export default ReviewPage;
