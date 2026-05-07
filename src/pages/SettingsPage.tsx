import { useNavigate } from "react-router-dom";
import { ArrowLeft, Sun, Moon, LogOut, BookOpen, Info, ChevronRight, Globe, Download, Bot, Search, Check, Plus, Trash2, ChevronDown, ChevronUp, Sparkles, Zap, Shield, Pencil, FlaskConical, RotateCcw, ArrowUpCircle, Archive } from "lucide-react";
import { useTheme, ACCENT_OPTIONS, type ThemeMode } from "@/contexts/ThemeContext";
import { useLanguage, LANGUAGES } from "@/contexts/LanguageContext";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import DataExport from "@/components/DataExport";
import DataImport, { FinanceCsvImport } from "@/components/DataImport";
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
  const { profiles, activeProfiles, canaryProfiles, deprecatedProfiles, loading: modelsLoading, setDefault, updateProfile, addProfile, deleteProfile, promoteCanary, rollback } = useModelProfiles();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [showExperiment, setShowExperiment] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newProfile, setNewProfile] = useState({ name: "", description: "", base_url: "", model: "", api_key_encrypted: "", usage_tag: "chat", is_default: false, version: "1.0", status: "active" });

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

  const handleDeleteAccount = async () => {
    const confirmed = confirm("⚠️ 确认删除账号？\n\n这将永久删除您的所有日记、待办、财务记录、生命之轮数据。此操作不可撤销。\n\n请再次确认：您真的要删除账号吗？");
    if (!confirmed) return;
    const reconfirm = window.prompt("请输入您的邮箱地址确认删除：");
    if (!user || reconfirm?.trim() !== user.email) {
      alert("邮箱地址不匹配，删除操作已取消。");
      return;
    }
    try {
      // Delete all user data from all tables
      await Promise.all([
        supabase.from("day_entries").delete().eq("user_id", user.id),
        supabase.from("todos").delete().eq("user_id", user.id),
        supabase.from("finance_entries").delete().eq("user_id", user.id),
        supabase.from("wheel_scores").delete().eq("user_id", user.id),
        supabase.from("habits").delete().eq("user_id", user.id),
        supabase.from("energy_logs").delete().eq("user_id", user.id),
        supabase.from("goals").delete().eq("user_id", user.id),
        supabase.from("ai_model_profiles").delete().eq("user_id", user.id),
      ]);
      // Clear localStorage
      Object.keys(localStorage).forEach(k => {
        if (k.includes(user.id) || k.startsWith("budgets_") || k.startsWith("subscriptions_") || k.startsWith("ious_") || k.startsWith("onboarded_")) {
          localStorage.removeItem(k);
        }
      });
      await signOut();
      alert("账号已删除。感谢您使用罗盘。");
    } catch (e) {
      alert("删除失败，请重试。如问题持续，请联系支持。");
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
    setNewProfile({ name: "", description: "", base_url: "", model: "", api_key_encrypted: "", usage_tag: "chat", is_default: false, version: "1.0", status: "active" });
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
            <button onClick={handleDeleteAccount} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-destructive/5 transition border-t border-border">
              <Trash2 size={14} className="text-destructive/70" />
              <span className="text-xs text-destructive/70">删除账号与所有数据</span>
            </button>
          </div>
        </section>

        {/* Privacy */}
        <section>
          <div className="bg-card border border-border rounded-xl">
            <button onClick={() => window.location.href = "/privacy"} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-accent transition">
              <Shield size={14} className="text-muted-foreground" />
              <span className="text-xs text-foreground flex-1">隐私政策</span>
              <ChevronRight size={12} className="text-muted-foreground" />
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
            {/* #7: 浅色模式尚未完整适配，暂时隐藏切换，只保留强调色选择 */}
            <p className="text-caption text-muted-foreground">主题色</p>
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
          <p className="text-[10px] text-muted-foreground mb-1.5 font-mono-jb">AI 模型</p>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {/* Simple card selection - only active profiles */}
            {modelsLoading ? (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">加载中...</div>
            ) : (
              <div className="p-3 space-y-2">
                {activeProfiles.map(p => {
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
                          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{p.description}</p>
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

            {/* Canary experiment zone */}
            {canaryProfiles.length > 0 && (
              <div className="border-t border-border p-3 space-y-2">
                <div className="flex items-center gap-1.5 mb-1">
                  <FlaskConical size={12} className="text-warning" />
                  <span className="text-[10px] font-medium text-warning">实验中</span>
                </div>
                {canaryProfiles.map(p => (
                  <div key={p.id} className="p-2.5 rounded-xl border border-dashed border-warning/40 bg-warning/5 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-medium text-foreground">{p.name}</span>
                        <span className="text-[9px] text-warning ml-2 bg-warning/10 px-1.5 py-0.5 rounded-full">canary v{p.version}</span>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">{p.description}</p>
                    <div className="flex gap-1.5">
                      <button onClick={() => promoteCanary(p.id)}
                        className="flex items-center gap-1 text-[9px] bg-primary/10 text-primary px-2 py-1 rounded-lg hover:bg-primary/20 transition">
                        <ArrowUpCircle size={10} /> 上线
                      </button>
                      <button onClick={() => setDefault(p.id)}
                        className="flex items-center gap-1 text-[9px] bg-accent text-foreground px-2 py-1 rounded-lg hover:bg-muted transition">
                        <Check size={10} /> 试用
                      </button>
                      <button onClick={() => deleteProfile(p.id)}
                        className="flex items-center gap-1 text-[9px] text-destructive px-2 py-1 rounded-lg hover:bg-destructive/10 transition">
                        <Trash2 size={10} /> 删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Deprecated rollback */}
            {deprecatedProfiles.length > 0 && (
              <div className="border-t border-border p-3 space-y-1.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Archive size={12} className="text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground">已归档</span>
                </div>
                {deprecatedProfiles.map(p => (
                  <div key={p.id} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-muted/30">
                    <span className="text-[10px] text-muted-foreground">{p.name} <span className="opacity-60">v{p.version}</span></span>
                    <button onClick={() => rollback(p.id)}
                      className="flex items-center gap-1 text-[9px] text-foreground bg-accent px-2 py-1 rounded-lg hover:bg-muted transition">
                      <RotateCcw size={9} /> 回滚
                    </button>
                  </div>
                ))}
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
                  <div key={p.id} className={`bg-muted/50 border rounded-xl p-3 space-y-2 ${p.status === 'deprecated' ? 'border-border/50 opacity-60' : p.status === 'canary' ? 'border-warning/30' : 'border-border'}`}>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-foreground">{p.name}</span>
                        <span className={`text-[8px] px-1.5 py-0.5 rounded-full ${
                          p.status === 'active' ? 'bg-los-green/20 text-los-green' : 
                          p.status === 'canary' ? 'bg-warning/20 text-warning' : 
                          'bg-muted text-muted-foreground'
                        }`}>{p.status} v{p.version}</span>
                      </div>
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
                        <FieldInput label="模型" value={p.model} placeholder="google/gemini-2.5-pro"
                          onChange={v => updateProfile(p.id, { model: v })} />
                        <FieldInput label="API Key" value={p.api_key_encrypted ? "••••••" : ""} placeholder="留空使用默认密钥" type="password"
                          onChange={v => { if (v !== "••••••") updateProfile(p.id, { api_key_encrypted: v ? btoa(v) : "" }); }} />
                        <FieldInput label="版本" value={p.version} placeholder="1.0"
                          onChange={v => updateProfile(p.id, { version: v })} />
                        <div>
                          <p className="text-[9px] text-muted-foreground mb-0.5">状态</p>
                          <div className="flex gap-1">
                            {(['active', 'canary', 'deprecated'] as const).map(s => (
                              <button key={s} onClick={() => updateProfile(p.id, { status: s })}
                                className={`text-[9px] px-2 py-1 rounded-lg transition ${p.status === s ? 
                                  s === 'active' ? 'bg-los-green/20 text-los-green' : s === 'canary' ? 'bg-warning/20 text-warning' : 'bg-muted text-muted-foreground'
                                  : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                                {s === 'active' ? '✅ 上线' : s === 'canary' ? '🧪 实验' : '📦 归档'}
                              </button>
                            ))}
                          </div>
                        </div>
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
                    <FieldInput label="模型" value={newProfile.model} placeholder="deepseek-chat"
                      onChange={v => setNewProfile(p => ({ ...p, model: v }))} />
                    <FieldInput label="API Key" value={newProfile.api_key_encrypted} placeholder="sk-..." type="password"
                      onChange={v => setNewProfile(p => ({ ...p, api_key_encrypted: v ? btoa(v) : "" }))} />
                    <div>
                      <p className="text-[9px] text-muted-foreground mb-0.5">初始状态</p>
                      <div className="flex gap-1">
                        <button onClick={() => setNewProfile(p => ({ ...p, status: 'canary' }))}
                          className={`text-[9px] px-2 py-1 rounded-lg transition ${newProfile.status === 'canary' ? 'bg-warning/20 text-warning' : 'bg-muted text-muted-foreground'}`}>
                          🧪 实验（仅自己可见）
                        </button>
                        <button onClick={() => setNewProfile(p => ({ ...p, status: 'active' }))}
                          className={`text-[9px] px-2 py-1 rounded-lg transition ${newProfile.status === 'active' ? 'bg-los-green/20 text-los-green' : 'bg-muted text-muted-foreground'}`}>
                          ✅ 直接上线
                        </button>
                      </div>
                    </div>
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
                  支持 OpenAI 兼容格式 · 留空 Base URL 使用内置网关 · 新模型建议先标记为🧪实验
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Data */}
        <section>
          <p className="text-[10px] text-muted-foreground mb-1.5 font-mono-jb">数据管理</p>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            <DataExport />
            <div className="border-t border-border">
              <DataImport />
            </div>
            <div className="border-t border-border">
              <FinanceCsvImport />
            </div>
          </div>
        </section>

        {/* P2: Encryption + R1: Quota */}
        <section>
          <p className="text-[10px] text-muted-foreground mb-1.5 font-mono-jb">隐私与使用</p>
          <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
            {/* AI 调用配额 */}
            <div className="px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-foreground">今日 AI 对话次数</span>
                <span className="text-xs font-mono-jb text-muted-foreground">
                  {parseInt(localStorage.getItem(`ai_calls_${new Date().toISOString().slice(0, 10)}`) || "0")} / 30
                </span>
              </div>
              <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${Math.min(parseInt(localStorage.getItem(`ai_calls_${new Date().toISOString().slice(0, 10)}`) || "0") / 30 * 100, 100)}%` }} />
              </div>
              <p className="text-[9px] text-muted-foreground mt-1">每日 30 次免费，次日自动重置</p>
            </div>
            {/* 日记加密 */}
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-foreground">日记内容加密</span>
                <button
                  onClick={() => {
                    const current = localStorage.getItem("diary_encryption") === "1";
                    if (!current) {
                      const pw = window.prompt("设置加密密码（请牢记，丢失后无法找回）：");
                      if (pw && pw.length >= 6) {
                        localStorage.setItem("diary_encryption", "1");
                        sessionStorage.setItem("diary_enc_pw_session", pw);
                        alert("✅ 加密已开启。新记录的日记将在上传前加密。");
                      } else if (pw !== null) {
                        alert("密码至少6位");
                      }
                    } else {
                      if (confirm("关闭加密？已加密的内容将显示为密文。")) {
                        localStorage.removeItem("diary_encryption");
                        sessionStorage.removeItem("diary_enc_pw_session");
                      }
                    }
                  }}
                  className={`text-[10px] px-3 py-1 rounded-full transition ${
                    localStorage.getItem("diary_encryption") === "1"
                      ? "bg-los-green/20 text-los-green"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {localStorage.getItem("diary_encryption") === "1" ? "已开启" : "已关闭"}
                </button>
              </div>
              <p className="text-[9px] text-muted-foreground">开启后日记内容在上传前 AES-256 加密，服务端只存密文</p>
            </div>
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
