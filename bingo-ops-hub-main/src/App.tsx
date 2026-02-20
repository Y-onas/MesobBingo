import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import DashboardLayout from "@/components/DashboardLayout";
import OverviewPage from "@/pages/OverviewPage";
import DepositsPage from "@/pages/DepositsPage";
import WithdrawalsPage from "@/pages/WithdrawalsPage";
import UsersPage from "@/pages/UsersPage";
import FraudAlertsPage from "@/pages/FraudAlertsPage";
import GameRoomsPage from "@/pages/GameRoomsPage";
import AuditLogPage from "@/pages/AuditLogPage";
import LoginPage from "@/pages/LoginPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Protected Route Component
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const isAuthenticated = localStorage.getItem("mesob_admin_authenticated") === "true";
  return isAuthenticated ? <>{children}</> : <Navigate to="/login" replace />;
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
              <Route path="/" element={<OverviewPage />} />
              <Route path="/deposits" element={<DepositsPage />} />
              <Route path="/withdrawals" element={<WithdrawalsPage />} />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/fraud-alerts" element={<FraudAlertsPage />} />
              <Route path="/game-rooms" element={<GameRoomsPage />} />
              <Route path="/audit-log" element={<AuditLogPage />} />
            </Route>
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
