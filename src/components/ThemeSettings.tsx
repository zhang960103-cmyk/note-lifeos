import { useNavigate } from "react-router-dom";
import { Sun, Moon, X } from "lucide-react";
import { useTheme, ACCENT_OPTIONS, type ThemeMode } from "@/contexts/ThemeContext";

export default function ThemeSettings({ onClose }: { onClose: () => void }) {
  const { mode, accent, setMode, setAccent } = useTheme();
  const navigate = useNavigate();

  return (
    <div className="absolute inset-x-0 bottom-0 bg-surface-1 border-t border-border rounded-t-2xl p-5 z-50 animate-in slide-in-from-bottom">
      <div className="flex justify-between items-center mb-5">
        <span className="text-sm font-serif-sc text-foreground">主题设置</span>
        <button onClick={onClose}><X size={16} className="text-muted-foreground" /></button>
      </div>

      {/* Mode toggle */}
      <div className="mb-5">
        <p className="text-[10px] text-muted-foreground mb-2">显示模式</p>
        <div className="flex gap-2">
          {([
            { key: "dark" as ThemeMode, icon: <Moon size={14} />, label: "深色" },
            { key: "light" as ThemeMode, icon: <Sun size={14} />, label: "浅色" },
          ]).map(m => (
            <button
              key={m.key}
              onClick={() => setMode(m.key)}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs transition ${
                mode === m.key ? "bg-gold text-background" : "bg-surface-2 text-muted-foreground hover:text-foreground"
              }`}
            >
              {m.icon} {m.label}
            </button>
          ))}
        </div>
      </div>

      {/* Accent color */}
      <div>
        <p className="text-[10px] text-muted-foreground mb-2">主题色</p>
        <div className="grid grid-cols-3 gap-2">
          {ACCENT_OPTIONS.map(a => (
            <button
              key={a.key}
              onClick={() => setAccent(a.key)}
              className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs transition ${
                accent === a.key ? "ring-2 ring-gold bg-surface-2" : "bg-surface-2 hover:bg-surface-3"
              }`}
            >
              <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: a.color }} />
              <span className="text-foreground">{a.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
