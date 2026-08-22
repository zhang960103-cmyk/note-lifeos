import { useState, useEffect, useCallback } from "react";
import { supabase, isSupabaseConfigured } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    // Safety timeout: if Supabase doesn't respond in 8s, unblock the UI
    const safetyTimer = setTimeout(() => setLoading(false), 8000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        clearTimeout(safetyTimer);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      clearTimeout(safetyTimer);
    }).catch(() => {
      setLoading(false);
      clearTimeout(safetyTimer);
    });

    return () => { subscription.unsubscribe(); clearTimeout(safetyTimer); };
  }, []);

  const ensureSupabase = () => {
    if (!supabase) {
      throw new Error("Supabase 未配置，请先在 Vercel 中设置 VITE_SUPABASE_URL 和 VITE_SUPABASE_PUBLISHABLE_KEY");
    }
    return supabase;
  };

  const signUp = useCallback(async (email: string, password: string) => {
    const client = ensureSupabase();
    const { error } = await client.auth.signUp({ email, password });
    if (error) throw error;
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const client = ensureSupabase();
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const client = ensureSupabase();
    // BUG-06 根因：client.auth.signOut() 默认 scope 是 "global"，会向 Supabase 服务端
    // 发一次网络请求使这个账号的全部设备会话失效；如果这次请求因为弱网/离线/服务端
    // 不可达而迟迟不返回，这个 Promise 就会一直挂起——而调用方（SettingsPage 的
    // handleSignOut）之前没有超时，也没有兜底，于是用户点了"退出登录"之后页面
    // 永远停在原地，看不出到底是在处理还是已经失败了。
    //
    // 修复：客户端自己加一个超时兜底。超时或报错后，改用 scope: "local"（只清本设备
    // 会话，不需要等服务端网络往返）强制清掉本地登录状态；即使这一步也失败，finally
    // 里仍然直接把 user/session 置空——保证不管 Supabase 那边最终有没有响应，UI 都能
    // 在有限时间内跳回登录页，不会无限期卡死在设置页且没有任何反馈。
    const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T | "timeout"> =>
      Promise.race([
        p,
        new Promise<"timeout">(resolve => setTimeout(() => resolve("timeout"), ms)),
      ]);

    try {
      const result = await withTimeout(client.auth.signOut(), 8000);
      if (result === "timeout" || result.error) {
        await client.auth.signOut({ scope: "local" }).catch(() => {});
      }
    } catch {
      await client.auth.signOut({ scope: "local" }).catch(() => {});
    } finally {
      setSession(null);
      setUser(null);
    }
  }, []);

  return { user, session, loading, signUp, signIn, signOut, isSupabaseConfigured };
}
