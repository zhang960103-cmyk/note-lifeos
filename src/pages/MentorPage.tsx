import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Send, Sparkles, RotateCcw, Loader2 } from "lucide-react";
import { streamChat, type ChatMessage, type ChatMode } from "@/lib/streamChat";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { ALL_DOMAINS, ALGORITHM_INFO } from "@/types/lifeOs";
import { subDays, subMonths, isAfter } from "date-fns";
import ReactMarkdown from "react-markdown";

const MODES: { value: ChatMode; label: string; icon: string }[] = [
  { value: "default", label: "日常对话", icon: "🧭" },
  { value: "soul-patch", label: "灵魂补丁", icon: "🔮" },
  { value: "weekly-review", label: "周复盘信", icon: "📊" },
  { value: "monthly-review", label: "月度报告", icon: "📈" },
];

const QUICK_PROMPTS = [
  "我最近感到迷茫，不知道方向在哪",
  "帮我分析一下本周的成长数据",
  "我想做一个新项目，但害怕失败",
  "今天状态超级好，效率爆棚！",
];

const MentorPage = () => {
  const navigate = useNavigate();
  const { entries, wheelScores } = useLifeOs();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [mode, setMode] = useState<ChatMode>("default");
  const [showModes, setShowModes] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Build context summary from user data
  const buildContextSummary = useCallback(() => {
    const weekCutoff = subDays(new Date(), 7);
    const monthCutoff = subMonths(new Date(), 1);
    const weekEntries = entries.filter(e => isAfter(new Date(e.createdAt), weekCutoff));
    const monthEntries = entries.filter(e => isAfter(new Date(e.createdAt), monthCutoff));

    const weekAvgHappy = weekEntries.length
      ? (weekEntries.reduce((s, e) => s + e.happinessScore, 0) / weekEntries.length).toFixed(1)
      : "N/A";
    const weekAvgEmotion = weekEntries.length
      ? (weekEntries.reduce((s, e) => s + e.emotionScore, 0) / weekEntries.length).toFixed(1)
      : "N/A";

    const allTasks = weekEntries.flatMap(e => e.tasks);
    const sys = allTasks.filter(t => t.type === "建系统").length;
    const sell = allTasks.filter(t => t.type === "卖时间").length;

    const domainCounts: Record<string, number> = {};
    ALL_DOMAINS.forEach(d => domainCounts[d] = 0);
    weekEntries.forEach(e => e.domains.forEach(d => domainCounts[d]++));
    const emptyDomains = ALL_DOMAINS.filter(d => domainCounts[d] === 0);

    const algoUsage: Record<string, number> = {};
    weekEntries.forEach(e => algoUsage[e.algorithm] = (algoUsage[e.algorithm] || 0) + 1);

    const latestWheel = wheelScores[0];

    let ctx = `[用户本周数据摘要]\n`;
    ctx += `- 日记数：${weekEntries.length}篇（月度${monthEntries.length}篇）\n`;
    ctx += `- 平均幸福度：${weekAvgHappy}/10，平均情绪：${weekAvgEmotion}/10\n`;
    ctx += `- 杠杆比：建系统${sys}个 / 卖时间${sell}个\n`;
    if (emptyDomains.length) ctx += `- 空白领域：${emptyDomains.join("、")}\n`;
    ctx += `- 算法使用：${Object.entries(algoUsage).map(([a, c]) => `${ALGORITHM_INFO[a as keyof typeof ALGORITHM_INFO]?.name || a}${c}次`).join("、")}\n`;
    if (latestWheel) {
      ctx += `- 最新生命之轮：${ALL_DOMAINS.map(d => `${d}${latestWheel.scores[d]}`).join("、")}\n`;
    }

    return ctx;
  }, [entries, wheelScores]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userContent = (mode === "weekly-review" || mode === "monthly-review")
      ? `${buildContextSummary()}\n\n用户消息：${text}`
      : text;

    const userMsg: ChatMessage = { role: "user", content: userContent };
    const displayMsg: ChatMessage = { role: "user", content: text };

    setMessages(prev => [...prev, displayMsg]);
    setInput("");
    setIsLoading(true);

    let assistantSoFar = "";
    const controller = new AbortController();
    abortRef.current = controller;

    const upsert = (chunk: string) => {
      assistantSoFar += chunk;
      setMessages(prev => {
        const last = prev[prev.length - 1];
        if (last?.role === "assistant") {
          return prev.map((m, i) => i === prev.length - 1 ? { ...m, content: assistantSoFar } : m);
        }
        return [...prev, { role: "assistant", content: assistantSoFar }];
      });
    };

    try {
      const history = messages.map(m => ({ role: m.role, content: m.content }));
      await streamChat({
        messages: [...history, userMsg],
        mode,
        onDelta: upsert,
        onDone: () => setIsLoading(false),
        signal: controller.signal,
      });
    } catch (e: any) {
      if (e.name !== "AbortError") {
        setMessages(prev => [...prev, { role: "assistant", content: `❌ ${e.message || "请求失败，请重试"}` }]);
      }
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const clearChat = () => {
    abortRef.current?.abort();
    setMessages([]);
    setIsLoading(false);
  };

  return (
    <div className="flex flex-col h-[100dvh] max-w-[600px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border bg-surface-1/95 backdrop-blur-sm">
        <button onClick={() => navigate("/")} className="text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft size={20} />
        </button>
        <div className="flex-1">
          <h1 className="font-serif-sc text-sm text-foreground">🧭 生命罗盘 · AI导师</h1>
          <p className="text-[9px] text-muted-foreground font-mono-jb">
            {MODES.find(m => m.value === mode)?.icon} {MODES.find(m => m.value === mode)?.label}
          </p>
        </div>
        <button onClick={() => setShowModes(!showModes)} className="text-muted-foreground hover:text-gold transition-colors">
          <Sparkles size={18} />
        </button>
        <button onClick={clearChat} className="text-muted-foreground hover:text-foreground transition-colors">
          <RotateCcw size={16} />
        </button>
      </div>

      {/* Mode Selector */}
      {showModes && (
        <div className="px-4 py-2 bg-surface-2 border-b border-border flex gap-2 overflow-x-auto scrollbar-none">
          {MODES.map(m => (
            <button
              key={m.value}
              onClick={() => { setMode(m.value); setShowModes(false); }}
              className={`text-[10px] font-mono-jb px-3 py-1.5 rounded-full whitespace-nowrap transition-all ${
                mode === m.value
                  ? "bg-gold text-background"
                  : "bg-surface-3 text-muted-foreground hover:text-gold hover:border-gold-border border border-border"
              }`}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-12">
            <div className="text-4xl mb-3">🧭</div>
            <h2 className="font-serif-sc text-base text-foreground mb-2">你的人生导师在线</h2>
            <p className="text-xs text-muted-foreground mb-6 max-w-[280px] mx-auto">
              我是生命罗盘，集日记整理师、成长教练、人生参谋于一体。说说你在想什么？
            </p>
            <div className="grid grid-cols-1 gap-2 max-w-[320px] mx-auto">
              {QUICK_PROMPTS.map((p, i) => (
                <button
                  key={i}
                  onClick={() => sendMessage(p)}
                  className="text-left bg-surface-2 border border-border rounded-lg px-3 py-2.5 text-xs text-muted-foreground hover:text-gold hover:border-gold-border transition-all"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-gold text-background rounded-br-md"
                  : "bg-surface-2 border border-border text-foreground rounded-bl-md"
              }`}
            >
              {msg.role === "assistant" ? (
                <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1.5 [&_li]:my-0.5 [&_h1]:text-base [&_h2]:text-sm [&_h3]:text-xs [&_code]:text-gold [&_strong]:text-gold">
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                </div>
              ) : (
                <span>{msg.content}</span>
              )}
            </div>
          </div>
        ))}

        {isLoading && messages[messages.length - 1]?.role !== "assistant" && (
          <div className="flex justify-start">
            <div className="bg-surface-2 border border-border rounded-2xl rounded-bl-md px-4 py-3">
              <Loader2 size={16} className="animate-spin text-gold" />
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div className="px-4 py-3 border-t border-border bg-surface-1/95 backdrop-blur-sm pb-[env(safe-area-inset-bottom,12px)]">
        <div className="flex gap-2 items-end">
          <textarea
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="和生命罗盘聊聊..."
            rows={1}
            className="flex-1 bg-surface-2 border border-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 resize-none focus:outline-none focus:border-gold-border transition-colors max-h-[120px]"
            style={{ minHeight: "42px" }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="bg-gold text-background rounded-xl p-2.5 disabled:opacity-30 hover:bg-gold/90 transition-all flex-shrink-0"
          >
            <Send size={18} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default MentorPage;
