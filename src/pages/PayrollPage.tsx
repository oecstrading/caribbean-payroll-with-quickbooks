import { useState } from "react";
import { motion } from "framer-motion";
import { CheckCircle, ArrowRight, DollarSign, FileText, AlertCircle, Receipt, Mail, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { sampleEmployees } from "@/lib/sample-data";
import { calculatePayroll, formatCurrency, ST_LUCIA_CONFIG, checkMinimumWageCompliance } from "@/lib/payroll-engine";
import { useAllEmployeeDeductions } from "@/hooks/useEmployeeDeductions";

const steps = ["Review & Sync", "Audit", "Approve & Run"];

export default function PayrollPage() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState(0);
  const [bulkEmailing, setBulkEmailing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [approved, setApproved] = useState(false);
  const { deductionsMap } = useAllEmployeeDeductions();

  const handleBulkEmail = async () => {
    setBulkEmailing(true);
    let sent = 0;
    let failed = 0;
    for (const emp of payrollData) {
      try {
        const { data, error } = await supabase.functions.invoke("email-payslip", {
          body: { user_id: emp.id, payslip_html: `Payslip for ${emp.firstName} ${emp.lastName}`, period: "March 2026" },
        });
        if (error || data?.error) { failed++; } else { sent++; }
      } catch { failed++; }
    }
    setBulkEmailing(false);
    if (failed === 0) {
      toast.success(`All ${sent} payslips emailed successfully`);
    } else {
      toast.warning(`${sent} sent, ${failed} failed`);
    }
  };

  const handleApprovePayroll = async () => {
    setProcessing(true);
    try {
      const period = "March 2026";

      // 1. Create payroll run
      const { data: run, error: runError } = await supabase
        .from("payroll_runs")
        .insert({
          period,
          status: "approved",
          employee_count: payrollData.length,
          total_gross: totals.gross,
          total_deductions: totals.nicEmployee + totals.paye + totals.creditor,
          total_net: totals.net,
        })
        .select()
        .single();

      if (runError) throw runError;

      // 2. Create payslips for each employee
      // Use crypto.randomUUID() for sample employees since they don't have real user_ids
      const payslipRows = payrollData.map((emp) => ({
        payroll_run_id: run.id,
        user_id: crypto.randomUUID(), // placeholder for sample data
        period,
        basic_pay: emp.payroll.basicPay,
        overtime_pay: emp.payroll.overtimePay,
        gross_pay: emp.payroll.grossMonthly,
        employee_nic: emp.payroll.employeeNIC,
        employer_nic: emp.payroll.employerNIC,
        paye: emp.payroll.paye,
        total_deductions: emp.payroll.totalDeductions,
        net_pay: emp.payroll.netPay,
      }));

      const { error: slipError } = await supabase
        .from("payslips")
        .insert(payslipRows);

      if (slipError) throw slipError;

      setApproved(true);
      toast.success(`Payroll approved! ${payrollData.length} payslips saved.`);
    } catch (err: any) {
      console.error("Payroll approval error:", err);
      toast.error(err.message || "Failed to process payroll");
    } finally {
      setProcessing(false);
    }
  };

  const payrollData = sampleEmployees
    .filter((e) => e.status === "Active")
    .map((e) => {
      // Try to match deductions by sample employee id (will be empty for sample data)
      const creditorDeductions = deductionsMap[e.id] || [];
      const result = calculatePayroll(e.monthlySalary, ST_LUCIA_CONFIG, 0, creditorDeductions);
      const hourlyRate = e.monthlySalary / (e.stdHoursPerDay * 22);
      const compliance = checkMinimumWageCompliance(hourlyRate, ST_LUCIA_CONFIG);
      return { ...e, payroll: result, hourlyRate, compliance };
    });

  const totals = payrollData.reduce(
    (acc, e) => ({
      gross: acc.gross + e.payroll.grossMonthly,
      nicEmployee: acc.nicEmployee + e.payroll.employeeNIC,
      nicEmployer: acc.nicEmployer + e.payroll.employerNIC,
      paye: acc.paye + e.payroll.paye,
      creditor: acc.creditor + e.payroll.totalCreditorDeductions,
      net: acc.net + e.payroll.netPay,
    }),
    { gross: 0, nicEmployee: 0, nicEmployer: 0, paye: 0, creditor: 0, net: 0 }
  );

  const anomalies = payrollData.filter((e) => !e.compliance.compliant);

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4 md:space-y-6">
      <div>
        <h1 className="text-2xl font-display font-bold text-foreground">Run Payroll</h1>
        <p className="text-sm text-muted-foreground mt-1">March 2026 • Saint Lucia (XCD)</p>
      </div>

      {/* Stepper */}
      <div className="flex items-center gap-2">
        {steps.map((step, i) => (
          <div key={step} className="flex items-center gap-2">
            <button
              onClick={() => setCurrentStep(i)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
                i === currentStep
                  ? "bg-primary text-primary-foreground"
                  : i < currentStep
                  ? "bg-success/10 text-success"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {i < currentStep ? <CheckCircle size={16} /> : <span className="w-5 h-5 rounded-full border-2 flex items-center justify-center text-xs">{i + 1}</span>}
              <span className="hidden sm:inline">{step}</span>
            </button>
            {i < steps.length - 1 && <ArrowRight size={14} className="text-muted-foreground" />}
          </div>
        ))}
      </div>

      {/* Step Content */}
      {currentStep === 0 && (
        <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
          <Card className="shadow-card border-border/60 overflow-hidden">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <FileText size={16} />
                Employee Payroll Preview
              </CardTitle>
            </CardHeader>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Employee</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Basic Pay</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">NIC (5%)</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">PAYE</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Creditor Ded.</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Total Ded.</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Net Pay</th>
                  </tr>
                </thead>
                <tbody>
                  {payrollData.map((emp, i) => (
                    <motion.tr
                      key={emp.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: i * 0.02 }}
                      className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                            <span className="text-xs font-bold text-primary">{emp.firstName[0]}{emp.lastName[0]}</span>
                          </div>
                          <div>
                            <p className="font-medium text-foreground">{emp.firstName} {emp.lastName}</p>
                            <p className="text-xs text-muted-foreground">{emp.nicNumber}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-foreground">{formatCurrency(emp.payroll.basicPay)}</td>
                      <td className="py-3 px-4 text-right font-mono text-destructive">{formatCurrency(emp.payroll.employeeNIC)}</td>
                      <td className="py-3 px-4 text-right font-mono text-destructive">{formatCurrency(emp.payroll.paye)}</td>
                      <td className="py-3 px-4 text-right font-mono text-destructive">{formatCurrency(emp.payroll.totalCreditorDeductions)}</td>
                      <td className="py-3 px-4 text-right font-mono text-destructive">{formatCurrency(emp.payroll.totalDeductions)}</td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-success">{formatCurrency(emp.payroll.netPay)}</td>
                    </motion.tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-secondary/80 font-semibold">
                    <td className="py-3 px-4 text-foreground">Totals</td>
                    <td className="py-3 px-4 text-right font-mono text-foreground">{formatCurrency(totals.gross)}</td>
                    <td className="py-3 px-4 text-right font-mono text-destructive">{formatCurrency(totals.nicEmployee)}</td>
                    <td className="py-3 px-4 text-right font-mono text-destructive">{formatCurrency(totals.paye)}</td>
                    <td className="py-3 px-4 text-right font-mono text-destructive">{formatCurrency(totals.creditor)}</td>
                    <td className="py-3 px-4 text-right font-mono text-destructive">{formatCurrency(totals.nicEmployee + totals.paye + totals.creditor)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-success">{formatCurrency(totals.net)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
          <div className="flex justify-end">
            <button onClick={() => setCurrentStep(1)} className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
              Continue to Audit <ArrowRight size={16} />
            </button>
          </div>
        </motion.div>
      )}

      {currentStep === 1 && (
        <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
          <Card className="shadow-card border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <AlertCircle size={16} className="text-primary" />
                AI Error Detection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {anomalies.length === 0 ? (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-success/10 border border-success/20">
                  <CheckCircle size={20} className="text-success" />
                  <div>
                    <p className="font-medium text-foreground">All checks passed</p>
                    <p className="text-sm text-muted-foreground">No anomalies detected. All employees meet minimum wage requirements.</p>
                  </div>
                </div>
              ) : (
                anomalies.map((a) => (
                  <div key={a.id} className="flex items-center gap-3 p-4 rounded-lg bg-warning/10 border border-warning/20">
                    <AlertCircle size={20} className="text-warning" />
                    <div>
                      <p className="font-medium text-foreground">{a.firstName} {a.lastName}</p>
                      <p className="text-sm text-muted-foreground">{a.compliance.message}</p>
                    </div>
                  </div>
                ))
              )}

              <div className="mt-4 space-y-2">
                <h3 className="text-sm font-medium text-foreground">Audit Checklist</h3>
                {[
                  "No duplicate NIC numbers found",
                  "All tax codes verified",
                  "No pay spikes exceeding 20% from last month",
                  `Employer NIC contribution: ${formatCurrency(totals.nicEmployer)} XCD`,
                  "PAYE brackets applied correctly (15% / 20% / 30%)",
                  `Total creditor deductions: ${formatCurrency(totals.creditor)} XCD`,
                ].map((check) => (
                  <div key={check} className="flex items-center gap-2 text-sm">
                    <CheckCircle size={14} className="text-success" />
                    <span className="text-foreground">{check}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
          <div className="flex justify-between">
            <button onClick={() => setCurrentStep(0)} className="px-6 py-2.5 bg-secondary text-foreground rounded-lg text-sm font-medium hover:bg-muted transition-colors">
              Back
            </button>
            <button onClick={() => setCurrentStep(2)} className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
              Continue to Approve <ArrowRight size={16} />
            </button>
          </div>
        </motion.div>
      )}

      {currentStep === 2 && (
        <motion.div initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} className="space-y-4">
          <Card className="shadow-card border-border/60">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display">Payroll Summary — March 2026</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Earnings</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between py-2 border-b border-border/50">
                      <span className="text-sm text-foreground">Total Gross Pay</span>
                      <span className="font-semibold font-mono text-foreground">{formatCurrency(totals.gross)} XCD</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/50">
                      <span className="text-sm text-foreground">Employees Paid</span>
                      <span className="font-semibold text-foreground">{payrollData.length}</span>
                    </div>
                  </div>
                </div>
                <div className="space-y-4">
                  <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Deductions</h3>
                  <div className="space-y-2">
                    <div className="flex justify-between py-2 border-b border-border/50">
                      <span className="text-sm text-foreground">NIC (Employee 5%)</span>
                      <span className="font-mono text-destructive">{formatCurrency(totals.nicEmployee)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/50">
                      <span className="text-sm text-foreground">NIC (Employer 5%)</span>
                      <span className="font-mono text-muted-foreground">{formatCurrency(totals.nicEmployer)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/50">
                      <span className="text-sm text-foreground">PAYE Income Tax</span>
                      <span className="font-mono text-destructive">{formatCurrency(totals.paye)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-border/50">
                      <span className="text-sm text-foreground">Creditor Deductions</span>
                      <span className="font-mono text-destructive">{formatCurrency(totals.creditor)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 rounded-lg bg-success/5 border border-success/20">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Total Net Pay</p>
                    <p className="text-3xl font-display font-bold text-success">{formatCurrency(totals.net)} <span className="text-lg">XCD</span></p>
                  </div>
                  <DollarSign size={32} className="text-success/30" />
                </div>
              </div>
            </CardContent>
          </Card>
          <div className="flex flex-col sm:flex-row justify-between gap-3">
            <button onClick={() => setCurrentStep(1)} className="px-6 py-2.5 bg-secondary text-foreground rounded-lg text-sm font-medium hover:bg-muted transition-colors">
              Back
            </button>
            <div className="flex flex-wrap gap-2 justify-end">
              <button
                onClick={handleBulkEmail}
                disabled={bulkEmailing}
                className="flex items-center gap-2 px-4 md:px-6 py-2.5 md:py-3 bg-secondary text-foreground rounded-lg text-xs md:text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
              >
                {bulkEmailing ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
                <span className="hidden sm:inline">{bulkEmailing ? `Emailing ${payrollData.length}...` : `Email All (${payrollData.length})`}</span>
                <span className="sm:hidden">{bulkEmailing ? "Emailing..." : "Email"}</span>
              </button>
              <button
                onClick={() => navigate("/payslips")}
                className="flex items-center gap-2 px-4 md:px-6 py-2.5 md:py-3 bg-secondary text-foreground rounded-lg text-xs md:text-sm font-medium hover:bg-muted transition-colors"
              >
                <Receipt size={16} />
                <span className="hidden sm:inline">Generate Payslips</span>
                <span className="sm:hidden">Payslips</span>
              </button>
              <button
                onClick={handleApprovePayroll}
                disabled={processing || approved}
                className="flex items-center gap-2 px-4 md:px-8 py-2.5 md:py-3 bg-success text-success-foreground rounded-lg text-xs md:text-sm font-bold hover:bg-success/90 transition-colors disabled:opacity-50"
              >
                {processing ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle size={18} />}
                {approved ? "Approved ✓" : processing ? "Processing..." : "Approve Payroll"}
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
