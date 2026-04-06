import { useState } from "react";
import { Mail, Lock, Loader2, Phone, ArrowLeft, CheckCircle, Globe, MonitorSmartphone, Sparkles, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage, LANGUAGES } from "@/contexts/LanguageContext";

interface AuthPageProps {
  onSignUp: (email: string, password: string) => Promise<void>;
  onSignIn: (email: string, password: string) => Promise<void>;
}

type AuthTab = "email" | "phone" | "forgot";

const AuthPage = ({ onSignUp, onSignIn }: AuthPageProps) => {
  const { t, lang, setLang } = useLanguage();
  const isWeb = typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;
  const [tab, setTab] = useState<AuthTab>("email");
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const [showLangPicker, setShowLangPicker] = useState(false);

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError("");
    try {
      if (isLogin) await onSignIn(email, password);
      else await onSignUp(email, password);
    } catch (err: any) {
      setError(err.message || t("auth.error.default"));
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });
      if (error) throw error;
      setForgotSent(true);
    } catch (err: any) {
      setError(err.message || t("auth.error.send_fail"));
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (!phone) return;
    setLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.signInWithOtp({ phone });
      if (error) throw error;
      setOtpSent(true);
    } catch (err: any) {
      setError(err.message || t("auth.error.otp_fail"));
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phone || !otp) return;
    setLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.verifyOtp({ phone, token: otp, type: "sms" });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || t("auth.error.verify_fail"));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: `${window.location.origin}/`,
          skipBrowserRedirect: false,
        },
      });
      if (error) throw error;
    } catch (err: any) {
      setError(err.message || "Google 登录失败");
      setLoading(false);
    }
  };

  const currentLang = LANGUAGES.find(l => l.key === lang);

  return (
    <div className="min-h-screen bg-background text-foreground relative overflow-hidden">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(197,148,58,0.18),transparent_35%),linear-gradient(180deg,rgba(11,10,8,0.96),rgba(11,10,8,1))]" />
      <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(197,148,58,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(197,148,58,0.08)_1px,transparent_1px)] [background-size:28px_28px]" />

      {/* Language selector - top right */}
      <div className="absolute top-4 right-4 z-50">
        <button
          onClick={() => setShowLangPicker(!showLangPicker)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-2 border border-border text-xs text-muted-foreground hover:text-foreground hover:border-primary/30 transition-all"
        >
          <Globe size={14} />
          <span>{currentLang?.flag} {currentLang?.label}</span>
        </button>

        {showLangPicker && (
          <>
            <div className="fixed inset-0" onClick={() => setShowLangPicker(false)} />
            <div className="absolute right-0 top-full mt-1 bg-surface-1 border border-border rounded-xl shadow-lg overflow-hidden z-50 min-w-[160px] max-h-[320px] overflow-y-auto">
              {LANGUAGES.map(l => (
                <button
                  key={l.key}
                  onClick={() => { setLang(l.key); setShowLangPicker(false); }}
                  className={`w-full flex items-center gap-2 px-3 py-2.5 text-xs transition hover:bg-surface-2 ${
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

      <div className={`relative z-10 min-h-screen ${isWeb ? "grid lg:grid-cols-[1.15fr_0.85fr]" : "flex flex-col justify-center"}`}>
        {isWeb && (
          <section className="hidden lg:flex flex-col justify-between p-10 xl:p-14 border-r border-white/5">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-gold/20 bg-gold/10 px-3 py-1 text-[11px] tracking-[0.24em] uppercase text-gold">
                <Sparkles size={12} /> Life OS Web + App
              </div>
              <div className="mt-8 max-w-xl">
                <h1 className="font-serif-sc text-5xl leading-tight text-foreground">
                  把日记、待办、复盘和 AI 导师，整理成一个真正可发布的网页版入口。
                </h1>
                <p className="mt-5 text-sm leading-8 text-foreground/70">
                  现在支持网页版登录、Google OAuth、邮箱密码、手机验证码与访客体验；同时保留移动端沉浸式布局，适合封装为 PWA 或 App WebView。
                </p>
              </div>
            </div>

            <div className="grid gap-4">
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                <div className="flex items-center gap-3 text-gold"><MonitorSmartphone size={18} /><span className="text-sm">双端兼容体验</span></div>
                <p className="mt-2 text-xs leading-6 text-foreground/65">桌面端使用双栏展示，移动端保持单手操作与底部导航习惯。</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/5 p-5 backdrop-blur-sm">
                <div className="flex items-center gap-3 text-gold"><ShieldCheck size={18} /><span className="text-sm">发布级认证链路</span></div>
                <p className="mt-2 text-xs leading-6 text-foreground/65">Supabase PKCE 会话、恢复密码、OAuth 回跳与匿名体验都可直接用于上线部署。</p>
              </div>
            </div>
          </section>
        )}

        <section className="flex items-center justify-center px-6 py-24 sm:px-8">
          <div className="w-full max-w-[420px] rounded-[32px] border border-white/10 bg-[rgba(20,16,12,0.88)] p-6 sm:p-8 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl">
            <div className="text-center mb-8">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-[22px] border border-gold/20 bg-gold/10 text-3xl shadow-[0_0_40px_rgba(197,148,58,0.18)]">🧭</div>
              <h1 className="font-serif-sc text-2xl text-foreground">{t("app.name")}</h1>
              <p className="text-sm text-muted-foreground mt-2">{t("app.tagline")}</p>
              <div className="mt-4 flex items-center justify-center gap-2 text-[11px] text-foreground/55">
                <span className="rounded-full border border-white/10 px-2 py-1">Web</span>
                <span className="rounded-full border border-white/10 px-2 py-1">PWA</span>
                <span className="rounded-full border border-white/10 px-2 py-1">Mobile App Shell</span>
              </div>
            </div>

        {/* Tab switcher */}
        {tab !== "forgot" && (
          <div className="flex gap-1 mb-4 bg-surface-2 rounded-xl p-1">
            <button onClick={() => { setTab("email"); setError(""); }}
              className={`flex-1 text-xs py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${tab === "email" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              <Mail size={12} /> {t("auth.email")}
            </button>
            <button onClick={() => { setTab("phone"); setError(""); }}
              className={`flex-1 text-xs py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${tab === "phone" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              <Phone size={12} /> {t("auth.phone")}
            </button>
          </div>
        )}

        {/* Forgot password */}
        {tab === "forgot" && (
          <>
            <button onClick={() => { setTab("email"); setForgotSent(false); setError(""); }}
              className="flex items-center gap-1 text-xs text-muted-foreground mb-4 hover:text-foreground transition">
              <ArrowLeft size={14} /> {t("auth.back")}
            </button>
            {forgotSent ? (
              <div className="text-center py-8">
                <CheckCircle size={32} className="text-los-green mx-auto mb-3" />
                <p className="text-sm text-foreground">{t("auth.forgot.sent")}</p>
                <p className="text-xs text-muted-foreground mt-1">{t("auth.forgot.check")} {email}</p>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-3">
                <p className="text-xs text-muted-foreground mb-2">{t("auth.forgot.desc")}</p>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t("auth.email.placeholder")}
                    className="w-full bg-surface-2 border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-gold-border" />
                </div>
                {error && <p className="text-xs text-los-red text-center">{error}</p>}
                <button type="submit" disabled={loading || !email}
                  className="w-full bg-gold text-background py-3 rounded-xl text-sm font-medium disabled:opacity-30 hover:bg-gold/90 transition-all flex items-center justify-center gap-2">
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  {t("auth.forgot.send")}
                </button>
              </form>
            )}
          </>
        )}

        {/* Email login/signup */}
        {tab === "email" && (
          <>
            <form onSubmit={handleEmailSubmit} className="space-y-3">
              <div className="relative">
                <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder={t("auth.email.placeholder")}
                  className="w-full bg-surface-2 border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-gold-border" />
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder={t("auth.password.placeholder")} minLength={6}
                  className="w-full bg-surface-2 border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-gold-border" />
              </div>
              {error && <p className="text-xs text-los-red text-center">{error}</p>}
              <button type="submit" disabled={loading || !email || !password}
                className="w-full bg-gold text-background py-3 rounded-xl text-sm font-medium disabled:opacity-30 hover:bg-gold/90 transition-all flex items-center justify-center gap-2">
                {loading && <Loader2 size={16} className="animate-spin" />}
                {isLogin ? t("auth.login") : t("auth.signup")}
              </button>
            </form>
            <div className="flex items-center justify-between mt-4">
              <button onClick={() => { setIsLogin(!isLogin); setError(""); }}
                className="text-xs text-muted-foreground hover:text-gold transition-colors">
                {isLogin ? t("auth.no_account") : t("auth.has_account")}
              </button>
              {isLogin && (
                <button onClick={() => { setTab("forgot"); setError(""); }}
                  className="text-xs text-muted-foreground hover:text-gold transition-colors">
                  {t("auth.forgot")}
                </button>
              )}
            </div>

            {/* Google OAuth + Guest */}
            <div className="mt-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] text-muted-foreground">{t("auth.or")}</span>
                <div className="flex-1 h-px bg-border" />
              </div>
              <button
                onClick={handleGoogleLogin}
                className="w-full flex items-center justify-center gap-2 border border-border bg-surface-2 py-2.5 rounded-xl text-sm text-foreground hover:bg-surface-3 transition"
              >
                <svg width="16" height="16" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
                {t("auth.google")}
              </button>
              <button
                onClick={async () => {
                  setLoading(true);
                  setError("");
                  try {
                    const { error } = await supabase.auth.signInAnonymously();
                    if (error) throw error;
                  } catch (err: any) {
                    setError(err.message || t("auth.error.default"));
                  } finally {
                    setLoading(false);
                  }
                }}
                className="w-full mt-2 flex items-center justify-center gap-2 border border-dashed border-border bg-transparent py-2.5 rounded-xl text-sm text-muted-foreground hover:text-foreground hover:border-primary/30 transition"
              >
                👤 {t("auth.guest")}
              </button>
              <p className="text-[9px] text-muted-foreground/60 text-center mt-1">{t("auth.guest.hint")}</p>
            </div>
          </>
        )}

        {/* Phone login */}
        {tab === "phone" && (
          <>
            {!otpSent ? (
              <div className="space-y-3">
                <div className="relative">
                  <Phone size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="tel" value={phone} onChange={e => setPhone(e.target.value)}
                    placeholder={t("auth.phone.placeholder")}
                    className="w-full bg-surface-2 border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-gold-border" />
                </div>
                <p className="text-[10px] text-muted-foreground">{t("auth.phone.hint")}</p>
                {error && <p className="text-xs text-los-red text-center">{error}</p>}
                <button onClick={handleSendOtp} disabled={loading || !phone}
                  className="w-full bg-gold text-background py-3 rounded-xl text-sm font-medium disabled:opacity-30 hover:bg-gold/90 transition-all flex items-center justify-center gap-2">
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  {t("auth.phone.send_otp")}
                </button>
              </div>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-3">
                <p className="text-xs text-muted-foreground mb-1">{t("auth.phone.otp_sent")} {phone}</p>
                <input type="text" value={otp} onChange={e => setOtp(e.target.value)} placeholder={t("auth.phone.otp_placeholder")}
                  maxLength={6} autoFocus
                  className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-sm text-foreground text-center tracking-[0.5em] placeholder:text-muted-foreground/40 focus:outline-none focus:border-gold-border" />
                {error && <p className="text-xs text-los-red text-center">{error}</p>}
                <button type="submit" disabled={loading || otp.length < 6}
                  className="w-full bg-gold text-background py-3 rounded-xl text-sm font-medium disabled:opacity-30 hover:bg-gold/90 transition-all flex items-center justify-center gap-2">
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  {t("auth.phone.verify")}
                </button>
                <button onClick={() => { setOtpSent(false); setOtp(""); setError(""); }}
                  className="w-full text-center text-xs text-muted-foreground hover:text-gold transition-colors">
                  {t("auth.phone.resend")}
                </button>
              </form>
            )}
          </>
        )}
          </div>
        </section>
      </div>
    </div>
  );
};

export default AuthPage;
