import { useRef, useState } from "react";
import { Upload, Loader2, CheckCircle, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { TablesInsert } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useLanguage } from "@/contexts/LanguageContext";

// importBackup() runs outside any component, so it can't call the useLanguage()
// hook directly — it takes a `t` function passed in from the caller instead.
type TFunc = (key: string, params?: Record<string, string | number>) => string;

// ─── types ────────────────────────────────────────────────────────────────────

interface ImportResult {
  day: number; msg: number; todo: number;
  finance: number; habit: number; wheel: number; energy: number;
  localExtras: number;
  warnings: string[];
}

// 这个数字要跟 DataExport.tsx 里的 BACKUP_SCHEMA_VERSION 保持同步。
// 只要以后新增字段都用"缺了就按默认值处理"的兼容写法，就不需要每次升级都改这里；
// 只有备份整体结构发生不兼容变化时才升级判断逻辑。当前能安全处理 1(旧版，没有
// schemaVersion字段，按1对待) 和 2。遇到更高版本号，说明是用更新的App导出的
// 备份、格式可能已经变了，这里选择继续尝试导入但提醒用户——比直接拒绝更实用，
// 大部分字段增量都是新增可选字段，不会真的读不懂。
const MAX_KNOWN_SCHEMA_VERSION = 2;

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
  userId: string,
  t: TFunc
): Promise<ImportResult> {
  if (!supabase) throw new Error(t("data_import.error.supabase_not_configured"));

  const entries        = safeArray<any>(json.entries);
  const topTodos       = safeArray<any>(json.todos);
  const financeEntries = safeArray<any>(json.financeEntries);
  const habits         = safeArray<any>(json.habits);
  const wheelScores    = safeArray<any>(json.wheelScores);
  const energyLogs     = safeArray<any>(json.energyLogs);

  const counts: ImportResult = {
    day: 0, msg: 0, todo: 0,
    finance: 0, habit: 0, wheel: 0, energy: 0,
    localExtras: 0,
    warnings: [],
  };
  const warn = (ctx: string, msg: string) => counts.warnings.push(`[${ctx}] ${msg}`);

  // 旧版本备份没有 schemaVersion 字段，按 1 对待（DataExport.tsx 里的字段结构
  // 从一开始就是"缺了按默认值处理"的宽松写法，所以版本1也能正常读，不阻断导入）
  const schemaVersion = typeof json.schemaVersion === "number" ? json.schemaVersion : 1;
  if (schemaVersion > MAX_KNOWN_SCHEMA_VERSION) {
    warn("version", t("data_import.warning.version_newer", { version: schemaVersion, maxVersion: MAX_KNOWN_SCHEMA_VERSION }));
  }

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

  // 7. localExtras（预算/订阅/借还/项目——只存在本地，schemaVersion>=2的备份才有）
  // 保守策略：只在当前设备这个key还没有数据时才写入，绝不覆盖用户在本设备上
  // 已经有的本地数据——避免"导入一份几个月前的旧备份，把这几天新记的预算/
  // 订阅覆盖没了"。key里的userId会重写成当前导入账号的id，即使备份来自
  // 另一个账号也能正确落到"当前登录账号"名下，不会因为id对不上而全部丢弃。
  const localExtras = (json.localExtras && typeof json.localExtras === "object")
    ? json.localExtras as Record<string, string>
    : {};
  const KNOWN_LOCAL_PREFIXES = ["budgets_", "subscriptions_", "ious_", "projects_"];
  for (const [rawKey, rawVal] of Object.entries(localExtras)) {
    const prefix = KNOWN_LOCAL_PREFIXES.find(p => rawKey.startsWith(p));
    if (!prefix || typeof rawVal !== "string") continue;
    const targetKey = `${prefix}${userId}`;
    try {
      const existing = localStorage.getItem(targetKey);
      const existingEmpty = !existing || existing === "[]" || existing === "null";
      if (existingEmpty) {
        localStorage.setItem(targetKey, rawVal);
        counts.localExtras++;
      } else {
        warn("local_extras", t("data_import.warning.local_extras_skip", { prefix }));
      }
    } catch (e: any) {
      warn("local_extras", e?.message || t("data_import.error.local_write_failed"));
    }
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
  const { t } = useLanguage();
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
        throw new Error(t("data_import.error.invalid_backup"));
      }

      setStatus("importing");
      const res = await importBackup(json, user.id, t);
      setResult(res);
      setStatus(res.warnings.length > 0 ? "error" : "done");
    } catch (err: any) {
      setErrMsg(err?.message ?? t("data_import.error.unknown"));
      setStatus("error");
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const isLoading = status === "reading" || status === "importing";
  const label =
    status === "reading"   ? t("data_import.button.reading") :
    status === "importing" ? t("data_import.button.importing") :
    t("data_import.button.select_file");

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
            <CheckCircle size={13} /> {t("data_import.success")}
          </p>
          <p className="text-muted-foreground">
            {t("data_import.summary", {
              day: result.day, msg: result.msg, todo: result.todo,
              finance: result.finance, habit: result.habit, energy: result.energy, wheel: result.wheel,
            })}
            {result.localExtras > 0 && ` · ${t("data_import.summary.local_extras_suffix", { count: result.localExtras })}`}
          </p>
        </div>
      )}

      {status === "error" && result && (
        <div className="mx-4 mb-2 rounded-md bg-yellow-500/10 border border-yellow-500/30 p-3 text-xs space-y-1">
          <p className="flex items-center gap-1.5 font-medium text-yellow-600">
            <AlertTriangle size={13} /> {t("data_import.partial_success", { count: result.warnings.length })}
          </p>
          <p className="text-muted-foreground">
            {t("data_import.summary_partial", {
              day: result.day, msg: result.msg, todo: result.todo,
              finance: result.finance, habit: result.habit, energy: result.energy,
            })}
          </p>
          <details className="mt-1">
            <summary className="cursor-pointer text-muted-foreground">{t("data_import.view_details")}</summary>
            <ul className="mt-1 space-y-0.5 font-mono text-[10px] text-destructive">
              {result.warnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </details>
        </div>
      )}

      {status === "error" && !result && errMsg && (
        <div className="mx-4 mb-2 rounded-md bg-destructive/10 border border-destructive/30 p-3 text-xs">
          <p className="flex items-center gap-1.5 font-medium text-destructive">
            <AlertTriangle size={13} /> {t("data_import.fail")}
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
  const { t } = useLanguage();
  const csvRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [count, setCount] = useState(0);
  const [failCount, setFailCount] = useState(0);
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
    setStatus("loading"); setErrMsg(""); setCount(0); setFailCount(0);

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

      if (records.length === 0) throw new Error(t("data_import.error.csv_format_unrecognized"));

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
      let failed = 0;
      // 之前一批(50条)插入失败时，这批的行数就直接从计数里消失了，没有任何提示——
      // 用户以为"导入了80条"，其实实际到手的可能只有50条，另外30条静默丢了。
      // 现在把失败的行数也记下来，最终结果如实告诉用户"成功X条，失败Y条"。
      for (let i = 0; i < toInsert.length; i += BATCH) {
        const batch = toInsert.slice(i, i + BATCH);
        const { error } = await supabase.from("finance_entries").insert(batch);
        if (!error) imported += batch.length;
        else { failed += batch.length; console.error("[FinanceCsvImport] 批量插入失败:", error); }
      }

      setCount(imported);
      setFailCount(failed);
      setStatus("done");
      onImported?.(imported);
    } catch (err: any) {
      setErrMsg(err?.message ?? t("data_import.error.csv_parse_failed"));
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
            {status === "loading" ? t("data_import.button.csv_importing") : t("data_import.button.select_csv")}
          </span>
          <span className="text-[9px] text-muted-foreground">{t("data_import.csv_hint")}</span>
        </div>
      </button>
      {status === "done" && failCount === 0 && (
        <div className="mx-4 mb-2 rounded-md bg-green-500/10 border border-green-500/30 p-3 text-xs">
          <p className="text-green-600 flex items-center gap-1.5"><CheckCircle size={13} /> {t("data_import.csv_success", { count })}</p>
        </div>
      )}
      {status === "done" && failCount > 0 && (
        <div className="mx-4 mb-2 rounded-md bg-yellow-500/10 border border-yellow-500/30 p-3 text-xs">
          <p className="text-yellow-600 flex items-center gap-1.5"><AlertTriangle size={13} /> {t("data_import.csv_partial", { count, failCount })}</p>
          <p className="text-muted-foreground mt-1">{t("data_import.csv_partial_hint")}</p>
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
