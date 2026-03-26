import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { LifeOsProvider } from "@/contexts/LifeOsContext";
import AppLayout from "@/components/AppLayout";
import Dashboard from "@/pages/Dashboard";
import DiaryPage from "@/pages/DiaryPage";
import HistoryPage from "@/pages/HistoryPage";
import ReviewPage from "@/pages/ReviewPage";
import WhitepaperPage from "@/pages/WhitepaperPage";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <LifeOsProvider>
        <BrowserRouter>
          <Routes>
            <Route element={<AppLayout />}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/diary" element={<DiaryPage />} />
              <Route path="/history" element={<HistoryPage />} />
              <Route path="/review" element={<ReviewPage />} />
            </Route>
            <Route path="/whitepaper" element={<WhitepaperPage />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </LifeOsProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
