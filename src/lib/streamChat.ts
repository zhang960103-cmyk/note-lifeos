export type ChatMsg = { 
  role: "user" | "assistant"; 
  content: string; 
  timestamp?: string;
};

export type ChatMode =
  | "default"
  | "weekly-review"
  | "monthly-review"
  | "extract"
  | "parse-todo"
  | "wheel-eval"
  | "wheel-inference"
  | "wheel-insight"
  | "time-analysis"
  | "time-extract"
  | "decompose";

export interface ExtractResult {
  emotionTags: string[];
  topicTags: string[];
  todos: Array<{
    text: string;
    priority?: string;
    dueDate?: string;
    tags?: string[];
    category?: string;
  }>;
  completedTodoIds: string[];
  emotionScore: number;
  financeHints: Array<{
    type: "income" | "expense";
    amount: number;
    category: string;
    note: string;
  }>;
  goalHints?: Array<{ krText: string; todoText: string }>;
}

// ════════════════════════════════════════
// Configuration Constants
// ════════════════════════════════════════
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/life-mentor-chat`;
const SUPABASE_PUBLISHABLE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
const DEFAULT_MAX_RETRIES = 1;
// BUG-01：QA 实测发现新会话/edge function 冷启动时 extractMeta 经常在 12s 内
// 收不到响应而触发 AbortError。原逻辑把这类超时错误当成"不可重试"直接判失败
// （isRetryableError 只认 StreamChatError/TypeError，不认 DOMException AbortError），
// 且失败后又把异常吞掉、悄悄返回空结果——两个问题叠加导致待办/财务经常抽取不到。
// 这里把超时窗口放宽到 20s，同时在下面让"超时触发的 abort"显式可重试。
const DEFAULT_TIMEOUT_MS = 20000;
const INITIAL_RETRY_DELAY_MS = 1000;
const CURRENT_PROJECT_REF = (() => {
  try {
    const host = new URL(import.meta.env.VITE_SUPABASE_URL).hostname;
    return host.split(".")[0] || null;
  } catch {
    return null;
  }
})();

// ════════════════════════════════════════
// Error Handling
// ════════════════════════════════════════

class StreamChatError extends Error {
  constructor(
    public code: string,
    message: string,
    public status?: number,
    public isRetryable?: boolean
  ) {
    super(message);
    this.name = "StreamChatError";
  }
}

function isPlainRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === "object" && !Array.isArray(v);
}

// BUG-01 输入校验：AI 抽取结果不可信任，逐条校验后再允许落库（待办/财务）。
// 结构不完整或数值不合理的条目直接丢弃，而不是"尽量兜底塞进去"——
// 宁可少记一条，也不能凭空产生一条金额是 NaN/负数、或空文本的待办/流水。
function isValidTodoHint(t: unknown): t is { text: string; priority?: string; dueDate?: string; tags?: string[]; category?: string } {
  return isPlainRecord(t) && typeof t.text === "string" && t.text.trim().length > 0;
}

function isValidFinanceHint(h: unknown): h is { type: "income" | "expense"; amount: number; category: string; note: string } {
  if (!isPlainRecord(h)) return false;
  if (h.type !== "income" && h.type !== "expense") return false;
  if (typeof h.amount !== "number" || !Number.isFinite(h.amount) || h.amount <= 0) return false;
  if (typeof h.category !== "string" || !h.category.trim()) return false;
  return true;
}

function validateExtractResult(data: unknown): ExtractResult {
  const defaults: ExtractResult = {
    emotionTags: [],
    topicTags: [],
    todos: [],
    completedTodoIds: [],
    emotionScore: 5,
    financeHints: [],
    goalHints: [],
  };

  if (!data || typeof data !== "object") {
    console.warn("Invalid extract result, using defaults:", data);
    return defaults;
  }

  const obj = data as Record<string, unknown>;

  try {
    const droppedTodos = Array.isArray(obj.todos) ? obj.todos.filter(t => !isValidTodoHint(t)) : [];
    const droppedFinance = Array.isArray(obj.financeHints) ? obj.financeHints.filter(h => !isValidFinanceHint(h)) : [];
    if (droppedTodos.length || droppedFinance.length) {
      console.warn("[extractMeta] 丢弃了不合法的抽取条目（缺字段/金额非法等），不会落库:", { droppedTodos, droppedFinance });
    }

    return {
      emotionTags: Array.isArray(obj.emotionTags)
        ? obj.emotionTags.filter(t => typeof t === 'string')
        : [],
      topicTags: Array.isArray(obj.topicTags)
        ? obj.topicTags.filter(t => typeof t === 'string')
        : [],
      todos: Array.isArray(obj.todos) ? obj.todos.filter(isValidTodoHint) : [],
      completedTodoIds: Array.isArray(obj.completedTodoIds)
        ? obj.completedTodoIds.filter(id => typeof id === 'string')
        : [],
      emotionScore: typeof obj.emotionScore === "number"
        ? Math.max(0, Math.min(10, obj.emotionScore))
        : 5,
      financeHints: Array.isArray(obj.financeHints)
        ? obj.financeHints.filter(isValidFinanceHint)
        : [],
      goalHints: Array.isArray(obj.goalHints) ? obj.goalHints : [],
    };
  } catch (e) {
    console.error("Error validating extract result:", e);
    return defaults;
  }
}

function validateEnvironment(): void {
  const required = ["VITE_SUPABASE_URL", "VITE_SUPABASE_PUBLISHABLE_KEY"];
  const missing = required.filter(key => !import.meta.env[key]);
  if (missing.length > 0) {
    throw new StreamChatError("ENV_MISSING", `Missing: ${missing.join(", ")}`, undefined, false);
  }
}

function isRetryableError(error: unknown): boolean {
  if (error instanceof StreamChatError) return error.isRetryable ?? false;
  if (error instanceof TypeError) return true; // network errors
  return false;
}

function getRetryDelay(attempt: number): number {
  return INITIAL_RETRY_DELAY_MS * Math.pow(2, attempt);
}

function isTokenForCurrentProject(token?: string): boolean {
  if (!token || !CURRENT_PROJECT_REF) return false;
  const parts = token.split(".");
  if (parts.length !== 3) return false;

  try {
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const payload = JSON.parse(atob(padded)) as { ref?: string };
    return payload.ref === CURRENT_PROJECT_REF;
  } catch {
    return false;
  }
}

function getPreferredAuthToken(authToken?: string): string {
  return isTokenForCurrentProject(authToken) ? authToken! : SUPABASE_PUBLISHABLE_KEY;
}

function buildFunctionHeaders(authToken?: string): HeadersInit {
  const token = getPreferredAuthToken(authToken);
  return {
    "Content-Type": "application/json",
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${token}`,
  };
}

// ════════════════════════════════════════
// Core Stream Chat Function
// ════════════════════════════════════════

export async function streamChat({
  messages,
  mode = "default",
  memoryContext,
  patterns,
  onDelta,
  onDone,
  onRetry,
  signal,
  modelProfileId,
  accessToken,
  maxRetries = DEFAULT_MAX_RETRIES,
  timeoutMs = DEFAULT_TIMEOUT_MS,
}: {
  messages: ChatMsg[];
  mode?: ChatMode;
  memoryContext?: string;
  patterns?: string;
  onDelta: (text: string) => void;
  onDone: () => void;
  // 重试前调用：调用方在这里把自己accumulate的文本(通常是 let full = "")清零，
  // 否则第二次尝试的新增量会被追加到第一次失败尝试已经写入的残留文本后面，
  // 造成保存内容重复/错乱。见 streamChat 内部注释。
  onRetry?: () => void;
  signal?: AbortSignal;
  modelProfileId?: string;
  accessToken?: string;
  maxRetries?: number;
  timeoutMs?: number;
}): Promise<void> {
  validateEnvironment();

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const timeoutController = new AbortController();
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    try {
      timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

      // iOS Safari 17.3 以下不支持 AbortSignal.any()，改为手动转发
      if (signal) {
        signal.addEventListener("abort", () => timeoutController.abort(), { once: true });
      }
      const mergedSignal = timeoutController.signal;

      const authToken = getPreferredAuthToken(accessToken);

      let resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: buildFunctionHeaders(authToken),
        body: JSON.stringify({ messages, mode, memoryContext, patterns, modelProfileId, version: "4.1" }),
        signal: mergedSignal,
      });

      if (resp.status === 401 && authToken !== SUPABASE_PUBLISHABLE_KEY) {
        resp = await fetch(CHAT_URL, {
          method: "POST",
          headers: buildFunctionHeaders(),
          body: JSON.stringify({ messages, mode, memoryContext, patterns, modelProfileId, version: "4.1" }),
          signal: mergedSignal,
        });
      }

      clearTimeout(timeoutId);

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        const errorMsg = errorData.error || `HTTP ${resp.status}: ${resp.statusText}`;
        throw new StreamChatError(
          `HTTP_${resp.status}`, errorMsg, resp.status,
          resp.status >= 500 || resp.status === 429 || resp.status === 408
        );
      }

      if (!resp.body) {
        throw new StreamChatError("NO_RESPONSE_BODY", "Response body is empty", resp.status, false);
      }

      await processStream(resp.body, onDelta);
      onDone();
      return;
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err as Error;

      const shouldRetry = attempt < maxRetries && isRetryableError(err);
      if (shouldRetry) {
        const delayMs = getRetryDelay(attempt);
        console.warn(`[streamChat] Attempt ${attempt + 1}/${maxRetries + 1} failed, retrying in ${delayMs}ms:`, lastError.message);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        // 上一次尝试可能已经通过 onDelta 写入了部分文本（比如流到一半网络断了）。
        // 在下一次 fetch 发出之前通知调用方清空累积buffer，避免新一轮的增量
        // 被追加到旧的残留内容后面，导致保存的内容重复/错乱。
        onRetry?.();
      } else {
        console.error(`[streamChat] Failed after ${attempt + 1} attempt(s):`, lastError);
        onDone();
        throw lastError;
      }
    }
  }

  onDone();
  throw lastError || new StreamChatError("UNKNOWN", "Stream failed after all retries", undefined, false);
}

// ════════════════════════════════════════
// Stream Processing
// ════════════════════════════════════════

async function processStream(
  body: ReadableStream<Uint8Array>,
  onDelta: (text: string) => void
): Promise<void> {
  const reader = body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let idx: number;
      while ((idx = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 1);
        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || !line.trim()) continue;

        if (line.startsWith("data: ")) {
          const data = line.slice(6);
          if (data === "[DONE]") return;

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.text || "";
            if (content) onDelta(content);
          } catch {
            console.warn("[processStream] Failed to parse JSON:", data);
          }
        }
      }
    }

    if (buffer.trim() && buffer.startsWith("data: ")) {
      const data = buffer.slice(6);
      if (data !== "[DONE]") {
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.text || "";
          if (content) onDelta(content);
        } catch {}
      }
    }
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new StreamChatError("STREAM_ABORTED", "Stream was aborted", undefined, true);
    }
    throw err;
  } finally {
    reader.releaseLock();
  }
}

// ════════════════════════════════════════
// Extract Meta Function
// ════════════════════════════════════════

// BUG-01 根因（三处叠加）：
// 1) 超时通过内部 timeoutController.abort() 触发的是原生 DOMException("AbortError")，
//    既不是 StreamChatError 也不是 TypeError，isRetryableError() 对它一律返回 false——
//    也就是说"12s 收不到响应"这条 QA 复现路径实际上从未真正重试过，第一次超时就直接判死。
// 2) 重试耗尽或不可重试时，旧代码 return validateExtractResult(null)——用一个"看起来正常"
//    的空结果 resolve，调用方 .then() 照样执行、只是 todos/financeHints 全是空数组，
//    .catch() 分支（驱动"自动记录未完成，点此重试"提示条）永远不会被触发。
// 3) 没有 signal 参数，调用方（HomePage）无法在页面卸载/用户主动停止生成时真正取消这次
//    请求；卸载后 promise 迟迟才 resolve/reject，容易在已卸载组件上触发状态更新。
// 三处一并修复：外部 signal 可取消且能与"超时"区分；超时 abort 显式可重试；
// 重试耗尽后一律 throw，不再返回伪装成功的空结果。
export async function extractMeta(
  messages: ChatMsg[],
  existingTodos?: Array<{ id: string; text: string; status: string; priority: string }>,
  accessToken?: string,
  signal?: AbortSignal
): Promise<ExtractResult> {
  validateEnvironment();

  if (signal?.aborted) {
    throw new StreamChatError("EXTRACT_CANCELLED", "提取已取消", undefined, false);
  }

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= DEFAULT_MAX_RETRIES; attempt++) {
    const timeoutController = new AbortController();
    let timedOut = false;
    let externallyCancelled = false;
    const timeoutId = setTimeout(() => { timedOut = true; timeoutController.abort(); }, DEFAULT_TIMEOUT_MS);
    // iOS Safari 17.3 以下不支持 AbortSignal.any()，手动转发外部取消信号。
    const onExternalAbort = () => { externallyCancelled = true; timeoutController.abort(); };
    signal?.addEventListener("abort", onExternalAbort, { once: true });

    try {
      const authToken = getPreferredAuthToken(accessToken);

      let resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: buildFunctionHeaders(authToken),
        body: JSON.stringify({ messages, mode: "extract", existingTodos, version: "4.1" }),
        signal: timeoutController.signal,
      });

      if (resp.status === 401 && authToken !== SUPABASE_PUBLISHABLE_KEY) {
        resp = await fetch(CHAT_URL, {
          method: "POST",
          headers: buildFunctionHeaders(),
          body: JSON.stringify({ messages, mode: "extract", existingTodos, version: "4.1" }),
          signal: timeoutController.signal,
        });
      }

      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", onExternalAbort);

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new StreamChatError(
          `HTTP_${resp.status}`, errorData.error || `HTTP ${resp.status}`,
          resp.status, resp.status >= 500 || resp.status === 429
        );
      }

      let data: unknown;
      try {
        data = await resp.json();
      } catch (parseErr) {
        // 解析失败与网络/超时失败是两类不同问题：AI 这次生成的 JSON 本身就是坏的，
        // 但换一次生成很可能就是好的，所以仍然标记为可重试，而不是直接判定失败。
        throw new StreamChatError("EXTRACT_PARSE_ERROR", "AI 返回的数据无法解析", resp.status, true);
      }
      return validateExtractResult(data);
    } catch (err) {
      clearTimeout(timeoutId);
      signal?.removeEventListener("abort", onExternalAbort);
      lastError = err as Error;

      const isAbort = err instanceof DOMException && err.name === "AbortError";

      if (isAbort && externallyCancelled) {
        // 用户主动取消 / 组件已卸载：这不是"提取失败"，不重试、不进入失败分支，
        // 直接抛出可辨识的错误，调用方据此决定不再显示"记录未完成"提示。
        throw new StreamChatError("EXTRACT_CANCELLED", "提取已取消", undefined, false);
      }

      const retryable = isAbort && timedOut ? true : isRetryableError(err);

      if (attempt < DEFAULT_MAX_RETRIES && retryable) {
        const delayMs = getRetryDelay(attempt);
        console.warn(`[extractMeta] Attempt ${attempt + 1} failed (${isAbort ? "timeout" : (err as StreamChatError)?.code || "error"}), retrying in ${delayMs}ms:`, lastError.message);
        await new Promise(resolve => setTimeout(resolve, delayMs));
        if (signal?.aborted) {
          throw new StreamChatError("EXTRACT_CANCELLED", "提取已取消", undefined, false);
        }
      } else {
        // 重试耗尽后必须把错误往外抛，让调用方能区分"AI 判断这段话没什么可提取的
        // （resolve 一个空结果）"和"这次提取请求彻底失败了（reject）"。绝不能在这里
        // 用 validateExtractResult(null) 伪装成功，否则待办/财务永远不会真正落库，
        // 而界面上写好的重试提示条也永远不会被触发。
        console.error("[extractMeta] Failed after retries:", lastError);
        throw lastError;
      }
    }
  }

  throw lastError ?? new StreamChatError("EXTRACT_UNKNOWN", "extractMeta failed", undefined, false);
}

// ════════════════════════════════════════
// Generic JSON Call (non-streaming modes)
// ════════════════════════════════════════
// Some edge-function modes (wheel-inference, wheel-insight, time-extract,
// time-analysis, decompose, ...) return one JSON object, not an SSE stream.
// streamChat()'s processStream() only understands "data: ..." SSE framing,
// so these modes must NOT be routed through streamChat() — doing so would
// silently produce empty output. This helper reuses the same auth-token
// fallback, retry and timeout logic without the SSE parsing.
export async function callLifeMentorJSON<T = any>(
  mode: ChatMode | string,
  messages: ChatMsg[],
  extra?: Record<string, unknown>,
  accessToken?: string,
  timeoutMs: number = DEFAULT_TIMEOUT_MS
): Promise<T> {
  validateEnvironment();

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= DEFAULT_MAX_RETRIES; attempt++) {
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), timeoutMs);

    try {
      const authToken = getPreferredAuthToken(accessToken);

      let resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: buildFunctionHeaders(authToken),
        body: JSON.stringify({ messages, mode, ...extra, version: "4.1" }),
        signal: timeoutController.signal,
      });

      if (resp.status === 401 && authToken !== SUPABASE_PUBLISHABLE_KEY) {
        resp = await fetch(CHAT_URL, {
          method: "POST",
          headers: buildFunctionHeaders(),
          body: JSON.stringify({ messages, mode, ...extra, version: "4.1" }),
          signal: timeoutController.signal,
        });
      }

      clearTimeout(timeoutId);

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new StreamChatError(
          `HTTP_${resp.status}`, errorData.error || `HTTP ${resp.status}`,
          resp.status, resp.status >= 500 || resp.status === 429
        );
      }

      return await resp.json();
    } catch (err) {
      clearTimeout(timeoutId);
      lastError = err as Error;

      if (attempt < DEFAULT_MAX_RETRIES && isRetryableError(err)) {
        const delayMs = getRetryDelay(attempt);
        console.warn(`[callLifeMentorJSON:${mode}] Attempt ${attempt + 1} failed, retrying in ${delayMs}ms:`, lastError.message);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        console.error(`[callLifeMentorJSON:${mode}] Failed:`, lastError);
        throw lastError;
      }
    }
  }

  throw lastError || new StreamChatError("UNKNOWN", "Request failed after all retries", undefined, false);
}

export async function parseTodoNL(text: string): Promise<any> {
  try {
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), DEFAULT_TIMEOUT_MS);

    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: buildFunctionHeaders(),
      body: JSON.stringify({ messages: [{ role: "user", content: text }], mode: "parse-todo" }),
      signal: timeoutController.signal,
    });

    clearTimeout(timeoutId);
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}

export { StreamChatError };
