import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./contexts/AuthContext";
import AuthPage from "./components/auth/AuthPage";
import AppLayout from "./components/layout/AppLayout";
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
              <Route index element={<Dashboard />} />
              <Route path="franchises" element={<FranchisesPage />} />
              <Route path="admin/franchises" element={<ListFranchisePage />} />
              <Route path="admin/franchises/new" element={<AddFranchisePage />} />
              <Route path="admin/profit-sharing" element={<ProfitSharingPage />} />
              <Route path="admin/profit-sharing-settings" element={<ProfitSharingSettingsPage />} />
              <Route path="admin/franchise-profit-sharing" element={<FranchiseProfitSharingPage />} />
              <Route path="admin-income" element={<AdminIncomePage />} />
              <Route path="worker-income" element={<WorkerIncomePage />} />
              <Route path="expenses" element={<ExpensesPage />} />
              <Route path="workers" element={<WorkersPage />} />
              <Route path="financial-report" element={<FinancialReportPage />} />
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
