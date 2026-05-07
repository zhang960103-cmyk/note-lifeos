import { useRef, useState } from "react";
import { Upload, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";

// ─── types ────────────────────────────────────────────────────────────────────

interface ImportResult {
  day: number; msg: number; todo: number;
  finance: number; habit: number; wheel: number; energy: number;
  warnings: string[];
}

// ─── helpers ──────────────────────────────────────────────────────────────────

function safeArray<T>(v: unknown): T[] {
  return Array.isArray(v) ? (v as T[]) : [];
}
function toJsonbStr(v: unknown): string {
  if (typeof v === "string") return v;
  return JSON.stringify(safeArray(v));
}
function pickDate(v: unknown): string {
  if (!v) return new Date().toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}

// ─── core importer ────────────────────────────────────────────────────────────

async function importBackup(
  json: Record<string, unknown>,
  userId: string
): Promise<ImportResult> {
  if (!supabase) throw new Error("Supabase 未配置");

  const entries        = safeArray<any>(json.entries);
  const topTodos       = safeArray<any>(json.todos);
  const financeEntries = safeArray<any>(json.financeEntries);
  const habits         = safeArray<any>(json.habits);
  const wheelScores    = safeArray<any>(json.wheelScores);
  const energyLogs     = safeArray<any>(json.energyLogs);

  const counts: ImportResult = {
    day: 0, msg: 0, todo: 0,
    finance: 0, habit: 0, wheel: 0, energy: 0,
    warnings: [],
  };
  const warn = (ctx: string, msg: string) => counts.warnings.push(`[${ctx}] ${msg}`);

  // 确保 profile 存在
  await supabase.from("profiles").upsert({ id: userId }, { onConflict: "id" });

  // 1. day_entries + chat_messages + entry-level todos
  for (const e of entries) {
    const { error: dayErr } = await supabase.from("day_entries").upsert(
      {
        id: e.id, user_id: userId, date: e.date,
        emotion_tags : safeArray(e.emotionTags),
        topic_tags   : safeArray(e.topicTags),
        emotion_score: typeof e.emotionScore === "number" ? e.emotionScore : 5,
        updated_at   : e.updatedAt || new Date().toISOString(),
      },
      { onConflict: "id" }
    );
    if (dayErr) { warn("day_entries", dayErr.message); continue; }
    counts.day++;

    // 先删旧消息再批量插（幂等，可重复导入）
    await supabase.from("chat_messages").delete().eq("entry_id", e.id);
    const msgs = safeArray<any>(e.messages).map((m: any) => ({
      entry_id: e.id, user_id: userId,
      role: m.role, content: m.content,
      timestamp: m.timestamp || new Date().toISOString(),
    }));
    if (msgs.length > 0) {
      const { error: msgErr } = await supabase.from("chat_messages").insert(msgs);
      if (msgErr) warn("chat_messages", msgErr.message);
      else counts.msg += msgs.length;
    }

    for (const t of safeArray<any>(e.todos)) {
      const { error } = await supabase.from("todos")
        .upsert(buildTodoRow(t, userId, e.id, e.date), { onConflict: "id" });
      if (error) warn("todo(entry)", error.message);
      else counts.todo++;
    }
  }

  // 2. 顶层 todos（已存在的跳过，不覆盖）
  for (const t of topTodos) {
    const { error } = await supabase.from("todos").upsert(
      buildTodoRow(t, userId, t.entry_id ?? null, t.sourceDate ?? null),
      { onConflict: "id", ignoreDuplicates: true }
    );
    if (error) warn("todo(top)", error.message);
    else counts.todo++;
  }

  // 3. finance_entries
  for (const f of financeEntries) {
    const { error } = await supabase.from("finance_entries").upsert(
      {
        id: f.id, user_id: userId,
        date    : pickDate(f.date),
        type    : f.type,
        amount  : Number(f.amount),
        category: f.category  ?? "",
        note    : f.note      ?? "",
        created_at: f.createdAt || new Date().toISOString(),
      },
      { onConflict: "id" }
    );
    if (error) warn("finance", error.message);
    else counts.finance++;
  }

  // 4. habits
  for (const h of habits) {
    const { error } = await supabase.from("habits").upsert(
      {
        id: h.id, user_id: userId,
        name       : h.name,
        emoji      : h.emoji       ?? "",
        target_days: safeArray(h.targetDays),
        check_ins  : safeArray(h.checkIns),
        created_at : h.createdAt   || new Date().toISOString(),
      },
      { onConflict: "id" }
    );
    if (error) warn("habit", error.message);
    else counts.habit++;
  }

  // 5. wheel_scores（备份里无顶层 id，用 user_id+date 去重）
  for (const w of wheelScores) {
    const { error } = await supabase.from("wheel_scores").upsert(
      {
        user_id   : userId,
        date      : w.date || new Date().toISOString(),
        scores    : typeof w.scores === "object" ? w.scores : {},
        created_at: w.createdAt || w.date || new Date().toISOString(),
      },
      { onConflict: "user_id,date" }
    );
    if (error) warn("wheel_score", error.message);
    else counts.wheel++;
  }

  // 6. energy_logs
  for (const g of energyLogs) {
    const { error } = await supabase.from("energy_logs").upsert(
      {
        id: g.id, user_id: userId,
        level    : g.level,
        note     : g.note  ?? "",
        timestamp: g.timestamp || new Date().toISOString(),
      },
      { onConflict: "id" }
    );
    if (error) warn("energy_log", error.message);
    else counts.energy++;
  }

  return counts;
}

function buildTodoRow(t: any, userId: string, entryId: string | null, fallbackDate: string | null) {
  return {
    id: t.id, user_id: userId,
    entry_id        : entryId          ?? null,
    text            : t.text,
    status          : t.status         || "todo",
    priority        : t.priority       || "normal",
    due_date        : t.dueDate        ?? null,
    due_time        : t.dueTime        ?? null,
    tags            : safeArray<unknown>(t.tags).map((tag) => String(tag)),
    sub_tasks       : toJsonbStr(t.subTasks),
    recur           : t.recur          || "none",
    recur_days      : Array.isArray(t.recurDays)
      ? t.recurDays
          .map((day: unknown) => Number(day))
          .filter((day: number) => Number.isInteger(day))
      : null,
    reminder_minutes: typeof t.reminderMinutes === "number"
      ? t.reminderMinutes
      : t.reminderMinutes == null
        ? null
        : Number(t.reminderMinutes),
    note            : t.note           ?? null,
    emotion_tag     : t.emotionTag     ?? null,
    source_date     : t.sourceDate     ?? fallbackDate ?? null,
    completed_at    : t.completedAt    ?? null,
    created_at      : t.createdAt      || new Date().toISOString(),
    updated_at      : t.updatedAt      || new Date().toISOString(),
  } satisfies TablesInsert<"todos">;
}

// ─── UI ───────────────────────────────────────────────────────────────────────

type Status = "idle" | "reading" | "importing" | "done" | "error";

export default function DataImport() {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [status,  setStatus]  = useState<Status>("idle");
  const [result,  setResult]  = useState<ImportResult | null>(null);
  const [errMsg,  setErrMsg]  = useState("");

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    setResult(null); setErrMsg("");

    try {
      setStatus("reading");
      const text = await file.text();
      const json = JSON.parse(text) as Record<string, unknown>;

      if (!json.entries && !json.todos && !json.habits) {
        throw new Error("不是有效的 LifeOS 备份（缺少 entries / todos / habits）");
      }

      setStatus("importing");
      const res = await importBackup(json, user.id);
      setResult(res);
      setStatus(res.warnings.length > 0 ? "error" : "done");
    } catch (err: any) {
      setErrMsg(err?.message ?? "未知错误");
      setStatus("error");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const isLoading = status === "reading" || status === "importing";
  const label =
    status === "reading"   ? "读取文件…" :
    status === "importing" ? "正在导入…" :
    "导入 JSON 备份";

  return (
    <div className="space-y-1">
      <input
        ref={fileRef}
        type="file"
        accept=".json,application/json"
        className="hidden"
        onChange={handleFile}
      />

      <button
        onClick={() => fileRef.current?.click()}
        disabled={isLoading}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-3 transition text-left"
      >
        {isLoading
          ? <Loader2 size={14} className="animate-spin text-muted-foreground" />
          : <Upload size={14} className="text-muted-foreground" />}
        <span className="text-xs text-foreground flex-1">{label}</span>
      </button>

      {status === "done" && result && (
        <div className="mx-4 mb-2 rounded-md bg-green-500/10 border border-green-500/30 p-3 text-xs space-y-1">
          <p className="flex items-center gap-1.5 font-medium text-green-600">
            <CheckCircle size={13} /> 导入成功
          </p>
          <p className="text-muted-foreground">
            日记 {result.day} · 消息 {result.msg} · 待办 {result.todo} ·
            财务 {result.finance} · 习惯 {result.habit} · 能量 {result.energy} · 车轮 {result.wheel}
          </p>
        </div>
      )}

      {status === "error" && result && (
        <div className="mx-4 mb-2 rounded-md bg-yellow-500/10 border border-yellow-500/30 p-3 text-xs space-y-1">
          <p className="flex items-center gap-1.5 font-medium text-yellow-600">
            <AlertTriangle size={13} /> 部分成功，{result.warnings.length} 个警告
          </p>
          <p className="text-muted-foreground">
            日记 {result.day} · 消息 {result.msg} · 待办 {result.todo} ·
            财务 {result.finance} · 习惯 {result.habit} · 能量 {result.energy}
          </p>
          <details className="mt-1">
            <summary className="cursor-pointer text-muted-foreground">查看详情</summary>
            <ul className="mt-1 space-y-0.5 font-mono text-[10px] text-destructive">
              {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </details>
        </div>
      )}

      {status === "error" && !result && errMsg && (
        <div className="mx-4 mb-2 rounded-md bg-destructive/10 border border-destructive/30 p-3 text-xs">
          <p className="flex items-center gap-1.5 font-medium text-destructive">
            <AlertTriangle size={13} /> 导入失败
          </p>
          <p className="text-muted-foreground mt-1">{errMsg}</p>
        </div>
      )}
    </div>
  );
}

// ─── Finance CSV Import Component ────────────────────────────────────────────
// Accepts CSV with columns: date, type(income/expense), amount, category, note
// Also accepts Alipay/WeChat Pay bill CSV exports (auto-detected)

export function FinanceCsvImport({ onImported }: { onImported?: (count: number) => void }) {
  const { user } = useAuth();
  const csvRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [count, setCount] = useState(0);
  const [errMsg, setErrMsg] = useState("");

  const detectAlipay = (rows: string[][]): boolean =>
    rows[0]?.some(h => h.includes("支付宝") || h.includes("交易时间") || h.includes("收/支"));

  const detectWechat = (rows: string[][]): boolean =>
    rows[0]?.some(h => h.includes("微信支付") || h.includes("交易类型") || h.includes("金额(元)"));

  const parseAlipay = (rows: string[][]): Array<{ date: string; type: "income" | "expense"; amount: number; category: string; note: string }> => {
    const header = rows.find(r => r.includes("交易时间") || r.includes("收/支"));
    if (!header) return [];
    const dateIdx = header.findIndex(h => h.includes("交易时间") || h.includes("日期"));
    const typeIdx = header.findIndex(h => h.includes("收/支") || h.includes("类型"));
    const amtIdx = header.findIndex(h => h.includes("金额") || h.includes("实际金额"));
    const noteIdx = header.findIndex(h => h.includes("商品说明") || h.includes("备注") || h.includes("交易对方"));
    const catIdx = header.findIndex(h => h.includes("交易分类") || h.includes("类别"));
    const headerRowIdx = rows.indexOf(header);
    return rows.slice(headerRowIdx + 1)
      .filter(r => r.length > 3 && r[typeIdx])
      .map(r => ({
        date: r[dateIdx]?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        type: (r[typeIdx]?.includes("收入") || r[typeIdx]?.includes("收款")) ? "income" : "expense",
        amount: Math.abs(parseFloat(r[amtIdx]?.replace(/[¥,]/g, "") || "0")),
        category: r[catIdx]?.trim() || "其他",
        note: r[noteIdx]?.trim() || "",
      }))
      .filter(r => r.amount > 0);
  };

  const parseWechat = (rows: string[][]): Array<{ date: string; type: "income" | "expense"; amount: number; category: string; note: string }> => {
    const header = rows.find(r => r.some(h => h.includes("交易时间") || h.includes("交易类型")));
    if (!header) return [];
    const dateIdx = header.findIndex(h => h.includes("交易时间"));
    const typeIdx = header.findIndex(h => h.includes("收/支"));
    const amtIdx = header.findIndex(h => h.includes("金额"));
    const noteIdx = header.findIndex(h => h.includes("商品") || h.includes("备注"));
    const headerRowIdx = rows.indexOf(header);
    return rows.slice(headerRowIdx + 1)
      .filter(r => r.length > 3 && r[typeIdx])
      .map(r => ({
        date: r[dateIdx]?.slice(0, 10) || new Date().toISOString().slice(0, 10),
        type: r[typeIdx]?.includes("收入") ? "income" : "expense",
        amount: Math.abs(parseFloat(r[amtIdx]?.replace(/[¥,]/g, "") || "0")),
        category: "其他",
        note: r[noteIdx]?.trim() || "",
      }))
      .filter(r => r.amount > 0);
  };

  const parseGeneric = (rows: string[][]): Array<{ date: string; type: "income" | "expense"; amount: number; category: string; note: string }> => {
    const header = rows[0] || [];
    const dateIdx = header.findIndex(h => /date|日期|时间/i.test(h));
    const typeIdx = header.findIndex(h => /type|类型|收支|income|expense/i.test(h));
    const amtIdx = header.findIndex(h => /amount|金额|数额/i.test(h));
    const catIdx = header.findIndex(h => /category|分类|类别/i.test(h));
    const noteIdx = header.findIndex(h => /note|备注|说明|remark/i.test(h));
    if (amtIdx === -1) return [];
    return rows.slice(1)
      .filter(r => r.length > 1)
      .map(r => {
        const rawType = r[typeIdx]?.toLowerCase() || "";
        const isIncome = rawType.includes("income") || rawType.includes("收入") || rawType.includes("in");
        return {
          date: r[dateIdx]?.slice(0, 10) || new Date().toISOString().slice(0, 10),
          type: (isIncome ? "income" : "expense") as "income" | "expense",
          amount: Math.abs(parseFloat(r[amtIdx]?.replace(/[¥$,]/g, "") || "0")),
          category: r[catIdx]?.trim() || "其他",
          note: r[noteIdx]?.trim() || "",
        };
      })
      .filter(r => r.amount > 0);
  };

  const handleCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user || !supabase) return;
    setStatus("loading"); setErrMsg(""); setCount(0);

    try {
      // Try UTF-8 first, then GBK for Alipay/WeChat exports
      let text = await file.text();
      if (text.includes("â€") || text.charCodeAt(0) > 200) {
        const buf = await file.arrayBuffer();
        text = new TextDecoder("gbk").decode(buf);
      }

      // Parse CSV (handle quoted fields)
      const rows: string[][] = text.trim().split(/\r?\n/).map(line => {
        const result: string[] = [];
        let cur = ""; let inQ = false;
        for (const ch of line) {
          if (ch === '"') { inQ = !inQ; }
          else if (ch === ',' && !inQ) { result.push(cur.trim()); cur = ""; }
          else { cur += ch; }
        }
        result.push(cur.trim());
        return result;
      }).filter(r => r.some(c => c.trim()));

      // Auto-detect format
      let records: Array<{ date: string; type: "income" | "expense"; amount: number; category: string; note: string }>;
      if (detectAlipay(rows)) records = parseAlipay(rows);
      else if (detectWechat(rows)) records = parseWechat(rows);
      else records = parseGeneric(rows);

      if (records.length === 0) throw new Error("未能识别CSV格式，请确认有date/amount/type列，或使用支付宝/微信账单格式");

      // Batch insert to Supabase
      const toInsert = records.map(r => ({
        user_id: user.id,
        date: r.date,
        type: r.type,
        amount: r.amount,
        category: r.category || "其他",
        note: r.note || "",
        created_at: new Date().toISOString(),
      }));

      const BATCH = 50;
      let imported = 0;
      for (let i = 0; i < toInsert.length; i += BATCH) {
        const { error } = await supabase.from("finance_entries").insert(toInsert.slice(i, i + BATCH));
        if (!error) imported += Math.min(BATCH, toInsert.length - i);
      }

      setCount(imported);
      setStatus("done");
      onImported?.(imported);
    } catch (err: any) {
      setErrMsg(err?.message ?? "解析失败");
      setStatus("error");
    } finally {
      if (csvRef.current) csvRef.current.value = "";
    }
  };

  return (
    <div className="space-y-1">
      <input ref={csvRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleCsv} />
      <button
        onClick={() => csvRef.current?.click()}
        disabled={status === "loading"}
        className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-3 transition text-left"
      >
        {status === "loading"
          ? <Loader2 size={14} className="animate-spin text-muted-foreground" />
          : <Upload size={14} className="text-muted-foreground" />}
        <div className="flex-1">
          <span className="text-xs text-foreground block">
            {status === "loading" ? "导入中…" : "导入账单 CSV"}
          </span>
          <span className="text-[9px] text-muted-foreground">支持支付宝/微信账单/自定义格式</span>
        </div>
      </button>
      {status === "done" && (
        <div className="mx-4 mb-2 rounded-md bg-green-500/10 border border-green-500/30 p-3 text-xs">
          <p className="text-green-600 flex items-center gap-1.5"><CheckCircle size={13} /> 成功导入 {count} 条账单</p>
        </div>
      )}
      {status === "error" && (
        <div className="mx-4 mb-2 rounded-md bg-destructive/10 border border-destructive/30 p-3 text-xs">
          <p className="text-destructive"><AlertTriangle size={13} className="inline mr-1" />{errMsg}</p>
        </div>
      )}
    </div>
  );
}
