import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sun, Moon, LogOut, BookOpen, Info, ChevronRight, Palette, Shield, Bell } from "lucide-react";
import { useTheme, ACCENT_OPTIONS, type ThemeMode } from "@/contexts/ThemeContext";
import { useAuth } from "@/hooks/useAuth";

const APP_VERSION = "1.4.0";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { mode, accent, setMode, setAccent } = useTheme();
  const { user, signOut } = useAuth();

  const handleSignOut = async () => {
    if (confirm("确定要退出登录吗？")) {
      await signOut();
    }
  };

  return (
    <div className="flex flex-col h-full max-w-[600px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground transition">
          <ArrowLeft size={18} />
        </button>
        <span className="font-serif-sc text-lg text-foreground">设置</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4">
        {/* Account */}
        <section>
          <p className="text-[10px] text-muted-foreground mb-2 font-mono-jb">账号</p>
          <div className="bg-surface-2 border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center text-sm text-gold">
                {user?.email?.charAt(0).toUpperCase() || "U"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground truncate">{user?.email || "未登录"}</p>
                <p className="text-[9px] text-muted-foreground">已登录</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-3 transition"
            >
              <LogOut size={14} className="text-destructive" />
              <span className="text-xs text-destructive">退出登录</span>
            </button>
          </div>
        </section>

        {/* Theme */}
        <section>
          <p className="text-[10px] text-muted-foreground mb-2 font-mono-jb">外观</p>
          <div className="bg-surface-2 border border-border rounded-xl p-4 space-y-4">
            {/* Mode toggle */}
            <div>
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
                      mode === m.key ? "bg-gold text-background" : "bg-surface-3 text-muted-foreground hover:text-foreground"
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
                      accent === a.key ? "ring-2 ring-gold bg-surface-3" : "bg-surface-3 hover:bg-background"
                    }`}
                  >
                    <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: a.color }} />
                    <span className="text-foreground">{a.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* Navigation links */}
        <section>
          <p className="text-[10px] text-muted-foreground mb-2 font-mono-jb">更多</p>
          <div className="bg-surface-2 border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => navigate("/guide")}
              className="w-full flex items-center gap-3 px-4 py-3 border-b border-border hover:bg-surface-3 transition text-left"
            >
              <BookOpen size={14} className="text-muted-foreground" />
              <span className="text-xs text-foreground flex-1">使用指南</span>
              <ChevronRight size={14} className="text-muted-foreground" />
            </button>
            <div className="flex items-center gap-3 px-4 py-3">
              <Info size={14} className="text-muted-foreground" />
              <span className="text-xs text-foreground flex-1">版本</span>
              <span className="text-[10px] text-muted-foreground font-mono-jb">v{APP_VERSION}</span>
            </div>
          </div>
        </section>

        {/* App info */}
        <div className="text-center pt-4 pb-8">
          <p className="text-xs text-foreground font-serif-sc mb-1">Life OS · 罗盘</p>
          <p className="text-[9px] text-muted-foreground">你的 AI 人生操作系统</p>
        </div>
      </div>
    </div>
  );
}
