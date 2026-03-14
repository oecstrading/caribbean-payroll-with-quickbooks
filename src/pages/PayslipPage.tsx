import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Printer, Download, ArrowLeft, Building, User, Calendar, DollarSign, Mail, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sampleEmployees, type Employee } from "@/lib/sample-data";
import { calculatePayroll, formatCurrency, ST_LUCIA_CONFIG } from "@/lib/payroll-engine";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCompany } from "@/hooks/useCompany";

export default function PayslipPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const initialId = searchParams.get("employee") || sampleEmployees[0]?.id || "";
  const [selectedId, setSelectedId] = useState(initialId);
  const [payPeriod] = useState("March 2026");
  const payslipRef = useRef<HTMLDivElement>(null);
  const [emailing, setEmailing] = useState(false);

  const employee = sampleEmployees.find((e) => e.id === selectedId);
  const payroll = employee ? calculatePayroll(employee.monthlySalary, ST_LUCIA_CONFIG) : null;

  const handlePrint = () => {
    window.print();
  };

  const handleEmailPayslip = async () => {
    if (!employee) return;
    setEmailing(true);
    try {
      const payslipHtml = payslipRef.current?.innerHTML || "";
      const { data, error } = await supabase.functions.invoke("email-payslip", {
        body: {
          user_id: employee.id,
          payslip_html: payslipHtml,
          period: payPeriod,
        },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Failed to email payslip");
      toast.success(data.message || "Payslip emailed successfully");
    } catch (err: any) {
      toast.error(err.message || "Failed to email payslip");
    } finally {
      setEmailing(false);
    }
  };

  if (!employee || !payroll) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center">
        <p className="text-muted-foreground">No employee selected.</p>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      {/* Header - no print */}
      <div className="no-print flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate(-1)}
            className="p-2 rounded-lg hover:bg-secondary transition-colors"
          >
            <ArrowLeft size={20} className="text-muted-foreground" />
          </button>
          <div>
            <h1 className="text-2xl font-display font-bold text-foreground">Payslip Generator</h1>
            <p className="text-sm text-muted-foreground mt-1">Generate and print employee payslips</p>
          </div>
        </div>
        <div className="flex gap-2">
          <button
            onClick={handleEmailPayslip}
            disabled={emailing}
            className="flex items-center gap-2 px-4 py-2.5 bg-secondary text-foreground rounded-lg text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            {emailing ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
            {emailing ? "Sending..." : "Email Payslip"}
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            <Printer size={16} />
            Print
          </button>
        </div>
      </div>

      {/* Employee Selector - no print */}
      <div className="no-print">
        <Card className="shadow-card border-border/60">
          <CardContent className="p-4">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2 block">
              Select Employee
            </label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {sampleEmployees
                .filter((e) => e.status === "Active")
                .map((e) => (
                  <option key={e.id} value={e.id}>
                    {e.firstName} {e.lastName} — {e.department} — {e.jobTitle}
                  </option>
                ))}
            </select>
          </CardContent>
        </Card>
      </div>

      {/* Payslip Document */}
      <motion.div
        ref={payslipRef}
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        key={selectedId}
      >
        <Card className="shadow-card border-border/60 overflow-hidden print:shadow-none print:border">
          {/* Company Header */}
          <div className="bg-primary px-6 py-5 text-primary-foreground">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary-foreground/20 flex items-center justify-center">
                  <Building size={20} />
                </div>
                <div>
                  <h2 className="font-display font-bold text-lg">Promotech Solutions Ltd.</h2>
                  <p className="text-primary-foreground/70 text-xs">Castries, Saint Lucia • EMP-NIC-2022-001</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-display font-bold text-sm">PAYSLIP</p>
                <p className="text-primary-foreground/70 text-xs">{payPeriod}</p>
              </div>
            </div>
          </div>

          <CardContent className="p-6 space-y-6">
            {/* Employee Info */}
            <div className="grid grid-cols-2 gap-6">
              <div className="space-y-3">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <User size={12} /> Employee Details
                </h3>
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Name</span>
                    <span className="text-sm font-medium text-foreground">{employee.firstName} {employee.lastName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Employee #</span>
                    <span className="text-sm font-mono text-foreground">{employee.personId}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Department</span>
                    <span className="text-sm text-foreground">{employee.department}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Job Title</span>
                    <span className="text-sm text-foreground">{employee.jobTitle}</span>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Calendar size={12} /> Tax & Statutory
                </h3>
                <div className="space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">NIC No.</span>
                    <span className="text-sm font-mono text-foreground">{employee.nicNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">TAN No.</span>
                    <span className="text-sm font-mono text-foreground">{employee.tanNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Pay Period</span>
                    <span className="text-sm text-foreground">{payPeriod}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Pay Date</span>
                    <span className="text-sm text-foreground">March 31, 2026</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="border-t border-border" />

            {/* Earnings */}
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3 flex items-center gap-1.5">
                <DollarSign size={12} /> Earnings
              </h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 font-medium text-muted-foreground">Description</th>
                    <th className="text-right py-2 font-medium text-muted-foreground">Current</th>
                    <th className="text-right py-2 font-medium text-muted-foreground">YTD (3 months)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/50">
                    <td className="py-2 text-foreground">Basic Salary</td>
                    <td className="py-2 text-right font-mono text-foreground">{formatCurrency(payroll.basicPay)}</td>
                    <td className="py-2 text-right font-mono text-muted-foreground">{formatCurrency(payroll.basicPay * 3)}</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 text-foreground">Overtime Pay</td>
                    <td className="py-2 text-right font-mono text-foreground">{formatCurrency(payroll.overtimePay)}</td>
                    <td className="py-2 text-right font-mono text-muted-foreground">{formatCurrency(payroll.overtimePay * 3)}</td>
                  </tr>
                  <tr className="font-semibold">
                    <td className="py-2 text-foreground">Total Earnings</td>
                    <td className="py-2 text-right font-mono text-foreground">{formatCurrency(payroll.grossMonthly)}</td>
                    <td className="py-2 text-right font-mono text-muted-foreground">{formatCurrency(payroll.grossMonthly * 3)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Deductions */}
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Statutory Deductions</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 font-medium text-muted-foreground">Description</th>
                    <th className="text-right py-2 font-medium text-muted-foreground">Current</th>
                    <th className="text-right py-2 font-medium text-muted-foreground">YTD (3 months)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-border/50">
                    <td className="py-2 text-foreground">NIC — Employee (5%)</td>
                    <td className="py-2 text-right font-mono text-destructive">{formatCurrency(payroll.employeeNIC)}</td>
                    <td className="py-2 text-right font-mono text-muted-foreground">{formatCurrency(payroll.employeeNIC * 3)}</td>
                  </tr>
                  <tr className="border-b border-border/50">
                    <td className="py-2 text-foreground">PAYE Income Tax</td>
                    <td className="py-2 text-right font-mono text-destructive">{formatCurrency(payroll.paye)}</td>
                    <td className="py-2 text-right font-mono text-muted-foreground">{formatCurrency(payroll.paye * 3)}</td>
                  </tr>
                  <tr className="font-semibold">
                    <td className="py-2 text-foreground">Total Deductions</td>
                    <td className="py-2 text-right font-mono text-destructive">{formatCurrency(payroll.totalDeductions)}</td>
                    <td className="py-2 text-right font-mono text-muted-foreground">{formatCurrency(payroll.totalDeductions * 3)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Employer Contributions (info only) */}
            <div className="p-4 rounded-lg bg-secondary/50 border border-border/50">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Employer Contributions (not deducted from pay)</h3>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">NIC — Employer (5%)</span>
                <span className="font-mono text-foreground">{formatCurrency(payroll.employerNIC)}</span>
              </div>
            </div>

            <div className="border-t border-border" />

            {/* Net Pay */}
            <div className="p-5 rounded-lg bg-success/5 border border-success/20">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Net Pay</p>
                  <p className="text-3xl font-display font-bold text-success mt-1">
                    {formatCurrency(payroll.netPay)} <span className="text-lg">XCD</span>
                  </p>
                </div>
                <DollarSign size={32} className="text-success/30" />
              </div>
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-muted-foreground space-y-1 pt-2">
              <p>This payslip is generated by OECS HR & Payroll Solutions</p>
              <p>Promotech Solutions Ltd. • Castries, Saint Lucia • Tax ID: TID-LC-00123</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
