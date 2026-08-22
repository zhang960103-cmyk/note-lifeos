import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Lock, Loader2, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";

export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const { t } = useLanguage();
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
    if (password.length < 6) { setError(t("reset_password.error_too_short")); return; }
    if (password !== confirmPassword) { setError(t("reset_password.error_mismatch")); return; }
    setLoading(true);
    setError("");
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setSuccess(true);
      setTimeout(() => navigate("/"), 2000);
    } catch (err: any) {
      setError(err.message || t("reset_password.error_failed"));
    } finally {
      setLoading(false);
    }
  };

  if (!isRecovery) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center px-8">
        <div className="text-center">
          <p className="text-sm text-muted-foreground">{t("reset_password.invalid_link")}</p>
          <button onClick={() => navigate("/")} className="text-xs text-primary mt-4">{t("reset_password.back_home")}</button>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center px-8">
        <div className="text-center">
          <CheckCircle size={40} className="text-los-green mx-auto mb-3" />
          <p className="text-sm text-foreground">{t("reset_password.success")}</p>
          <p className="text-xs text-muted-foreground mt-1">{t("reset_password.redirecting")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-background flex items-center justify-center px-8">
      <div className="max-w-[340px] w-full">
        <div className="text-center mb-8">
          <div className="text-4xl mb-3">🔐</div>
          <h1 className="font-serif-sc text-xl text-foreground">{t("reset_password.title")}</h1>
          <p className="text-xs text-muted-foreground mt-1">{t("reset_password.subtitle")}</p>
        </div>
        <form onSubmit={handleReset} className="space-y-3">
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder={t("reset_password.new_password_placeholder")} minLength={6}
              className="w-full bg-surface-2 border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-gold-border" />
          </div>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
              placeholder={t("reset_password.confirm_password_placeholder")}
              className="w-full bg-surface-2 border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-gold-border" />
          </div>
          {error && <p className="text-xs text-los-red text-center">{error}</p>}
          <button type="submit" disabled={loading || !password || !confirmPassword}
            className="w-full bg-gold text-background py-3 rounded-xl text-sm font-medium disabled:opacity-30 hover:bg-gold/90 transition-all flex items-center justify-center gap-2">
            {loading && <Loader2 size={16} className="animate-spin" />}
            {t("reset_password.submit")}
          </button>
        </form>
      </div>
    </div>
  );
}
