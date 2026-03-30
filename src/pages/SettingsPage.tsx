import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sun, Moon, LogOut, BookOpen, Info, ChevronRight, Globe, Download, Bot, Search, Check } from "lucide-react";
import { useTheme, ACCENT_OPTIONS, type ThemeMode } from "@/contexts/ThemeContext";
import { useLanguage, LANGUAGES } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import DataExport from "@/components/DataExport";
import GlobalSearch from "@/components/GlobalSearch";

const APP_VERSION = "2.1.0";

const CURRENCY_OPTIONS = [
  { key: "CNY", symbol: "¥", label: "人民币 (CNY)" },
  { key: "USD", symbol: "$", label: "美元 (USD)" },
  { key: "AED", symbol: "د.إ", label: "迪拉姆 (AED)" },
  { key: "EUR", symbol: "€", label: "欧元 (EUR)" },
  { key: "GBP", symbol: "£", label: "英镑 (GBP)" },
  { key: "JPY", symbol: "¥", label: "日元 (JPY)" },
  { key: "KRW", symbol: "₩", label: "韩元 (KRW)" },
  { key: "RUB", symbol: "₽", label: "卢布 (RUB)" },
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
  const [profileSaved, setProfileSaved] = useState(false);

  // Load profile
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

  const saveCurrency = async (c: string) => {
    setCurrency(c);
    setShowCurrencyPicker(false);
    if (user) await supabase.from("profiles").update({ currency: c }).eq("id", user.id);
  };

  const saveProfile = async () => {
    if (!user) return;
    await supabase.from("profiles").update({ display_name: displayName || null }).eq("id", user.id);
    setShowProfile(false);
    setProfileSaved(true);
    setTimeout(() => setProfileSaved(false), 2000);
  };

  const currentLang = LANGUAGES.find(l => l.key === lang);
  const currentCurrency = CURRENCY_OPTIONS.find(c => c.key === currency);

  if (showSearch) return <GlobalSearch onClose={() => setShowSearch(false)} />;

  return (
    <div className="flex flex-col h-full max-w-[600px] mx-auto">
      <div className="flex items-center gap-3 px-4 py-3">
        <button onClick={() => navigate(-1)} className="text-muted-foreground hover:text-foreground transition"><ArrowLeft size={18} /></button>
        <span className="font-serif-sc text-base text-foreground">{t("settings.title")}</span>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-24 space-y-3">
        {/* Search */}
        <button onClick={() => setShowSearch(true)}
          className="w-full bg-muted border border-border rounded-xl px-4 py-2.5 flex items-center gap-3 hover:bg-accent transition">
          <Search size={14} className="text-muted-foreground" />
          <span className="text-xs text-muted-foreground flex-1 text-left">{t("settings.search_placeholder") || "搜索日记、待办..."}</span>
        </button>

        {/* Account */}
        <section>
          <p className="text-[10px] text-muted-foreground mb-1.5 font-mono-jb">{t("settings.account")}</p>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <button onClick={() => setShowProfile(!showProfile)} className="w-full flex items-center gap-3 px-4 py-2.5 border-b border-border hover:bg-accent transition">
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-sm text-primary">
                {displayName?.charAt(0) || user?.email?.charAt(0).toUpperCase() || "U"}
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs text-foreground truncate">{displayName || user?.email || t("settings.not_logged_in")}</p>
                <p className="text-[9px] text-muted-foreground">{t("settings.logged_in")}</p>
              </div>
              {profileSaved && <Check size={14} className="text-los-green" />}
              <ChevronRight size={14} className="text-muted-foreground" />
            </button>
            {showProfile && (
              <div className="p-3 border-b border-border space-y-2">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-1">{t("settings.nickname") || "昵称"}</p>
                  <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="输入昵称"
                    className="w-full bg-muted border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary" />
                </div>
                <button onClick={saveProfile} className="text-xs bg-primary text-primary-foreground px-4 py-1.5 rounded-lg">{t("settings.save") || "保存"}</button>
              </div>
            )}
            <button onClick={handleSignOut} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-accent transition">
              <LogOut size={14} className="text-destructive" />
              <span className="text-xs text-destructive">{t("settings.logout")}</span>
            </button>
          </div>
        </section>

        {/* Language & Currency - combined row */}
        <section>
          <p className="text-[10px] text-muted-foreground mb-1.5 font-mono-jb">{t("settings.regional") || "地区与语言"}</p>
          <div className="bg-card border border-border rounded-xl">
            {/* Language */}
            <div className="relative">
              <button onClick={() => { setShowLangPicker(!showLangPicker); setShowCurrencyPicker(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 border-b border-border hover:bg-accent transition rounded-t-xl">
                <Globe size={14} className="text-muted-foreground" />
                <span className="text-xs text-foreground flex-1">{currentLang?.flag} {currentLang?.label}</span>
                <ChevronRight size={14} className="text-muted-foreground" />
              </button>
              {showLangPicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowLangPicker(false)} />
                  <div className="fixed left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-[280px] bg-popover border border-border rounded-xl shadow-lg z-50 max-h-[320px] overflow-y-auto">
                    {LANGUAGES.map(l => (
                      <button key={l.key} onClick={() => { setLang(l.key); setShowLangPicker(false); }}
                        className={`w-full flex items-center gap-2 px-4 py-2.5 text-xs transition hover:bg-accent ${lang === l.key ? "text-primary bg-accent" : "text-foreground"}`}>
                        <span className="text-base">{l.flag}</span><span>{l.label}</span>
                        {lang === l.key && <Check size={12} className="ml-auto text-primary" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
            {/* Currency */}
            <div className="relative">
              <button onClick={() => { setShowCurrencyPicker(!showCurrencyPicker); setShowLangPicker(false); }}
                className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent transition rounded-b-xl">
                <span className="text-sm w-[14px] text-center">{currentCurrency?.symbol}</span>
                <span className="text-xs text-foreground flex-1">{currentCurrency?.label}</span>
                <ChevronRight size={14} className="text-muted-foreground" />
              </button>
              {showCurrencyPicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowCurrencyPicker(false)} />
                  <div className="fixed left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-[280px] bg-popover border border-border rounded-xl shadow-lg z-50 max-h-[320px] overflow-y-auto">
                    {CURRENCY_OPTIONS.map(c => (
                      <button key={c.key} onClick={() => saveCurrency(c.key)}
                        className={`w-full flex items-center gap-2 px-4 py-2.5 text-xs transition hover:bg-accent ${currency === c.key ? "text-primary bg-accent" : "text-foreground"}`}>
                        <span className="text-sm w-5 text-center">{c.symbol}</span><span>{c.label}</span>
                        {currency === c.key && <Check size={12} className="ml-auto text-primary" />}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        </section>

        {/* Theme */}
        <section>
          <p className="text-[10px] text-muted-foreground mb-1.5 font-mono-jb">{t("settings.appearance")}</p>
          <div className="bg-card border border-border rounded-xl p-3 space-y-3">
            <div className="flex gap-2">
              {([
                { key: "dark" as ThemeMode, icon: <Moon size={13} />, labelKey: "settings.mode.dark" },
                { key: "light" as ThemeMode, icon: <Sun size={13} />, labelKey: "settings.mode.light" },
              ]).map(m => (
                <button key={m.key} onClick={() => setMode(m.key)}
                  className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-xl text-xs transition ${mode === m.key ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                  {m.icon} {t(m.labelKey)}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {ACCENT_OPTIONS.map(a => (
                <button key={a.key} onClick={() => setAccent(a.key)}
                  className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs transition ${accent === a.key ? "ring-2 ring-primary bg-accent" : "bg-muted hover:bg-accent"}`}>
                  <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: a.color }} />
                  <span className="text-foreground">{a.label}</span>
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* AI Config */}
        <section>
          <p className="text-[10px] text-muted-foreground mb-1.5 font-mono-jb">🤖 AI 模型</p>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <button onClick={() => setShowAiConfig(!showAiConfig)} className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-accent transition">
              <Bot size={14} className="text-muted-foreground" />
              <span className="text-xs text-foreground flex-1">{aiBaseUrl ? "自定义模型" : "默认模型"}</span>
              <ChevronRight size={14} className="text-muted-foreground" />
            </button>
            {showAiConfig && (
              <div className="p-3 border-t border-border space-y-2">
                {[
                  { label: "Base URL", value: aiBaseUrl, set: setAiBaseUrl, placeholder: "https://api.openclaw.ai/v1" },
                  { label: "模型", value: aiModel, set: setAiModel, placeholder: "gpt-4o" },
                ].map(f => (
                  <div key={f.label}>
                    <p className="text-[9px] text-muted-foreground mb-0.5">{f.label}</p>
                    <input value={f.value} onChange={e => f.set(e.target.value)} placeholder={f.placeholder}
                      className="w-full bg-muted border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary" />
                  </div>
                ))}
                <div>
                  <p className="text-[9px] text-muted-foreground mb-0.5">API Key</p>
                  <input type="password" value={aiApiKey} onChange={e => setAiApiKey(e.target.value)} placeholder="sk-..."
                    className="w-full bg-muted border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary" />
                </div>
                <button onClick={saveAiConfig} disabled={aiSaving}
                  className="w-full bg-primary text-primary-foreground text-xs py-2 rounded-lg disabled:opacity-50">
                  {aiSaving ? "保存中..." : "保存"}
                </button>
                <p className="text-[8px] text-muted-foreground/60">支持 OpenAI 兼容格式 API（OpenClaw、Ollama 等）</p>
              </div>
            )}
          </div>
        </section>

        {/* Data */}
        <section>
          <p className="text-[10px] text-muted-foreground mb-1.5 font-mono-jb">📦 数据管理</p>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <DataExport />
          </div>
        </section>

        {/* More */}
        <section>
          <p className="text-[10px] text-muted-foreground mb-1.5 font-mono-jb">{t("settings.more")}</p>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <button onClick={() => navigate("/guide")} className="w-full flex items-center gap-3 px-4 py-2.5 border-b border-border hover:bg-accent transition text-left">
              <BookOpen size={14} className="text-muted-foreground" />
              <span className="text-xs text-foreground flex-1">{t("settings.guide")}</span>
              <ChevronRight size={14} className="text-muted-foreground" />
            </button>
            <div className="flex items-center gap-3 px-4 py-2.5">
              <Info size={14} className="text-muted-foreground" />
              <span className="text-xs text-foreground flex-1">{t("settings.version")}</span>
              <span className="text-[10px] text-muted-foreground font-mono-jb">v{APP_VERSION}</span>
            </div>
          </div>
        </section>

        <div className="text-center pt-3 pb-6">
          <p className="text-xs text-foreground font-serif-sc mb-0.5">{t("app.name")}</p>
          <p className="text-[9px] text-muted-foreground">{t("settings.app_desc")}</p>
        </div>
      </div>
    </div>
  );
}
