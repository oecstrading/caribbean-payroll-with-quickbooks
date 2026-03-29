import { useState, useEffect, useMemo } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  CalendarDays,
  Landmark,
  Users,
  Clock,
  DollarSign,
  FileText,
  Settings,
  ChevronLeft,
  ChevronRight,
  Globe,
  Bell,
  Search,
  UserCircle,
  Receipt,
  MapPin,
  Shield,
  LogOut,
  History,
  Menu,
  X,
  FolderKanban,
  Wrench,
  ClipboardList,
  UsersRound,
  Briefcase,
  TrendingUp,
  Navigation,
  AlertTriangle,
  Building2,
  CalendarRange,
  UserCheck,
  FileSpreadsheet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { useRole } from "@/hooks/useRole";
import { useCompany } from "@/hooks/useCompany";
import { useAuth } from "@/hooks/useAuth";
import PanicButton from "@/components/PanicButton";
import VoiceCommandListener from "@/components/VoiceCommandListener";

interface NavItem {
  path: string;
  label: string;
  icon: any;
  adminOnly?: boolean;
  managerOnly?: boolean;
  separator?: boolean;
  bottomNav?: boolean; // show in mobile bottom nav
}

const navItems: NavItem[] = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard, bottomNav: true },
  { path: "/employees", label: "Employees", icon: Users },
  { path: "/attendance", label: "Attendance", icon: Clock },
  { path: "/payroll", label: "Payroll", icon: DollarSign, bottomNav: true },
  { path: "/payroll-history", label: "Payroll History", icon: History },
  { path: "/payslips", label: "Payslips", icon: Receipt },
  { path: "/reports", label: "Reports", icon: FileText },
  { path: "/geofencing", label: "Geofencing", icon: MapPin },
  { path: "/leave-management", label: "Leave Approvals", icon: CalendarDays, managerOnly: true },
  { path: "/deductions", label: "Deductions", icon: Landmark, managerOnly: true },
  { path: "/projects", label: "Projects", icon: FolderKanban, separator: true },
  { path: "/crews", label: "Crews", icon: UsersRound },
  { path: "/equipment", label: "Equipment", icon: Wrench },
  { path: "/daily-reports", label: "Field Reports", icon: ClipboardList },
  { path: "/contractors", label: "Contractors", icon: Briefcase, managerOnly: true },
  { path: "/project-profitability", label: "Profitability", icon: TrendingUp, managerOnly: true },
  { path: "/sites", label: "Client Sites", icon: Building2, separator: true },
  { path: "/roster", label: "Guard Roster", icon: CalendarRange },
  { path: "/command-center", label: "Command Center", icon: Navigation, managerOnly: true },
  { path: "/guard-tour", label: "Guard Tour", icon: MapPin, bottomNav: true },
  { path: "/incidents", label: "Incidents", icon: AlertTriangle },
  { path: "/violations", label: "Violations", icon: AlertTriangle, managerOnly: true },
  { path: "/compliance", label: "Compliance", icon: Shield, managerOnly: true },
  { path: "/guard-performance", label: "Performance", icon: TrendingUp, managerOnly: true },
  { path: "/late-clockin-report", label: "Late Report", icon: Clock, managerOnly: true },
  { path: "/applicants", label: "Recruitment", icon: UserCheck, managerOnly: true },
  { path: "/invoicing", label: "Client Invoicing", icon: FileSpreadsheet, managerOnly: true },
  { path: "/portal", label: "My Portal", icon: UserCircle, separator: true, bottomNav: true },
  { path: "/users", label: "User Management", icon: Shield, adminOnly: true },
  { path: "/settings", label: "Settings", icon: Settings, bottomNav: true },
];

export default function AppLayout() {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { role, isAdmin, isAdminOrManager } = useRole();
  const { user, signOut } = useAuth();
  const company = useCompany();

  const userInitials = useMemo(() => {
    const first = user?.user_metadata?.first_name?.[0] || user?.email?.[0] || "U";
    const last = user?.user_metadata?.last_name?.[0] || "";
    return (first + last).toUpperCase();
  }, [user]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileOpen(false);
    setSearchQuery("");
  }, [location.pathname]);

  const visibleNavItems = navItems.filter((item) => {
    if (item.adminOnly && !isAdmin) return false;
    if (item.managerOnly && !isAdminOrManager) return false;
    return true;
  });

  // Search results based on nav items
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.toLowerCase();
    return visibleNavItems.filter((item) =>
      item.label.toLowerCase().includes(q)
    );
  }, [searchQuery, visibleNavItems]);

  const bottomNavItems = visibleNavItems.filter((item) => item.bottomNav).slice(0, 5);

  const handleNav = (path: string) => {
    navigate(path);
    setMobileOpen(false);
  };

  return (
    <>
    <div className="flex h-screen overflow-hidden">
      {/* Mobile Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
          />
        )}
      </AnimatePresence>

      {/* Sidebar - hidden on mobile, slide-out drawer when toggled */}
      <AnimatePresence>
        {(mobileOpen || true) && (
          <motion.aside
            initial={false}
            animate={{
              width: collapsed ? 72 : 256,
              x: 0,
            }}
            transition={{ duration: 0.2, ease: "easeInOut" }}
            className={cn(
              "flex flex-col bg-sidebar border-r border-sidebar-border z-50",
              "hidden md:flex", // hidden on mobile by default
              mobileOpen && "!flex fixed inset-y-0 left-0 w-[280px]" // show as overlay on mobile
            )}
            style={mobileOpen ? { width: 280 } : undefined}
          >
            {/* Logo */}
            <div className="flex items-center justify-between px-4 h-16 border-b border-sidebar-border">
              <div className="flex items-center gap-3">
                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary flex items-center justify-center overflow-hidden">
                  {company.logo_url ? (
                    <img src={company.logo_url} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <span className="font-display font-bold text-primary-foreground text-sm">OE</span>
                  )}
                </div>
                {(!collapsed || mobileOpen) && (
                  <div className="overflow-hidden">
                    <h1 className="font-display font-bold text-sidebar-foreground text-sm whitespace-nowrap">
                      {company.company_name || "OECS HR & Payroll"}
                    </h1>
                    <p className="text-[10px] text-sidebar-muted whitespace-nowrap">Saint Lucia</p>
                  </div>
                )}
              </div>
              {/* Close button on mobile */}
              {mobileOpen && (
                <button
                  onClick={() => setMobileOpen(false)}
                  className="md:hidden p-1.5 rounded-lg text-sidebar-foreground/50 hover:bg-sidebar-accent"
                >
                  <X size={20} />
                </button>
              )}
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-4 px-2 space-y-1 overflow-y-auto">
              {visibleNavItems.map((item) => {
                const isActive = location.pathname === item.path;
                return (
                  <div key={item.path}>
                    {item.separator && <div className="h-px bg-sidebar-border my-2 mx-2" />}
                    <button
                      onClick={() => handleNav(item.path)}
                      className={cn(
                        "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150",
                        isActive
                          ? "bg-sidebar-accent text-sidebar-primary"
                          : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground"
                      )}
                    >
                      <item.icon size={20} className="flex-shrink-0" />
                      {(!collapsed || mobileOpen) && (
                        <span className="whitespace-nowrap">{item.label}</span>
                      )}
                      {item.adminOnly && (!collapsed || mobileOpen) && (
                        <span className="ml-auto text-[9px] px-1.5 py-0.5 rounded bg-sidebar-accent text-sidebar-primary font-bold">
                          ADMIN
                        </span>
                      )}
                    </button>
                  </div>
                );
              })}
            </nav>

            {/* Role badge + Collapse + Logout */}
            <div className="px-2 py-3 border-t border-sidebar-border space-y-2">
              {(!collapsed || mobileOpen) && role && (
                <div className="flex items-center justify-between px-2">
                  <span className="text-[10px] text-sidebar-muted uppercase tracking-wider">Role</span>
                  <span className={cn(
                    "text-[10px] px-2 py-0.5 rounded-full font-bold",
                    role === "admin" ? "bg-destructive/20 text-destructive" :
                    role === "manager" ? "bg-primary/20 text-primary" :
                    "bg-sidebar-accent text-sidebar-foreground"
                  )}>
                    {role.toUpperCase()}
                  </span>
                </div>
              )}
              <div className="flex gap-1">
                <button
                  onClick={() => setCollapsed(!collapsed)}
                  className="hidden md:flex flex-1 items-center justify-center py-2 rounded-lg text-sidebar-foreground/50 hover:bg-sidebar-accent transition-colors"
                >
                  {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
                </button>
                <button
                  onClick={signOut}
                  className="flex items-center justify-center py-2 px-3 rounded-lg text-sidebar-foreground/50 hover:bg-sidebar-accent hover:text-destructive transition-colors"
                  title="Sign out"
                >
                  <LogOut size={18} />
                  {mobileOpen && <span className="ml-2 text-sm">Sign Out</span>}
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="h-14 md:h-16 bg-card border-b border-border flex items-center justify-between px-3 md:px-6">
          <div className="flex items-center gap-2 md:gap-3">
            {/* Hamburger for mobile */}
            <button
              onClick={() => setMobileOpen(true)}
              className="md:hidden p-2 rounded-lg hover:bg-secondary transition-colors"
            >
              <Menu size={20} className="text-foreground" />
            </button>
            <div className="relative hidden sm:block">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => setTimeout(() => setSearchFocused(false), 200)}
                placeholder="Search pages..."
                className="pl-9 pr-4 py-2 w-48 md:w-72 bg-secondary rounded-lg text-sm font-body placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
              {/* Search dropdown */}
              {searchFocused && searchResults.length > 0 && (
                <div className="absolute top-full left-0 mt-1 w-full bg-card border border-border rounded-lg shadow-lg z-50 overflow-hidden">
                  {searchResults.map((item) => (
                    <button
                      key={item.path}
                      onMouseDown={() => { navigate(item.path); setSearchQuery(""); }}
                      className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-secondary transition-colors"
                    >
                      <item.icon size={16} className="text-muted-foreground" />
                      {item.label}
                    </button>
                  ))}
                </div>
              )}
              {searchFocused && searchQuery.trim() && searchResults.length === 0 && (
                <div className="absolute top-full left-0 mt-1 w-full bg-card border border-border rounded-lg shadow-lg z-50 p-3">
                  <p className="text-sm text-muted-foreground text-center">No results found</p>
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 md:gap-4">
            <button className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary text-sm font-medium text-foreground hover:bg-muted transition-colors">
              <Globe size={14} />
              <span className="hidden md:inline">🇱🇨 St. Lucia</span>
              <span className="md:hidden">🇱🇨</span>
            </button>
            <button
              onClick={() => navigate("/leave-management")}
              className="relative p-2 rounded-lg hover:bg-secondary transition-colors"
              title="Notifications"
            >
              <Bell size={18} className="text-muted-foreground" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-accent rounded-full" />
            </button>
            <button
              onClick={() => navigate("/portal")}
              className="w-8 h-8 rounded-full bg-primary flex items-center justify-center hover:bg-primary/90 transition-colors"
              title="My Portal"
            >
              <span className="text-primary-foreground text-xs font-bold">{userInitials}</span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-background pb-16 md:pb-0">
          <Outlet />
          <PanicButton />
        </main>

        {/* Mobile Bottom Navigation */}
        <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-card border-t border-border flex items-center justify-around px-1 py-1 z-30 safe-bottom">
          {bottomNavItems.map((item) => {
            const isActive = location.pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => handleNav(item.path)}
                className={cn(
                  "flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg transition-colors min-w-0 flex-1",
                  isActive ? "text-primary" : "text-muted-foreground"
                )}
              >
                <item.icon size={20} />
                <span className="text-[10px] font-medium truncate w-full text-center">{item.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => setMobileOpen(true)}
            className="flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg text-muted-foreground transition-colors min-w-0 flex-1"
          >
            <Menu size={20} />
            <span className="text-[10px] font-medium">More</span>
          </button>
        </nav>
      </div>
    </div>
    <VoiceCommandListener />
    </>
  );
}
