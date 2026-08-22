import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { extractMeta, StreamChatError } from "./streamChat";

// BUG-01 回归测试：AI 元数据提取（extractMeta）中止后不再假装成功。
// 覆盖：成功 / 超时重试后成功 / 超时重试耗尽后失败 / 用户主动取消 /
// 响应格式错误（JSON 解析失败）/ 抽取结果里混入非法条目时的过滤。
//
// extractMeta 内部有 20s 超时 + 1s 起跳的指数退避重试，真实跑的话单个失败用例
// 会拖到 20+ 秒。这里用 vi.useFakeTimers() 把 setTimeout（超时 abort 和重试延迟）
// 都换成可手动推进的假时钟，测试可以在几毫秒内跑完，同时还是在验证同一套真实的
// 定时器/重试逻辑，不是绕过它。

function jsonResponse(body: unknown, ok = true, status = 200) {
  return {
    ok,
    status,
    statusText: ok ? "OK" : "Error",
    json: async () => body,
  } as Response;
}

function abortError() {
  return new DOMException("The operation was aborted.", "AbortError");
}

describe("extractMeta", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("成功：一次请求成功即返回校验后的结果", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        emotionTags: ["平静"],
        topicTags: ["工作"],
        todos: [{ text: "买水" }],
        completedTodoIds: [],
        emotionScore: 7,
        financeHints: [{ type: "expense", amount: 12, category: "餐饮", note: "买水" }],
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await extractMeta([{ role: "user", content: "今天花12元买水" }]);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.todos).toEqual([{ text: "买水" }]);
    expect(result.financeHints).toEqual([{ type: "expense", amount: 12, category: "餐饮", note: "买水" }]);
  });

  it("超时后重试一次成功：第一次 abort，第二次正常返回", async () => {
    const fetchMock = vi.fn()
      .mockImplementationOnce((_url, init: RequestInit) => new Promise((_resolve, reject) => {
        (init.signal as AbortSignal).addEventListener("abort", () => reject(abortError()));
      }))
      .mockResolvedValueOnce(jsonResponse({ emotionTags: [], topicTags: [], todos: [], completedTodoIds: [], emotionScore: 5, financeHints: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const promise = extractMeta([{ role: "user", content: "hi" }]);
    // 推进到第一次请求的 20s 超时，触发内部 abort → 应该重试而不是直接判失败
    // （回归 BUG-01 根因之一：原逻辑把 AbortError 当"不可重试"处理）。
    await vi.advanceTimersByTimeAsync(20_000);
    // 重试前有指数退避延迟（1s * 2^0 = 1s）
    await vi.advanceTimersByTimeAsync(1_000);

    const result = await promise;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.todos).toEqual([]);
  });

  it("超时重试耗尽后 throw，不再返回伪装成功的空结果", async () => {
    const fetchMock = vi.fn().mockImplementation((_url, init: RequestInit) => new Promise((_resolve, reject) => {
      (init.signal as AbortSignal).addEventListener("abort", () => reject(abortError()));
    }));
    vi.stubGlobal("fetch", fetchMock);

    const promise = extractMeta([{ role: "user", content: "hi" }]);
    const assertion = expect(promise).rejects.toThrow();

    await vi.advanceTimersByTimeAsync(20_000); // 第一次超时
    await vi.advanceTimersByTimeAsync(1_000);  // 重试退避
    await vi.advanceTimersByTimeAsync(20_000); // 第二次（最后一次）超时

    await assertion;
    // DEFAULT_MAX_RETRIES = 1 → 最多两次尝试
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("用户主动取消：传入已 abort 的 signal，直接抛 EXTRACT_CANCELLED，不发请求", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const controller = new AbortController();
    controller.abort();

    await expect(
      extractMeta([{ role: "user", content: "hi" }], undefined, undefined, controller.signal)
    ).rejects.toMatchObject({ code: "EXTRACT_CANCELLED" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("用户在请求过程中取消（组件卸载）：不重试，抛 EXTRACT_CANCELLED", async () => {
    const fetchMock = vi.fn().mockImplementation((_url, init: RequestInit) => new Promise((_resolve, reject) => {
      (init.signal as AbortSignal).addEventListener("abort", () => reject(abortError()));
    }));
    vi.stubGlobal("fetch", fetchMock);

    const controller = new AbortController();
    const promise = extractMeta([{ role: "user", content: "hi" }], undefined, undefined, controller.signal);
    const assertion = expect(promise).rejects.toMatchObject({ code: "EXTRACT_CANCELLED" });

    controller.abort(); // 模拟组件卸载 / 用户中止

    await assertion;
    // 主动取消不应该触发重试机制
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("响应 JSON 解析失败：按可重试错误处理，重试后成功", async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce({ ok: true, status: 200, statusText: "OK", json: async () => { throw new SyntaxError("Unexpected token"); } } as Response)
      .mockResolvedValueOnce(jsonResponse({ emotionTags: [], topicTags: [], todos: [], completedTodoIds: [], emotionScore: 5, financeHints: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const promise = extractMeta([{ role: "user", content: "hi" }]);
    await vi.advanceTimersByTimeAsync(1_000); // 解析失败后的重试退避

    const result = await promise;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result.emotionScore).toBe(5);
  });

  it("部分条目非法：过滤掉非法的待办/财务条目，保留合法的那些（不因一条脏数据丢弃整批）", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        emotionTags: [],
        topicTags: [],
        todos: [
          { text: "买水" },           // 合法
          { text: "" },               // 非法：空文本
          { priority: "high" },       // 非法：缺 text
        ],
        completedTodoIds: [],
        emotionScore: 5,
        financeHints: [
          { type: "expense", amount: 12, category: "餐饮", note: "买水" }, // 合法
          { type: "expense", amount: -5, category: "餐饮", note: "非法金额" }, // 非法：负数
          { type: "expense", amount: NaN, category: "餐饮", note: "非法金额" }, // 非法：NaN
          { type: "expense", amount: 10, category: "", note: "无分类" }, // 非法：空分类
          { type: "unknown", amount: 10, category: "其他", note: "非法类型" }, // 非法：type 不对
        ],
      })
    );
    vi.stubGlobal("fetch", fetchMock);

    const result = await extractMeta([{ role: "user", content: "hi" }]);

    expect(result.todos).toEqual([{ text: "买水" }]);
    expect(result.financeHints).toEqual([{ type: "expense", amount: 12, category: "餐饮", note: "买水" }]);
  });

  it("网络失败（TypeError）：可重试，重试后成功", async () => {
    const fetchMock = vi.fn()
      .mockRejectedValueOnce(new TypeError("Failed to fetch"))
      .mockResolvedValueOnce(jsonResponse({ emotionTags: [], topicTags: [], todos: [], completedTodoIds: [], emotionScore: 5, financeHints: [] }));
    vi.stubGlobal("fetch", fetchMock);

    const promise = extractMeta([{ role: "user", content: "hi" }]);
    await vi.advanceTimersByTimeAsync(1_000);

    const result = await promise;
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(result).toBeTruthy();
  });

  it("HTTP 4xx（不可重试）：不重试，直接抛出", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({ error: "bad request" }, false, 400));
    vi.stubGlobal("fetch", fetchMock);

    await expect(extractMeta([{ role: "user", content: "hi" }])).rejects.toBeInstanceOf(StreamChatError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
