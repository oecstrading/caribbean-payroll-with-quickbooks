import { useEffect, useMemo, useState } from "react";
import { Landmark } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { formatCurrency } from "@/lib/payroll-engine";
import { levyFor } from "@/lib/statutory-levies";
import { REMITTANCE_TERMS, termsFor } from "@/lib/remittance-terms";

type Slip = { name: string; month: string; gross: number; paye: number; ee: number; er: number };

export default function StatutoryRemittanceReport() {
  const [slips, setSlips] = useState<Slip[]>([]);
  const [month, setMonth] = useState(new Date().toISOString().slice(0, 7));
  const [code, setCode] = useState("LC");

  useEffect(() => { void (async () => {
    const cols = "payroll_run_id,gross_pay,paye,employee_nic,employer_nic,employee_name_snapshot,created_at";
    const [runs, a, b] = await Promise.all([
      supabase.from("payroll_runs").select("id,period_end,run_date"),
      supabase.from("payslips").select(cols), supabase.from("employee_payslips").select(cols),
    ]);
    const rm = new Map((runs.data ?? []).map(r => [r.id, (r.period_end ?? r.run_date ?? "").slice(0, 7)]));
    setSlips([...(a.data ?? []), ...(b.data ?? [])].map(p => ({ name: p.employee_name_snapshot ?? "Employee", month: rm.get(p.payroll_run_id) || String(p.created_at).slice(0, 7),
      gross: Number(p.gross_pay) || 0, paye: Number(p.paye) || 0, ee: Number(p.employee_nic) || 0, er: Number(p.employer_nic) || 0 })));
  })(); }, []);

  const t = termsFor(code);
  const rows = useMemo(() => {
    const g = new Map<string, Slip & { levy: number }>();
    for (const s of slips.filter(s => s.month === month)) {
      const cur = g.get(s.name) ?? { ...s, gross: 0, paye: 0, ee: 0, er: 0, levy: 0 };
      cur.gross += s.gross; cur.paye += s.paye; cur.ee += s.ee; cur.er += s.er; g.set(s.name, cur);
    }
    return [...g.values()].map(r => { const l = levyFor(code, r.gross); return { ...r, levy: l.employee + l.employer }; }).sort((a, b) => a.name.localeCompare(b.name));
  }, [slips, month, code]);
  const tot = rows.reduce((s, r) => ({ gross: s.gross + r.gross, paye: s.paye + r.paye, ee: s.ee + r.ee, er: s.er + r.er, levy: s.levy + r.levy }), { gross: 0, paye: 0, ee: 0, er: 0, levy: 0 });
  const remit = tot.paye + tot.ee + tot.er + tot.levy;
  const heads = [t.gross, t.paye, t.eeNis, t.erNis, t.levies, "Total remittance"];

  return <Card>
    <CardHeader><CardTitle className="font-display flex items-center gap-2"><Landmark size={20} className="text-primary" />Statutory Remittance Report</CardTitle>
      <p className="text-sm text-muted-foreground">{t.form} · payable to {t.authority}</p></CardHeader>
    <CardContent className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
        <div className="space-y-1"><Label htmlFor="rem-month">Month</Label><Input id="rem-month" type="month" value={month} onChange={e => setMonth(e.target.value)} /></div>
        <div className="space-y-1"><Label htmlFor="rem-country">Jurisdiction</Label><NativeSelect id="rem-country" value={code} onChange={e => setCode(e.target.value)}>{Object.entries(REMITTANCE_TERMS).map(([k, v]) => <option key={k} value={k}>{v.name}</option>)}</NativeSelect></div>
        <div className="rounded-xl bg-primary/10 p-3"><p className="text-xs text-muted-foreground">Grand total due to government</p><p className="text-xl font-bold font-display text-primary">{formatCurrency(remit)}</p></div>
      </div>
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="border-b border-border text-muted-foreground"><th className="text-left py-2 px-2">Employee</th>{heads.map(h => <th key={h} className="text-right px-2 whitespace-nowrap">{h}</th>)}</tr></thead>
        <tbody>{!rows.length ? <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">No approved payslips for this month.</td></tr> : rows.map(r => <tr key={r.name} className="border-b border-border/50">
          <td className="py-2 px-2">{r.name}</td>{[r.gross, r.paye, r.ee, r.er, r.levy, r.paye + r.ee + r.er + r.levy].map((v, i) => <td key={i} className={`px-2 text-right tabular-nums ${i === 5 ? "font-semibold" : ""}`}>{formatCurrency(v)}</td>)}</tr>)}</tbody>
        {!!rows.length && <tfoot><tr className="font-bold border-t-2 border-border"><td className="py-2 px-2">Grand total</td>{[tot.gross, tot.paye, tot.ee, tot.er, tot.levy, remit].map((v, i) => <td key={i} className="px-2 text-right tabular-nums">{formatCurrency(v)}</td>)}</tr></tfoot>}
      </table></div>
      <p className="text-xs text-muted-foreground">Gross wages are not remitted; the total covers PAYE, both NIS/NIB shares and levies. Levies follow the selected country's rules — confirm rates with your accountant.</p>
    </CardContent>
  </Card>;
}
