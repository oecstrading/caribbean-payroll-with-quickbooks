import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { History, ChevronDown, ChevronRight, Calendar, Users, DollarSign, FileText, Eye, Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/payroll-engine";
import { downloadCSV, downloadPDF } from "@/lib/export-utils";
import { toast } from "sonner";

interface PayrollRun {
  id: string;
  period: string;
  run_date: string;
  status: string;
  employee_count: number;
  total_gross: number;
  total_deductions: number;
  total_net: number;
  created_at: string;
}

interface Payslip {
  id: string;
  user_id: string;
  period: string;
  basic_pay: number;
  overtime_pay: number;
  gross_pay: number;
  employee_nic: number;
  employer_nic: number;
  paye: number;
  total_deductions: number;
  net_pay: number;
  created_at: string;
  profile?: { first_name: string; last_name: string; department: string | null; nic_number: string | null };
}

export default function PayrollHistoryPage() {
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedRun, setExpandedRun] = useState<string | null>(null);
  const [payslips, setPayslips] = useState<Record<string, Payslip[]>>({});
  const [loadingPayslips, setLoadingPayslips] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("payroll_runs")
      .select("*")
      .order("run_date", { ascending: false })
      .then(({ data }) => {
        setRuns(data || []);
        setLoading(false);
      });
  }, []);

  const toggleRun = async (runId: string) => {
    if (expandedRun === runId) {
      setExpandedRun(null);
      return;
    }
    setExpandedRun(runId);

    if (!payslips[runId]) {
      setLoadingPayslips(runId);
      const { data } = await supabase
        .from("payslips")
        .select("*, profile:profiles!payslips_user_id_fkey(first_name, last_name, department, nic_number)")
        .eq("payroll_run_id", runId)
        .order("created_at", { ascending: true });

      // If the join doesn't work due to missing FK name, fetch without join
      if (!data || data.length === 0) {
        const { data: plainData } = await supabase
          .from("payslips")
          .select("*")
          .eq("payroll_run_id", runId)
          .order("created_at", { ascending: true });
        setPayslips((prev) => ({ ...prev, [runId]: (plainData as Payslip[]) || [] }));
      } else {
        setPayslips((prev) => ({ ...prev, [runId]: (data as unknown as Payslip[]) || [] }));
      }
      setLoadingPayslips(null);
    }
  };

  const statusBadge = (status: string) => {
    const map: Record<string, { variant: "default" | "secondary" | "destructive" | "outline"; label: string }> = {
      approved: { variant: "default", label: "Approved" },
      draft: { variant: "secondary", label: "Draft" },
      processing: { variant: "outline", label: "Processing" },
      failed: { variant: "destructive", label: "Failed" },
    };
    const s = map[status] || { variant: "secondary" as const, label: status };
    return <Badge variant={s.variant} className="text-xs">{s.label}</Badge>;
  };

  const totals = runs.reduce(
    (acc, r) => ({
      gross: acc.gross + Number(r.total_gross),
      deductions: acc.deductions + Number(r.total_deductions),
      net: acc.net + Number(r.total_net),
      employees: acc.employees + r.employee_count,
    }),
    { gross: 0, deductions: 0, net: 0, employees: 0 }
  );

  const exportRunsCSV = () => {
    if (runs.length === 0) { toast.error("No data to export"); return; }
    const headers = ["Period", "Run Date", "Status", "Employees", "Gross", "Deductions", "Net"];
    const rows = runs.map((r) => [
      r.period, r.run_date, r.status, r.employee_count,
      Number(r.total_gross).toFixed(2), Number(r.total_deductions).toFixed(2), Number(r.total_net).toFixed(2),
    ]);
    downloadCSV("payroll-history", headers, rows);
    toast.success("CSV exported");
  };

  const exportRunsPDF = () => {
    if (runs.length === 0) { toast.error("No data to export"); return; }
    const headers = ["Period", "Run Date", "Status", "Employees", "Gross (XCD)", "Deductions (XCD)", "Net (XCD)"];
    const rows = runs.map((r) => [
      r.period, r.run_date, r.status, r.employee_count,
      Number(r.total_gross).toFixed(2), Number(r.total_deductions).toFixed(2), Number(r.total_net).toFixed(2),
    ]);
    downloadPDF("payroll-history", "Payroll History Report", headers, rows, {
      subtitle: `${runs.length} payroll runs — Generated ${new Date().toLocaleDateString()}`,
      summaryRows: [
        { label: "Total Gross", value: formatCurrency(totals.gross) + " XCD" },
        { label: "Total Deductions", value: formatCurrency(totals.deductions) + " XCD" },
        { label: "Total Net", value: formatCurrency(totals.net) + " XCD" },
      ],
    });
    toast.success("PDF exported");
  };

  const exportRunPayslipsCSV = (runId: string) => {
    const slips = payslips[runId];
    if (!slips?.length) { toast.error("No payslips to export"); return; }
    const run = runs.find((r) => r.id === runId);
    const headers = ["Employee", "Department", "Basic", "OT", "Gross", "NIC", "PAYE", "Deductions", "Net"];
    const rows = slips.map((s) => [
      s.profile ? `${s.profile.first_name} ${s.profile.last_name}` : s.user_id.slice(0, 8),
      s.profile?.department || "",
      Number(s.basic_pay).toFixed(2), Number(s.overtime_pay).toFixed(2), Number(s.gross_pay).toFixed(2),
      Number(s.employee_nic).toFixed(2), Number(s.paye).toFixed(2),
      Number(s.total_deductions).toFixed(2), Number(s.net_pay).toFixed(2),
    ]);
    downloadCSV(`payslips-${run?.period || runId}`, headers, rows);
    toast.success("Payslips CSV exported");
  };

  const exportRunPayslipsPDF = (runId: string) => {
    const slips = payslips[runId];
    if (!slips?.length) { toast.error("No payslips to export"); return; }
    const run = runs.find((r) => r.id === runId);
    const headers = ["Employee", "Dept", "Basic", "OT", "Gross", "NIC", "PAYE", "Deductions", "Net"];
    const rows = slips.map((s) => [
      s.profile ? `${s.profile.first_name} ${s.profile.last_name}` : s.user_id.slice(0, 8),
      s.profile?.department || "",
      Number(s.basic_pay).toFixed(2), Number(s.overtime_pay).toFixed(2), Number(s.gross_pay).toFixed(2),
      Number(s.employee_nic).toFixed(2), Number(s.paye).toFixed(2),
      Number(s.total_deductions).toFixed(2), Number(s.net_pay).toFixed(2),
    ]);
    downloadPDF(`payslips-${run?.period || runId}`, `Payslips — ${run?.period || ""}`, headers, rows, {
      subtitle: `${slips.length} employees — Run date: ${run?.run_date || ""}`,
    });
    toast.success("Payslips PDF exported");
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Payroll History</h1>
          <p className="text-sm text-muted-foreground mt-1">View past payroll runs and drill into individual payslips</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportRunsCSV} className="flex items-center gap-2 px-4 py-2.5 bg-secondary text-foreground rounded-lg text-sm font-medium hover:bg-muted transition-colors">
            <Download size={14} /> CSV
          </button>
          <button onClick={exportRunsPDF} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors">
            <Download size={14} /> PDF
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        {[
          { label: "Total Runs", value: runs.length, icon: History, color: "text-primary" },
          { label: "Total Gross Paid", value: formatCurrency(totals.gross), icon: DollarSign, color: "text-foreground" },
          { label: "Total Deductions", value: formatCurrency(totals.deductions), icon: FileText, color: "text-destructive" },
          { label: "Total Net Paid", value: formatCurrency(totals.net), icon: DollarSign, color: "text-success" },
        ].map((card) => (
          <Card key={card.label} className="shadow-card border-border/60">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">{card.label}</p>
                  <p className={`text-xl font-display font-bold mt-1 ${card.color}`}>{card.value}</p>
                </div>
                <card.icon size={20} className="text-muted-foreground/40" />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Runs Table */}
      <Card className="shadow-card border-border/60 overflow-hidden">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-display flex items-center gap-2">
            <History size={16} />
            Past Payroll Runs
          </CardTitle>
        </CardHeader>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="p-8 text-center text-muted-foreground text-sm">Loading payroll history...</div>
          ) : runs.length === 0 ? (
            <div className="p-8 text-center text-muted-foreground text-sm">
              No payroll runs found. Process your first payroll to see history here.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-secondary/50">
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground w-8" />
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Period</th>
                  <th className="text-left py-3 px-4 font-medium text-muted-foreground">Run Date</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Status</th>
                  <th className="text-center py-3 px-4 font-medium text-muted-foreground">Employees</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Gross</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Deductions</th>
                  <th className="text-right py-3 px-4 font-medium text-muted-foreground">Net</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((run, i) => (
                  <motion.tbody key={run.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.03 }}>
                    <tr
                      onClick={() => toggleRun(run.id)}
                      className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer"
                    >
                      <td className="py-3 px-4">
                        {expandedRun === run.id ? (
                          <ChevronDown size={16} className="text-muted-foreground" />
                        ) : (
                          <ChevronRight size={16} className="text-muted-foreground" />
                        )}
                      </td>
                      <td className="py-3 px-4 font-medium text-foreground">{run.period}</td>
                      <td className="py-3 px-4 text-muted-foreground">
                        {new Date(run.run_date).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })}
                      </td>
                      <td className="py-3 px-4 text-center">{statusBadge(run.status)}</td>
                      <td className="py-3 px-4 text-center text-foreground">{run.employee_count}</td>
                      <td className="py-3 px-4 text-right font-mono text-foreground">{formatCurrency(Number(run.total_gross))}</td>
                      <td className="py-3 px-4 text-right font-mono text-destructive">{formatCurrency(Number(run.total_deductions))}</td>
                      <td className="py-3 px-4 text-right font-mono font-semibold text-success">{formatCurrency(Number(run.total_net))}</td>
                    </tr>

                    {/* Expanded Payslips */}
                    {expandedRun === run.id && (
                      <tr>
                        <td colSpan={8} className="p-0">
                          <div className="bg-secondary/20 border-t border-border/30 px-6 py-4">
                            {loadingPayslips === run.id ? (
                              <p className="text-sm text-muted-foreground text-center py-3">Loading payslips...</p>
                            ) : (payslips[run.id]?.length || 0) === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-3">No payslips found for this run.</p>
                            ) : (
                              <div className="space-y-3">
                                <div className="flex justify-end gap-2">
                                  <button
                                    onClick={(e) => { e.stopPropagation(); exportRunPayslipsCSV(run.id); }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary text-foreground rounded-md text-xs font-medium hover:bg-muted transition-colors"
                                  >
                                    <Download size={12} /> CSV
                                  </button>
                                  <button
                                    onClick={(e) => { e.stopPropagation(); exportRunPayslipsPDF(run.id); }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-md text-xs font-medium hover:bg-primary/90 transition-colors"
                                  >
                                    <Download size={12} /> PDF
                                  </button>
                                </div>
                              <table className="w-full text-sm">
                                <thead>
                                  <tr className="border-b border-border/40">
                                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Employee</th>
                                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Basic</th>
                                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">OT</th>
                                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Gross</th>
                                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">NIC</th>
                                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">PAYE</th>
                                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Deductions</th>
                                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Net</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {payslips[run.id].map((slip) => (
                                    <tr key={slip.id} className="border-b border-border/20 hover:bg-secondary/30 transition-colors">
                                      <td className="py-2 px-3">
                                        <div className="flex items-center gap-2">
                                          <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
                                            <span className="text-[10px] font-bold text-primary">
                                              {slip.profile ? `${slip.profile.first_name[0]}${slip.profile.last_name[0]}` : "??"}
                                            </span>
                                          </div>
                                          <div>
                                            <p className="font-medium text-foreground text-xs">
                                              {slip.profile ? `${slip.profile.first_name} ${slip.profile.last_name}` : slip.user_id.slice(0, 8)}
                                            </p>
                                            {slip.profile?.department && (
                                              <p className="text-[10px] text-muted-foreground">{slip.profile.department}</p>
                                            )}
                                          </div>
                                        </div>
                                      </td>
                                      <td className="py-2 px-3 text-right font-mono text-foreground text-xs">{formatCurrency(Number(slip.basic_pay))}</td>
                                      <td className="py-2 px-3 text-right font-mono text-foreground text-xs">{formatCurrency(Number(slip.overtime_pay))}</td>
                                      <td className="py-2 px-3 text-right font-mono text-foreground text-xs">{formatCurrency(Number(slip.gross_pay))}</td>
                                      <td className="py-2 px-3 text-right font-mono text-destructive text-xs">{formatCurrency(Number(slip.employee_nic))}</td>
                                      <td className="py-2 px-3 text-right font-mono text-destructive text-xs">{formatCurrency(Number(slip.paye))}</td>
                                      <td className="py-2 px-3 text-right font-mono text-destructive text-xs">{formatCurrency(Number(slip.total_deductions))}</td>
                                      <td className="py-2 px-3 text-right font-mono font-semibold text-success text-xs">{formatCurrency(Number(slip.net_pay))}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </motion.tbody>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </Card>
    </div>
  );
}
