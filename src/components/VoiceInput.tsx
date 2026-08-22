import { useState, useCallback, useRef, useEffect } from "react";
import { Mic, MicOff, X, Check, RefreshCw, AlertTriangle } from "lucide-react";

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  onClose: () => void;
  accessToken?: string;
}

type VoiceState = "idle" | "listening" | "preview";

export default function VoiceInput({ onTranscript, onClose }: VoiceInputProps) {
  const [state, setState] = useState<VoiceState>("idle"); // 不自动开始
  const [rawText, setRawText] = useState("");
  const [editableText, setEditableText] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  const startListening = useCallback(() => {
    const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SR) {
      setErrorMsg("当前浏览器不支持语音识别，换个浏览器或直接打字吧");
      return;
    }
    setErrorMsg(null);
    const recog = new SR();
    recog.lang = "zh-CN";
    recog.continuous = false;
    recog.interimResults = false;
    recog.maxAlternatives = 1;

    recog.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      setRawText(text);
      setEditableText(text);
      // 直接进预览，跳过AI纠错（慢且不必要）
      setState("preview");
    };
    recog.onerror = (e: any) => {
      const errType = e?.error;
      if (errType === "not-allowed" || errType === "service-not-allowed") {
        setErrorMsg("没有麦克风权限，请在系统/浏览器设置里允许访问麦克风后重试");
      } else if (errType === "no-speech") {
        setErrorMsg("没有识别到语音，请靠近麦克风再说一次");
      } else if (errType === "network") {
        setErrorMsg("网络异常，语音识别服务暂时不可用");
      } else if (errType === "audio-capture") {
        setErrorMsg("找不到可用的麦克风设备");
      } else if (errType === "aborted") {
        // 用户主动点击停止触发的中止，不算错误，不提示
      } else {
        setErrorMsg("语音识别出错，请重试");
      }
      // 用函数式更新读取"当前"状态，而不是闭包创建时捕获的 state——
      // 否则这里的 state 永远是 startListening 被调用那一刻的旧值("idle")，
      // 判断永远为假，识别报错后界面会卡在"录音中…"出不来。
      setState(s => (s === "listening" ? "idle" : s));
    };
    recog.onend = () => {
      // 同样问题：必须用函数式更新读最新状态，不能用闭包里的 state。
      // 只有还处于"listening"时才归位到 idle，避免覆盖 onresult 已经设置的 "preview"。
      setState(s => (s === "listening" ? "idle" : s));
    };

    try {
      recog.start();
      recognitionRef.current = recog;
      setState("listening");
    } catch (err) {
      console.error("[VoiceInput] start() failed:", err);
      setErrorMsg("启动语音识别失败，请重试");
      setState("idle");
    }
  }, []);

  const stopListening = () => {
    recognitionRef.current?.stop();
  };

  const handleConfirm = () => {
    if (editableText.trim()) {
      onTranscript(editableText.trim());
      onClose();
    }
  };

  const handleRetry = () => {
    setRawText(""); setEditableText(""); setState("idle"); setErrorMsg(null);
  };

  // 组件卸载（比如识别过程中用户直接关掉弹窗）时停止识别，
  // 避免残留的识别实例在卸载后继续触发 onresult/onerror/onend 里的 setState。
  useEffect(() => {
    return () => {
      try { recognitionRef.current?.stop(); } catch {}
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-end justify-center" onClick={onClose}>
      <div className="w-full max-w-[600px] bg-surface-1 rounded-t-2xl p-6 pb-10"
        onClick={e => e.stopPropagation()}>

        {/* 待机 / 录音中 */}
        {(state === "idle" || state === "listening") && (
          <div className="text-center">
            <button
              onClick={state === "listening" ? stopListening : startListening}
              className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 transition-all shadow-lg
                ${state === "listening" ? "bg-destructive scale-110 shadow-destructive/30" : "bg-primary shadow-primary/30"}`}>
              {state === "listening"
                ? <MicOff size={28} className="text-white" />
                : <Mic size={28} className="text-white" />}
            </button>

            {/* 波形 */}
            <div className="flex items-end justify-center gap-1.5 h-10 mb-4">
              {[0.5, 0.8, 1, 0.8, 0.5].map((h, i) => (
                <div key={i}
                  className={`w-1.5 rounded-full transition-all ${state === "listening" ? "wave-bar bg-destructive" : "bg-muted"}`}
                  style={{ height: `${h * 36}px` }} />
              ))}
            </div>

            <p className="text-sm font-medium text-foreground mb-1">
              {state === "listening" ? "录音中…说完点击停止" : "点击麦克风开始说话"}
            </p>
            <p className="text-caption text-muted-foreground">
              {state === "listening" ? "识别完成后可以编辑" : "不需要特定格式，随便说"}
            </p>

            {errorMsg && (
              <div className="mt-3 flex items-center justify-center gap-1.5 text-caption text-destructive bg-destructive/10 rounded-lg px-3 py-2 mx-auto max-w-[280px]">
                <AlertTriangle size={12} className="flex-shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            <button onClick={onClose} className="mt-5 text-muted-foreground text-caption flex items-center gap-1 mx-auto">
              <X size={12} /> 取消
            </button>
          </div>
        )}

        {/* 预览确认 */}
        {state === "preview" && (
          <div>
            <p className="text-caption text-muted-foreground mb-2">识别结果（可以直接编辑）：</p>
            <textarea
              value={editableText}
              onChange={e => setEditableText(e.target.value)}
              className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-sm text-foreground focus:outline-none focus:border-primary resize-none leading-relaxed"
              rows={3}
              autoFocus
            />
            <div className="flex gap-2 mt-4">
              <button onClick={handleRetry}
                className="flex items-center gap-1.5 px-4 py-2.5 bg-muted text-muted-foreground rounded-xl text-sm">
                <RefreshCw size={14} /> 重新录
              </button>
              <button onClick={handleConfirm} disabled={!editableText.trim()}
                className="flex-1 flex items-center justify-center gap-1.5 bg-primary text-primary-foreground py-2.5 rounded-xl text-sm font-medium disabled:opacity-30">
                <Check size={14} /> 确认发送
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
