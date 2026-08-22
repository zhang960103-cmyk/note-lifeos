import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

// BUG-06 回归测试：访客/任何账号点"退出登录"时，如果 Supabase 的网络请求挂起或
// 报错，signOut() 之前会直接卡住（没有超时、没有本地兜底）。这里 mock
// @/integrations/supabase/client 的 supabase.auth.signOut，模拟"挂起"和"报错"
// 两种场景，断言 useAuth().signOut() 在有限时间内一定会 resolve，并且本地
// user/session 状态一定会被清空——不管服务端最终有没有响应。

const mockSignOut = vi.fn();
const mockGetSession = vi.fn();
const mockOnAuthStateChange = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  isSupabaseConfigured: true,
  supabase: {
    auth: {
      signOut: (...args: any[]) => mockSignOut(...args),
      getSession: () => mockGetSession(),
      onAuthStateChange: (...args: any[]) => mockOnAuthStateChange(...args),
    },
  },
}));

const { useAuth } = await import("./useAuth");

// `waitFor` polls on real timers internally, which never fires once
// vi.useFakeTimers() is active — so instead of `waitFor(...loading===false)`,
// manually flush the microtask queue enough times for the mocked
// getSession().then(...) chain (which resolves loading) to settle.
async function flushMicrotasks(times = 5) {
  for (let i = 0; i < times; i++) {
    await act(async () => { await Promise.resolve(); });
  }
}

describe("useAuth.signOut (BUG-06)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockSignOut.mockReset();
    mockGetSession.mockReset().mockResolvedValue({ data: { session: null } });
    mockOnAuthStateChange.mockReset().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("网络请求一直挂起（从不 resolve）：8 秒超时后仍然 resolve，并触发本地 scope 兜底清理", async () => {
    // global scope 的调用永远不 resolve，模拟弱网/离线导致请求挂起
    const neverResolves = new Promise(() => {});
    mockSignOut.mockImplementation((opts?: { scope?: string }) => {
      if (opts?.scope === "local") return Promise.resolve({ error: null });
      return neverResolves;
    });

    const { result } = renderHook(() => useAuth());
    await flushMicrotasks();

    let resolved = false;
    let signOutPromise: Promise<void>;
    await act(async () => {
      signOutPromise = result.current.signOut().then(() => { resolved = true; });
      await vi.advanceTimersByTimeAsync(8000);
      await signOutPromise;
    });

    expect(resolved).toBe(true);
    // 超时之后应该会用 scope: "local" 兜底再调用一次
    expect(mockSignOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("global signOut 直接抛错：立即 resolve 并走本地兜底，不让调用方一直挂着", async () => {
    mockSignOut.mockImplementation((opts?: { scope?: string }) => {
      if (opts?.scope === "local") return Promise.resolve({ error: null });
      return Promise.reject(new Error("network unreachable"));
    });

    const { result } = renderHook(() => useAuth());
    await flushMicrotasks();

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockSignOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("global signOut 正常返回 error（非 timeout、非 throw）：同样会走本地兜底", async () => {
    mockSignOut.mockImplementation((opts?: { scope?: string }) => {
      if (opts?.scope === "local") return Promise.resolve({ error: null });
      return Promise.resolve({ error: { message: "some auth error" } });
    });

    const { result } = renderHook(() => useAuth());
    await flushMicrotasks();

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockSignOut).toHaveBeenCalledWith({ scope: "local" });
  });

  it("正常情况：global signOut 很快成功，不会多余地再调用一次 local scope", async () => {
    mockSignOut.mockImplementation((opts?: { scope?: string }) => {
      if (opts?.scope === "local") return Promise.resolve({ error: null });
      return Promise.resolve({ error: null });
    });

    const { result } = renderHook(() => useAuth());
    await flushMicrotasks();

    await act(async () => {
      await result.current.signOut();
    });

    expect(mockSignOut).toHaveBeenCalledTimes(1);
    expect(mockSignOut).toHaveBeenCalledWith();
  });
});
