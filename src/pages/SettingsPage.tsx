import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sun, Moon, LogOut, BookOpen, Info, ChevronRight, Globe, Download, Bot, User, Search } from "lucide-react";
import { useTheme, ACCENT_OPTIONS, type ThemeMode } from "@/contexts/ThemeContext";
import { useLanguage, LANGUAGES } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import DataExport from "@/components/DataExport";
import GlobalSearch from "@/components/GlobalSearch";

const APP_VERSION = "2.0.0";

const CURRENCY_OPTIONS = [
  { key: "CNY", symbol: "¥", label: "人民币 (CNY)" },
  { key: "USD", symbol: "$", label: "美元 (USD)" },
  { key: "AED", symbol: "د.إ", label: "迪拉姆 (AED)" },
  { key: "EUR", symbol: "€", label: "欧元 (EUR)" },
  { key: "GBP", symbol: "£", label: "英镑 (GBP)" },
  { key: "JPY", symbol: "¥", label: "日元 (JPY)" },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const { mode, accent, setMode, setAccent } = useTheme();
  const { t, lang, setLang } = useLanguage();
  const { user, signOut } = useAuth();
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showSearch, setShowSearch] = useState(false);

  // AI config
  const [aiBaseUrl, setAiBaseUrl] = useState("");
  const [aiModel, setAiModel] = useState("");
  const [aiApiKey, setAiApiKey] = useState("");
  const [aiSaving, setAiSaving] = useState(false);
  const [showAiConfig, setShowAiConfig] = useState(false);

  // Currency
  const [currency, setCurrency] = useState("CNY");
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  // Profile
  const [displayName, setDisplayName] = useState("");
  const [showProfile, setShowProfile] = useState(false);

  // Load profile settings
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("ai_base_url, ai_model, ai_api_key_encrypted, currency, display_name").eq("id", user.id).single()
      .then(({ data }) => {
        if (data) {
          setAiBaseUrl(data.ai_base_url || "");
          setAiModel(data.ai_model || "");
          setAiApiKey(data.ai_api_key_encrypted ? atob(data.ai_api_key_encrypted) : "");
          setCurrency(data.currency || "CNY");
          setDisplayName(data.display_name || "");
        }
      });
  }, [user]);

  const handleSignOut = async () => {
    if (confirm(t("auth.confirm_logout"))) {
      await signOut();
    }
  };

  const saveAiConfig = async () => {
    if (!user) return;
    setAiSaving(true);
    await supabase.from("profiles").update({
      ai_base_url: aiBaseUrl || null,
      ai_model: aiModel || null,
      ai_api_key_encrypted: aiApiKey ? btoa(aiApiKey) : null,
    }).eq("id", user.id);
    setAiSaving(false);
  };

  const clearAiConfig = async () => {
    if (!user) return;
    setAiBaseUrl(""); setAiModel(""); setAiApiKey("");
    await supabase.from("profiles").update({
      ai_base_url: null, ai_model: null, ai_api_key_encrypted: null,
    }).eq("id", user.id);
  };

  const saveCurrency = async (c: string) => {
    setCurrency(c);
    setShowCurrencyPicker(false);
    if (user) await supabase.from("profiles").update({ currency: c }).eq("id", user.id);
  };

  const saveProfile = async () => {
    if (!user) return;
    await supabase.from("profiles").update({ display_name: displayName || null }).eq("id", user.id);
    setShowProfile(false);
  };

  const currentLang = LANGUAGES.find(l => l.key === lang);
  const currentCurrency = CURRENCY_OPTIONS.find(c => c.key === currency);

  if (showSearch) return <GlobalSearch onClose={() => setShowSearch(false)} />;

  return (
    <div className="flex flex-col h-full max-w-[600px] mx-auto">
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground transition"><ArrowLeft size={18} /></button>
        <span className="font-serif-sc text-lg text-foreground">{t("settings.title")}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-4">
        {/* Global Search */}
        <section>
          <button onClick={() => setShowSearch(true)}
            className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 flex items-center gap-3 hover:bg-surface-3 transition">
            <Search size={14} className="text-muted-foreground" />
            <span className="text-xs text-muted-foreground flex-1 text-left">搜索日记、待办...</span>
          </button>
        </section>

        {/* Account */}
        <section>
          <p className="text-[10px] text-muted-foreground mb-2 font-mono-jb">{t("settings.account")}</p>
          <div className="bg-surface-2 border border-border rounded-xl overflow-hidden">
            <button onClick={() => setShowProfile(!showProfile)} className="w-full flex items-center gap-3 px-4 py-3 border-b border-border hover:bg-surface-3 transition">
              <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center text-sm text-gold">
                {displayName?.charAt(0) || user?.email?.charAt(0).toUpperCase() || "U"}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs text-foreground truncate">{displayName || user?.email || t("settings.not_logged_in")}</p>
                <p className="text-[9px] text-muted-foreground">{t("settings.logged_in")}</p>
              </div>
              <ChevronRight size={14} className="text-muted-foreground" />
            </button>
            {showProfile && (
              <div className="p-4 border-b border-border space-y-3">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">昵称</p>
                  <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="输入昵称"
                    className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-gold-border" />
                </div>
                <button onClick={saveProfile} className="text-xs bg-gold text-background px-4 py-1.5 rounded-lg">保存</button>
              </div>
            )}
            <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-surface-3 transition">
              <LogOut size={14} className="text-destructive" />
              <span className="text-xs text-destructive">{t("settings.logout")}</span>
            </button>
          </div>
        </section>

        {/* Language */}
        <section>
          <p className="text-[10px] text-muted-foreground mb-2 font-mono-jb">{t("settings.language")}</p>
          <div className="bg-surface-2 border border-border rounded-xl overflow-hidden relative">
            <button onClick={() => setShowLangPicker(!showLangPicker)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-3 transition">
              <Globe size={14} className="text-muted-foreground" />
              <span className="text-xs text-foreground flex-1">{currentLang?.flag} {currentLang?.label}</span>
              <ChevronRight size={14} className="text-muted-foreground" />
            </button>
            {showLangPicker && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowLangPicker(false)} />
                <div className="absolute left-0 right-0 top-full bg-surface-1 border border-border rounded-xl shadow-lg z-50 max-h-[280px] overflow-y-auto">
                  {LANGUAGES.map(l => (
                    <button key={l.key} onClick={() => { setLang(l.key); setShowLangPicker(false); }}
                      className={`w-full flex items-center gap-2 px-4 py-2.5 text-xs transition hover:bg-surface-2 ${lang === l.key ? "text-primary bg-surface-2" : "text-foreground"}`}>
                      <span className="text-base">{l.flag}</span><span>{l.label}</span>
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
        </section>

        {/* Currency */}
        <section>
          <p className="text-[10px] text-muted-foreground mb-2 font-mono-jb">💰 货币单位</p>
          <div className="bg-surface-2 border border-border rounded-xl overflow-hidden relative">
            <button onClick={() => setShowCurrencyPicker(!showCurrencyPicker)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-3 transition">
              <span className="text-sm">{currentCurrency?.symbol}</span>
              <span className="text-xs text-foreground flex-1">{currentCurrency?.label}</span>
              <ChevronRight size={14} className="text-muted-foreground" />
            </button>
            {showCurrencyPicker && (
              <>
                <div className="fixed inset-0 z-40" onClick={() => setShowCurrencyPicker(false)} />
                <div className="absolute left-0 right-0 top-full bg-surface-1 border border-border rounded-xl shadow-lg z-50">
                  {CURRENCY_OPTIONS.map(c => (
                    <button key={c.key} onClick={() => saveCurrency(c.key)}
                      className={`w-full flex items-center gap-2 px-4 py-2.5 text-xs transition hover:bg-surface-2 ${currency === c.key ? "text-primary bg-surface-2" : "text-foreground"}`}>
                      <span className="text-sm">{c.symbol}</span><span>{c.label}</span>
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
                  <button key={m.key} onClick={() => setMode(m.key)}
                    className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs transition ${mode === m.key ? "bg-gold text-background" : "bg-surface-3 text-muted-foreground hover:text-foreground"}`}>
                    {m.icon} {t(m.labelKey)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground mb-2">{t("settings.accent")}</p>
              <div className="grid grid-cols-3 gap-2">
                {ACCENT_OPTIONS.map(a => (
                  <button key={a.key} onClick={() => setAccent(a.key)}
                    className={`flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs transition ${accent === a.key ? "ring-2 ring-gold bg-surface-3" : "bg-surface-3 hover:bg-background"}`}>
                    <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ background: a.color }} />
                    <span className="text-foreground">{a.label}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* AI Model Config */}
        <section>
          <p className="text-[10px] text-muted-foreground mb-2 font-mono-jb">🤖 AI 模型配置</p>
          <div className="bg-surface-2 border border-border rounded-xl overflow-hidden">
            <button onClick={() => setShowAiConfig(!showAiConfig)} className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-3 transition">
              <Bot size={14} className="text-muted-foreground" />
              <span className="text-xs text-foreground flex-1">{aiBaseUrl ? "已配置自定义模型" : "使用默认模型"}</span>
              <ChevronRight size={14} className="text-muted-foreground" />
            </button>
            {showAiConfig && (
              <div className="p-4 border-t border-border space-y-3">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">Base URL</p>
                  <input value={aiBaseUrl} onChange={e => setAiBaseUrl(e.target.value)}
                    placeholder="https://api.openclaw.ai/v1"
                    className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-gold-border" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">模型名称</p>
                  <input value={aiModel} onChange={e => setAiModel(e.target.value)}
                    placeholder="gpt-4o"
                    className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-gold-border" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">API Key</p>
                  <input type="password" value={aiApiKey} onChange={e => setAiApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full bg-surface-3 border border-border rounded-lg px-3 py-2 text-xs text-foreground focus:outline-none focus:border-gold-border" />
                </div>
                <div className="flex gap-2">
                  <button onClick={saveAiConfig} disabled={aiSaving}
                    className="flex-1 bg-gold text-background text-xs py-2 rounded-lg disabled:opacity-50">
                    {aiSaving ? "保存中..." : "保存配置"}
                  </button>
                  <button onClick={clearAiConfig} className="text-xs text-muted-foreground hover:text-destructive px-3 py-2 rounded-lg bg-surface-3">
                    清除
                  </button>
                </div>
                <p className="text-[9px] text-muted-foreground/60">
                  支持 OpenAI 兼容格式的 API（OpenClaw、Ollama 等）。清除后使用默认模型。
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Data Export */}
        <section>
          <p className="text-[10px] text-muted-foreground mb-2 font-mono-jb">📦 数据管理</p>
          <div className="bg-surface-2 border border-border rounded-xl overflow-hidden">
            <DataExport />
          </div>
        </section>

        {/* Navigation links */}
        <section>
          <p className="text-[10px] text-muted-foreground mb-2 font-mono-jb">{t("settings.more")}</p>
          <div className="bg-surface-2 border border-border rounded-xl overflow-hidden">
            <button onClick={() => navigate("/guide")} className="w-full flex items-center gap-3 px-4 py-3 border-b border-border hover:bg-surface-3 transition text-left">
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

        <div className="text-center pt-4 pb-8">
          <p className="text-xs text-foreground font-serif-sc mb-1">{t("app.name")}</p>
          <p className="text-[9px] text-muted-foreground">{t("settings.app_desc")}</p>
        </div>
      </div>
    </div>
  );
}
