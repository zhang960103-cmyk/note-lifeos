import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export interface ModelProfile {
  id: string;
  name: string;
  description: string;
  base_url: string;
  model: string;
  api_key_encrypted: string;
  usage_tag: string;
  is_default: boolean;
  is_system: boolean;
}

export function useModelProfiles() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<ModelProfile[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchProfiles = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await supabase
      .from("ai_model_profiles" as any)
      .select("*")
      .eq("user_id", user.id)
      .order("is_default", { ascending: false });
    setProfiles((data as any[] || []).map((d: any) => ({
      id: d.id,
      name: d.name,
      description: d.description || "",
      base_url: d.base_url || "",
      model: d.model || "",
      api_key_encrypted: d.api_key_encrypted || "",
      usage_tag: d.usage_tag || "chat",
      is_default: d.is_default || false,
      is_system: d.is_system || false,
    })));
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  const getDefault = useCallback((): ModelProfile | null => {
    return profiles.find(p => p.is_default) || profiles[0] || null;
  }, [profiles]);

  const setDefault = useCallback(async (id: string) => {
    if (!user) return;
    // Unset all defaults first
    await supabase.from("ai_model_profiles" as any).update({ is_default: false } as any).eq("user_id", user.id);
    // Set new default
    await supabase.from("ai_model_profiles" as any).update({ is_default: true } as any).eq("id", id);
    setProfiles(prev => prev.map(p => ({ ...p, is_default: p.id === id })));
  }, [user]);

  const updateProfile = useCallback(async (id: string, updates: Partial<ModelProfile>) => {
    if (!user) return;
    const dbUpdates: any = {};
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description;
    if (updates.base_url !== undefined) dbUpdates.base_url = updates.base_url;
    if (updates.model !== undefined) dbUpdates.model = updates.model;
    if (updates.api_key_encrypted !== undefined) dbUpdates.api_key_encrypted = updates.api_key_encrypted;
    if (updates.usage_tag !== undefined) dbUpdates.usage_tag = updates.usage_tag;
    dbUpdates.updated_at = new Date().toISOString();
    await supabase.from("ai_model_profiles" as any).update(dbUpdates).eq("id", id);
    setProfiles(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, [user]);

  const addProfile = useCallback(async (profile: Omit<ModelProfile, "id" | "is_system">) => {
    if (!user) return;
    const { data } = await supabase.from("ai_model_profiles" as any).insert({
      user_id: user.id,
      name: profile.name,
      description: profile.description,
      base_url: profile.base_url,
      model: profile.model,
      api_key_encrypted: profile.api_key_encrypted,
      usage_tag: profile.usage_tag,
      is_default: profile.is_default,
      is_system: false,
    } as any).select().single();
    if (data) {
      await fetchProfiles();
    }
  }, [user, fetchProfiles]);

  const deleteProfile = useCallback(async (id: string) => {
    if (!user) return;
    await supabase.from("ai_model_profiles" as any).delete().eq("id", id);
    setProfiles(prev => prev.filter(p => p.id !== id));
  }, [user]);

  return { profiles, loading, getDefault, setDefault, updateProfile, addProfile, deleteProfile, refresh: fetchProfiles };
}
