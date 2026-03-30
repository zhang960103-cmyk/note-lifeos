import { useState } from "react";
import { Mail, Lock, Loader2, Phone, ArrowLeft, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AuthPageProps {
  onSignUp: (email: string, password: string) => Promise<void>;
  onSignIn: (email: string, password: string) => Promise<void>;
}

type AuthTab = "email" | "phone" | "forgot";

const AuthPage = ({ onSignUp, onSignIn }: AuthPageProps) => {
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

  const handleEmailSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError("");
    try {
      if (isLogin) await onSignIn(email, password);
      else await onSignUp(email, password);
    } catch (err: any) {
      setError(err.message || "操作失败");
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
      setError(err.message || "发送失败");
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
      setError(err.message || "发送验证码失败");
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
      setError(err.message || "验证失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center px-8">
      <div className="max-w-[340px] w-full">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🧭</div>
          <h1 className="font-serif-sc text-xl text-foreground">罗盘 · Life OS</h1>
          <p className="text-xs text-muted-foreground mt-1">你的私人生命导师</p>
        </div>

        {/* Tab switcher */}
        {tab !== "forgot" && (
          <div className="flex gap-1 mb-4 bg-surface-2 rounded-xl p-1">
            <button onClick={() => { setTab("email"); setError(""); }}
              className={`flex-1 text-xs py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${tab === "email" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              <Mail size={12} /> 邮箱
            </button>
            <button onClick={() => { setTab("phone"); setError(""); }}
              className={`flex-1 text-xs py-2 rounded-lg transition flex items-center justify-center gap-1.5 ${tab === "phone" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}>
              <Phone size={12} /> 手机
            </button>
          </div>
        )}

        {/* Forgot password */}
        {tab === "forgot" && (
          <>
            <button onClick={() => { setTab("email"); setForgotSent(false); setError(""); }}
              className="flex items-center gap-1 text-xs text-muted-foreground mb-4 hover:text-foreground transition">
              <ArrowLeft size={14} /> 返回登录
            </button>
            {forgotSent ? (
              <div className="text-center py-8">
                <CheckCircle size={32} className="text-los-green mx-auto mb-3" />
                <p className="text-sm text-foreground">重置邮件已发送</p>
                <p className="text-xs text-muted-foreground mt-1">请检查 {email} 的收件箱</p>
              </div>
            ) : (
              <form onSubmit={handleForgotPassword} className="space-y-3">
                <p className="text-xs text-muted-foreground mb-2">输入注册邮箱，我们将发送重置链接</p>
                <div className="relative">
                  <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="邮箱地址"
                    className="w-full bg-surface-2 border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-gold-border" />
                </div>
                {error && <p className="text-xs text-los-red text-center">{error}</p>}
                <button type="submit" disabled={loading || !email}
                  className="w-full bg-gold text-background py-3 rounded-xl text-sm font-medium disabled:opacity-30 hover:bg-gold/90 transition-all flex items-center justify-center gap-2">
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  发送重置链接
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
                <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="邮箱地址"
                  className="w-full bg-surface-2 border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-gold-border" />
              </div>
              <div className="relative">
                <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input type="password" value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="密码（至少6位）" minLength={6}
                  className="w-full bg-surface-2 border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-gold-border" />
              </div>
              {error && <p className="text-xs text-los-red text-center">{error}</p>}
              <button type="submit" disabled={loading || !email || !password}
                className="w-full bg-gold text-background py-3 rounded-xl text-sm font-medium disabled:opacity-30 hover:bg-gold/90 transition-all flex items-center justify-center gap-2">
                {loading && <Loader2 size={16} className="animate-spin" />}
                {isLogin ? "登录" : "注册"}
              </button>
            </form>
            <div className="flex items-center justify-between mt-4">
              <button onClick={() => { setIsLogin(!isLogin); setError(""); }}
                className="text-xs text-muted-foreground hover:text-gold transition-colors">
                {isLogin ? "没有账号？注册" : "已有账号？登录"}
              </button>
              {isLogin && (
                <button onClick={() => { setTab("forgot"); setError(""); }}
                  className="text-xs text-muted-foreground hover:text-gold transition-colors">
                  忘记密码？
                </button>
              )}
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
                    placeholder="+86 手机号（含国际区号）"
                    className="w-full bg-surface-2 border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-gold-border" />
                </div>
                <p className="text-[10px] text-muted-foreground">请输入完整号码，如 +8613812345678</p>
                {error && <p className="text-xs text-los-red text-center">{error}</p>}
                <button onClick={handleSendOtp} disabled={loading || !phone}
                  className="w-full bg-gold text-background py-3 rounded-xl text-sm font-medium disabled:opacity-30 hover:bg-gold/90 transition-all flex items-center justify-center gap-2">
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  发送验证码
                </button>
              </div>
            ) : (
              <form onSubmit={handleVerifyOtp} className="space-y-3">
                <p className="text-xs text-muted-foreground mb-1">验证码已发送至 {phone}</p>
                <input type="text" value={otp} onChange={e => setOtp(e.target.value)} placeholder="输入6位验证码"
                  maxLength={6} autoFocus
                  className="w-full bg-surface-2 border border-border rounded-xl px-4 py-3 text-sm text-foreground text-center tracking-[0.5em] placeholder:text-muted-foreground/40 focus:outline-none focus:border-gold-border" />
                {error && <p className="text-xs text-los-red text-center">{error}</p>}
                <button type="submit" disabled={loading || otp.length < 6}
                  className="w-full bg-gold text-background py-3 rounded-xl text-sm font-medium disabled:opacity-30 hover:bg-gold/90 transition-all flex items-center justify-center gap-2">
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  验证并登录
                </button>
                <button onClick={() => { setOtpSent(false); setOtp(""); setError(""); }}
                  className="w-full text-center text-xs text-muted-foreground hover:text-gold transition-colors">
                  重新发送
                </button>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default AuthPage;
