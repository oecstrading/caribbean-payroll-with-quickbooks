import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { RoleProvider, useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import { CompanyProvider } from "@/hooks/useCompany";
import AppLayout from "@/components/AppLayout";
import DashboardPage from "@/pages/Dashboard";
import EmployeesPage from "@/pages/EmployeesPage";
import AttendancePage from "@/pages/AttendancePage";
import PayrollPage from "@/pages/PayrollPage";
import ReportsPage from "@/pages/ReportsPage";
import SettingsPage from "@/pages/SettingsPage";
import CompaniesPage from "@/pages/CompaniesPage";
import CompanySetupPage from "@/pages/CompanySetupPage";
import PayslipPage from "@/pages/PayslipPage";
import AuthPage from "@/pages/AuthPage";
import PortalPage from "@/pages/PortalPage";
import UserManagementPage from "@/pages/UserManagementPage";
import GeofencingPage from "@/pages/GeofencingPage";
import LeaveManagementPage from "@/pages/LeaveManagementPage";
import DeductionsPage from "@/pages/DeductionsPage";
import PayrollHistoryPage from "@/pages/PayrollHistoryPage";
import ProjectsPage from "@/pages/ProjectsPage";
import EquipmentPage from "@/pages/EquipmentPage";
import DailyReportsPage from "@/pages/DailyReportsPage";
import CrewsPage from "@/pages/CrewsPage";
import ContractorsPage from "@/pages/ContractorsPage";
import ProjectProfitabilityPage from "@/pages/ProjectProfitabilityPage";
import SiteManagementPage from "@/pages/SiteManagementPage";
import GuardTourPage from "@/pages/GuardTourPage";
import IncidentReportsPage from "@/pages/IncidentReportsPage";
import ClientPortalPage from "@/pages/ClientPortalPage";
import CommandCenterPage from "@/pages/CommandCenterPage";
import ViolationReportPage from "@/pages/ViolationReportPage";
import RosterPage from "@/pages/RosterPage";
import LateClockInReportPage from "@/pages/LateClockInReportPage";
import ComplianceTrackingPage from "@/pages/ComplianceTrackingPage";
import GuardPerformancePage from "@/pages/GuardPerformancePage";
import ApplicantTrackingPage from "@/pages/ApplicantTrackingPage";
import InvoicingPage from "@/pages/InvoicingPage";
import TrainingHubPage from "@/pages/TrainingHubPage";
import PublicTrainingPage from "@/pages/PublicTrainingPage";
import QuickBooksPage from "@/pages/QuickBooksPage";
import PayrollSettingsPage from "@/pages/PayrollSettingsPage";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const { role, loading: accessLoading } = useRole();
  if (loading || (user && accessLoading)) {
    return (
      <div
        className="min-h-screen flex items-center justify-center"
        style={{ background: "linear-gradient(135deg, hsl(48 100% 55%) 0%, hsl(18 95% 58%) 35%, hsl(330 85% 50%) 70%, hsl(195 90% 22%) 100%)" }}
      >
        <div className="text-center space-y-3">
          <div className="w-10 h-10 rounded-lg bg-white/90 flex items-center justify-center mx-auto animate-pulse">
            <span className="font-display font-bold text-sm" style={{ color: "hsl(195 90% 22%)" }}>OE</span>
          </div>
          <p className="text-sm text-white/90">Loading your Caribbean payroll…</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (!role) return <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6"><div className="max-w-md space-y-4"><h1 className="font-display text-2xl">Company invitation required</h1><p className="text-muted-foreground">Your account is signed in but has not been assigned to a company. Ask your company administrator for access.</p><Button onClick={() => void signOut()}>Sign out</Button></div></main>;
  return <>{children}</>;
}

function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

const AppRoutes = () => (
  <Routes>
    <Route path="/company-setup" element={<CompanySetupPage />} />
    <Route path="/auth" element={<PublicRoute><AuthPage /></PublicRoute>} />
    <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/employees" element={<EmployeesPage />} />
      <Route path="/attendance" element={<AttendancePage />} />
      <Route path="/payroll" element={<PayrollPage />} />
      <Route path="/payroll-history" element={<PayrollHistoryPage />} />
      <Route path="/reports" element={<ReportsPage />} />
      <Route path="/payslips" element={<PayslipPage />} />
      <Route path="/portal" element={<PortalPage />} />
      <Route path="/geofencing" element={<GeofencingPage />} />
      <Route path="/leave-management" element={<LeaveManagementPage />} />
      <Route path="/deductions" element={<DeductionsPage />} />
      <Route path="/users" element={<UserManagementPage />} />
      <Route path="/projects" element={<ProjectsPage />} />
      <Route path="/equipment" element={<EquipmentPage />} />
      <Route path="/daily-reports" element={<DailyReportsPage />} />
      <Route path="/crews" element={<CrewsPage />} />
      <Route path="/contractors" element={<ContractorsPage />} />
      <Route path="/project-profitability" element={<ProjectProfitabilityPage />} />
      <Route path="/sites" element={<SiteManagementPage />} />
      <Route path="/guard-tour" element={<GuardTourPage />} />
      <Route path="/incidents" element={<IncidentReportsPage />} />
      <Route path="/command-center" element={<CommandCenterPage />} />
      <Route path="/violations" element={<ViolationReportPage />} />
      <Route path="/roster" element={<RosterPage />} />
      <Route path="/late-clockin-report" element={<LateClockInReportPage />} />
      <Route path="/compliance" element={<ComplianceTrackingPage />} />
      <Route path="/guard-performance" element={<GuardPerformancePage />} />
      <Route path="/applicants" element={<ApplicantTrackingPage />} />
      <Route path="/invoicing" element={<InvoicingPage />} />
      <Route path="/training" element={<TrainingHubPage />} />
      <Route path="/quickbooks" element={<QuickBooksPage />} />
      <Route path="/payroll-settings" element={<PayrollSettingsPage />} />
      <Route path="/settings" element={<SettingsPage />} />
      <Route path="/companies" element={<CompaniesPage />} />
    </Route>
    <Route path="/client-portal" element={<ClientPortalPage />} />
    <Route path="/training-public" element={<PublicTrainingPage />} />
    <Route path="/user-guide" element={<PublicTrainingPage />} />
    <Route path="/payroll-user-guide" element={<PublicTrainingPage />} />
    <Route path="/guide" element={<PublicTrainingPage />} />
    <Route path="/manual" element={<PublicTrainingPage />} />
    <Route path="/brochure" element={<PublicTrainingPage />} />
    <Route path="*" element={<NotFound />} />
  </Routes>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <RoleProvider>
            <CompanyProvider>
              <AppRoutes />
            </CompanyProvider>
          </RoleProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
