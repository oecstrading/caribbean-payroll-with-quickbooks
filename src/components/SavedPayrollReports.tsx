import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { payslipReportRow, selectDepartments, type PayrollReportRow } from "@/lib/department-payroll";
import DepartmentSelector from "@/components/DepartmentSelector";
import DepartmentPayrollReport from "@/components/DepartmentPayrollReport";
import { Label } from "@/components/ui/label";

export default function SavedPayrollReports() {
  const [periods, setPeriods] = useState<string[]>([]);
  const [period, setPeriod] = useState("");
  const [rows, setRows] = useState<PayrollReportRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    supabase.from("payroll_runs").select("period").eq("status", "approved").order("period", { ascending: false }).then(({ data, error }) => {
      if (error) { setError(error.message); setLoading(false); return; }
      const months = [...new Set((data || []).map(run => run.period))];
      setPeriods(months); setPeriod(months[0] || ""); if (!months.length) setLoading(false);
    });
  }, []);
  useEffect(() => {
    if (!period) return;
    let cancelled = false;
    setLoading(true); setError(""); setRows([]);
    const load = async () => {
      const runs = await supabase.from("payroll_runs").select("id").eq("period", period).eq("status", "approved");
      if (runs.error) throw runs.error;
      const ids = (runs.data || []).map(run => run.id);
      if (!ids.length) return [];
      const slips = await supabase.from("payroll_payslip_directory").select("*").in("payroll_run_id", ids);
      if (slips.error) throw slips.error;
      return (slips.data || []).map(payslipReportRow);
    };
    load().then(data => { if (cancelled) return; setRows(data); setSelected([...new Set(data.map(row => row.department))].sort()); })
      .catch(e => { if (!cancelled) setError(e.message || "Unable to load payroll reports"); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [period]);
  return <section className="space-y-4">
    <h2 className="text-lg font-display font-semibold text-foreground">Approved payroll reports</h2>
    <div className="space-y-1 max-w-xs"><Label htmlFor="report-period">Payroll month</Label><select id="report-period" className="w-full h-11 border border-input bg-background text-foreground rounded-md px-3" value={period} onChange={e => setPeriod(e.target.value)}>
      {!periods.length && <option value="">No approved payroll</option>}{periods.map(p => <option key={p}>{p}</option>)}</select></div>
    {error ? <p role="alert" className="text-destructive text-sm">{error}</p> : loading ? <p className="text-sm text-muted-foreground">Loading payroll reports…</p> : <>
      <DepartmentSelector departments={[...new Set(rows.map(row => row.department))].sort()} selected={selected} onChange={setSelected} />
      <DepartmentPayrollReport rows={selectDepartments(rows, selected)} period={period || "—"} />
    </>}
  </section>;
}