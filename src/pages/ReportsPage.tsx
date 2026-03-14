import { motion } from "framer-motion";
import { FileText, Download, Printer, Calendar } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sampleEmployees } from "@/lib/sample-data";
import { calculatePayroll, formatCurrency, ST_LUCIA_CONFIG } from "@/lib/payroll-engine";

export default function ReportsPage() {
  const payrollData = sampleEmployees.filter((e) => e.status === "Active").map((e) => ({
    ...e,
    payroll: calculatePayroll(e.monthlySalary, ST_LUCIA_CONFIG),
  }));

  const totals = payrollData.reduce(
    (acc, e) => ({
      gross: acc.gross + e.payroll.grossMonthly,
      nicEmployee: acc.nicEmployee + e.payroll.employeeNIC,
      nicEmployer: acc.nicEmployer + e.payroll.employerNIC,
      paye: acc.paye + e.payroll.paye,
    }),
    { gross: 0, nicEmployee: 0, nicEmployer: 0, paye: 0 }
  );

  const reports = [
    {
      title: "NIC C3 Schedule",
      description: "Monthly NIC contributions schedule for the National Insurance Corporation",
      icon: FileText,
      period: "March 2026",
      dueDate: "April 15, 2026",
      status: "Ready",
    },
    {
      title: "PAYE Monthly Remittance",
      description: "Monthly PAYE tax remittance report for the Inland Revenue Department (IRD)",
      icon: FileText,
      period: "March 2026",
      dueDate: "April 15, 2026",
      status: "Ready",
    },
    {
      title: "TD5 Annual Certificates",
      description: "Year-to-date earnings and deductions certificates for each employee",
      icon: FileText,
      period: "FY 2025/2026",
      dueDate: "June 30, 2026",
      status: "In Progress",
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Reports</h1>
        <p className="text-sm text-muted-foreground mt-1">Government reports, payslips, and statutory exports</p>
      </div>

      {/* Government Reports */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {reports.map((report, i) => (
          <motion.div
            key={report.title}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <Card className="shadow-card border-border/60 hover:shadow-md transition-shadow h-full">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <report.icon size={18} className="text-primary" />
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-full ${
                    report.status === "Ready" ? "bg-success/10 text-success" : "bg-accent/20 text-accent-foreground"
                  }`}>
                    {report.status}
                  </span>
                </div>
                <CardTitle className="text-base font-display mt-3">{report.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">{report.description}</p>
                <div className="space-y-2 text-xs text-muted-foreground mb-4">
                  <div className="flex items-center gap-2">
                    <Calendar size={12} />
                    <span>Period: {report.period}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Calendar size={12} />
                    <span>Due: {report.dueDate}</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors">
                    <Download size={14} /> Export
                  </button>
                  <button className="flex items-center justify-center gap-2 px-3 py-2 bg-secondary text-foreground rounded-lg text-xs font-medium hover:bg-muted transition-colors">
                    <Printer size={14} />
                  </button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* NIC C3 Preview */}
      <Card className="shadow-card border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display">NIC C3 Schedule Preview — March 2026</CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">#</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Employee Name</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">NIC Number</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Gross Earnings</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Employee NIC (5%)</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Employer NIC (5%)</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Total Contribution</th>
              </tr>
            </thead>
            <tbody>
              {payrollData.map((emp, i) => (
                <tr key={emp.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                  <td className="py-2.5 px-4 text-muted-foreground">{i + 1}</td>
                  <td className="py-2.5 px-4 font-medium text-foreground">{emp.firstName} {emp.lastName}</td>
                  <td className="py-2.5 px-4 font-mono text-xs text-muted-foreground">{emp.nicNumber}</td>
                  <td className="py-2.5 px-4 text-right font-mono text-foreground">{formatCurrency(emp.payroll.grossMonthly)}</td>
                  <td className="py-2.5 px-4 text-right font-mono text-foreground">{formatCurrency(emp.payroll.employeeNIC)}</td>
                  <td className="py-2.5 px-4 text-right font-mono text-foreground">{formatCurrency(emp.payroll.employerNIC)}</td>
                  <td className="py-2.5 px-4 text-right font-mono font-semibold text-foreground">{formatCurrency(emp.payroll.employeeNIC + emp.payroll.employerNIC)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-secondary/80 font-semibold">
                <td colSpan={3} className="py-3 px-4 text-foreground">Totals</td>
                <td className="py-3 px-4 text-right font-mono text-foreground">{formatCurrency(totals.gross)}</td>
                <td className="py-3 px-4 text-right font-mono text-foreground">{formatCurrency(totals.nicEmployee)}</td>
                <td className="py-3 px-4 text-right font-mono text-foreground">{formatCurrency(totals.nicEmployer)}</td>
                <td className="py-3 px-4 text-right font-mono font-bold text-primary">{formatCurrency(totals.nicEmployee + totals.nicEmployer)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
    </div>
  );
}
