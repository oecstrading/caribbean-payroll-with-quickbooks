import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CalendarClock, Save, ClipboardCheck, Undo2, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { defaultRange, periodFactor, payTypeLabels, type PayType } from "@/lib/pay-period";
import { estimatePayroll, runFactor, type ForecastLine } from "@/lib/payroll-forecast";

const fmt = (n: number) => n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const iso = (d: Date) => d.toISOString().slice(0, 10);
const r2 = (n: number) => Math.round((Number.isFinite(n) ? n : 0) * 100) / 100;

interface EditLine { userId: string; name: string; basic: number; overtime: number; employeeNic: number; employerNic: number; paye: number; other: number }
const gross = (l: EditLine) => r2(l.basic + l.overtime);
const net = (l: EditLine) => r2(gross(l) - l.employeeNic - l.paye - l.other);

function nextPeriod(type: PayType, lastEnd?: string | null) {
  const d = lastEnd ? new Date(lastEnd + "T00:00:00Z") : new Date();
  if (lastEnd) d.setUTCDate(d.getUTCDate() + 1);
  const ref = iso(d);
  if (type === "semi_monthly") return defaultRange(type, ref, Number(ref.slice(8)) >= 16 ? 2 : 1);
  return defaultRange(type, ref);
}

export function PayrollForecast() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ["payroll-forecast-base"],
    queryFn: async () => {
      const { data: run } = await supabase.from("payroll_runs").select("*").order("period_end", { ascending: false, nullsFirst: false }).order("run_date", { ascending: false }).limit(1).maybeSingle();
      if (!run) return null;
      const cols = "user_id,employee_name_snapshot,gross_pay,employee_nic,employer_nic,paye,total_deductions,net_pay";
      const [a, b] = await Promise.all([supabase.from("payslips").select(cols).eq("payroll_run_id", run.id), supabase.from("employee_payslips").select(cols).eq("payroll_run_id", run.id)]);
      const rows = [...(a.data ?? []), ...(b.data ?? [])];
      const lines: (ForecastLine & { userId: string })[] = rows.map(s => ({
        userId: s.user_id as string, name: s.employee_name_snapshot ?? "Employee", gross: +s.gross_pay, employeeNic: +s.employee_nic, employerNic: +s.employer_nic, paye: +s.paye,
        otherDeductions: Math.max(0, +s.total_deductions - +s.employee_nic - +s.paye), net: +s.net_pay,
      }));
      return { run, lines };
    },
  });
  const [type, setType] = useState<PayType>("semi_monthly");
  const [range, setRange] = useState<{ start: string; end: string } | null>(null);
  const period = range ?? nextPeriod(type, data?.run.period_end);
  const draftKey = `payroll-draft:${data?.run.org_id ?? ""}:${period.start}:${period.end}`;

  const estimate = useMemo(() => {
    if (!data) return null;
    let target: number;
    try { target = periodFactor(type, period.start, period.end); } catch (e) { return { error: (e as Error).message }; }
    const est = estimatePayroll(data.lines, runFactor(data.run.pay_type, data.run.period_start, data.run.period_end), target);
    return { lines: est.map((l, i): EditLine => ({ userId: data.lines[i].userId, name: l.name, basic: l.gross, overtime: 0, employeeNic: l.employeeNic, employerNic: l.employerNic, paye: l.paye, other: l.otherDeductions })) };
  }, [data, type, period.start, period.end]);

  const [lines, setLines] = useState<EditLine[]>([]);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [reviewing, setReviewing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedRun, setSavedRun] = useState<string | null>(null);

  useEffect(() => {
    if (!estimate || "error" in estimate) { setLines([]); return; }
    const raw = localStorage.getItem(draftKey);
    if (raw) { try { const d = JSON.parse(raw); setLines(d.lines); setSavedAt(d.savedAt); setReviewing(false); return; } catch { /* ignore */ } }
    setLines(estimate.lines); setSavedAt(null); setReviewing(false);
  }, [estimate, draftKey]);

  const edit = (i: number, k: keyof EditLine, v: string) => { setReviewing(false); setLines(ls => ls.map((l, j) => j === i ? { ...l, [k]: r2(parseFloat(v)) } : l)); };
  const saveDraft = () => { const at = new Date().toLocaleString(); localStorage.setItem(draftKey, JSON.stringify({ lines, savedAt: at })); setSavedAt(at); toast.success("Draft saved. You can come back and keep editing."); };
  const discard = () => { localStorage.removeItem(draftKey); if (estimate && !("error" in estimate)) setLines(estimate.lines); setSavedAt(null); setReviewing(false); };

  const problems = lines.flatMap(l => {
    const p: string[] = [];
    if ([l.basic, l.overtime, l.employeeNic, l.employerNic, l.paye, l.other].some(v => v < 0)) p.push(`${l.name}: amounts cannot be negative`);
    if (net(l) < 0) p.push(`${l.name}: deductions are more than gross pay`);
    if (l.employeeNic > gross(l)) p.push(`${l.name}: NIC is more than gross pay`);
    return p;
  });
  const T = lines.reduce((s, l) => ({ gross: s.gross + gross(l), nic: s.nic + l.employeeNic, er: s.er + l.employerNic, paye: s.paye + l.paye, other: s.other + l.other, net: s.net + net(l) }), { gross: 0, nic: 0, er: 0, paye: 0, other: 0, net: 0 });

  const approve = async () => {
    setSaving(true);
    const { data: id, error } = await supabase.rpc("approve_payslip_import", {
      _start: period.start, _end: period.end, _jurisdiction: data?.run.jurisdiction ?? "LC", _notes: "Prepared and edited in AI Paymaster",
      _rows: lines.map(l => ({ user_id: l.userId, basic_pay: r2(l.basic), overtime_pay: r2(l.overtime), gross_pay: gross(l), employee_nic: r2(l.employeeNic), employer_nic: r2(l.employerNic), paye: r2(l.paye), total_deductions: r2(l.employeeNic + l.paye + l.other), net_pay: net(l) })),
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    localStorage.removeItem(draftKey); setSavedRun(String(id)); setReviewing(false);
    toast.success("Payroll saved. It now appears in Payroll History and Reports.");
    qc.invalidateQueries();
  };

  const cur = data?.run.currency_code ?? "XCD";
  const num = (i: number, k: keyof EditLine, v: number) => <Input type="number" step="0.01" min="0" inputMode="decimal" aria-label={`${k} for ${lines[i].name}`} className="h-9 w-24 text-right ml-auto" value={v} disabled={reviewing} onChange={e => edit(i, k, e.target.value)} />;

  return (
    <Card>
      <CardHeader><CardTitle className="flex items-center gap-2"><CalendarClock className="h-5 w-5 text-primary" />Prepare a payroll</CardTitle></CardHeader>
      <CardContent className="space-y-4 text-sm">
        {!data ? <p className="text-muted-foreground">No saved payroll yet. Approve one payroll and the AI Paymaster can prepare upcoming periods from it.</p> : <>
          <p className="text-muted-foreground">Starts from the last payroll ({data.run.period_start ?? data.run.period} to {data.run.period_end ?? ""}, {data.lines.length} staff). Type over any figure, save a draft, then review and approve. Nothing is paid until you approve.</p>
          <div className="flex flex-wrap gap-3 items-end">
            <label className="space-y-1"><span>Pay period</span><NativeSelect value={type} onChange={e => { setType(e.target.value as PayType); setRange(null); setSavedRun(null); }}>
              {(Object.keys(payTypeLabels) as PayType[]).map(t => <option key={t} value={t}>{payTypeLabels[t]}</option>)}</NativeSelect></label>
            <label className="space-y-1"><span>From</span><Input type="date" value={period.start} onChange={e => { setRange({ ...period, start: e.target.value }); setSavedRun(null); }} /></label>
            <label className="space-y-1"><span>To</span><Input type="date" value={period.end} onChange={e => { setRange({ ...period, end: e.target.value }); setSavedRun(null); }} /></label>
          </div>
          {estimate && "error" in estimate ? <p className="text-destructive">{estimate.error}</p> : savedRun ? (
            <div className="rounded-md border border-border bg-muted/40 p-4 flex items-center gap-2"><CheckCircle2 className="h-5 w-5 text-success" />Payroll for {period.start} to {period.end} is saved. See it in Payroll History and Reports.</div>
          ) : <>
            <div className="overflow-x-auto">
              <table className="w-full text-right">
                <thead className="text-muted-foreground"><tr><th className="text-left py-2">Employee</th><th>Basic</th><th>Overtime</th><th>Gross</th><th>NIC</th><th>PAYE</th><th>Other</th><th>Net</th><th>Employer NIC</th></tr></thead>
                <tbody>{lines.map((l, i) => <tr key={l.userId + i} className="border-t border-border">
                  <td className="text-left py-2">{l.name}</td><td>{num(i, "basic", l.basic)}</td><td>{num(i, "overtime", l.overtime)}</td><td>{fmt(gross(l))}</td>
                  <td>{num(i, "employeeNic", l.employeeNic)}</td><td>{num(i, "paye", l.paye)}</td><td>{num(i, "other", l.other)}</td>
                  <td className="font-semibold">{fmt(net(l))}</td><td>{num(i, "employerNic", l.employerNic)}</td></tr>)}</tbody>
                <tfoot className="font-bold border-t border-border"><tr><td className="text-left py-2" colSpan={3}>Total ({cur})</td><td>{fmt(T.gross)}</td><td>{fmt(T.nic)}</td><td>{fmt(T.paye)}</td><td>{fmt(T.other)}</td><td>{fmt(T.net)}</td><td>{fmt(T.er)}</td></tr></tfoot>
              </table>
              <p className="mt-2 text-muted-foreground">Total cost to company: {cur} {fmt(T.gross + T.er)}{savedAt ? ` · Draft saved ${savedAt}` : " · Not saved yet"}</p>
            </div>
            {problems.length > 0 && <ul className="text-destructive list-disc pl-5">{problems.map(p => <li key={p}>{p}</li>)}</ul>}
            {reviewing ? (
              <div className="rounded-md border border-primary/40 bg-primary/5 p-4 space-y-3">
                <p className="font-medium">Review before saving</p>
                <p>{lines.length} staff · Period {period.start} to {period.end} · Gross {cur} {fmt(T.gross)} · Deductions {cur} {fmt(T.nic + T.paye + T.other)} · Net to pay {cur} {fmt(T.net)}</p>
                <p className="text-muted-foreground">Approving saves this payroll to Payroll History and Reports. Staff already paid for part of this period will be refused.</p>
                <div className="flex flex-wrap gap-2">
                  <Button className="min-h-11" disabled={saving} onClick={approve}><CheckCircle2 className="mr-2 h-4 w-4" />{saving ? "Saving…" : "Approve and save payroll"}</Button>
                  <Button variant="outline" className="min-h-11" onClick={() => setReviewing(false)}>Back to editing</Button>
                </div>
              </div>
            ) : (
              <div className="flex flex-wrap gap-2">
                <Button variant="outline" className="min-h-11" onClick={saveDraft} disabled={!lines.length}><Save className="mr-2 h-4 w-4" />Save draft</Button>
                <Button className="min-h-11" disabled={!lines.length || problems.length > 0} onClick={() => { saveDraft(); setReviewing(true); }}><ClipboardCheck className="mr-2 h-4 w-4" />Review payroll</Button>
                <Button variant="ghost" className="min-h-11" onClick={discard}><Undo2 className="mr-2 h-4 w-4" />Start again from estimate</Button>
              </div>
            )}
          </>}
        </>}
      </CardContent>
    </Card>
  );
}
