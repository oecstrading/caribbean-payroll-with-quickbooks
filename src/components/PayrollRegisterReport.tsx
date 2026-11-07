import { useEffect, useMemo, useState } from "react";
import { Wallet, TrendingUp, MinusCircle, Building2, Banknote, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";
import { formatCurrency } from "@/lib/payroll-engine";
import { registerRow, type RegisterRow } from "@/lib/statutory-levies";
import { toast } from "sonner";
import { SummaryCard } from "@/components/SummaryCard";

type Line = RegisterRow & { id: string; name: string; department: string; status: string; start: string; end: string; period: string };

export default function PayrollRegisterReport() {
  const [lines, setLines] = useState<Line[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dept, setDept] = useState("all");
  const [status, setStatus] = useState("all");
  const [detail, setDetail] = useState("");

  useEffect(() => { void (async () => {
    const cols = "id,user_id,payroll_run_id,period,gross_pay,paye,employee_nic,employer_nic,total_deductions,net_pay,department_snapshot,employee_name_snapshot";
    const [runs, a, b, prof, recs] = await Promise.all([
      supabase.from("payroll_runs").select("id,period_start,period_end,jurisdiction,run_date"),
      supabase.from("payslips").select(cols),
      supabase.from("employee_payslips").select(cols),
      supabase.from("profiles").select("user_id,status"),
      supabase.from("employee_records").select("id,status"),
    ]);
    const runMap = new Map((runs.data ?? []).map(r => [r.id, r]));
    const st = new Map<string, string>([...(prof.data ?? []).map(p => [p.user_id, p.status ?? "active"] as [string, string]), ...(recs.data ?? []).map(r => [r.id, r.status ?? "active"] as [string, string])]);
    const all = [...(a.data ?? []), ...(b.data ?? [])].map(p => {
      const run = runMap.get(p.payroll_run_id);
      return { id: p.id, name: p.employee_name_snapshot ?? "Employee", department: p.department_snapshot ?? "Unassigned", status: String(st.get(p.user_id) ?? "active").toLowerCase(),
        start: run?.period_start ?? run?.run_date ?? "", end: run?.period_end ?? run?.run_date ?? "", period: p.period,
        ...registerRow(p as never, run?.jurisdiction) };
    });
    setLines(all); setLoading(false);
  })(); }, []);

  const departments = useMemo(() => [...new Set(lines.map(l => l.department))].sort(), [lines]);
  const statuses = useMemo(() => [...new Set(lines.map(l => l.status))].sort(), [lines]);
  const rows = lines.filter(l => (!from || l.end >= from) && (!to || l.start <= to) && (dept === "all" || l.department === dept) && (status === "all" || l.status === status));
  const t = rows.reduce((s, r) => ({ gross: s.gross + r.gross, paye: s.paye + r.paye, nis: s.nis + r.nis, levy: s.levy + r.levy, other: s.other + r.other, net: s.net + r.net, eNis: s.eNis + r.employerNis, eLevy: s.eLevy + r.employerLevy }), { gross: 0, paye: 0, nis: 0, levy: 0, other: 0, net: 0, eNis: 0, eLevy: 0 });
  const empDed = t.paye + t.nis + t.levy + t.other, employer = t.eNis + t.eLevy;
  const cards = [
    { label: "Total cash requirement", value: t.gross + employer, icon: Wallet, tone: "bg-primary/10 text-primary", note: "Gross + employer liabilities" },
    { label: "Total gross", value: t.gross, icon: TrendingUp, tone: "bg-accent/15 text-accent-foreground", note: `${rows.length} payslips` },
    { label: "Employee deductions", value: empDed, icon: MinusCircle, tone: "bg-destructive/10 text-destructive", note: "PAYE, NIS/NIB, levies, other" },
    { label: "Employer liabilities", value: employer, icon: Building2, tone: "bg-secondary text-secondary-foreground", note: `NIS/NIB ${formatCurrency(t.eNis)} · levies ${formatCurrency(t.eLevy)}` },
    { label: "Total net pay", value: t.net, icon: Banknote, tone: "bg-primary/10 text-primary", note: "Paid to employees" },
  ];
  const heads = ["Employee", "Department", "Period", "Gross", "PAYE", "NIS/NIB (EE)", "Statutory levies", "Other deductions", "Net pay", "Employer NIS/NIB", "Employer levies", "Cash requirement"];

  return <Card>
    <CardHeader><CardTitle className="font-display">Payroll Register & Summary</CardTitle><p className="text-sm text-muted-foreground">From approved payslips. Levies use each payroll's jurisdiction rules (OECS islands have none beyond NIS/NIC and PAYE).</p></CardHeader>
    <CardContent className="space-y-5">
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">{cards.map(c => <SummaryCard key={c.label} label={c.label} value={formatCurrency(c.value)} icon={c.icon} active={detail===c.label} onClick={()=>{setDetail(c.label);document.getElementById("register-details")?.scrollIntoView({behavior:"smooth",block:"start"});}} />)}</div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 items-end">
        <div className="space-y-1"><Label htmlFor="reg-from">From</Label><Input id="reg-from" type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="reg-to">To</Label><Input id="reg-to" type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="reg-dept">Department</Label><NativeSelect id="reg-dept" value={dept} onChange={e => setDept(e.target.value)}><option value="all">All departments</option>{departments.map(d => <option key={d} value={d}>{d}</option>)}</NativeSelect></div>
        <div className="space-y-1"><Label htmlFor="reg-status">Employee status</Label><NativeSelect id="reg-status" value={status} onChange={e => setStatus(e.target.value)}><option value="all">All statuses</option>{statuses.map(s => <option key={s} value={s}>{s}</option>)}</NativeSelect></div>
        <Button variant="outline" className="min-h-11" onClick={() => toast.info("CSV export is coming soon.")}><Download size={16} className="mr-2" />Export to CSV</Button>
      </div>
      <div id="register-details" className="flex items-center justify-between gap-3"><h3 className="font-semibold">{detail ? `${detail} breakdown` : "Payroll details"} · {rows.length} payslips</h3>{detail && <Button variant="ghost" onClick={()=>setDetail("")}>Show all columns</Button>}</div>
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="border-b border-border text-left text-muted-foreground">{heads.map((h, i) => <th key={h} className={`py-2 px-2 whitespace-nowrap ${i > 2 ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
        <tbody>{loading ? <tr><td colSpan={12} className="py-6 text-center text-muted-foreground">Loading payslips…</td></tr> : !rows.length ? <tr><td colSpan={12} className="py-6 text-center text-muted-foreground">No approved payslips match these filters.</td></tr> : rows.map(r => <tr key={r.id} className="border-b border-border/50">
          <td className="py-2 px-2">{r.name}</td><td className="px-2">{r.department}</td><td className="px-2 whitespace-nowrap">{r.period}</td>
          {[r.gross, r.paye, r.nis, r.levy, r.other, r.net, r.employerNis, r.employerLevy, r.gross+r.employerNis+r.employerLevy].map((v, i) => <td key={i} className={`px-2 text-right tabular-nums ${i === 5 ? "font-semibold" : ""}`}>{formatCurrency(v)}</td>)}</tr>)}</tbody>
        {!!rows.length && <tfoot><tr className="font-semibold border-t-2 border-border"><td className="py-2 px-2" colSpan={3}>Totals</td>{[t.gross, t.paye, t.nis, t.levy, t.other, t.net, t.eNis, t.eLevy, t.gross+employer].map((v, i) => <td key={i} className="px-2 text-right tabular-nums">{formatCurrency(v)}</td>)}</tr></tfoot>}
      </table></div>
    </CardContent>
  </Card>;
}
