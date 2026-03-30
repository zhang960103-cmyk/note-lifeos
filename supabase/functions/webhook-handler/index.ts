import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    // Verify webhook secret
    const webhookSecret = req.headers.get("x-webhook-secret");
    const expectedSecret = Deno.env.get("WEBHOOK_SECRET");
    if (expectedSecret && webhookSecret !== expectedSecret) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Action: add-todo — Add a todo from external service (n8n, Zapier, etc.)
    if (action === "add-todo") {
      const { user_id, text, priority, due_date, tags } = body;
      if (!user_id || !text) {
        return new Response(JSON.stringify({ error: "user_id and text required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await supabase.from("todos").insert({
        user_id,
        text,
        priority: priority || "normal",
        due_date: due_date || null,
        tags: tags || [],
        status: "todo",
        sub_tasks: "[]",
        recur: "none",
      }).select().single();

      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, todo: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: add-finance — Add finance entry
    if (action === "add-finance") {
      const { user_id, type, amount, category, note, date } = body;
      if (!user_id || !type || !amount) {
        return new Response(JSON.stringify({ error: "user_id, type, amount required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await supabase.from("finance_entries").insert({
        user_id,
        type,
        amount,
        category: category || "",
        note: note || "",
        date: date || new Date().toISOString().split("T")[0],
      }).select().single();

      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, entry: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: log-energy — Log energy level
    if (action === "log-energy") {
      const { user_id, level, note } = body;
      if (!user_id || !level) {
        return new Response(JSON.stringify({ error: "user_id and level required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data, error } = await supabase.from("energy_logs").insert({
        user_id,
        level,
        note: note || "",
      }).select().single();

      if (error) throw error;
      return new Response(JSON.stringify({ ok: true, log: data }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Action: get-stats — Get user's stats summary
    if (action === "get-stats") {
      const { user_id } = body;
      if (!user_id) {
        return new Response(JSON.stringify({ error: "user_id required" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const [{ data: todos }, { data: finance }, { data: energy }] = await Promise.all([
        supabase.from("todos").select("status").eq("user_id", user_id),
        supabase.from("finance_entries").select("type, amount").eq("user_id", user_id),
        supabase.from("energy_logs").select("level").eq("user_id", user_id).order("timestamp", { ascending: false }).limit(7),
      ]);

      const todoStats = {
        total: todos?.length || 0,
        done: todos?.filter(t => t.status === "done").length || 0,
        doing: todos?.filter(t => t.status === "doing").length || 0,
      };
      const financeStats = {
        totalIncome: finance?.filter(f => f.type === "income").reduce((s, f) => s + Number(f.amount), 0) || 0,
        totalExpense: finance?.filter(f => f.type === "expense").reduce((s, f) => s + Number(f.amount), 0) || 0,
      };
      const recentEnergy = energy?.map(e => e.level) || [];

      return new Response(JSON.stringify({ ok: true, todoStats, financeStats, recentEnergy }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: `Unknown action: ${action}`, availableActions: ["add-todo", "add-finance", "log-energy", "get-stats"] }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("webhook error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
