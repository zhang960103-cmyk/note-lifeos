import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff, X, Check, Languages, Loader2 } from "lucide-react";

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  onClose: () => void;
}

const LANGUAGES = [
  { code: "zh-CN", label: "中文", flag: "🇨🇳" },
  { code: "en-US", label: "English", flag: "🇺🇸" },
  { code: "ar-SA", label: "العربية", flag: "🇸🇦" },
];

export default function VoiceInput({ onTranscript, onClose }: VoiceInputProps) {
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [editMode, setEditMode] = useState(false);
  const [editText, setEditText] = useState("");
  const [langIdx, setLangIdx] = useState(0);
  const [error, setError] = useState("");
  const [duration, setDuration] = useState(0);
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

  const startListening = useCallback(() => {
    setError("");
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
      if (final) setTranscript(prev => prev + final);
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
    timerRef.current = setInterval(() => setDuration(d => d + 1), 1000);
  }, [lang.code, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Auto-focus textarea in edit mode
  useEffect(() => {
    if (editMode && textareaRef.current) {
      textareaRef.current.focus();
      textareaRef.current.setSelectionRange(editText.length, editText.length);
    }
  }, [editMode, editText]);

  const handleConfirm = () => {
    const finalText = editMode ? editText : (transcript + interimText);
    if (finalText.trim()) {
      onTranscript(finalText.trim());
    }
    onClose();
  };

  const handleEdit = () => {
    setEditText(transcript + interimText);
    setEditMode(true);
    if (isListening) stopListening();
  };

  const cycleLang = () => {
    if (isListening) stopListening();
    setLangIdx((langIdx + 1) % LANGUAGES.length);
    setTranscript("");
    setInterimText("");
  };

  const fullText = transcript + interimText;
  const formatDuration = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-sm flex flex-col animate-in fade-in">
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
        ) : (
          <div className="min-h-[200px]">
            {fullText ? (
              <p className="text-foreground text-base leading-[2] whitespace-pre-wrap">
                {transcript}
                {interimText && <span className="text-muted-foreground/60">{interimText}</span>}
              </p>
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
                      支持中文、English、العربية
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
        {/* Duration indicator */}
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
          {fullText && !editMode && (
            <button
              onClick={handleEdit}
              className="text-xs text-muted-foreground hover:text-foreground px-3 py-2 rounded-lg bg-surface-2 transition"
            >
              ✏️ 编辑
            </button>
          )}

          {/* Mic button */}
          {!editMode && (
            <button
              onClick={isListening ? stopListening : startListening}
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
          {(fullText || editText) && (
            <button
              onClick={handleConfirm}
              className="text-xs text-gold hover:text-gold/80 px-3 py-2 rounded-lg bg-gold/10 transition flex items-center gap-1"
            >
              <Check size={14} />
              发送
            </button>
          )}
        </div>

        {!editMode && !isListening && fullText && (
          <p className="text-center text-[10px] text-muted-foreground/40 mt-3">
            点击「编辑」可手动修改识别结果
          </p>
        )}
      </div>
    </div>
  );
}
