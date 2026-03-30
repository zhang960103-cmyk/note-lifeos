import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sun, Moon, LogOut, BookOpen, Info, ChevronRight, Globe, Download, Bot, Search, Check, Plus, Trash2, ChevronDown, ChevronUp, Sparkles, Zap, Shield, Pencil, FlaskConical, RotateCcw, ArrowUpCircle, Archive } from "lucide-react";
import { useTheme, ACCENT_OPTIONS, type ThemeMode } from "@/contexts/ThemeContext";
import { useLanguage, LANGUAGES } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import DataExport from "@/components/DataExport";
import GlobalSearch from "@/components/GlobalSearch";
import { useModelProfiles, type ModelProfile } from "@/hooks/useModelProfiles";

const APP_VERSION = "2.2.0";

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

const USAGE_TAG_LABELS: Record<string, { icon: string; label: string }> = {
  chat: { icon: "💬", label: "日记/对话" },
  cheap: { icon: "⚡", label: "效率/整理" },
  private: { icon: "🔒", label: "本地/私有" },
  extract: { icon: "🔍", label: "数据提取" },
};

export default function SettingsPage() {
  const navigate = useNavigate();
  const { mode, accent, setMode, setAccent } = useTheme();
  const { t, lang, setLang } = useLanguage();
  const { user, signOut } = useAuth();
  const [showLangPicker, setShowLangPicker] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [showCurrencyPicker, setShowCurrencyPicker] = useState(false);

  // Profile
  const [displayName, setDisplayName] = useState("");
  const [showProfile, setShowProfile] = useState(false);
  const [profileSaved, setProfileSaved] = useState(false);
  const [currency, setCurrency] = useState("CNY");

  // AI Models
  const { profiles, loading: modelsLoading, setDefault, updateProfile, addProfile, deleteProfile } = useModelProfiles();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProfile, setNewProfile] = useState({ name: "", description: "", base_url: "", model: "", api_key_encrypted: "", usage_tag: "chat", is_default: false });

  // Load profile
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("currency, display_name").eq("id", user.id).single()
      .then(({ data }) => {
        if (data) {
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

  const handleAddProfile = async () => {
    await addProfile(newProfile);
    setNewProfile({ name: "", description: "", base_url: "", model: "", api_key_encrypted: "", usage_tag: "chat", is_default: false });
    setShowAddForm(false);
  };

  const currentLang = LANGUAGES.find(l => l.key === lang);
  const currentCurrency = CURRENCY_OPTIONS.find(c => c.key === currency);
  const defaultProfile = profiles.find(p => p.is_default);

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
                  <p className="text-[10px] text-muted-foreground mb-0.5">{t("settings.nickname") || "昵称"}</p>
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

        {/* Language & Currency */}
        <section>
          <p className="text-[10px] text-muted-foreground mb-1.5 font-mono-jb">{t("settings.regional") || "地区与语言"}</p>
          <div className="bg-card border border-border rounded-xl">
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

        {/* AI Model Profiles */}
        <section>
          <p className="text-[10px] text-muted-foreground mb-1.5 font-mono-jb">🤖 AI 模型</p>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {/* Simple card selection */}
            {modelsLoading ? (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">加载中...</div>
            ) : (
              <div className="p-3 space-y-2">
                {profiles.map(p => {
                  const tagInfo = USAGE_TAG_LABELS[p.usage_tag] || { icon: "🔧", label: p.usage_tag };
                  const isActive = p.is_default;
                  return (
                    <button key={p.id} onClick={() => setDefault(p.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        isActive
                          ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                          : "border-border hover:border-muted-foreground/30 hover:bg-accent"
                      }`}>
                      <div className="flex items-start gap-2.5">
                        <span className="text-lg mt-0.5">{tagInfo.icon}</span>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium text-foreground">{p.name}</span>
                            {isActive && (
                              <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">默认</span>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{p.description}</p>
                          {p.base_url && (
                            <p className="text-[9px] text-muted-foreground/60 mt-0.5 font-mono-jb truncate">{p.model} · 自定义</p>
                          )}
                          {!p.base_url && (
                            <p className="text-[9px] text-muted-foreground/60 mt-0.5 font-mono-jb truncate">{p.model}</p>
                          )}
                        </div>
                        <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-1 ${
                          isActive ? "border-primary bg-primary" : "border-muted-foreground/30"
                        }`}>
                          {isActive && <Check size={10} className="text-primary-foreground" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Advanced toggle */}
            <button onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2 border-t border-border text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent transition">
              {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              高级设置
            </button>

            {/* Advanced panel */}
            {showAdvanced && (
              <div className="border-t border-border p-3 space-y-3">
                {profiles.map(p => (
                  <div key={p.id} className="bg-muted/50 border border-border rounded-xl p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">{p.name}</span>
                      <div className="flex items-center gap-1">
                        <button onClick={() => setEditingId(editingId === p.id ? null : p.id)}
                          className="p-1 hover:bg-accent rounded-lg transition text-muted-foreground hover:text-foreground">
                          <Pencil size={12} />
                        </button>
                        {!p.is_system && (
                          <button onClick={() => deleteProfile(p.id)}
                            className="p-1 hover:bg-destructive/10 rounded-lg transition text-muted-foreground hover:text-destructive">
                            <Trash2 size={12} />
                          </button>
                        )}
                      </div>
                    </div>
                    {editingId === p.id && (
                      <div className="space-y-1.5">
                        <FieldInput label="名称" value={p.name}
                          onChange={v => updateProfile(p.id, { name: v })} />
                        <FieldInput label="说明" value={p.description}
                          onChange={v => updateProfile(p.id, { description: v })} />
                        <FieldInput label="Base URL" value={p.base_url} placeholder="留空使用默认网关"
                          onChange={v => updateProfile(p.id, { base_url: v })} />
                        <FieldInput label="模型" value={p.model} placeholder="google/gemini-3-flash-preview"
                          onChange={v => updateProfile(p.id, { model: v })} />
                        <FieldInput label="API Key" value={p.api_key_encrypted ? "••••••" : ""} placeholder="留空使用默认密钥" type="password"
                          onChange={v => { if (v !== "••••••") updateProfile(p.id, { api_key_encrypted: v ? btoa(v) : "" }); }} />
                        <div>
                          <p className="text-[9px] text-muted-foreground mb-0.5">用途标签</p>
                          <div className="flex gap-1 flex-wrap">
                            {Object.entries(USAGE_TAG_LABELS).map(([tag, info]) => (
                              <button key={tag} onClick={() => updateProfile(p.id, { usage_tag: tag })}
                                className={`text-[9px] px-2 py-1 rounded-lg transition ${p.usage_tag === tag ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                                {info.icon} {info.label}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Add new profile */}
                {showAddForm ? (
                  <div className="bg-muted/50 border border-dashed border-primary/30 rounded-xl p-3 space-y-1.5">
                    <p className="text-xs font-medium text-foreground mb-2">新增模型预设</p>
                    <FieldInput label="名称" value={newProfile.name} placeholder="我的自定义模型"
                      onChange={v => setNewProfile(p => ({ ...p, name: v }))} />
                    <FieldInput label="说明" value={newProfile.description} placeholder="用途简介"
                      onChange={v => setNewProfile(p => ({ ...p, description: v }))} />
                    <FieldInput label="Base URL" value={newProfile.base_url} placeholder="https://api.openclaw.ai/v1"
                      onChange={v => setNewProfile(p => ({ ...p, base_url: v }))} />
                    <FieldInput label="模型" value={newProfile.model} placeholder="gpt-4o"
                      onChange={v => setNewProfile(p => ({ ...p, model: v }))} />
                    <FieldInput label="API Key" value={newProfile.api_key_encrypted} placeholder="sk-..." type="password"
                      onChange={v => setNewProfile(p => ({ ...p, api_key_encrypted: v ? btoa(v) : "" }))} />
                    <div className="flex gap-2 pt-1">
                      <button onClick={handleAddProfile} disabled={!newProfile.name || !newProfile.model}
                        className="flex-1 text-xs bg-primary text-primary-foreground py-1.5 rounded-lg disabled:opacity-50">
                        保存
                      </button>
                      <button onClick={() => setShowAddForm(false)}
                        className="text-xs text-muted-foreground px-3 py-1.5 hover:text-foreground">
                        取消
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowAddForm(true)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-border rounded-xl text-xs text-muted-foreground hover:text-foreground hover:border-muted-foreground/30 transition">
                    <Plus size={12} /> 新增模型预设
                  </button>
                )}

                <p className="text-[8px] text-muted-foreground/60 text-center">
                  支持 OpenAI 兼容格式 API · 留空 Base URL 和 API Key 将使用内置网关
                </p>
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

function FieldInput({ label, value, placeholder, type, onChange }: {
  label: string; value: string; placeholder?: string; type?: string;
  onChange: (v: string) => void;
}) {
  const [localVal, setLocalVal] = useState(value);
  useEffect(() => setLocalVal(value), [value]);
  return (
    <div>
      <p className="text-[9px] text-muted-foreground mb-0.5">{label}</p>
      <input type={type || "text"} value={localVal}
        onChange={e => setLocalVal(e.target.value)}
        onBlur={() => { if (localVal !== value) onChange(localVal); }}
        placeholder={placeholder}
        className="w-full bg-muted border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary" />
    </div>
  );
}
