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
  | "time-analysis" 
  | "time-extract";

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
const DEFAULT_MAX_RETRIES = 2;
const DEFAULT_TIMEOUT_MS = 30000;
const INITIAL_RETRY_DELAY_MS = 1000;

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
    return {
      emotionTags: Array.isArray(obj.emotionTags) 
        ? obj.emotionTags.filter(t => typeof t === 'string')
        : [],
      topicTags: Array.isArray(obj.topicTags) 
        ? obj.topicTags.filter(t => typeof t === 'string')
        : [],
      todos: Array.isArray(obj.todos) ? obj.todos : [],
      completedTodoIds: Array.isArray(obj.completedTodoIds) 
        ? obj.completedTodoIds.filter(id => typeof id === 'string')
        : [],
      emotionScore: typeof obj.emotionScore === "number" 
        ? Math.max(0, Math.min(10, obj.emotionScore))
        : 5,
      financeHints: Array.isArray(obj.financeHints) 
        ? obj.financeHints.filter(h => 
            h && typeof h === 'object' && 
            ('type' in h) && ('amount' in h) && ('category' in h)
          )
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

      const authToken = accessToken || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ messages, mode, memoryContext, patterns, modelProfileId, version: "4.1" }),
        signal: mergedSignal,
      });

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

export async function extractMeta(
  messages: ChatMsg[],
  existingTodos?: Array<{ id: string; text: string; status: string; priority: string }>,
  accessToken?: string
): Promise<ExtractResult> {
  validateEnvironment();

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= DEFAULT_MAX_RETRIES; attempt++) {
    try {
      const timeoutController = new AbortController();
      const timeoutId = setTimeout(() => timeoutController.abort(), DEFAULT_TIMEOUT_MS);

      const authToken = accessToken || import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${authToken}`,
        },
        body: JSON.stringify({ messages, mode: "extract", existingTodos, version: "4.1" }),
        signal: timeoutController.signal,
      });

      clearTimeout(timeoutId);

      if (!resp.ok) {
        const errorData = await resp.json().catch(() => ({}));
        throw new StreamChatError(
          `HTTP_${resp.status}`, errorData.error || `HTTP ${resp.status}`,
          resp.status, resp.status >= 500 || resp.status === 429
        );
      }

      const data = await resp.json();
      return validateExtractResult(data);
    } catch (err) {
      lastError = err as Error;

      if (attempt < DEFAULT_MAX_RETRIES && isRetryableError(err)) {
        const delayMs = getRetryDelay(attempt);
        console.warn(`[extractMeta] Attempt ${attempt + 1} failed, retrying in ${delayMs}ms:`, lastError.message);
        await new Promise(resolve => setTimeout(resolve, delayMs));
      } else {
        console.error("[extractMeta] Failed:", lastError);
        return validateExtractResult(null);
      }
    }
  }

  return validateExtractResult(null);
}

export async function parseTodoNL(text: string): Promise<any> {
  try {
    const timeoutController = new AbortController();
    const timeoutId = setTimeout(() => timeoutController.abort(), DEFAULT_TIMEOUT_MS);

    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
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
