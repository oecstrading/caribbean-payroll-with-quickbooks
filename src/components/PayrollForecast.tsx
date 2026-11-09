import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CalendarClock } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";
import { defaultRange, periodFactor, payTypeLabels, type PayType } from "@/lib/pay-period";
import { estimatePayroll, runFactor, type ForecastLine } from "@/lib/payroll-forecast";

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const iso = (d: Date) => d.toISOString().slice(0, 10);

function nextPeriod(type: PayType, lastEnd?: string | null) {
  const d = lastEnd ? new Date(lastEnd + "T00:00:00Z") : new Date();
  if (lastEnd) d.setUTCDate(d.getUTCDate() + 1);
  const ref = iso(d);
  if (type === "semi_monthly") return defaultRange(type, ref, Number(ref.slice(8)) >= 16 ? 2 : 1);
  return defaultRange(type, ref);
}

export function PayrollForecast() {
  const { data } = useQuery({
    queryKey: ["payroll-forecast-base"],
    queryFn: async () => {
      const { data: run } = await supabase.from("payroll_runs").select("*").order("period_end", { ascending: false, nullsFirst: false }).order("run_date", { ascending: false }).limit(1).maybeSingle();
      if (!run) return null;
      const cols = "employee_name_snapshot,gross_pay,employee_nic,employer_nic,paye,total_deductions,net_pay";
      const [a, b] = await Promise.all([supabase.from("payslips").select(cols).eq("payroll_run_id", run.id), supabase.from("employee_payslips").select(cols).eq("payroll_run_id", run.id)]);
      const lines: ForecastLine[] = [...(a.data ?? []), ...(b.data ?? [])].map(s => ({
        name: s.employee_name_snapshot ?? "Employee", gross: +s.gross_pay, employeeNic: +s.employee_nic, employerNic: +s.employer_nic, paye: +s.paye,
        otherDeductions: Math.max(0, +s.total_deductions - +s.employee_nic - +s.paye), net: +s.net_pay,
      }));
      return { run, lines };
    },
  });
  const [type, setType] = useState<PayType>("semi_monthly");
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);
  const period = range ?? nextPeriod(type, data?.run.period_end);

  const result = useMemo(() => {
    if (!data) return null;
    let target: number;
    try { target = periodFactor(type, period.start, period.end); } catch (e) { return { error: (e as Error).message }; }
    const lines = estimatePayroll(data.lines, runFactor(data.run.pay_type, data.run.period_start, data.run.period_end), target);
    const sum = (k: keyof ForecastLine) => lines.reduce((s, l) => s + (l[k] as number), 0);
    return { lines, totals: { gross: sum("gross"), employeeNic: sum("employeeNic"), employerNic: sum("employerNic"), paye: sum("paye"), otherDeductions: sum("otherDeductions"), net: sum("net") } };
  }, [data, type, period.start, period.end]);

  const cur = data?.run.currency_code ?? "XCD";
  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-primary" />Estimate a future payroll</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm">
        {!data ? <p className="text-muted-foreground">No saved payroll yet. Approve one payroll and the AI Paymaster can estimate upcoming periods from it.</p> : <>
          <p className="text-muted-foreground">Based on the last payroll ({data.run.period_start ?? data.run.period} to {data.run.period_end ?? ""}, {data.lines.length} staff). This is an estimate only. Nothing is saved or paid.</p>
          <div className="flex flex-wrap gap-3 items-end">
            <label className="space-y-1"><span>Pay period</span><NativeSelect value={type} onChange={e => { setType(e.target.value as PayType); setRange(null); }}>
              {(Object.keys(payTypeLabels) as PayType[]).map(t => <option key={t} value={t}>{payTypeLabels[t]}</option>)}</NativeSelect></label>
            <label className="space-y-1"><span>From</span><Input type="date" value={period.start} onChange={e => setRange({ ...period, start: e.target.value })} /></label>
            <label className="space-y-1"><span>To</span><Input type="date" value={period.end} onChange={e => setRange({ ...period, end: e.target.value })} /></label>
          </div>
          {result && "error" in result ? <p className="text-destructive">{result.error}</p> : result && <div className="overflow-x-auto">
            <table className="w-full text-right">
              <thead className="text-muted-foreground"><tr><th className="text-left py-2">Employee</th><th>Gross</th><th>NIC</th><th>PAYE</th><th>Other</th><th>Net</th></tr></thead>
              <tbody>{result.lines.map((l, i) => <tr key={i} className="border-t border-border"><td className="text-left py-2">{l.name}</td><td>{fmt(l.gross)}</td><td>{fmt(l.employeeNic)}</td><td>{fmt(l.paye)}</td><td>{fmt(l.otherDeductions)}</td><td className="font-semibold">{fmt(l.net)}</td></tr>)}</tbody>
              <tfoot className="font-bold border-t border-border"><tr><td className="text-left py-2">Total ({cur})</td><td>{fmt(result.totals.gross)}</td><td>{fmt(result.totals.employeeNic)}</td><td>{fmt(result.totals.paye)}</td><td>{fmt(result.totals.otherDeductions)}</td><td>{fmt(result.totals.net)}</td></tr></tfoot>
            </table>
            <p className="mt-2 text-muted-foreground">Employer NIC: {cur} {fmt(result.totals.employerNic)} · Total cost to company: {cur} {fmt(result.totals.gross + result.totals.employerNic)}</p>
          </div>}
        </>}
      </CardContent>
    </Card>
  );
}
