import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LifeOsProvider } from "@/contexts/LifeOsContext";
import HomePage from "@/pages/HomePage";
import HistoryPage from "@/pages/HistoryPage";
import ReviewPage from "@/pages/ReviewPage";
import WheelPage from "@/pages/WheelPage";
import NotFound from "@/pages/NotFound";
import Onboarding from "@/components/Onboarding";
import InstallBanner from "@/components/InstallBanner";
import { useLifeOs } from "@/contexts/LifeOsContext";

const queryClient = new QueryClient();

const AppInner = () => {
  const { onboarded } = useLifeOs();

  if (!onboarded) return <Onboarding />;

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/history" element={<HistoryPage />} />
          <Route path="/review" element={<ReviewPage />} />
          <Route path="/wheel" element={<WheelPage />} />
          <Route path="*" element={<NotFound />} />
        </Routes>
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
