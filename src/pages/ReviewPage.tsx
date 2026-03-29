import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { ALL_DOMAINS } from "@/types/lifeOs";
import { Mail, Loader2 } from "lucide-react";
import { subDays, isAfter, subMonths, format, parseISO } from "date-fns";
import { streamChat, type ChatMsg } from "@/lib/streamChat";

const ReviewPage = () => {
  const navigate = useNavigate();
  const { entries, wheelScores, allTodos, monthFinanceStats } = useLifeOs();
  const [letter, setLetter] = useState<string | null>(null);
  const [letterType, setLetterType] = useState<"weekly" | "monthly" | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [touchStart, setTouchStart] = useState(0);

  const today = format(new Date(), "yyyy-MM-dd");

  const weekEntries = useMemo(() => {
    const cutoff = subDays(new Date(), 7);
    return entries.filter(e => isAfter(parseISO(e.date), cutoff));
  }, [entries]);

  const monthEntries = useMemo(() => {
    const cutoff = subMonths(new Date(), 1);
    return entries.filter(e => isAfter(parseISO(e.date), cutoff));
  }, [entries]);

  const buildSummary = (data: typeof entries) => {
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
  };

  const generateLetter = async (type: "weekly" | "monthly") => {
    setLetterType(type);
    setIsGenerating(true);
    setLetter("");

    const data = type === "weekly" ? weekEntries : monthEntries;
    const stats = buildSummary(data);

    const recentContent = data.slice(0, 5).map(e => {
      const userMsgs = e.messages.filter(m => m.role === "user").map(m => m.content).join(" ");
      return `[${e.date}] ${userMsgs.slice(0, 100)}`;
    }).join("\n");

    const contextMsg = `以下是我${type === "weekly" ? "这周" : "这个月"}的记录摘要：
- 记录天数：${stats.count}天
- 平均情绪：${stats.avgEmotion}/10
- 常见情绪：${stats.topTags.map(([t]) => t).join("、") || "无"}
- 常见话题：${stats.topTopics.map(([t]) => t).join("、") || "无"}
- 任务完成：${stats.todoDone}/${stats.todoTotal}
- 逾期任务：${stats.overdueTodos.length}个
${monthFinanceStats.count > 0 ? `- 本月收入：¥${monthFinanceStats.income}，支出：¥${monthFinanceStats.expense}，净值：¥${monthFinanceStats.net}` : ""}
${wheelScores[0] ? `- 生命之轮：${ALL_DOMAINS.map(d => `${d}${wheelScores[0].scores[d]}`).join("、")}` : ""}

最近内容：
${recentContent}

请给我写一封${type === "weekly" ? "周" : "月"}回顾信。如果有适合我当前阶段学习的资源（书籍、工具、课程），请在末尾推荐1-2个。`;

    const msgs: ChatMsg[] = [{ role: "user", content: contextMsg }];
    let full = "";

    try {
      await streamChat({
        messages: msgs,
        mode: type === "weekly" ? "weekly-review" : "monthly-review",
        onDelta: (chunk) => {
          full += chunk;
          setLetter(full);
        },
        onDone: () => setIsGenerating(false),
      });
    } catch (e: any) {
      setLetter(`抱歉，生成失败了。${e.message || ""}`);
      setIsGenerating(false);
    }
  };

  const weekStats = useMemo(() => buildSummary(weekEntries), [weekEntries]);
  const monthStats = useMemo(() => buildSummary(monthEntries), [monthEntries]);

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

      {/* Weekly */}
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
          </div>
          <p className="text-[13px] text-foreground/90 leading-[1.8] whitespace-pre-line">{letter}</p>
          {!isGenerating && <p className="text-[11px] text-muted-foreground mt-4 italic">—— 罗盘</p>}
        </div>
      )}
    </div>
  );
};

export default ReviewPage;
