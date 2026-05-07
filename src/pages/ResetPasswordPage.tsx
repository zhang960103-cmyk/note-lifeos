import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Loader2, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    // Check for recovery token in URL hash
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setIsRecovery(true);
    }
    // Listen for PASSWORD_RECOVERY event
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
      }
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) { setError("密码至少6位"); return; }
    if (password !== confirmPassword) { setError("两次密码不一致"); return; }
    setLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      setTimeout(() => navigate("/"), 2000);
    } catch (err: any) {
      setError(err.message || "重置失败");
    } finally {
      setLoading(false);
    }
  };

  if (!isRecovery) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center px-8">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">无效的重置链接</p>
          <button onClick={() => navigate("/")} className="text-xs text-primary mt-4">返回首页</button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center px-8">
        <div className="text-center">
          <CheckCircle size={40} className="text-los-green mx-auto mb-3" />
          <p className="text-sm text-foreground">密码重置成功！</p>
          <p className="text-xs text-muted-foreground mt-1">正在跳转...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center px-8">
      <div className="max-w-[340px] w-full">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🔐</div>
          <h1 className="font-serif-sc text-xl text-foreground">重置密码</h1>
          <p className="text-xs text-muted-foreground mt-1">请设置新密码</p>
        </div>
        <form onSubmit={handleReset} className="space-y-3">
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="新密码（至少6位）" minLength={6}
              className="w-full bg-surface-2 border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-gold-border" />
          </div>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              placeholder="确认新密码"
              className="w-full bg-surface-2 border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-gold-border" />
          </div>
          {error && <p className="text-xs text-los-red text-center">{error}</p>}
          <button type="submit" disabled={loading || !password || !confirmPassword}
            className="w-full bg-gold text-background py-3 rounded-xl text-sm font-medium disabled:opacity-30 hover:bg-gold/90 transition-all flex items-center justify-center gap-2">
            {loading && <Loader2 size={16} className="animate-spin" />}
            重置密码
          </button>
        </form>
      </div>
    </div>
  );
}
