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
// BUG-02：加密开关已禁用（详见下方"日记内容加密"区块），这里只保留 setEncryptionEnabled
// 用于一次性清理旧版本残留的"已开启"标记，避免误导性状态留在 localStorage 里。
import { isEncryptionEnabled, setEncryptionEnabled } from "@/lib/crypto";

const APP_VERSION = "2.2.0";

const CURRENCY_OPTIONS = [
  { key: "CNY", symbol: "¥" },
  { key: "USD", symbol: "$" },
  { key: "AED", symbol: "د.إ" },
  { key: "EUR", symbol: "€" },
  { key: "GBP", symbol: "£" },
  { key: "JPY", symbol: "¥" },
  { key: "KRW", symbol: "₩" },
  { key: "RUB", symbol: "₽" },
];

const USAGE_TAG_ICONS: Record<string, string> = {
  chat: "💬",
  cheap: "⚡",
  private: "🔒",
  extract: "🔍",
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

  // BUG-02：加密开关已改为禁用状态，不再需要 React state 交互。这里做一次性清理：
  // 如果用户在旧版本里点开过"已开启"，localStorage 里会留一个从未真正生效过的
  // diary_encryption_<userId> 标记；不清理的话，将来真正接通加密时容易被这个
  // 陈旧标记误导成"这个用户已经加密过"。
  useEffect(() => {
    if (user && isEncryptionEnabled(user.id)) {
      setEncryptionEnabled(false, user.id);
    }
  }, [user]);

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

  // BUG-06：之前这里直接 `await signOut()`，没有 loading 状态也没有 catch——如果
  // signOut() 挂起或抛错，用户点完按钮后完全看不出任何反应，只能一直等。现在加上
  // 进行中状态（禁用按钮+提示文案）和错误提示；signOut() 本身的超时/兜底逻辑见
  // useAuth.ts。
  const [signingOut, setSigningOut] = useState(false);
  const handleSignOut = async () => {
    if (!confirm(t("auth.confirm_logout"))) return;
    setSigningOut(true);
    try {
      await signOut();
    } catch (e: any) {
      alert(e?.message || t("settings.logout_error"));
    } finally {
      setSigningOut(false);
    }
  };

  // 只清本地缓存的key(仅本设备)——注意：预算/订阅/借还/项目这四类数据从设计上
  // 就只存在localStorage，从来没有同步到云端(见useLocalData.ts/useProjects.ts)，
  // 所以"仅清空本地"对这四类数据其实等同于永久删除，不是"仅清空本地缓存"那么
  // 轻量，必须在确认文案里明确说清楚，不能让用户误以为云端还留着备份。
  // 之前这里用 k.startsWith("budgets_") 这种不带userId的宽泛匹配，会连同一台
  // 设备上其他账号的本地数据一起清掉——改成精确匹配当前账号的key。
  const clearLocalKeysFor = (userId: string) => {
    const exactPrefixes = [
      `budgets_${userId}`, `subscriptions_${userId}`, `ious_${userId}`, `projects_${userId}`,
    ];
    Object.keys(localStorage).forEach(k => {
      if (k.includes(userId) || exactPrefixes.some(p => k === p)) {
        localStorage.removeItem(k);
      }
    });
  };

  const handleClearLocalOnly = () => {
    if (!user) return;
    const confirmed = confirm(t("settings.clear_local_confirm"));
    if (!confirmed) return;
    clearLocalKeysFor(user.id);
    alert(t("settings.clear_local_done"));
  };

  const handleDeleteAccount = async () => {
    const confirmed = confirm(t("settings.delete_account_confirm"));
    if (!confirmed) return;
    const reconfirm = window.prompt(t("settings.delete_account_email_prompt"));
    if (!user || reconfirm?.trim() !== user.email) {
      alert(t("settings.delete_account_email_mismatch"));
      return;
    }
    try {
      // Delete all user data from all tables.
      // 之前这里 Promise.all 只等 promise 是否 reject，不检查每个结果的 error——
      // supabase-js 失败时是 resolve 不是 reject，所以某张表删除失败时用户依然会看到
      // "账号已删除"的成功提示，实际上那张表的数据还留在库里。这里改成逐个检查 error 并汇总。
      const tables = [
        "day_entries", "todos", "chat_messages", "finance_entries", "wheel_scores",
        "habits", "energy_logs", "goals", "ai_model_profiles",
        "insight_bookmarks", "user_places", "health_metrics", "review_letters",
      ] as const;
      const results = await Promise.all(
        tables.map(t => supabase.from(t).delete().eq("user_id", user.id))
      );
      const failedTables: string[] = [];
      results.forEach((r, i) => {
        if (r.error) { failedTables.push(tables[i]); console.error(`[删除账号] 表 ${tables[i]} 删除失败:`, r.error); }
      });

      // Clear localStorage（本地这几类数据从未同步云端，云端数据删了本地也要跟着清，
      // 否则退出登录前还能在本设备继续看到"已删除"的账号数据）
      clearLocalKeysFor(user.id);

      if (failedTables.length > 0) {
        alert(t("settings.delete_account_partial_fail", { tables: failedTables.join(", ") }));
        return;
      }

      await signOut();
      alert(t("settings.delete_account_success"));
    } catch (e) {
      console.error("[删除账号] 异常:", e);
      alert(t("settings.delete_account_error"));
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

  const getUsageTagInfo = (tag: string) => {
    const icon = USAGE_TAG_ICONS[tag] || "🔧";
    const label = USAGE_TAG_ICONS[tag] ? t(`settings.usage_tag.${tag}`) : tag;
    return { icon, label };
  };

  const currentLang = LANGUAGES.find(l => l.key === lang);
  const currentCurrency = CURRENCY_OPTIONS.find(c => c.key === currency);
  const defaultProfile = profiles.find(p => p.is_default);
  // usage_tag==="private" 的模型(比如自己填的本地/私有网关)不占用云端每日额度，
  // 和 HomePage.tsx 里 bumpAiCall/aiQuotaExceeded 的判断逻辑保持一致。
  const isPrivateModelActive = defaultProfile?.usage_tag === "private";
  // 之前这个key是"ai_calls_日期"，不分账号——同一浏览器登录过的所有账号共用
  // 同一个每日额度计数，A账号的额度会被B账号的对话消耗掉。按userId分开存。
  const aiCallsKey = user ? `ai_calls_${user.id}_${new Date().toISOString().slice(0, 10)}` : "";
  const aiCallCountToday = aiCallsKey ? parseInt(localStorage.getItem(aiCallsKey) || "0") : 0;

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
          <span className="text-xs text-muted-foreground flex-1 text-left">{t("settings.search_placeholder")}</span>
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
                {/* BUG-05 根因：访客(匿名)账号在 Supabase 里也是一个真实的 `user` 对象
                    （只是没有 email），旧代码用 `user?.email || t("settings.not_logged_in")`
                    做名字兜底，导致访客看到名字栏显示"未登录"；但状态栏又不看 email
                    是否存在、无条件写死显示"已登录"——同一张卡片同时出现"未登录"和
                    "已登录"两个互斥状态，用户完全无法判断数据有没有绑定账号。
                    修复：用 Supabase 提供的 `user.is_anonymous` 字段明确区分访客，
                    访客统一展示"访客（仅本地数据）"，不再套用"未登录/已登录"这套
                    只适用于真实账号的文案。 */}
                <p className="text-xs text-foreground truncate">
                  {user?.is_anonymous ? t("settings.guest_name") : (displayName || user?.email || t("settings.not_logged_in"))}
                </p>
                <p className="text-[9px] text-muted-foreground">
                  {user?.is_anonymous ? t("settings.guest_status") : t("settings.logged_in")}
                </p>
              </div>
              {profileSaved && <Check size={14} className="text-los-green" />}
              <ChevronRight size={14} className="text-muted-foreground" />
            </button>
            {showProfile && (
              <div className="p-3 border-b border-border space-y-2">
                <div>
                  <p className="text-[10px] text-muted-foreground mb-0.5">{t("settings.nickname")}</p>
                  <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder={t("settings.nickname_placeholder")}
                    className="w-full bg-muted border border-border rounded-lg px-3 py-1.5 text-xs text-foreground focus:outline-none focus:border-primary" />
                </div>
                <button onClick={saveProfile} className="text-xs bg-primary text-primary-foreground px-4 py-1.5 rounded-lg">{t("settings.save")}</button>
              </div>
            )}
            <button onClick={handleSignOut} disabled={signingOut}
              className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-accent transition disabled:opacity-50">
              <LogOut size={14} className="text-destructive" />
              <span className="text-xs text-destructive">{signingOut ? t("settings.logging_out") : t("settings.logout")}</span>
            </button>
            <button onClick={handleClearLocalOnly} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-accent transition border-t border-border">
              <Trash2 size={14} className="text-muted-foreground" />
              <span className="text-xs text-foreground">{t("settings.clear_local_only")}</span>
            </button>
            <button onClick={handleDeleteAccount} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-destructive/5 transition border-t border-border">
              <Trash2 size={14} className="text-destructive/70" />
              <span className="text-xs text-destructive/70">{t("settings.delete_cloud_data")}</span>
            </button>
          </div>
        </section>

        {/* Privacy */}
        <section>
          <div className="bg-card border border-border rounded-xl">
            <button onClick={() => window.location.href = "/privacy"} className="w-full flex items-center gap-3 px-4 py-2.5 text-left hover:bg-accent transition">
              <Shield size={14} className="text-muted-foreground" />
              <span className="text-xs text-foreground flex-1">{t("settings.privacy_policy")}</span>
              <ChevronRight size={12} className="text-muted-foreground" />
            </button>
          </div>
        </section>

        {/* Language & Currency */}
        <section>
          <p className="text-[10px] text-muted-foreground mb-1.5 font-mono-jb">{t("settings.regional")}</p>
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
                <span className="text-xs text-foreground flex-1">{currentCurrency ? t(`settings.currency.${currentCurrency.key}`) : ""}</span>
                <ChevronRight size={14} className="text-muted-foreground" />
              </button>
              {showCurrencyPicker && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowCurrencyPicker(false)} />
                  <div className="fixed left-1/2 -translate-x-1/2 top-1/2 -translate-y-1/2 w-[280px] bg-popover border border-border rounded-xl shadow-lg z-50 max-h-[320px] overflow-y-auto">
                    {CURRENCY_OPTIONS.map(c => (
                      <button key={c.key} onClick={() => saveCurrency(c.key)}
                        className={`w-full flex items-center gap-2 px-4 py-2.5 text-xs transition hover:bg-accent ${currency === c.key ? "text-primary bg-accent" : "text-foreground"}`}>
                        <span className="text-sm w-5 text-center">{c.symbol}</span><span>{t(`settings.currency.${c.key}`)}</span>
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
            <p className="text-caption text-muted-foreground">{t("settings.accent")}</p>
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
          <p className="text-[10px] text-muted-foreground mb-1.5 font-mono-jb">{t("settings.ai_models")}</p>
          <div className="bg-card border border-border rounded-xl overflow-hidden">
            {/* Simple card selection - only active profiles */}
            {modelsLoading ? (
              <div className="px-4 py-6 text-center text-xs text-muted-foreground">{t("common.loading")}</div>
            ) : (
              <div className="p-3 space-y-2">
                {activeProfiles.map(p => {
                  const tagInfo = getUsageTagInfo(p.usage_tag);
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
                              <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full">{t("settings.default_badge")}</span>
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
                  <span className="text-[10px] font-medium text-warning">{t("settings.canary_zone")}</span>
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
                        <ArrowUpCircle size={10} /> {t("settings.promote")}
                      </button>
                      <button onClick={() => setDefault(p.id)}
                        className="flex items-center gap-1 text-[9px] bg-accent text-foreground px-2 py-1 rounded-lg hover:bg-muted transition">
                        <Check size={10} /> {t("settings.trial")}
                      </button>
                      <button onClick={() => deleteProfile(p.id)}
                        className="flex items-center gap-1 text-[9px] text-destructive px-2 py-1 rounded-lg hover:bg-destructive/10 transition">
                        <Trash2 size={10} /> {t("common.delete")}
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
                  <span className="text-[10px] text-muted-foreground">{t("settings.archived")}</span>
                </div>
                {deprecatedProfiles.map(p => (
                  <div key={p.id} className="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-muted/30">
                    <span className="text-[10px] text-muted-foreground">{p.name} <span className="opacity-60">v{p.version}</span></span>
                    <button onClick={() => rollback(p.id)}
                      className="flex items-center gap-1 text-[9px] text-foreground bg-accent px-2 py-1 rounded-lg hover:bg-muted transition">
                      <RotateCcw size={9} /> {t("settings.rollback")}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Advanced toggle */}
            <button onClick={() => setShowAdvanced(!showAdvanced)}
              className="w-full flex items-center justify-center gap-1.5 px-4 py-2 border-t border-border text-[10px] text-muted-foreground hover:text-foreground hover:bg-accent transition">
              {showAdvanced ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
              {t("settings.advanced_settings")}
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
                        <FieldInput label={t("settings.field_name")} value={p.name}
                          onChange={v => updateProfile(p.id, { name: v })} />
                        <FieldInput label={t("settings.field_description")} value={p.description}
                          onChange={v => updateProfile(p.id, { description: v })} />
                        <FieldInput label="Base URL" value={p.base_url} placeholder={t("settings.base_url_placeholder")}
                          onChange={v => updateProfile(p.id, { base_url: v })} />
                        <FieldInput label={t("settings.field_model")} value={p.model} placeholder="google/gemini-2.5-pro"
                          onChange={v => updateProfile(p.id, { model: v })} />
                        <FieldInput label="API Key" value={p.api_key_encrypted ? "••••••" : ""} placeholder={t("settings.api_key_placeholder")} type="password"
                          onChange={v => { if (v !== "••••••") updateProfile(p.id, { api_key_encrypted: v ? btoa(v) : "" }); }} />
                        <FieldInput label={t("settings.field_version")} value={p.version} placeholder="1.0"
                          onChange={v => updateProfile(p.id, { version: v })} />
                        <div>
                          <p className="text-[9px] text-muted-foreground mb-0.5">{t("settings.field_status")}</p>
                          <div className="flex gap-1">
                            {(['active', 'canary', 'deprecated'] as const).map(s => (
                              <button key={s} onClick={() => updateProfile(p.id, { status: s })}
                                className={`text-[9px] px-2 py-1 rounded-lg transition ${p.status === s ?
                                  s === 'active' ? 'bg-los-green/20 text-los-green' : s === 'canary' ? 'bg-warning/20 text-warning' : 'bg-muted text-muted-foreground'
                                  : 'bg-muted text-muted-foreground hover:text-foreground'}`}>
                                {s === 'active' ? t("settings.status_active") : s === 'canary' ? t("settings.status_canary") : t("settings.status_deprecated")}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-[9px] text-muted-foreground mb-0.5">{t("settings.usage_tag_label")}</p>
                          <div className="flex gap-1 flex-wrap">
                            {Object.keys(USAGE_TAG_ICONS).map(tag => {
                              const info = getUsageTagInfo(tag);
                              return (
                                <button key={tag} onClick={() => updateProfile(p.id, { usage_tag: tag })}
                                  className={`text-[9px] px-2 py-1 rounded-lg transition ${p.usage_tag === tag ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground hover:text-foreground"}`}>
                                  {info.icon} {info.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}

                {/* Add new profile */}
                {showAddForm ? (
                  <div className="bg-muted/50 border border-dashed border-primary/30 rounded-xl p-3 space-y-1.5">
                    <p className="text-xs font-medium text-foreground mb-2">{t("settings.add_model_profile")}</p>
                    <FieldInput label={t("settings.field_name")} value={newProfile.name} placeholder={t("settings.custom_model_placeholder")}
                      onChange={v => setNewProfile(p => ({ ...p, name: v }))} />
                    <FieldInput label={t("settings.field_description")} value={newProfile.description} placeholder={t("settings.description_placeholder")}
                      onChange={v => setNewProfile(p => ({ ...p, description: v }))} />
                    <FieldInput label="Base URL" value={newProfile.base_url} placeholder="https://api.openclaw.ai/v1"
                      onChange={v => setNewProfile(p => ({ ...p, base_url: v }))} />
                    <FieldInput label={t("settings.field_model")} value={newProfile.model} placeholder="deepseek-chat"
                      onChange={v => setNewProfile(p => ({ ...p, model: v }))} />
                    <FieldInput label="API Key" value={newProfile.api_key_encrypted} placeholder="sk-..." type="password"
                      onChange={v => setNewProfile(p => ({ ...p, api_key_encrypted: v ? btoa(v) : "" }))} />
                    <div>
                      <p className="text-[9px] text-muted-foreground mb-0.5">{t("settings.initial_status")}</p>
                      <div className="flex gap-1">
                        <button onClick={() => setNewProfile(p => ({ ...p, status: 'canary' }))}
                          className={`text-[9px] px-2 py-1 rounded-lg transition ${newProfile.status === 'canary' ? 'bg-warning/20 text-warning' : 'bg-muted text-muted-foreground'}`}>
                          {t("settings.status_canary_hint")}
                        </button>
                        <button onClick={() => setNewProfile(p => ({ ...p, status: 'active' }))}
                          className={`text-[9px] px-2 py-1 rounded-lg transition ${newProfile.status === 'active' ? 'bg-los-green/20 text-los-green' : 'bg-muted text-muted-foreground'}`}>
                          {t("settings.status_active_hint")}
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-2 pt-1">
                      <button onClick={handleAddProfile} disabled={!newProfile.name || !newProfile.model}
                        className="flex-1 text-xs bg-primary text-primary-foreground py-1.5 rounded-lg disabled:opacity-50">
                        {t("common.save")}
                      </button>
                      <button onClick={() => setShowAddForm(false)}
                        className="text-xs text-muted-foreground px-3 py-1.5 hover:text-foreground">
                        {t("common.cancel")}
                      </button>
                    </div>
                  </div>
                ) : (
                  <button onClick={() => setShowAddForm(true)}
                    className="w-full flex items-center justify-center gap-1.5 py-2 border border-dashed border-border rounded-xl text-xs text-muted-foreground hover:text-foreground hover:border-muted-foreground/30 transition">
                    <Plus size={12} /> {t("settings.add_model_profile")}
                  </button>
                )}

                <p className="text-[8px] text-muted-foreground/60 text-center">
                  {t("settings.model_profile_hint")}
                </p>
              </div>
            )}
          </div>
        </section>

        {/* Data */}
        <section>
          <p className="text-[10px] text-muted-foreground mb-1.5 font-mono-jb">{t("settings.data_management")}</p>
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
          <p className="text-[10px] text-muted-foreground mb-1.5 font-mono-jb">{t("settings.privacy_usage")}</p>
          <div className="bg-card border border-border rounded-xl overflow-hidden divide-y divide-border">
            {/* AI 调用配额 */}
            <div className="px-4 py-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-foreground">{t("settings.ai_calls_today")}</span>
                <span className="text-xs font-mono-jb text-muted-foreground">
                  {isPrivateModelActive ? t("settings.unlimited_private_model") : `${aiCallCountToday} / 30`}
                </span>
              </div>
              <div className="mt-1.5 h-1.5 bg-muted rounded-full overflow-hidden">
                <div className="h-full bg-primary rounded-full transition-all"
                  style={{ width: isPrivateModelActive ? "100%" : `${Math.min(aiCallCountToday / 30 * 100, 100)}%` }} />
              </div>
              <p className="text-[9px] text-muted-foreground mt-1">
                {isPrivateModelActive
                  ? t("settings.private_model_note")
                  : t("settings.daily_quota_reset_note")}
              </p>
            </div>
            {/* 日记加密 — BUG-02：日记的创建/读取/搜索/导出/同步全链路里没有任何一处
                真正调用过 encryptText/decryptText（全仓搜索确认，crypto.ts 是一个完整但
                完全没被接入的孤立模块）。旧版开关仍然可点、可切换"已开启/已关闭"、还会弹
                window.prompt() 收密码——用户很容易只看到"已开启"的绿色徽标就以为数据已被
                保护，根本不会往下看那行小字说明。安全整改的第一原则是"界面展示要跟实际存储
                行为一致"，所以这里不做"警告 + 仍可开启"的中间状态，而是把开关本身禁用掉，
                彻底删除 AES-256 的承诺文案，明确标注功能尚未提供。 */}
            <div className="px-4 py-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs text-foreground">{t("settings.diary_encryption")}</span>
                <span
                  aria-disabled="true"
                  title={t("settings.encryption_disabled_title")}
                  className="text-[10px] px-3 py-1 rounded-full bg-muted text-muted-foreground/60 cursor-not-allowed select-none"
                >
                  {t("settings.coming_soon")}
                </span>
              </div>
              <p className="text-[9px] text-muted-foreground">
                {t("settings.encryption_disabled_desc")}
              </p>
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
