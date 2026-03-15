import { motion } from "framer-motion";
import {
  Users,
  DollarSign,
  Clock,
  CalendarDays,
  TrendingUp,
  AlertTriangle,
  ArrowRight,
  UserPlus,
  PlayCircle,
  FileDown,
  RefreshCw,
  Briefcase,
  Wrench,
  ClipboardList,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { sampleEmployees, sampleAttendance } from "@/lib/sample-data";
import { calculatePayroll, formatCurrency, ST_LUCIA_CONFIG } from "@/lib/payroll-engine";
import { useNavigate } from "react-router-dom";
import { useRef, useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

function usePullToRefresh(onRefresh: () => Promise<void>) {
  const [pulling, setPulling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const threshold = 80;

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    if (containerRef.current && containerRef.current.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
      setPulling(true);
    }
  }, []);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    if (!pulling) return;
    const delta = e.touches[0].clientY - startY.current;
    if (delta > 0) {
      setPullDistance(Math.min(delta * 0.5, 120));
    }
  }, [pulling]);

  const onTouchEnd = useCallback(async () => {
    if (pullDistance >= threshold && !refreshing) {
      setRefreshing(true);
      setPullDistance(threshold);
      await onRefresh();
      setRefreshing(false);
    }
    setPulling(false);
    setPullDistance(0);
  }, [pullDistance, refreshing, onRefresh, threshold]);

  return { containerRef, pullDistance, refreshing, onTouchStart, onTouchMove, onTouchEnd, threshold };
}

export default function DashboardPage() {
  const navigate = useNavigate();
  const [refreshKey, setRefreshKey] = useState(0);
  const [fieldOps, setFieldOps] = useState({ activeProjects: 0, pendingPayments: 0, pendingAmount: 0, checkedOut: 0, totalEquipment: 0, todayReports: 0 });

  useEffect(() => {
    const fetchFieldOps = async () => {
      const today = new Date().toISOString().split("T")[0];
      const [{ count: activeProjects }, { data: payments }, { count: checkedOut }, { count: totalEquipment }, { count: todayReports }] = await Promise.all([
        supabase.from("projects").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("contractor_payments").select("amount").eq("status", "pending"),
        supabase.from("equipment_checkouts").select("*", { count: "exact", head: true }).is("returned_at", null),
        supabase.from("equipment").select("*", { count: "exact", head: true }),
        supabase.from("daily_reports").select("*", { count: "exact", head: true }).eq("report_date", today),
      ]);
      setFieldOps({
        activeProjects: activeProjects || 0,
        pendingPayments: payments?.length || 0,
        pendingAmount: payments?.reduce((s, p) => s + Number(p.amount), 0) || 0,
        checkedOut: checkedOut || 0,
        totalEquipment: totalEquipment || 0,
        todayReports: todayReports || 0,
      });
    };
    fetchFieldOps();
  }, [refreshKey]);

  const handleRefresh = useCallback(async () => {
    await new Promise((r) => setTimeout(r, 800));
    setRefreshKey((k) => k + 1);
  }, []);

  const { containerRef, pullDistance, refreshing, onTouchStart, onTouchMove, onTouchEnd, threshold } = usePullToRefresh(handleRefresh);
  const activeEmployees = sampleEmployees.filter((e) => e.status === "Active");
  const totalPayroll = activeEmployees.reduce((sum, e) => {
    const result = calculatePayroll(e.monthlySalary, ST_LUCIA_CONFIG);
    return sum + result.netPay;
  }, 0);
  const totalGross = activeEmployees.reduce((sum, e) => sum + e.monthlySalary, 0);
  const onClockToday = sampleAttendance.filter(
    (a) => a.date === "2026-03-06" && a.clockIn && a.status === "Complete"
  ).length;
  const lateToday = sampleAttendance.filter((a) => a.late).length;

  const metrics = [
    { label: "Total Employees", value: activeEmployees.length.toString(), icon: Users, color: "text-primary", bgColor: "bg-primary/10", path: "/employees" },
    { label: "Monthly Gross", value: formatCurrency(totalGross, "$"), icon: DollarSign, color: "text-success", bgColor: "bg-success/10", path: "/payroll" },
    { label: "On Clock Today", value: onClockToday.toString(), icon: Clock, color: "text-primary", bgColor: "bg-primary/10", path: "/attendance" },
    { label: "Next Pay Date", value: "Mar 31", icon: CalendarDays, color: "text-accent-foreground", bgColor: "bg-accent/20", path: "/payroll" },
  ];

  const quickActions = [
    { label: "Run Payroll", icon: PlayCircle, path: "/payroll", accent: true },
    { label: "Add Employee", icon: UserPlus, path: "/employees" },
    { label: "Export Reports", icon: FileDown, path: "/reports" },
  ];

  return (
    <div
      ref={containerRef}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      className="p-4 md:p-6 max-w-7xl mx-auto space-y-4 md:space-y-6 relative"
    >
      {/* Pull to refresh indicator */}
      <div
        className="flex items-center justify-center overflow-hidden transition-all duration-200 md:hidden"
        style={{ height: pullDistance > 0 ? `${pullDistance}px` : 0 }}
      >
        <RefreshCw
          size={22}
          className={`text-primary transition-transform ${refreshing ? "animate-spin" : ""}`}
          style={{ transform: `rotate(${(pullDistance / threshold) * 360}deg)` }}
        />
        <span className="ml-2 text-xs text-muted-foreground">
          {refreshing ? "Refreshing…" : pullDistance >= threshold ? "Release to refresh" : "Pull to refresh"}
        </span>
      </div>
      {/* Page Header */}
      <motion.div {...fadeUp} transition={{ delay: 0 }}>
        <h1 className="text-2xl font-display font-bold text-foreground">Dashboard</h1>
        <p className="text-sm text-muted-foreground mt-1">Welcome back. Here's your workforce summary.</p>
      </motion.div>

      {/* Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, i) => (
          <motion.div key={metric.label} {...fadeUp} transition={{ delay: 0.05 * (i + 1) }}>
            <Card
              className="shadow-card border-border/60 hover:shadow-md transition-shadow cursor-pointer group"
              onClick={() => navigate(metric.path)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">{metric.label}</p>
                    <p className="text-2xl font-display font-bold text-foreground mt-1">{metric.value}</p>
                  </div>
                  <div className={`p-2.5 rounded-lg ${metric.bgColor} group-hover:scale-110 transition-transform`}>
                    <metric.icon size={20} className={metric.color} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Quick Actions */}
        <motion.div {...fadeUp} transition={{ delay: 0.25 }}>
          <Card className="shadow-card border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => navigate(action.path)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    action.accent
                      ? "bg-primary text-primary-foreground hover:bg-primary/90"
                      : "bg-secondary text-foreground hover:bg-muted"
                  }`}
                >
                  <action.icon size={18} />
                  <span>{action.label}</span>
                  <ArrowRight size={14} className="ml-auto" />
                </button>
              ))}
            </CardContent>
          </Card>
        </motion.div>

        {/* Compliance Alerts */}
        <motion.div {...fadeUp} transition={{ delay: 0.3 }}>
          <Card className="shadow-card border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <AlertTriangle size={16} className="text-warning" />
                Compliance Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div
                className="flex items-start gap-3 p-3 rounded-lg bg-warning/10 border border-warning/20 cursor-pointer hover:bg-warning/15 transition-colors"
                onClick={() => navigate("/attendance")}
              >
                <AlertTriangle size={16} className="text-warning mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">{lateToday} late arrivals this week</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Review attendance records →</p>
                </div>
              </div>
              <div
                className="flex items-start gap-3 p-3 rounded-lg bg-primary/5 border border-primary/10 cursor-pointer hover:bg-primary/10 transition-colors"
                onClick={() => navigate("/reports")}
              >
                <TrendingUp size={16} className="text-primary mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">NIC remittance due Mar 15</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Generate C3 report →</p>
                </div>
              </div>
              <div className="flex items-start gap-3 p-3 rounded-lg bg-success/5 border border-success/10">
                <DollarSign size={16} className="text-success mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">All salaries above minimum wage</p>
                  <p className="text-xs text-muted-foreground mt-0.5">$6.52 XCD/hr threshold met</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Payroll Summary */}
        <motion.div {...fadeUp} transition={{ delay: 0.35 }}>
          <Card className="shadow-card border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display">February Payroll</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {[
                  { label: "Gross Pay", value: formatCurrency(totalGross), color: "text-foreground" },
                  { label: "Total NIC (Employee)", value: formatCurrency(activeEmployees.reduce((s, e) => s + calculatePayroll(e.monthlySalary).employeeNIC, 0)), color: "text-destructive" },
                  { label: "Total PAYE", value: formatCurrency(activeEmployees.reduce((s, e) => s + calculatePayroll(e.monthlySalary).paye, 0)), color: "text-destructive" },
                  { label: "Net Pay", value: formatCurrency(totalPayroll), color: "text-success" },
                ].map((row) => (
                  <div key={row.label} className="flex items-center justify-between py-1.5 border-b border-border/50 last:border-0">
                    <span className="text-sm text-muted-foreground">{row.label}</span>
                    <span className={`text-sm font-semibold ${row.color}`}>{row.value}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => navigate("/payroll")}
                className="w-full text-center text-sm text-primary font-medium hover:underline"
              >
                View full payroll →
              </button>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Field Operations Widget */}
      <motion.div {...fadeUp} transition={{ delay: 0.4 }}>
        <Card className="shadow-card border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Briefcase size={16} className="text-primary" />
              Field Operations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div
                className="flex items-center gap-3 p-4 rounded-lg bg-primary/5 border border-primary/10 cursor-pointer hover:bg-primary/10 transition-colors"
                onClick={() => navigate("/projects")}
              >
                <div className="p-2 rounded-lg bg-primary/10">
                  <Briefcase size={18} className="text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-display font-bold text-foreground">{fieldOps.activeProjects}</p>
                  <p className="text-xs text-muted-foreground">Active Projects</p>
                </div>
              </div>

              <div
                className="flex items-center gap-3 p-4 rounded-lg bg-warning/5 border border-warning/10 cursor-pointer hover:bg-warning/10 transition-colors"
                onClick={() => navigate("/contractors")}
              >
                <div className="p-2 rounded-lg bg-warning/10">
                  <DollarSign size={18} className="text-warning" />
                </div>
                <div>
                  <p className="text-2xl font-display font-bold text-foreground">{fieldOps.pendingPayments}</p>
                  <p className="text-xs text-muted-foreground">Pending Payments</p>
                  {fieldOps.pendingAmount > 0 && (
                    <Badge variant="secondary" className="mt-1 text-[10px] bg-warning/10 text-warning">
                      {formatCurrency(fieldOps.pendingAmount)} due
                    </Badge>
                  )}
                </div>
              </div>

              <div
                className="flex items-center gap-3 p-4 rounded-lg bg-accent/10 border border-accent/10 cursor-pointer hover:bg-accent/20 transition-colors"
                onClick={() => navigate("/equipment")}
              >
                <div className="p-2 rounded-lg bg-accent/20">
                  <Wrench size={18} className="text-accent-foreground" />
                </div>
                <div>
                  <p className="text-2xl font-display font-bold text-foreground">{fieldOps.checkedOut}</p>
                  <p className="text-xs text-muted-foreground">Equipment Out</p>
                  <Badge variant="secondary" className="mt-1 text-[10px]">
                    of {fieldOps.totalEquipment} total
                  </Badge>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
