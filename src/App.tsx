import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LifeOsProvider } from "@/contexts/LifeOsContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { useAuth } from "@/hooks/useAuth";
import HomePage from "@/pages/HomePage";
import TodoPage from "@/pages/TodoPage";
import HistoryPage from "@/pages/HistoryPage";
import ReviewPage from "@/pages/ReviewPage";
import WheelPage from "@/pages/WheelPage";
import WealthPage from "@/pages/WealthPage";
import GuidePage from "@/pages/GuidePage";
import SettingsPage from "@/pages/SettingsPage";
import InsightsPage from "@/pages/InsightsPage";
import GoalsPage from "@/pages/GoalsPage";
import TimeStatsPage from "@/pages/TimeStatsPage";
import AuthPage from "@/pages/AuthPage";
import ResetPasswordPage from "@/pages/ResetPasswordPage";
import NotFound from "@/pages/NotFound";
import Onboarding from "@/components/Onboarding";
import InstallBanner from "@/components/InstallBanner";
import TabBar from "@/components/TabBar";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { useReminders } from "@/hooks/useReminders";
import { Loader2 } from "lucide-react";

const queryClient = new QueryClient();

const AppInner = () => {
  const { onboarded, completeOnboarding } = useLifeOs();
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
      <div className="h-[100dvh] flex flex-col">
        <div className="flex-1 overflow-hidden pb-[52px]">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/todos" element={<TodoPage />} />
            <Route path="/history" element={<HistoryPage />} />
            <Route path="/review" element={<ReviewPage />} />
            <Route path="/wheel" element={<WheelPage />} />
            <Route path="/wealth" element={<WealthPage />} />
            <Route path="/guide" element={<GuidePage />} />
            <Route path="/settings" element={<SettingsPage />} />
            <Route path="/insights" element={<InsightsPage />} />
            <Route path="/goals" element={<GoalsPage />} />
            <Route path="/time-stats" element={<TimeStatsPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </div>
        <TabBar />
      </div>
      <InstallBanner />
    </>
  );
};

const AuthGate = () => {
  const { user, loading, signUp, signIn } = useAuth();

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
