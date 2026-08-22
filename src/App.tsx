import { useEffect, lazy, Suspense } from "react";
import { useNavigate, useLocation } from "react-router-dom";

const DESKTOP_NAV = [
  { path: "/", icon: "🧭", label: "今日" },
  { path: "/todos", icon: "✅", label: "待办" },
  { path: "/calendar", icon: "📅", label: "日历" },
  { path: "/time-stats", icon: "⏰", label: "时间" },
  { path: "/wheel", icon: "⚖️", label: "生命之轮" },
  { path: "/wealth", icon: "💰", label: "财富" },
  { path: "/review", icon: "📮", label: "复盘" },
  { path: "/goals", icon: "🎯", label: "目标" },
  { path: "/projects", icon: "🗂️", label: "项目" },
  { path: "/health", icon: "❤️", label: "健康" },
  { path: "/map", icon: "🗺️", label: "足迹" },
  { path: "/history", icon: "📖", label: "日记墙" },
  { path: "/search", icon: "🔍", label: "搜索" },
  { path: "/guide", icon: "📘", label: "使用指南" },
  { path: "/settings", icon: "⚙️", label: "设置" },
  { path: "/privacy", icon: "🔒", label: "隐私政策" },
];

const DesktopSidebar = () => {
  const navigate = useNavigate();
  const location = useLocation();
  return (
    <nav className="flex-1 px-3 py-3 space-y-0.5 overflow-y-auto">
      {DESKTOP_NAV.map(item => {
        const active = item.path === "/" ? location.pathname === "/" : location.pathname.startsWith(item.path);
        return (
          <button
            key={item.path}
            onClick={() => navigate(item.path)}
            className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition ${
              active ? "bg-gold/10 text-gold font-medium" : "text-muted-foreground hover:text-foreground hover:bg-surface-2"
            }`}
          >
            <span>{item.icon}</span>
            <span>{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
};
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LifeOsProvider } from "@/contexts/LifeOsContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAuth } from "@/hooks/useAuth";
import { initSupabaseHealth } from "@/integrations/supabase/validate";
// HomePage/TodoPage 是绝大多数用户(包括手机上的家人)打开app后最先/最常停留的页面，
// 保持同步加载，避免多一次网络请求的白屏等待；其余页面按路由懒加载，减小首屏 JS 体积。
import HomePage from "@/pages/HomePage";
import TodoPage from "@/pages/TodoPage";
import AuthPage from "@/pages/AuthPage";
import PrivacyPage from "@/pages/PrivacyPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import NotFound from "@/pages/NotFound";

const HistoryPage = lazy(() => import("@/pages/HistoryPage"));
const ReviewPage = lazy(() => import("@/pages/ReviewPage"));
const WheelPage = lazy(() => import("@/pages/WheelPage"));
const WealthPage = lazy(() => import("@/pages/WealthPage"));
const GuidePage = lazy(() => import("@/pages/GuidePage"));
const SettingsPage = lazy(() => import("@/pages/SettingsPage"));
// InsightsPage merged into CalendarPage
const GoalsPage = lazy(() => import("@/pages/GoalsPage"));
const TimeStatsPage = lazy(() => import("@/pages/TimeStatsPage"));
const CalendarPage = lazy(() => import("@/pages/CalendarPage"));
const ProjectsPage = lazy(() => import("@/pages/ProjectsPage"));
const SearchPage = lazy(() => import("@/pages/SearchPage"));
const HealthPage = lazy(() => import("@/pages/HealthPage"));
const MapPage = lazy(() => import("@/pages/MapPage"));
import Onboarding from "@/components/Onboarding";
import InstallBanner from "@/components/InstallBanner";
import TabBar from "@/components/TabBar";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { useReminders } from "@/hooks/useReminders";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

const AppInner = () => {
  const { onboarded } = useLifeOs();
  const location = useLocation();
  useReminders();

  if (onboarded === null) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-gold" size={24} />
      </div>
    );
  }

  if (!onboarded) return <Onboarding />;

  return (
    <>
      <div className="h-[100dvh] flex flex-col lg:flex-row">
        {/* Desktop sidebar nav - only on large screens */}
        <div className="hidden lg:flex lg:flex-col lg:w-[220px] lg:border-r lg:border-border lg:bg-surface-1 lg:flex-shrink-0">
          <div className="px-6 py-5 border-b border-border">
            <span className="font-serif-sc text-base text-foreground">罗盘 · Life OS</span>
            <p className="text-[10px] text-muted-foreground mt-0.5">你的私人生命导师</p>
          </div>
          <DesktopSidebar />
        </div>
        <div className="flex-1 overflow-hidden pb-[52px] lg:pb-0">
          {/* key={pathname}：某个页面渲染崩了触发这层边界后，边界组件的state会
              一直停在"已崩溃"，之前切到别的Tab也看不到东西，因为React没有卸载
              重建这个ErrorBoundary。加上key，一旦路由变化就强制重新挂载，
              离开出问题的页面后自动恢复正常，不需要用户手动刷新整个App。*/}
          <ErrorBoundary scope="page" boundaryName={location.pathname} key={location.pathname}>
            <Suspense fallback={
              <div className="h-full flex items-center justify-center">
                <Loader2 className="animate-spin text-gold" size={24} />
              </div>
            }>
              <Routes>
                <Route path="/" element={<HomePage />} />
                <Route path="/todos" element={<TodoPage />} />
                <Route path="/history" element={<HistoryPage />} />
                <Route path="/review" element={<ReviewPage />} />
                <Route path="/wheel" element={<WheelPage />} />
                <Route path="/wealth" element={<WealthPage />} />
                <Route path="/guide" element={<GuidePage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/insights" element={<Navigate to="/calendar" replace />} />
                <Route path="/goals" element={<GoalsPage />} />
                <Route path="/time-stats" element={<TimeStatsPage />} />
                <Route path="/calendar" element={<CalendarPage />} />
                <Route path="/projects" element={<ProjectsPage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/health" element={<HealthPage />} />
                <Route path="/map" element={<MapPage />} />
                <Route path="/privacy" element={<PrivacyPage />} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </ErrorBoundary>
        </div>
        <div className="lg:hidden">
          <TabBar />
        </div>
      </div>
      <InstallBanner />
    </>
  );
};

const MissingConfigScreen = () => (
  <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
    <div className="w-full max-w-xl rounded-[28px] border border-gold/20 bg-surface-1 p-8 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
      <div className="inline-flex items-center rounded-full border border-gold/20 bg-gold/10 px-3 py-1 text-[11px] tracking-[0.24em] uppercase text-gold">
        Configuration Required
      </div>
      <h1 className="mt-5 font-serif-sc text-3xl text-foreground">应用已部署，但 Supabase 环境变量还没配置</h1>
      <p className="mt-4 text-sm leading-7 text-foreground/70">
        当前页面打不开，不是因为构建失败，而是应用启动时缺少
        <code className="mx-1 rounded bg-black/20 px-1.5 py-0.5 text-xs">VITE_SUPABASE_URL</code>
        和
        <code className="mx-1 rounded bg-black/20 px-1.5 py-0.5 text-xs">VITE_SUPABASE_PUBLISHABLE_KEY</code>
        。
      </p>
      <ol className="mt-6 list-decimal space-y-3 pl-5 text-sm text-foreground/80">
        <li>打开 Vercel 项目设置 → Environment Variables</li>
        <li>添加 <code className="rounded bg-black/20 px-1.5 py-0.5 text-xs">VITE_SUPABASE_URL</code></li>
        <li>添加 <code className="rounded bg-black/20 px-1.5 py-0.5 text-xs">VITE_SUPABASE_PUBLISHABLE_KEY</code></li>
        <li>保存后重新部署</li>
      </ol>
    </div>
  </div>
);

const AuthGate = () => {
  const { user, loading, signUp, signIn, isSupabaseConfigured } = useAuth();

  useEffect(() => {
    initSupabaseHealth();
  }, []);

  if (!isSupabaseConfigured) {
    return <MissingConfigScreen />;
  }

  if (loading) {
    return (
      <div className="fixed inset-0 bg-background flex items-center justify-center">
        <Loader2 className="animate-spin text-gold" size={24} />
      </div>
    );
  }

  if (!user) {
    return <AuthPage onSignUp={signUp} onSignIn={signIn} />;
  }

  return (
    <LifeOsProvider userId={user.id}>
      <AppInner />
    </LifeOsProvider>
  );
};

const App = () => (
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <LanguageProvider>
        <ThemeProvider>
          <ErrorBoundary>
            <TooltipProvider>
              <Toaster />
              <Sonner />
              <Routes>
                <Route path="/reset-password" element={<ResetPasswordPage />} />
                <Route path="*" element={<AuthGate />} />
              </Routes>
            </TooltipProvider>
          </ErrorBoundary>
        </ThemeProvider>
      </LanguageProvider>
    </QueryClientProvider>
  </BrowserRouter>
);

export default App;
