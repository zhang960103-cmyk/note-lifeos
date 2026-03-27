import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { Send, Loader2, Clock, BarChart3, Target } from "lucide-react";
import { streamChat, extractMeta, type ChatMsg } from "@/lib/streamChat";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { format } from "date-fns";
import type { TodoItem } from "@/types/lifeOs";

const HomePage = () => {
  const navigate = useNavigate();
  const { todayEntry, todayKey, addMessage, updateAssistantMessage, updateDayMeta } = useLifeOs();
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const chatEndRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const messages = todayEntry?.messages || [];
  const displayMessages = isLoading && streamingContent
    ? [...messages, { role: "assistant" as const, content: streamingContent, timestamp: new Date().toISOString() }]
    : messages;

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [displayMessages.length, streamingContent]);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 120) + "px";
    }
  }, [input]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMsg = { role: "user" as const, content: text, timestamp: new Date().toISOString() };
    addMessage(userMsg);
    setInput("");
    setIsLoading(true);
    setStreamingContent("");

    const controller = new AbortController();
    abortRef.current = controller;

    let full = "";
    const allMsgs: ChatMsg[] = [
      ...messages.map(m => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: text },
    ];

    try {
      await streamChat({
        messages: allMsgs,
        mode: "default",
        onDelta: (chunk) => {
          full += chunk;
          setStreamingContent(full);
        },
        onDone: () => {
          // Save the complete assistant message
          addMessage({ role: "assistant", content: full, timestamp: new Date().toISOString() });
          setStreamingContent("");
          setIsLoading(false);

          // Background extraction
          const msgsForExtract = [
            ...allMsgs,
            { role: "assistant" as const, content: full },
          ];
          extractMeta(msgsForExtract).then(meta => {
            if (meta.emotionTags.length || meta.topicTags.length || meta.todos.length) {
              const todoItems: TodoItem[] = meta.todos.map(t => ({
                id: crypto.randomUUID(),
                text: t,
                completed: false,
                createdAt: new Date().toISOString(),
              }));
              updateDayMeta(todayKey, {
                emotionTags: meta.emotionTags,
                topicTags: meta.topicTags,
                todos: todoItems.length > 0 ? todoItems : undefined,
                emotionScore: meta.emotionScore || undefined,
              });
            }
          });
        },
        signal: controller.signal,
      });
    } catch (e: any) {
      if (e.name !== "AbortError") {
        addMessage({ role: "assistant", content: `抱歉，出了点问题。${e.message || ""}`, timestamp: new Date().toISOString() });
      }
      setStreamingContent("");
      setIsLoading(false);
    }
  }, [isLoading, messages, addMessage, updateDayMeta, todayKey]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  return (
    <div className="flex flex-col h-[100dvh] max-w-[600px] mx-auto">
      {/* Minimal header */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-[10px] text-muted-foreground font-mono-jb">
          {format(new Date(), "M月d日")}
        </span>
        <div className="flex gap-3">
          <button onClick={() => navigate("/history")} className="text-muted-foreground hover:text-foreground transition-colors">
            <Clock size={18} />
          </button>
          <button onClick={() => navigate("/review")} className="text-muted-foreground hover:text-foreground transition-colors">
            <BarChart3 size={18} />
          </button>
          <button onClick={() => navigate("/wheel")} className="text-muted-foreground hover:text-foreground transition-colors">
            <Target size={18} />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-2">
        {displayMessages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <div className="text-center max-w-[260px]">
              <div className="text-3xl mb-4">🧭</div>
              <p className="text-foreground text-sm leading-[1.8]">今天，你想说什么？</p>
              <p className="text-muted-foreground text-xs mt-2 leading-[1.8]">随便聊，我在听。</p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {displayMessages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[82%] rounded-2xl px-4 py-3 ${
                  msg.role === "user"
                    ? "bg-gold text-background rounded-br-sm text-sm leading-[1.8]"
                    : "text-muted-foreground rounded-bl-sm text-[13px] leading-[1.8]"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {isLoading && !streamingContent && (
            <div className="flex justify-start">
              <div className="px-4 py-3">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                  <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                  <span className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                </div>
              </div>
            </div>
          )}
        </div>
        <div ref={chatEndRef} />
      </div>

      {/* Tags strip */}
      {todayEntry && (todayEntry.emotionTags.length > 0 || todayEntry.topicTags.length > 0) && (
        <div className="px-4 py-1.5 flex gap-1.5 overflow-x-auto scrollbar-none">
          {todayEntry.emotionTags.map(t => (
            <span key={t} className="text-[9px] bg-surface-2 text-muted-foreground px-2 py-0.5 rounded-full whitespace-nowrap">{t}</span>
          ))}
          {todayEntry.topicTags.map(t => (
            <span key={t} className="text-[9px] bg-gold-light text-gold px-2 py-0.5 rounded-full whitespace-nowrap">{t}</span>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="px-4 py-3 pb-[env(safe-area-inset-bottom,12px)]">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="说点什么..."
            rows={1}
            className="flex-1 bg-surface-2 border border-border rounded-2xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/40 resize-none focus:outline-none focus:border-gold-border transition-colors leading-[1.8]"
            style={{ minHeight: "42px", maxHeight: "120px" }}
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={!input.trim() || isLoading}
            className="bg-gold text-background rounded-full p-2.5 disabled:opacity-20 hover:bg-gold/90 transition-all flex-shrink-0"
          >
            {isLoading ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default HomePage;
