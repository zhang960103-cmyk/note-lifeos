import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff, X, Check, Languages, Loader2 } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/life-mentor-chat`;

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  onClose: () => void;
}

const LANGUAGES_LIST = [
  { code: "zh-CN", label: "中文", flag: "🇨🇳" },
  { code: "en-US", label: "English", flag: "🇺🇸" },
  { code: "ar-SA", label: "العربية", flag: "🇸🇦" },
];

async function correctVoiceText(text: string): Promise<{ corrected: string; changes: Array<{ from: string; to: string }> }> {
  try {
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages: [{ role: "user", content: text }], mode: "voice-correct" }),
    });
    if (!resp.ok) return { corrected: text, changes: [] };
    const data = await resp.json();
    return { corrected: data.corrected || text, changes: data.changes || [] };
  } catch {
    return { corrected: text, changes: [] };
  }
}

export default function VoiceInput({ onTranscript, onClose }: VoiceInputProps) {
  const { t } = useLanguage();
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [langIdx, setLangIdx] = useState(0);
  const [error, setError] = useState("");
  const [duration, setDuration] = useState(0);
  const [isCorrecting, setIsCorrecting] = useState(false);
  const recognitionRef = useRef<any>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const transcriptRef = useRef("");

  const lang = LANGUAGES_LIST[langIdx];

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const handleStopAndCorrect = useCallback(async () => {
    stopListening();
    const raw = transcriptRef.current;
    if (!raw.trim()) return;
    setIsCorrecting(true);
    const result = await correctVoiceText(raw);
    // Auto-insert corrected text and close
    onTranscript(result.corrected);
    onClose();
  }, [stopListening, onTranscript, onClose]);

  const startListening = useCallback(() => {
    setError("");
    transcriptRef.current = "";
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) { setError("浏览器不支持语音识别"); return; }

    const recognition = new SR();
    recognition.lang = lang.code;
    recognition.interimResults = true;
    recognition.continuous = true;

    recognition.onresult = (event: any) => {
      let final = "", interim = "";
      for (let i = 0; i < event.results.length; i++) {
        if (event.results[i].isFinal) final += event.results[i][0].transcript;
        else interim += event.results[i][0].transcript;
      }
      if (final) { transcriptRef.current = final; setTranscript(final); }
      setInterimText(interim);
    };

    recognition.onerror = (event: any) => {
      if (event.error === "no-speech") setError("未检测到语音");
      else if (event.error === "not-allowed") setError("请允许麦克风权限");
      else setError(`错误: ${event.error}`);
      stopListening();
    };

    recognition.onend = () => {
      setIsListening(false);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
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
    return () => { recognitionRef.current?.stop(); if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Auto-start on mount
  useEffect(() => { startListening(); }, []);

  const cycleLang = () => {
    if (isListening) stopListening();
    setLangIdx((langIdx + 1) % LANGUAGES_LIST.length);
    setTranscript(""); setInterimText("");
  };

  const fullText = transcript + interimText;
  const fmt = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  return (
    <div className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in">
      {/* Close */}
      <button onClick={onClose} className="absolute top-4 right-4 p-2 text-muted-foreground hover:text-foreground"><X size={20} /></button>

      {/* Language toggle */}
      <button onClick={cycleLang} className="absolute top-4 left-4 flex items-center gap-1 px-2.5 py-1 rounded-full bg-surface-2 text-xs text-muted-foreground">
        <Languages size={14} />{lang.flag} {lang.label}
      </button>

      {/* Visual feedback */}
      <div className="flex flex-col items-center gap-6">
        {/* Waveform ring */}
        <div className={`relative w-32 h-32 rounded-full flex items-center justify-center transition-all ${isListening ? "bg-destructive/10" : isCorrecting ? "bg-primary/10" : "bg-primary/5"}`}>
          {isListening && (
            <>
              <div className="absolute inset-0 rounded-full border-2 border-destructive/30 animate-ping" />
              <div className="absolute inset-2 rounded-full border border-destructive/20 animate-pulse" />
            </>
          )}
          {isCorrecting ? (
            <Loader2 size={32} className="text-primary animate-spin" />
          ) : (
            <button
              onClick={isListening ? handleStopAndCorrect : startListening}
              className={`w-20 h-20 rounded-full flex items-center justify-center transition-all ${isListening ? "bg-destructive text-destructive-foreground scale-110 shadow-lg" : "bg-primary text-primary-foreground hover:bg-primary/90"}`}
            >
              {isListening ? <MicOff size={28} /> : <Mic size={28} />}
            </button>
          )}
        </div>

        {/* Duration / Status */}
        <div className="text-center">
          {isListening && (
            <div className="flex items-center gap-2 text-destructive text-sm mb-2">
              <span className="w-2 h-2 bg-destructive rounded-full animate-pulse" />
              <span className="font-mono">{fmt(duration)}</span>
            </div>
          )}
          {isCorrecting && <p className="text-muted-foreground text-sm">AI 纠错中...</p>}
          {!isListening && !isCorrecting && !error && !fullText && (
            <p className="text-muted-foreground text-sm">点击开始说话</p>
          )}
          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        {/* Live transcript preview */}
        {fullText && (
          <div className="max-w-[320px] text-center px-4">
            <p className="text-foreground text-sm leading-relaxed">
              {transcript}
              {interimText && <span className="text-muted-foreground/50">{interimText}</span>}
            </p>
          </div>
        )}

        {/* Quick send without correction */}
        {fullText && !isListening && !isCorrecting && (
          <button
            onClick={() => { onTranscript(fullText); onClose(); }}
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 transition"
          >
            <Check size={14} /> 直接发送（跳过纠错）
          </button>
        )}
      </div>
    </div>
  );
}
