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
  Shield,
  CheckCircle,
  XCircle,
  TimerOff,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { sampleEmployees, sampleAttendance } from "@/lib/sample-data";
import { calculatePayroll, formatCurrency, ST_LUCIA_CONFIG } from "@/lib/payroll-engine";
import { useNavigate } from "react-router-dom";
import { useRef, useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import AttendanceClock from "@/components/AttendanceClock";
import caribbeanHero from "@/assets/caribbean-hero.jpg";

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
  const [fieldOps, setFieldOps] = useState({ activeProjects: 0, pendingPayments: 0, pendingAmount: 0, checkedOut: 0, totalEquipment: 0, todayReports: 0, weeklyReports: [] as number[] });
  const [rosterData, setRosterData] = useState<{ name: string; siteName: string; shiftStart: string | null; shiftEnd: string | null; clockedIn: boolean; lateMinutes: number | null }[]>([]);
  const [lateAlerts, setLateAlerts] = useState<{ name: string; siteName: string; shiftStart: string; lateMinutes: number; clockedInAt: string | null }[]>([]);

  useEffect(() => {
    const fetchFieldOps = async () => {
      const today = new Date();
      const todayStr = today.toISOString().split("T")[0];
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 6);
      const weekAgoStr = weekAgo.toISOString().split("T")[0];
      const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
      const todayDay = dayNames[today.getDay()];

      const [{ count: activeProjects }, { data: payments }, { count: checkedOut }, { count: totalEquipment }, { count: todayReports }, { data: weekReports }, { data: todayAssignments }, { data: allProfiles }, { data: allSites }, { data: todayPunches }] = await Promise.all([
        supabase.from("projects").select("*", { count: "exact", head: true }).eq("status", "active"),
        supabase.from("contractor_payments").select("amount").eq("status", "pending"),
        supabase.from("equipment_checkouts").select("*", { count: "exact", head: true }).is("returned_at", null),
        supabase.from("equipment").select("*", { count: "exact", head: true }),
        supabase.from("daily_reports").select("*", { count: "exact", head: true }).eq("report_date", todayStr),
        supabase.from("daily_reports").select("report_date").gte("report_date", weekAgoStr).lte("report_date", todayStr),
        supabase.from("guard_assignments").select("user_id, site_id, shift_start, shift_end, days_of_week").eq("is_active", true),
        supabase.from("profiles").select("user_id, first_name, last_name").eq("status", "Active"),
        supabase.from("client_sites").select("id, name"),
        supabase.from("clock_punches").select("user_id, punch_type, punched_at").gte("punched_at", todayStr).lte("punched_at", todayStr + "T23:59:59"),
      ]);

      // Build 7-day counts array
      const dayCounts: number[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(weekAgo);
        d.setDate(d.getDate() + i);
        const ds = d.toISOString().split("T")[0];
        dayCounts.push((weekReports || []).filter(r => r.report_date === ds).length);
      }

      const now = new Date();
      const roster = (todayAssignments || [])
        .filter(a => !a.days_of_week || a.days_of_week.length === 0 || a.days_of_week.includes(todayDay))
        .map(a => {
          const p = (allProfiles || []).find(p => p.user_id === a.user_id);
          const s = (allSites || []).find(s => s.id === a.site_id);
          const clockInPunch = (todayPunches || []).find(tp => tp.user_id === a.user_id && tp.punch_type === "clock_in");
          const hasClockedIn = !!clockInPunch;
          
          // Calculate late minutes
          let lateMinutes: number | null = null;
          if (a.shift_start) {
            const [shiftH, shiftM] = a.shift_start.split(":").map(Number);
            const shiftTime = new Date(today);
            shiftTime.setHours(shiftH, shiftM, 0, 0);
            
            if (hasClockedIn && clockInPunch.punched_at) {
              const clockInTime = new Date(clockInPunch.punched_at);
              const diffMs = clockInTime.getTime() - shiftTime.getTime();
              if (diffMs > 5 * 60 * 1000) { // 5 min grace period
                lateMinutes = Math.floor(diffMs / 60000);
              }
            } else if (now.getTime() > shiftTime.getTime() + 5 * 60 * 1000) {
              // Not clocked in and past shift start + grace
              lateMinutes = Math.floor((now.getTime() - shiftTime.getTime()) / 60000);
            }
          }
          
          return {
            name: p ? `${p.first_name} ${p.last_name}` : "Unknown",
            siteName: s?.name || "Unknown",
            shiftStart: a.shift_start,
            shiftEnd: a.shift_end,
            clockedIn: hasClockedIn,
            lateMinutes,
          };
        });
      setRosterData(roster);

      // Build late alerts (only guards who are late or were late)
      const late = roster
        .filter(g => g.lateMinutes !== null && g.lateMinutes > 0 && g.shiftStart)
        .map(g => ({
          name: g.name,
          siteName: g.siteName,
          shiftStart: g.shiftStart!,
          lateMinutes: g.lateMinutes!,
          clockedInAt: g.clockedIn ? "Arrived late" : null,
        }))
        .sort((a, b) => b.lateMinutes - a.lateMinutes);
      setLateAlerts(late);

      setFieldOps({
        activeProjects: activeProjects || 0,
        pendingPayments: payments?.length || 0,
        pendingAmount: payments?.reduce((s, p) => s + Number(p.amount), 0) || 0,
        checkedOut: checkedOut || 0,
        totalEquipment: totalEquipment || 0,
        todayReports: todayReports || 0,
        weeklyReports: dayCounts,
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
    { label: "Total Employees", tile: "carib-sea", value: activeEmployees.length.toString(), icon: Users, color: "text-primary", bgColor: "bg-primary/10", path: "/employees" },
    { label: "Monthly Gross", tile: "carib-palm", value: formatCurrency(totalGross, "$"), icon: DollarSign, color: "text-success", bgColor: "bg-success/10", path: "/payroll" },
    { label: "On Clock Today", tile: "carib-coral", value: onClockToday.toString(), icon: Clock, color: "text-primary", bgColor: "bg-primary/10", path: "/attendance" },
    { label: "Next Pay Date", tile: "carib-mango", value: "Mar 31", icon: CalendarDays, color: "text-accent-foreground", bgColor: "bg-accent/20", path: "/payroll" },
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
      className="carib-sand min-h-full p-4 md:p-6 max-w-7xl mx-auto space-y-4 md:space-y-6 relative"
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
      <motion.div {...fadeUp} transition={{ delay: 0 }} onClick={() => navigate("/payroll")} role="link" className="relative overflow-hidden rounded-2xl shadow-lg cursor-pointer hover:shadow-xl transition-shadow">
        <img src={caribbeanHero} alt="Saint Lucia Pitons at sunset" className="absolute inset-0 w-full h-full object-cover" />
        <div className="absolute inset-0" style={{ background: "linear-gradient(120deg, hsl(195 90% 18% / 0.92) 0%, hsl(330 80% 35% / 0.82) 55%, hsl(18 90% 45% / 0.75) 100%)" }} />
        <div className="relative px-6 py-7 md:px-8 md:py-9" style={{ color: "hsl(0 0% 100%)", textShadow: "0 1px 3px hsl(0 0% 0% / 0.45)" }}>
          <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "hsl(48 100% 70%)" }}>OECS HR & Payroll · Built for the Caribbean</p>
          <h1 className="text-3xl md:text-4xl font-display font-bold mt-2">
            Payroll that <span style={{ color: "hsl(48 100% 65%)" }}>moves</span> like the islands.
          </h1>
          <p className="text-sm md:text-base mt-2 max-w-xl" style={{ color: "hsl(0 0% 100% / 0.92)" }}>Welcome back. Here's your workforce summary.</p>
        </div>
      </motion.div>

      {/* Metrics */}
      <AttendanceClock />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((metric, i) => (
          <motion.div key={metric.label} {...fadeUp} transition={{ delay: 0.05 * (i + 1) }}>
            <Card
              className={`carib-tile ${(metric as any).tile} border-0 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all cursor-pointer group`}
              onClick={() => navigate(metric.path)}
            >
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide opacity-90">{metric.label}</p>
                    <p className="text-2xl font-display font-bold mt-1">{metric.value}</p>
                  </div>
                  <div className="relative z-10 p-2.5 rounded-lg bg-background/20 group-hover:scale-110 transition-transform">
                    <metric.icon size={20} />
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
          <Card className="carib-band shadow-card border-border/60 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display"><button type="button" onClick={() => navigate("/payroll")} className="hover:underline">Quick Actions →</button></CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {quickActions.map((action) => (
                <button
                  key={action.label}
                  onClick={() => navigate(action.path)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-all ${
                    action.accent
                      ? "carib-tile carib-coral shadow-md hover:brightness-110"
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
          <Card className="carib-band shadow-card border-border/60 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <AlertTriangle size={16} className="text-warning" />
                Compliance Alerts
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {lateAlerts.length > 0 && (
                <div
                  className="flex items-start gap-3 p-3 rounded-lg bg-destructive/10 border border-destructive/20 cursor-pointer hover:bg-destructive/15 transition-colors"
                  onClick={() => navigate("/late-clockin-report")}
                >
                  <TimerOff size={16} className="text-destructive mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-foreground">{lateAlerts.length} late clock-in{lateAlerts.length > 1 ? "s" : ""} today</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {lateAlerts.filter(a => !a.clockedInAt).length} guards still missing • View Report →
                    </p>
                  </div>
                </div>
              )}
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
              <div
                className="flex items-start gap-3 p-3 rounded-lg bg-success/5 border border-success/10 cursor-pointer hover:bg-success/10 transition-colors"
                onClick={() => navigate("/employees")}
              >
                <DollarSign size={16} className="text-success mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm font-medium text-foreground">All salaries above minimum wage</p>
                  <p className="text-xs text-muted-foreground mt-0.5">$6.52 XCD/hr threshold met — View employees →</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent Payroll Summary */}
        <motion.div {...fadeUp} transition={{ delay: 0.35 }}>
          <Card className="carib-band shadow-card border-border/60 hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display"><button type="button" onClick={() => navigate("/payroll")} className="hover:underline">February Payroll →</button></CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                {[
                  { label: "Gross Pay", value: formatCurrency(totalGross), color: "text-foreground" },
                  { label: "Total NIC (Employee)", value: formatCurrency(activeEmployees.reduce((s, e) => s + calculatePayroll(e.monthlySalary).employeeNIC, 0)), color: "text-destructive" },
                  { label: "Total PAYE", value: formatCurrency(activeEmployees.reduce((s, e) => s + calculatePayroll(e.monthlySalary).paye, 0)), color: "text-destructive" },
                  { label: "Net Pay", value: formatCurrency(totalPayroll), color: "text-success" },
                ].map((row) => (
                  <button type="button" key={row.label} onClick={() => navigate(row.label === "Gross Pay" || row.label === "Net Pay" ? "/payroll" : "/reports")} className="w-full flex items-center justify-between py-1.5 px-1 rounded-md border-b border-border/50 last:border-0 hover:bg-muted transition-colors text-left">
                    <span className="text-sm text-muted-foreground">{row.label}</span>
                    <span className={`text-sm font-semibold ${row.color}`}>{row.value}</span>
                  </button>
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

      {/* Late Clock-In Alerts */}
      {lateAlerts.length > 0 && (
        <motion.div {...fadeUp} transition={{ delay: 0.38 }}>
          <Card className="shadow-card border-destructive/30 bg-destructive/5">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base font-display flex items-center gap-2">
                  <TimerOff size={16} className="text-destructive" />
                  Late Clock-In Alerts
                  <Badge variant="destructive" className="text-[10px]">{lateAlerts.length}</Badge>
                </CardTitle>
                <button
                  onClick={() => navigate("/late-clockin-report")}
                  className="text-xs text-destructive font-medium hover:underline"
                >
                  View full report →
                </button>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {lateAlerts.slice(0, 6).map((alert, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-background border border-destructive/20">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{alert.name}</p>
                      <p className="text-[10px] text-muted-foreground truncate">{alert.siteName}</p>
                    </div>
                    <div className="flex flex-col items-end flex-shrink-0">
                      <Badge variant="destructive" className="text-[10px]">
                        {alert.lateMinutes >= 60
                          ? `${Math.floor(alert.lateMinutes / 60)}h ${alert.lateMinutes % 60}m late`
                          : `${alert.lateMinutes}m late`}
                      </Badge>
                      <span className="text-[10px] text-muted-foreground mt-0.5">
                        Shift: {alert.shiftStart} • {alert.clockedInAt || "No show"}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
              {lateAlerts.length > 6 && (
                <button onClick={() => navigate("/late-clockin-report")} className="w-full text-center text-xs text-destructive font-medium hover:underline mt-2">
                  +{lateAlerts.length - 6} more late guards — View Report →
                </button>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Field Operations Widget */}
      <motion.div {...fadeUp} transition={{ delay: 0.4 }}>
        <Card className="carib-band shadow-card border-border/60 hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-display flex items-center gap-2">
              <Briefcase size={16} className="text-primary" />
              Field Operations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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

              <div
                className="flex items-center gap-3 p-4 rounded-lg bg-success/5 border border-success/10 cursor-pointer hover:bg-success/10 transition-colors"
                onClick={() => navigate("/daily-reports")}
              >
                <div className="p-2 rounded-lg bg-success/10">
                  <ClipboardList size={18} className="text-success" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-2xl font-display font-bold text-foreground">{fieldOps.todayReports}</p>
                    {fieldOps.weeklyReports.length > 0 && (() => {
                      const max = Math.max(...fieldOps.weeklyReports, 1);
                      return (
                        <svg viewBox="0 0 48 20" className="w-12 h-5 flex-shrink-0" fill="none">
                          <polyline
                            points={fieldOps.weeklyReports.map((v, i) => `${i * 8},${20 - (v / max) * 16}`).join(" ")}
                            stroke="hsl(var(--success))"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            fill="none"
                          />
                          {fieldOps.weeklyReports.map((v, i) => (
                            <circle key={i} cx={i * 8} cy={20 - (v / max) * 16} r="1.2" fill="hsl(var(--success))" />
                          ))}
                        </svg>
                      );
                    })()}
                  </div>
                  <p className="text-xs text-muted-foreground">Reports Today</p>
                  <p className="text-[10px] text-muted-foreground">{fieldOps.weeklyReports.reduce((s, v) => s + v, 0)} this week</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Today's Roster Widget */}
      <motion.div {...fadeUp} transition={{ delay: 0.45 }}>
        <Card className="carib-band shadow-card border-border/60 hover:shadow-lg transition-shadow">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <Shield size={16} className="text-primary" />
                Today's Guard Roster
              </CardTitle>
              <button
                onClick={() => navigate("/roster")}
                className="text-xs text-primary font-medium hover:underline"
              >
                View full roster →
              </button>
            </div>
          </CardHeader>
          <CardContent>
            {rosterData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No guards scheduled today</p>
            ) : (
              <div className="space-y-2">
                <div className="flex items-center gap-4 mb-3 text-xs text-muted-foreground">
                  <span>{rosterData.length} scheduled</span>
                  <span className="flex items-center gap-1"><CheckCircle size={12} className="text-success" /> {rosterData.filter(r => r.clockedIn).length} clocked in</span>
                  <span className="flex items-center gap-1"><XCircle size={12} className="text-destructive" /> {rosterData.filter(r => !r.clockedIn).length} not yet</span>
                  {lateAlerts.length > 0 && (
                    <span className="flex items-center gap-1"><TimerOff size={12} className="text-destructive" /> {lateAlerts.length} late</span>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {rosterData.slice(0, 9).map((guard, i) => (
                    <button type="button" onClick={() => navigate(guard.lateMinutes && guard.lateMinutes > 0 ? "/late-clockin-report" : "/attendance")} key={i} className={`w-full text-left flex items-center justify-between p-3 rounded-lg border transition-colors hover:shadow-md hover:-translate-y-0.5 ${
                      guard.lateMinutes && guard.lateMinutes > 0
                        ? "bg-destructive/10 border-destructive/30"
                        : guard.clockedIn
                          ? "bg-success/5 border-success/20"
                          : "bg-destructive/5 border-destructive/20"
                    }`}>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{guard.name}</p>
                        <p className="text-[10px] text-muted-foreground truncate">{guard.siteName}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {guard.lateMinutes && guard.lateMinutes > 0 ? (
                          <Badge variant="destructive" className="text-[9px] px-1.5 py-0">
                            {guard.lateMinutes}m late
                          </Badge>
                        ) : guard.shiftStart ? (
                          <span className="text-[10px] text-muted-foreground">{guard.shiftStart}</span>
                        ) : null}
                        {guard.clockedIn ? (
                          <CheckCircle size={16} className="text-success" />
                        ) : (
                          <XCircle size={16} className="text-destructive/60" />
                        )}
                      </div>
                    </button>
                  ))}
                </div>
                {rosterData.length > 9 && (
                  <button onClick={() => navigate("/roster")} className="w-full text-center text-xs text-primary font-medium hover:underline mt-2">
                    +{rosterData.length - 9} more guards →
                  </button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
