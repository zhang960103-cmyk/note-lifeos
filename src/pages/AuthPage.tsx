import { useState } from "react";
import { Mail, Lock, Loader2 } from "lucide-react";

interface AuthPageProps {
  onSignUp: (email: string, password: string) => Promise<void>;
  onSignIn: (email: string, password: string) => Promise<void>;
}

const AuthPage = ({ onSignUp, onSignIn }: AuthPageProps) => {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    setError("");
    try {
      if (isLogin) {
        await onSignIn(email, password);
      } else {
        await onSignUp(email, password);
      }
    } catch (err: any) {
      setError(err.message || "操作失败");
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

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="relative">
            <Mail size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="邮箱地址"
              className="w-full bg-surface-2 border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-gold-border"
            />
          </div>
          <div className="relative">
            <Lock size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="密码（至少6位）"
              minLength={6}
              className="w-full bg-surface-2 border border-border rounded-xl pl-10 pr-4 py-3 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-gold-border"
            />
          </div>

          {error && <p className="text-xs text-los-red text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading || !email || !password}
            className="w-full bg-gold text-background py-3 rounded-xl text-sm font-medium disabled:opacity-30 hover:bg-gold/90 transition-all flex items-center justify-center gap-2"
          >
            {loading && <Loader2 size={16} className="animate-spin" />}
            {isLogin ? "登录" : "注册"}
          </button>
        </form>

        <button
          onClick={() => { setIsLogin(!isLogin); setError(""); }}
          className="w-full text-center text-xs text-muted-foreground mt-4 hover:text-gold transition-colors"
        >
          {isLogin ? "没有账号？注册" : "已有账号？登录"}
        </button>
      </div>
    </div>
  );
};

export default AuthPage;
