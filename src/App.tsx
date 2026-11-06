import { useEffect, useState } from "react";
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
import AiPaymasterPage from "@/pages/AiPaymasterPage";
import ReportsPage from "@/pages/ReportsPage";
import SettingsPage from "@/pages/SettingsPage";
import CompaniesPage from "@/pages/CompaniesPage";
import MyCompaniesPage from "@/pages/MyCompaniesPage";
import CompanySetupPage from "@/pages/CompanySetupPage";
import StaffClockPage from "@/pages/StaffClockPage";
import KioskPage from "@/pages/KioskPage";
import ClockDevicesPage from "@/pages/ClockDevicesPage";
import PayslipPage from "@/pages/PayslipPage";
import AuthPage from "@/pages/AuthPage";
import AcceptInvitationPage from "@/pages/AcceptInvitationPage";
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
import PromoPage from "./pages/PromoPage";
import PayrollDemoPage from "@/pages/PayrollDemoPage";
import QuickBooksPage from "@/pages/QuickBooksPage";
import PayrollSettingsPage from "@/pages/PayrollSettingsPage";
import PayrollImportPage from "@/pages/PayrollImportPage";
import PayslipImportPage from "@/pages/PayslipImportPage";
import NotFound from "./pages/NotFound.tsx";

const queryClient = new QueryClient();

function SlowLoadHint() {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = window.setTimeout(() => setShow(true), 8000); return () => window.clearTimeout(t); }, []);
  return show ? <button type="button" onClick={() => window.location.reload()} className="text-xs underline text-white/80">Taking a while? Tap to reload</button> : null;
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut } = useAuth();
  const { role, loading: accessLoading, accessError, refreshAccess } = useRole();
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
          <SlowLoadHint />
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/auth" replace />;
  if (accessError) return <main className="min-h-screen bg-background text-foreground flex items-center justify-center p-6"><div className="max-w-md space-y-4" role="alert"><h1 className="font-display text-2xl">Company access temporarily unavailable</h1><p className="text-muted-foreground">Lovable Cloud is currently unavailable, so we cannot verify your company access. This does not mean you need a new invitation. Please try again shortly.</p><div className="flex gap-3"><Button onClick={() => void refreshAccess()}>Try again</Button><Button variant="outline" onClick={() => void signOut()}>Sign out</Button></div></div></main>;
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
    <Route path="/time-clock/:companyId" element={<StaffClockPage />} />
    <Route path="/time-clock" element={<StaffClockPage />} />
    <Route path="/kiosk" element={<KioskPage />} />
    <Route path="/auth" element={<PublicRoute><AuthPage /></PublicRoute>} />
    <Route path="/accept-invitation" element={<AcceptInvitationPage />} />
    <Route path="/reset-password" element={<AcceptInvitationPage />} />
    <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
      <Route path="/" element={<DashboardPage />} />
      <Route path="/employees" element={<EmployeesPage />} />
      <Route path="/attendance" element={<AttendancePage />} />
      <Route path="/payroll" element={<PayrollPage />} />
      <Route path="/ai-paymaster" element={<AiPaymasterPage />} />
      <Route path="/payroll-history" element={<PayrollHistoryPage />} />
      <Route path="/payroll-import" element={<PayrollImportPage />} />
      <Route path="/payslip-import" element={<PayslipImportPage />} />
      <Route path="/reports" element={<ReportsPage />} />
      <Route path="/payslips" element={<PayslipPage />} />
      <Route path="/portal" element={<PortalPage />} />
      <Route path="/geofencing" element={<GeofencingPage />} />
      <Route path="/leave-management" element={<LeaveManagementPage />} />
      <Route path="/deductions" element={<DeductionsPage />} />
      <Route path="/users" element={<UserManagementPage />} />
      <Route path="/clock-devices" element={<ClockDevicesPage />} />
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
      <Route path="/my-companies" element={<MyCompaniesPage />} />
    </Route>
    <Route path="/client-portal" element={<ClientPortalPage />} />
    <Route path="/training-public" element={<PublicTrainingPage />} />
    <Route path="/payroll-demo" element={<PayrollDemoPage />} />
    <Route path="/user-guide" element={<PublicTrainingPage />} />
    <Route path="/payroll-user-guide" element={<PublicTrainingPage />} />
    <Route path="/guide" element={<PublicTrainingPage />} />
    <Route path="/manual" element={<PublicTrainingPage />} />
    <Route path="/brochure" element={<PublicTrainingPage />} />
    <Route path="/discover" element={<PromoPage />} />
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
