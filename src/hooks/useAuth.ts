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
    await client.auth.signOut();
  }, []);

  return { user, session, loading, signUp, signIn, signOut, isSupabaseConfigured };
}
