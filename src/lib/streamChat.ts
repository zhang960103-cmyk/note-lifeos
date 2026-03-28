export type ChatMsg = { role: "user" | "assistant"; content: string };
export type ChatMode = "default" | "weekly-review" | "monthly-review" | "extract" | "parse-todo" | "wheel-eval";

const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/life-mentor-chat`;

export async function streamChat({
  messages,
  mode = "default",
  onDelta,
  onDone,
  signal,
}: {
  messages: ChatMsg[];
  mode?: ChatMode;
  onDelta: (text: string) => void;
  onDone: () => void;
  signal?: AbortSignal;
}) {
  const resp = await fetch(CHAT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
    },
    body: JSON.stringify({ messages, mode }),
    signal,
  });

  if (!resp.ok || !resp.body) {
    const errData = await resp.json().catch(() => ({}));
    throw new Error(errData.error || `请求失败 (${resp.status})`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let streamDone = false;

  while (!streamDone) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let idx: number;
    while ((idx = buffer.indexOf("\n")) !== -1) {
      let line = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 1);
      if (line.endsWith("\r")) line = line.slice(0, -1);
      if (line.startsWith(":") || line.trim() === "") continue;
      if (!line.startsWith("data: ")) continue;

      const json = line.slice(6).trim();
      if (json === "[DONE]") { streamDone = true; break; }

      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content as string | undefined;
        if (content) onDelta(content);
      } catch {
        buffer = line + "\n" + buffer;
        break;
      }
    }
  }

  if (buffer.trim()) {
    for (let raw of buffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (!raw.startsWith("data: ")) continue;
      const json = raw.slice(6).trim();
      if (json === "[DONE]") continue;
      try {
        const parsed = JSON.parse(json);
        const content = parsed.choices?.[0]?.delta?.content;
        if (content) onDelta(content);
      } catch {}
    }
  }

  onDone();
}

export async function extractMeta(messages: ChatMsg[], existingTodos?: Array<{ id: string; text: string; status: string; priority: string }>): Promise<{
  emotionTags: string[];
  topicTags: string[];
  todos: Array<{ text: string; priority?: string; dueDate?: string; tags?: string[] }>;
  completedTodoIds: string[];
  emotionScore: number;
  financeHints: Array<{ type: 'income' | 'expense'; amount: number; category: string; note: string }>;
}> {
  try {
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages, mode: "extract", existingTodos }),
    });
    if (!resp.ok) return { emotionTags: [], topicTags: [], todos: [], completedTodoIds: [], emotionScore: 5, financeHints: [] };
    const data = await resp.json();
    return {
      emotionTags: data.emotionTags || [],
      topicTags: data.topicTags || [],
      todos: data.todos || [],
      completedTodoIds: data.completedTodoIds || [],
      emotionScore: data.emotionScore || 5,
      financeHints: data.financeHints || [],
    };
  } catch {
    return { emotionTags: [], topicTags: [], todos: [], completedTodoIds: [], emotionScore: 5, financeHints: [] };
  }
}

export async function parseTodoNL(text: string): Promise<any> {
  try {
    const resp = await fetch(CHAT_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({ messages: [{ role: "user", content: text }], mode: "parse-todo" }),
    });
    if (!resp.ok) return null;
    return await resp.json();
  } catch {
    return null;
  }
}
