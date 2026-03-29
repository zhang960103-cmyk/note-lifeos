import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff, X, Check, Languages, Loader2 } from "lucide-react";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/life-mentor-chat`;

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  onClose: () => void;
}

const LANGUAGES = [
  { code: "zh-CN", label: "中文", flag: "🇨🇳" },
  { code: "en-US", label: "English", flag: "🇺🇸" },
  { code: "ar-SA", label: "العربية", flag: "🇸🇦" },
];

interface CorrectionChange {
  from: string;
  to: string;
}

async function correctVoiceText(text: string): Promise<{ corrected: string; changes: CorrectionChange[] }> {
  try {
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({
        messages: [{ role: "user", content: text }],
        mode: "voice-correct",
      }),
    });
    if (!resp.ok) return { corrected: text, changes: [] };
    const data = await resp.json();
    return {
      corrected: data.corrected || text,
      changes: data.changes || [],
    };
  } catch {
    return { corrected: text, changes: [] };
  }
}

export default function VoiceInput({ onTranscript, onClose }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState("");
  const [langIdx, setLangIdx] = useState(0);
  const [error, setError] = useState("");
  const [duration, setDuration] = useState(0);
  const [isCorreecting, setIsCorrecting] = useState(false);
  const [corrected, setCorrected] = useState(false);
  const [changes, setChanges] = useState<CorrectionChange[]>([]);
  const [originalText, setOriginalText] = useState("");
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const lang = LANGUAGES[langIdx];

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  // Auto-correct after stopping
  const handleStopAndCorrect = useCallback(async () => {
    stopListening();
    // Wait a tick for final transcript state
    setTimeout(async () => {
      const raw = document.querySelector<HTMLElement>('[data-raw-transcript]')?.dataset.rawTranscript || "";
      if (!raw.trim()) return;
      setIsCorrecting(true);
      setOriginalText(raw);
      const result = await correctVoiceText(raw);
      setTranscript(result.corrected);
      setInterimText("");
      setChanges(result.changes);
      setCorrected(true);
      setIsCorrecting(false);
    }, 200);
  }, [stopListening]);

  const startListening = useCallback(() => {
    setError("");
    setCorrected(false);
    setChanges([]);
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError("当前浏览器不支持语音识别，请使用 Chrome 或 Safari");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = lang.code;
    recognition.interimResults = true;
    recognition.continuous = true;
    recognition.maxAlternatives = 1;

    recognition.onresult = (event: any) => {
      let final = "";
      let interim = "";
      for (let i = 0; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) {
          final += result[0].transcript;
        } else {
          interim += result[0].transcript;
        }
      }
      if (final) setTranscript(final);
      setInterimText(interim);
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech") {
        setError("未检测到语音，请重试");
      } else if (event.error === "not-allowed") {
        setError("请允许麦克风权限");
      } else {
        setError(`识别错误: ${event.error}`);
      }
      stopListening();
    };

    recognition.onend = () => {
      setIsListening(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
    setIsListening(true);
    setDuration(0);
    setTranscript("");
    setInterimText("");
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
  }, [lang.code, stopListening]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  useEffect(() => {
    if (editMode && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(editText.length, editText.length);
    }
  }, [editMode, editText]);

  const handleConfirm = () => {
    const finalText = editMode ? editText : transcript;
    if (finalText.trim()) {
      onTranscript(finalText.trim());
    }
    onClose();
  };

  const handleEdit = () => {
    setEditText(transcript);
    setEditMode(true);
  };

  const handleUseOriginal = () => {
    setTranscript(originalText);
    setCorrected(false);
    setChanges([]);
  };

  const cycleLang = () => {
    if (isListening) stopListening();
    setLangIdx((langIdx + 1) % LANGUAGES.length);
    setTranscript("");
    setInterimText("");
    setCorrected(false);
    setChanges([]);
  };

  const fullText = transcript + interimText;
  const formatDuration = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-sm flex flex-col animate-in fade-in">
      {/* Hidden element to pass raw transcript for correction */}
      <span data-raw-transcript={fullText} className="hidden" />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <button onClick={onClose} className="p-2 text-muted-foreground hover:text-foreground transition">
          <X size={20} />
        </button>
        <span className="text-sm font-serif-sc text-foreground">语音输入</span>
        <button onClick={cycleLang} className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface-2 text-xs text-muted-foreground hover:text-foreground transition">
          <Languages size={14} />
          <span>{lang.flag} {lang.label}</span>
        </button>
      </div>

      {/* Transcript display / Edit area */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        {editMode ? (
          <textarea
            ref={textareaRef}
            value={editText}
            onChange={e => setEditText(e.target.value)}
            className="w-full h-full min-h-[200px] bg-transparent text-foreground text-base leading-[2] resize-none focus:outline-none placeholder:text-muted-foreground/40"
            placeholder="编辑识别结果..."
          />
        ) : isCorreecting ? (
          <div className="flex flex-col items-center justify-center h-[200px] text-center gap-3">
            <Loader2 size={24} className="animate-spin text-gold" />
            <p className="text-muted-foreground text-sm">AI 正在纠错润色...</p>
          </div>
        ) : (
          <div className="min-h-[200px]">
            {fullText ? (
              <div>
                <p className="text-foreground text-base leading-[2] whitespace-pre-wrap">
                  {transcript}
                  {interimText && <span className="text-muted-foreground/60">{interimText}</span>}
                </p>

                {/* Show correction diff */}
                {corrected && changes.length > 0 && (
                  <div className="mt-4 p-3 bg-surface-2 rounded-xl">
                    <p className="text-[10px] text-gold mb-2 font-medium">🤖 AI 已自动修正：</p>
                    {changes.map((c, i) => (
                      <div key={i} className="text-xs leading-relaxed mb-1">
                        <span className="text-los-red line-through">{c.from}</span>
                        <span className="text-muted-foreground mx-1">→</span>
                        <span className="text-los-green">{c.to}</span>
                      </div>
                    ))}
                    <button
                      onClick={handleUseOriginal}
                      className="text-[10px] text-muted-foreground/50 hover:text-muted-foreground mt-2 transition"
                    >
                      恢复原文
                    </button>
                  </div>
                )}
                {corrected && changes.length === 0 && (
                  <p className="mt-3 text-[10px] text-muted-foreground/50">✓ AI 检查完毕，无需修正</p>
                )}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-[200px] text-center">
                {error ? (
                  <p className="text-los-red text-sm">{error}</p>
                ) : (
                  <>
                    <p className="text-muted-foreground/50 text-sm">
                      {isListening ? "正在聆听..." : "点击下方麦克风开始说话"}
                    </p>
                    <p className="text-muted-foreground/30 text-[10px] mt-2">
                      支持中文、English、العربية · 停止后自动纠错
                    </p>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom controls */}
      <div className="px-4 py-4 pb-6 border-t border-border bg-surface-1">
        {isListening && (
          <div className="flex justify-center mb-3">
            <div className="flex items-center gap-2 text-los-red text-xs">
              <span className="w-2 h-2 bg-los-red rounded-full animate-pulse" />
              <span>{formatDuration(duration)}</span>
            </div>
          </div>
        )}

        <div className="flex items-center justify-center gap-6">
          {/* Edit button */}
          {fullText && !editMode && !isListening && !isCorreecting && (
            <button
              onClick={handleEdit}
              className="text-xs text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg bg-surface-2 transition"
            >
              ✏️ 编辑
            </button>
          )}

          {/* Mic button */}
          {!editMode && !isCorreecting && (
            <button
              onClick={isListening ? handleStopAndCorrect : startListening}
              className={`w-16 h-16 rounded-full flex items-center justify-center transition-all ${
                isListening
                  ? "bg-los-red text-white shadow-lg shadow-los-red/30 scale-110"
                  : "bg-gold text-background hover:bg-gold/90"
              }`}
            >
              {isListening ? <MicOff size={24} /> : <Mic size={24} />}
            </button>
          )}

          {/* Confirm button */}
          {(fullText || editText) && !isListening && !isCorreecting && (
            <button
              onClick={handleConfirm}
              className="text-xs text-gold hover:text-gold/80 px-3 py-2 rounded-lg bg-gold/10 transition flex items-center gap-1"
            >
              <Check size={14} />
              发送
            </button>
          )}
        </div>

        {!editMode && !isListening && !isCorreecting && fullText && (
          <p className="text-center text-[10px] text-muted-foreground/40 mt-3">
            点击「编辑」可手动修改 · 点击「发送」确认
          </p>
        )}
      </div>
    </div>
  );
}
