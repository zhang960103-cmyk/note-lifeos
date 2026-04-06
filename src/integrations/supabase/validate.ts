/**
 * Supabase 连接验证和诊断
 */

import { supabase } from "./client";

export interface SupabaseHealth {
  isConnected: boolean;
  apiUrl: string;
  hasValidKey: boolean;
  lastChecked: Date;
  errors: string[];
}

export async function checkSupabaseHealth(): Promise<SupabaseHealth> {
  const health: SupabaseHealth = {
    isConnected: false,
    apiUrl: import.meta.env.VITE_SUPABASE_URL || "unknown",
    hasValidKey: !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    lastChecked: new Date(),
    errors: [],
  };

  try {
    const { error } = await supabase.auth.getUser();
    if (error && error.message !== "Auth session missing!") {
      health.errors.push(`Auth check failed: ${error.message}`);
    }
    health.isConnected = true;
  } catch (err) {
    health.errors.push(`Connection error: ${err instanceof Error ? err.message : String(err)}`);
  }

  return health;
}

export async function initSupabaseHealth(): Promise<void> {
  try {
    const health = await checkSupabaseHealth();
    console.log("🔍 Supabase Health Check:", {
      connected: health.isConnected,
      url: health.apiUrl,
      validKey: health.hasValidKey,
    });
    if (health.errors.length > 0) {
      console.warn("⚠️ Supabase warnings:", health.errors);
    }
    if (!health.isConnected) {
      console.error("❌ Failed to connect to Supabase. Some features may not work correctly.");
    }
  } catch (err) {
    console.error("Supabase health check failed:", err);
  }
}
