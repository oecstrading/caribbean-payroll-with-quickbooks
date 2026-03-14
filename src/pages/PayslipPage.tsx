import { useState, useRef } from "react";
import { motion } from "framer-motion";
import { Printer, ArrowLeft, Building, User, Calendar, DollarSign, Mail, Loader2, Download } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { sampleEmployees, type Employee } from "@/lib/sample-data";
import { calculatePayroll, formatCurrency, ST_LUCIA_CONFIG } from "@/lib/payroll-engine";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useCompany } from "@/hooks/useCompany";
import { useAllEmployeeDeductions } from "@/hooks/useEmployeeDeductions";
import { useAllEmployeeAdditions } from "@/hooks/useEmployeeAdditions";
import { downloadCSV, downloadPDF } from "@/lib/export-utils";

export default function PayslipPage() {
  const navigate = useNavigate();
  const company = useCompany();
  const [searchParams] = useSearchParams();
  const initialId = searchParams.get("employee") || sampleEmployees[0]?.id || "";
  const [selectedId, setSelectedId] = useState(initialId);
  const [payPeriod] = useState("March 2026");
  const payslipRef = useRef<HTMLDivElement>(null);
  const [emailing, setEmailing] = useState(false);
  const { deductionsMap } = useAllEmployeeDeductions();
  const { additionsMap } = useAllEmployeeAdditions();

  const employee = sampleEmployees.find((e) => e.id === selectedId);
  const creditorDeductions = deductionsMap[selectedId] || [];
  const additions = additionsMap[selectedId] || [];
  const payroll = employee ? calculatePayroll(employee.monthlySalary, ST_LUCIA_CONFIG, 0, creditorDeductions, additions) : null;

  const handlePrint = () => window.print();

  const statutoryDeductions = payroll ? payroll.employeeNIC + payroll.paye : 0;

  const handleExportCSV = () => {
    if (!employee || !payroll) return;
    const headers = ["Description", "Current (XCD)", "YTD (XCD)"];
    const rows: (string | number)[][] = [
      ["Basic Salary", payroll.basicPay.toFixed(2), (payroll.basicPay * 3).toFixed(2)],
      ["Overtime Pay", payroll.overtimePay.toFixed(2), (payroll.overtimePay * 3).toFixed(2)],
      ...payroll.additions.map((a) => [`+ ${a.description}`, a.amount.toFixed(2), (a.amount * 3).toFixed(2)]),
      ["Total Earnings (Gross)", payroll.grossMonthly.toFixed(2), (payroll.grossMonthly * 3).toFixed(2)],
      ["", "", ""],
      ["--- Statutory Deductions ---", "", ""],
      ["NIC Employee (5%)", payroll.employeeNIC.toFixed(2), (payroll.employeeNIC * 3).toFixed(2)],
      ["PAYE Income Tax", payroll.paye.toFixed(2), (payroll.paye * 3).toFixed(2)],
      ["Subtotal Statutory", statutoryDeductions.toFixed(2), (statutoryDeductions * 3).toFixed(2)],
      ["", "", ""],
      ["--- Other Deductions ---", "", ""],
      ...payroll.creditorDeductions.map((d) => [d.creditorName, d.amount.toFixed(2), (d.amount * 3).toFixed(2)]),
      ["Subtotal Other Deductions", payroll.totalCreditorDeductions.toFixed(2), (payroll.totalCreditorDeductions * 3).toFixed(2)],
      ["", "", ""],
      ["Total Deductions", payroll.totalDeductions.toFixed(2), (payroll.totalDeductions * 3).toFixed(2)],
      ["NET PAY (Check Amount)", payroll.netPay.toFixed(2), (payroll.netPay * 3).toFixed(2)],
    ];
    downloadCSV(`payslip-${employee.firstName}-${employee.lastName}-${payPeriod}`, headers, rows);
    toast.success("Payslip CSV exported");
  };

  const handleExportPDF = () => {
    if (!employee || !payroll) return;
    const headers = ["Description", "Current (XCD)", "YTD (XCD)"];
    const rows: (string | number)[][] = [
      ["Basic Salary", payroll.basicPay.toFixed(2), (payroll.basicPay * 3).toFixed(2)],
      ["Overtime Pay", payroll.overtimePay.toFixed(2), (payroll.overtimePay * 3).toFixed(2)],
      ...payroll.additions.map((a) => [`+ ${a.description}`, a.amount.toFixed(2), (a.amount * 3).toFixed(2)]),
      ["--- Total Earnings (Gross) ---", payroll.grossMonthly.toFixed(2), (payroll.grossMonthly * 3).toFixed(2)],
      ["NIC Employee (5%)", payroll.employeeNIC.toFixed(2), (payroll.employeeNIC * 3).toFixed(2)],
      ["PAYE Income Tax", payroll.paye.toFixed(2), (payroll.paye * 3).toFixed(2)],
      ...payroll.creditorDeductions.map((d) => [d.creditorName, d.amount.toFixed(2), (d.amount * 3).toFixed(2)]),
      ["--- Total Deductions ---", payroll.totalDeductions.toFixed(2), (payroll.totalDeductions * 3).toFixed(2)],
      ["NET PAY (Check Amount)", payroll.netPay.toFixed(2), (payroll.netPay * 3).toFixed(2)],
    ];
    downloadPDF(
      `payslip-${employee.firstName}-${employee.lastName}-${payPeriod}`,
      `Payslip — ${employee.firstName} ${employee.lastName}`,
      headers,
      rows,
      {
        subtitle: `${company.company_name || "OECS HR & Payroll"} • ${payPeriod} • Employee #${employee.personId}`,
        orientation: "portrait",
        summaryRows: [
          { label: "NIC No.", value: employee.nicNumber },
          { label: "Department", value: employee.department },
          { label: "Employer NIC", value: formatCurrency(payroll.employerNIC) + " XCD" },
        ],
      }
    );
    toast.success("Payslip PDF exported");
  };

  const handleEmailPayslip = async () => {
    if (!employee) return;
    setEmailing(true);
    try {
      const payslipHtml = payslipRef.current?.innerHTML || "";
      const { data, error } = await supabase.functions.invoke("email-payslip", {
        body: { user_id: employee.id, payslip_html: payslipHtml, period: payPeriod },
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
    <div className="p-4 md:p-6 max-w-4xl mx-auto space-y-4 md:space-y-6">
      {/* Header - no print */}
      <div className="no-print space-y-3">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="p-2 rounded-lg hover:bg-secondary transition-colors">
            <ArrowLeft size={20} className="text-muted-foreground" />
          </button>
          <div>
            <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">Payslip Generator</h1>
            <p className="text-xs md:text-sm text-muted-foreground mt-0.5">Generate and print employee payslips</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3 md:px-4 py-2 md:py-2.5 bg-secondary text-foreground rounded-lg text-xs md:text-sm font-medium hover:bg-muted transition-colors"
          >
            <Download size={14} /> CSV
          </button>
          <button
            onClick={handleExportPDF}
            className="flex items-center gap-2 px-3 md:px-4 py-2 md:py-2.5 bg-secondary text-foreground rounded-lg text-xs md:text-sm font-medium hover:bg-muted transition-colors"
          >
            <Download size={14} /> PDF
          </button>
          <button
            onClick={handleEmailPayslip}
            disabled={emailing}
            className="flex items-center gap-2 px-3 md:px-4 py-2 md:py-2.5 bg-secondary text-foreground rounded-lg text-xs md:text-sm font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            {emailing ? <Loader2 size={16} className="animate-spin" /> : <Mail size={16} />}
            {emailing ? "Sending..." : "Email"}
          </button>
          <button
            onClick={handlePrint}
            className="flex items-center gap-2 px-3 md:px-4 py-2 md:py-2.5 bg-primary text-primary-foreground rounded-lg text-xs md:text-sm font-medium hover:bg-primary/90 transition-colors"
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
      <motion.div ref={payslipRef} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} key={selectedId}>
        <Card className="shadow-card border-border/60 overflow-hidden print:shadow-none print:border">
          {/* Company Header */}
          <div className="bg-primary px-6 py-5 text-primary-foreground">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary-foreground/20 flex items-center justify-center overflow-hidden">
                  {company.logo_url ? (
                    <img src={company.logo_url} alt="Logo" className="w-full h-full object-contain" />
                  ) : (
                    <Building size={20} />
                  )}
                </div>
                <div>
                  <h2 className="font-display font-bold text-lg">{company.company_name || "Promotech Solutions Ltd."}</h2>
                  <p className="text-primary-foreground/70 text-xs">
                    {company.address || "Castries, Saint Lucia"} • {company.employer_nic_number || "EMP-NIC-2022-001"}
                  </p>
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
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 md:gap-6">
              <div className="space-y-3">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <User size={12} /> Employee Details
                </h3>
                <div className="space-y-1.5">
                  {[
                    ["Name", `${employee.firstName} ${employee.lastName}`],
                    ["Employee #", employee.personId],
                    ["Department", employee.department],
                    ["Job Title", employee.jobTitle],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between">
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <span className={`text-sm ${label === "Employee #" ? "font-mono" : ""} text-foreground font-medium`}>{value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="space-y-3">
                <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide flex items-center gap-1.5">
                  <Calendar size={12} /> Tax & Statutory
                </h3>
                <div className="space-y-1.5">
                  {[
                    ["NIC No.", employee.nicNumber],
                    ["TAN No.", employee.tanNumber],
                    ["Pay Period", payPeriod],
                    ["Pay Date", "March 31, 2026"],
                  ].map(([label, value]) => (
                    <div key={label} className="flex justify-between">
                      <span className="text-sm text-muted-foreground">{label}</span>
                      <span className={`text-sm ${["NIC No.", "TAN No."].includes(label) ? "font-mono" : ""} text-foreground`}>{value}</span>
                    </div>
                  ))}
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
                  {/* Additions */}
                  {payroll.additions.map((a, i) => (
                    <tr key={i} className="border-b border-border/50">
                      <td className="py-2 text-success">+ {a.description}</td>
                      <td className="py-2 text-right font-mono text-success">+{formatCurrency(a.amount)}</td>
                      <td className="py-2 text-right font-mono text-muted-foreground">+{formatCurrency(a.amount * 3)}</td>
                    </tr>
                  ))}
                  {payroll.totalAdditions > 0 && (
                    <tr className="border-b border-border/50 bg-success/5">
                      <td className="py-2 text-success font-medium">Subtotal Additions</td>
                      <td className="py-2 text-right font-mono text-success font-semibold">+{formatCurrency(payroll.totalAdditions)}</td>
                      <td className="py-2 text-right font-mono text-muted-foreground">+{formatCurrency(payroll.totalAdditions * 3)}</td>
                    </tr>
                  )}
                  <tr className="font-semibold">
                    <td className="py-2 text-foreground">Total Gross Earnings</td>
                    <td className="py-2 text-right font-mono text-foreground">{formatCurrency(payroll.grossMonthly)}</td>
                    <td className="py-2 text-right font-mono text-muted-foreground">{formatCurrency(payroll.grossMonthly * 3)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Statutory Deductions */}
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
                  <tr className="font-semibold bg-secondary/30">
                    <td className="py-2 text-foreground">Subtotal Statutory</td>
                    <td className="py-2 text-right font-mono text-destructive">{formatCurrency(statutoryDeductions)}</td>
                    <td className="py-2 text-right font-mono text-muted-foreground">{formatCurrency(statutoryDeductions * 3)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Other Deductions (Creditors, Loans, etc.) */}
            <div>
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3">Other Deductions</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-2 font-medium text-muted-foreground">Creditor / Description</th>
                    <th className="text-right py-2 font-medium text-muted-foreground">Current</th>
                    <th className="text-right py-2 font-medium text-muted-foreground">YTD (3 months)</th>
                  </tr>
                </thead>
                <tbody>
                  {payroll.creditorDeductions.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="py-2 text-muted-foreground text-center italic">No other deductions</td>
                    </tr>
                  ) : (
                    <>
                      {payroll.creditorDeductions.map((d, i) => (
                        <tr key={i} className="border-b border-border/50">
                          <td className="py-2 text-foreground">{d.creditorName}</td>
                          <td className="py-2 text-right font-mono text-destructive">{formatCurrency(d.amount)}</td>
                          <td className="py-2 text-right font-mono text-muted-foreground">{formatCurrency(d.amount * 3)}</td>
                        </tr>
                      ))}
                      <tr className="font-semibold bg-secondary/30">
                        <td className="py-2 text-foreground">Subtotal Other Deductions</td>
                        <td className="py-2 text-right font-mono text-destructive">{formatCurrency(payroll.totalCreditorDeductions)}</td>
                        <td className="py-2 text-right font-mono text-muted-foreground">{formatCurrency(payroll.totalCreditorDeductions * 3)}</td>
                      </tr>
                    </>
                  )}
                </tbody>
              </table>
            </div>

            {/* Total Deductions */}
            <div className="flex justify-between py-3 border-t-2 border-border font-semibold text-sm">
              <span className="text-foreground">Total All Deductions</span>
              <span className="font-mono text-destructive">{formatCurrency(payroll.totalDeductions)}</span>
            </div>

            {/* Employer Contributions */}
            <div className="p-4 rounded-lg bg-secondary/50 border border-border/50">
              <h3 className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2">Employer Contributions (not deducted from pay)</h3>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">NIC — Employer (5%)</span>
                <span className="font-mono text-foreground">{formatCurrency(payroll.employerNIC)}</span>
              </div>
            </div>

            {/* Net Pay / Check Amount */}
            <div className="p-5 rounded-lg bg-success/5 border-2 border-success/30">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Net Pay — Check Amount</p>
                  <p className="text-3xl font-display font-bold text-success mt-1">
                    {formatCurrency(payroll.netPay)} <span className="text-lg">XCD</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Gross ({formatCurrency(payroll.grossMonthly)}) − Statutory ({formatCurrency(statutoryDeductions)}) − Other ({formatCurrency(payroll.totalCreditorDeductions)})
                  </p>
                </div>
                <DollarSign size={32} className="text-success/30" />
              </div>
            </div>

            {/* Footer */}
            <div className="text-center text-xs text-muted-foreground space-y-1 pt-2">
              <p>This payslip is generated by OECS HR & Payroll Solutions</p>
              <p>{company.company_name || "Promotech Solutions Ltd."} • {company.address || "Castries, Saint Lucia"} • Tax ID: {company.tax_id || "TID-LC-00123"}</p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
