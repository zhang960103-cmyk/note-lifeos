import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sun, Moon, LogOut, BookOpen, Info, ChevronRight, Globe } from "lucide-react";
import { useTheme, ACCENT_OPTIONS, type ThemeMode } from "@/contexts/ThemeContext";
import { useLanguage, LANGUAGES } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { useState } from "react";

const APP_VERSION = "1.4.0";

export default function SettingsPage() {
  const navigate = useNavigate();
  const { mode, accent, setMode, setAccent } = useTheme();
  const { t, lang, setLang } = useLanguage();
  const { user, signOut } = useAuth();
  const [showLangPicker, setShowLangPicker] = useState(false);

  const handleSignOut = async () => {
    if (confirm(t("auth.confirm_logout"))) {
      await signOut();
    }
  };

  const currentLang = LANGUAGES.find(l => l.key === lang);

  return (
    <div className="flex flex-col h-full max-w-[600px] mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground transition">
          <ArrowLeft size={18} />
        </button>
        <span className="font-serif-sc text-lg text-foreground">{t("settings.title")}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4">
        {/* Account */}
        <section>
          <p className="text-[10px] text-muted-foreground mb-2 font-mono-jb">{t("settings.account")}</p>
          <div className="bg-surface-2 border border-border rounded-xl overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
              <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center text-sm text-gold">
                {user?.email?.charAt(0).toUpperCase() || "U"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground truncate">{user?.email || t("settings.not_logged_in")}</p>
                <p className="text-[9px] text-muted-foreground">{t("settings.logged_in")}</p>
              </div>
            </div>
            <button
              onClick={handleSignOut}
              className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-3 transition"
            >
              <LogOut size={14} className="text-destructive" />
              <span className="text-xs text-destructive">{t("settings.logout")}</span>
            </button>
          </div>
        </section>

        {/* Language */}
        <section>
          <p className="text-[10px] text-muted-foreground mb-2 font-mono-jb">{t("settings.language")}</p>
          <div className="bg-surface-2 border border-border rounded-xl overflow-hidden relative">
            <button
              onClick={() => setShowLangPicker(!showLangPicker)}
              className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-3 transition"
            >
              <Globe size={14} className="text-muted-foreground" />
              <span className="text-xs text-foreground flex-1">{currentLang?.flag} {currentLang?.label}</span>
              <ChevronRight size={14} className="text-muted-foreground" />
            </button>
            {showLangPicker && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowLangPicker(false)} />
                <div className="absolute left-0 right-0 top-full bg-surface-1 border border-border rounded-xl shadow-lg z-50 max-h-[280px] overflow-y-auto">
                  {LANGUAGES.map(l => (
                    <button
                      key={l.key}
                      onClick={() => { setLang(l.key); setShowLangPicker(false); }}
                      className={`w-full flex items-center gap-2 px-4 py-2.5 text-xs transition hover:bg-surface-2 ${
                        lang === l.key ? "text-primary bg-surface-2" : "text-foreground"
                      }`}
                    >
                      <span className="text-base">{l.flag}</span>
                      <span>{l.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        {/* Theme */}
        <section>
          <p className="text-[10px] text-muted-foreground mb-2 font-mono-jb">{t("settings.appearance")}</p>
          <div className="bg-surface-2 border border-border rounded-xl p-4 space-y-4">
            <div>
              <p className="text-[10px] text-muted-foreground mb-2">{t("settings.mode")}</p>
              <div className="flex gap-2">
                {([
                  { key: "dark" as ThemeMode, icon: <Moon size={14} />, labelKey: "settings.mode.dark" },
                  { key: "light" as ThemeMode, icon: <Sun size={14} />, labelKey: "settings.mode.light" },
                ]).map(m => (
                  <button
                    key={m.key}
                    onClick={() => setMode(m.key)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs transition ${
                      mode === m.key ? "bg-gold text-background" : "bg-surface-3 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {m.icon} {t(m.labelKey)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <p className="text-[10px] text-muted-foreground mb-2">{t("settings.accent")}</p>
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
          <p className="text-[10px] text-muted-foreground mb-2 font-mono-jb">{t("settings.more")}</p>
          <div className="bg-surface-2 border border-border rounded-xl overflow-hidden">
            <button
              onClick={() => navigate("/guide")}
              className="w-full flex items-center gap-3 px-4 py-3 border-b border-border hover:bg-surface-3 transition text-left"
            >
              <BookOpen size={14} className="text-muted-foreground" />
              <span className="text-xs text-foreground flex-1">{t("settings.guide")}</span>
              <ChevronRight size={14} className="text-muted-foreground" />
            </button>
            <div className="flex items-center gap-3 px-4 py-3">
              <Info size={14} className="text-muted-foreground" />
              <span className="text-xs text-foreground flex-1">{t("settings.version")}</span>
              <span className="text-[10px] text-muted-foreground font-mono-jb">v{APP_VERSION}</span>
            </div>
          </div>
        </section>

        {/* App info */}
        <div className="text-center pt-4 pb-8">
          <p className="text-xs text-foreground font-serif-sc mb-1">{t("app.name")}</p>
          <p className="text-[9px] text-muted-foreground">{t("settings.app_desc")}</p>
        </div>
      </div>
    </div>
  );
}
