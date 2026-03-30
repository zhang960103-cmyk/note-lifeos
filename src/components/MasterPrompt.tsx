import { useState } from "react";
import { getSystemPrompt, getSystemPromptVersion } from "@/lib/systemPrompts";

const modes = [
  { key: "default", label: "生命教练模式", icon: "🧭" },
  { key: "extract", label: "信息提取模式", icon: "📋" },
  { key: "wheel-eval", label: "生命之轮评估", icon: "🎡" },
  { key: "time-analysis", label: "时间分析", icon: "⏱️" },
];

const MasterPrompt = () => {
  const [expandedMode, setExpandedMode] = useState<string | null>(null);
  const version = getSystemPromptVersion();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-serif-sc text-foreground">
          AI 系统提示词配置
        </h3>
        <span className="text-xs bg-gold/20 text-gold px-2 py-1 rounded-full">
          v{version}
        </span>
      </div>

      <div className="space-y-2">
        {modes.map(mode => (
          <div
            key={mode.key}
            className="border border-border rounded-lg overflow-hidden bg-surface-2"
          >
            <button
              onClick={() => setExpandedMode(expandedMode === mode.key ? null : mode.key)}
              className="w-full px-4 py-3 flex items-center justify-between hover:bg-surface-3 transition"
            >
              <span className="flex items-center gap-2 text-sm text-foreground">
                <span className="text-lg">{mode.icon}</span>
                <span className="font-medium">{mode.label}</span>
              </span>
              <span className={`text-xs transition-transform ${expandedMode === mode.key ? "rotate-180" : ""}`}>
                ▼
              </span>
            </button>

            {expandedMode === mode.key && (
              <div className="border-t border-border px-4 py-3 bg-background/50">
                <pre className="text-[11px] text-muted-foreground whitespace-pre-wrap break-words max-h-[300px] overflow-y-auto font-mono">
                  {getSystemPrompt(mode.key)}
                </pre>
                <p className="text-[10px] text-muted-foreground/60 mt-3">
                  ℹ️ 这个提示词会被发送到 AI 引擎以确保一致的回复风格
                </p>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="border border-border/50 rounded-lg p-3 bg-surface-2/50">
        <p className="text-xs text-muted-foreground">
          <strong>💡 提示:</strong> 系统提示词版本应与后端一致。如果 AI
          回复风格异常，请检查版本号是否匹配。
        </p>
      </div>
    </div>
  );
};

export default MasterPrompt;

export function masterText() {
  return getSystemPrompt("default");
}
