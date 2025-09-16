import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import AuthPage from "./components/auth/AuthPage";
import AppLayout from "./components/layout/AppLayout";
import RouteGuard from "./components/auth/RouteGuard";
import Dashboard from "./pages/Dashboard";
import FranchisesPage from "./pages/FranchisesPage";
import ListFranchisePage from "./pages/admin/ListFranchisePage";
import AddFranchisePage from "./pages/admin/AddFranchisePage";
import ProfitSharingPage from "./pages/admin/ProfitSharingPage";
import FranchiseProfitSharingPage from "./pages/admin/FranchiseProfitSharingPage";
import ProfitSharingSettingsPage from "./pages/admin/ProfitSharingSettingsPage";
import AdminIncomePage from "./pages/AdminIncomePage";
import WorkerIncomePage from "./pages/WorkerIncomePage";
import ExpensesPage from "./pages/ExpensesPage";
import WorkersPage from "./pages/WorkersPage";
import FinancialReportPage from "./pages/FinancialReportPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/auth" element={<AuthPage />} />
            <Route path="/" element={<AppLayout />}>
              <Route index element={<RouteGuard><Dashboard /></RouteGuard>} />
              <Route path="franchises" element={<RouteGuard><FranchisesPage /></RouteGuard>} />
              <Route path="admin/franchises" element={<RouteGuard><ListFranchisePage /></RouteGuard>} />
              <Route path="admin/franchises/new" element={<RouteGuard><AddFranchisePage /></RouteGuard>} />
              <Route path="admin/profit-sharing" element={<RouteGuard><ProfitSharingPage /></RouteGuard>} />
              <Route path="admin/profit-sharing-settings" element={<RouteGuard><ProfitSharingSettingsPage /></RouteGuard>} />
              <Route path="admin/franchise-profit-sharing" element={<RouteGuard><FranchiseProfitSharingPage /></RouteGuard>} />
              <Route path="admin-income" element={<RouteGuard><AdminIncomePage /></RouteGuard>} />
              <Route path="worker-income" element={<RouteGuard><WorkerIncomePage /></RouteGuard>} />
              <Route path="expenses" element={<RouteGuard><ExpensesPage /></RouteGuard>} />
              <Route path="workers" element={<RouteGuard><WorkersPage /></RouteGuard>} />
              <Route path="financial-report" element={<RouteGuard><FinancialReportPage /></RouteGuard>} />
            </Route>
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
