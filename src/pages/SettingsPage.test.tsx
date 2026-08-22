import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// BUG-05 回归测试：访客(匿名)账号的账号卡片之前会同时显示"未登录"（名字栏兜底文案）
// 和"已登录"（状态栏写死文案），两个互斥状态同时出现，用户无法判断数据是否绑定账号。
// 这里 mock useAuth 返回一个 is_anonymous=true 的用户，渲染 SettingsPage，断言：
//   1. 页面上出现"访客"相关的明确标识
//   2. 页面上不再出现旧版写死的"已登录"文案
//   3. 名字栏不会退化显示"未登录"（因为访客不该被当成"未登录"的真实账号处理）

const mockSignOut = vi.fn();

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({
    user: { id: "guest-local-1", is_anonymous: true, email: undefined },
    session: null,
    loading: false,
    signUp: vi.fn(),
    signIn: vi.fn(),
    signOut: mockSignOut,
    isSupabaseConfigured: true,
  }),
}));

// 链式 mock：SettingsPage 自己的 profile 加载 + useModelProfiles 内部都会调用
// supabase.from(...).select(...).eq(...).order/single(...)，这里统一返回空结果，
// 避免测试真的打网络请求。
function makeChainable(finalValue: any): any {
  const chain: any = {
    select: () => chain,
    eq: () => chain,
    order: () => chain,
    single: () => Promise.resolve(finalValue),
    then: (resolve: any) => Promise.resolve(finalValue).then(resolve),
  };
  return chain;
}

vi.mock("@/integrations/supabase/client", () => ({
  isSupabaseConfigured: true,
  supabase: {
    from: () => makeChainable({ data: null, error: null }),
    auth: {
      signOut: vi.fn(),
      getSession: () => Promise.resolve({ data: { session: null } }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}));

vi.mock("@/contexts/LifeOsContext", async () => {
  const actual = await vi.importActual<any>("@/contexts/LifeOsContext");
  return {
    ...actual,
    useLifeOs: () => ({
      entries: [], allTodos: [], financeEntries: [], habits: [], wheelScores: [], energyLogs: [],
    }),
  };
});

const { default: SettingsPage } = await import("./SettingsPage");
const { LanguageProvider } = await import("@/contexts/LanguageContext");
const { ThemeProvider } = await import("@/contexts/ThemeContext");

function renderSettings() {
  return render(
    <MemoryRouter>
      <LanguageProvider>
        <ThemeProvider>
          <SettingsPage />
        </ThemeProvider>
      </LanguageProvider>
    </MemoryRouter>
  );
}

describe("SettingsPage account card (BUG-05)", () => {
  beforeEach(() => { mockSignOut.mockReset(); });

  it("访客账号：显示明确的访客标识，不再出现互斥的'已登录'文案", async () => {
    renderSettings();
    // 中文默认语言下应能找到"访客"字样（名字栏 + 状态栏）
    const guestMatches = await screen.findAllByText(/访客/);
    expect(guestMatches.length).toBeGreaterThan(0);
    // 不应该再有旧版写死的"已登录"渲染出来
    expect(screen.queryByText("已登录")).toBeNull();
    // 名字栏不应该退化成"未登录"（is_anonymous 分支应该优先命中）
    expect(screen.queryByText("未登录")).toBeNull();
  });
});
