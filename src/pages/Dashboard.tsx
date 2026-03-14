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
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sampleEmployees, sampleAttendance } from "@/lib/sample-data";
import { calculatePayroll, formatCurrency, ST_LUCIA_CONFIG } from "@/lib/payroll-engine";
import { useNavigate } from "react-router-dom";

const fadeUp = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

export default function DashboardPage() {
  const navigate = useNavigate();
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
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4 md:space-y-6">
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
    </div>
  );
}
