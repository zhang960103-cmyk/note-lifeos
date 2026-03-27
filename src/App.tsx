import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LifeOsProvider } from "@/contexts/LifeOsContext";
import HomePage from "@/pages/HomePage";
import TodoPage from "@/pages/TodoPage";
import HistoryPage from "@/pages/HistoryPage";
import ReviewPage from "@/pages/ReviewPage";
import WheelPage from "@/pages/WheelPage";
import NotFound from "@/pages/NotFound";
import Onboarding from "@/components/Onboarding";
import InstallBanner from "@/components/InstallBanner";
import TabBar from "@/components/TabBar";
import { useLifeOs } from "@/contexts/LifeOsContext";
import { useReminders } from "@/hooks/useReminders";

const queryClient = new QueryClient();

const AppInner = () => {
  const { onboarded, completeOnboarding } = useLifeOs();
  useReminders();

  if (!onboarded) return <Onboarding />;

  return (
    <>
      <BrowserRouter>
        <div className="h-[100dvh] flex flex-col">
          <div className="flex-1 overflow-hidden pb-[52px]">
            <Routes>
              <Route path="/" element={<HomePage />} />
              <Route path="/todos" element={<TodoPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/review" element={<ReviewPage />} />
              <Route path="/wheel" element={<WheelPage />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
          <TabBar />
        </div>
      </BrowserRouter>
      <InstallBanner />
    </>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <LifeOsProvider>
        <AppInner />
      </LifeOsProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
