import { useEffect, useMemo, useState } from "react";
import { Bot, CheckCircle2, AlertTriangle, Upload, Receipt, X } from "lucide-react";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/payroll-engine";
import { pdfLines } from "@/lib/pdf-lines";
import { parsePayslips, learnNicBasis, rebuildSlip, matchEmployee, NIC_BASIS_LABELS, type NicBasis, type ParsedSlip, type PayeRule } from "@/lib/payslip-pdf";

type Person = { user_id: string | null; first_name: string | null; last_name: string | null; department: string | null; jurisdiction: string | null };

export default function PayslipImportPage() {
  const [fileName, setFileName] = useState("");
  const [slips, setSlips] = useState<ParsedSlip[]>([]);
  const [reading, setReading] = useState(false);
  const [people, setPeople] = useState<Person[]>([]);
  const [basis, setBasis] = useState<NicBasis>("gross");
  const [learned, setLearned] = useState<{ basis: NicBasis; matches: number } | null>(null);
  const [paye, setPaye] = useState<PayeRule | "">("");
  const [matches, setMatches] = useState<Record<number, string>>({});
  const [confirmed, setConfirmed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedRun, setSavedRun] = useState("");

  useEffect(() => {
    supabase.from("payroll_employee_directory").select("user_id,first_name,last_name,department,jurisdiction").is("deleted_at", null).ilike("status", "active")
      .then(({ data }) => setPeople((data as Person[]) || []));
  }, []);

  const reset = () => { setFileName(""); setSlips([]); setLearned(null); setPaye(""); setMatches({}); setConfirmed(false); setSavedRun(""); };

  const upload = async (file: File) => {
    reset(); setReading(true);
    try {
      const found = parsePayslips(await pdfLines(await file.arrayBuffer()));
      if (!found.length) throw new Error("No pay stubs found. The file needs to be a text PDF with an \"Employee Pay Stub\" page per person.");
      setFileName(file.name); setSlips(found);
      const l = learnNicBasis(found); setLearned(l); setBasis(l.basis);
      setPaye(found.every(s => s.taxes === 0) ? "" : "as_slips");
    } catch (e) { toast.error(e instanceof Error ? e.message : "Couldn't read this PDF"); }
    setReading(false);
  };

  useEffect(() => {
    const next: Record<number, string> = {};
    slips.forEach((s, i) => { const p = matchEmployee(s.name, people); if (p?.user_id) next[i] = p.user_id; });
    setMatches(next);
  }, [slips, people]);

  const rebuilt = useMemo(() => paye ? slips.map(s => rebuildSlip(s, { basis, paye })) : [], [slips, basis, paye]);
  const exact = rebuilt.filter(r => r.differences.length === 0).length;
  const total = (k: "gross" | "net") => rebuilt.reduce((s, r) => s + r[k], 0);
  const slipTotal = (k: "gross" | "net") => slips.reduce((s, r) => s + r[k], 0);
  const allMatched = slips.length > 0 && slips.every((_, i) => matches[i]);
  const period = slips[0] ? { start: slips.map(s => s.periodStart).sort()[0], end: slips.map(s => s.periodEnd).sort().reverse()[0] } : null;

  const save = async () => {
    if (!period) return;
    setSaving(true);
    const { data, error } = await supabase.rpc("approve_payslip_import", {
      _start: period.start, _end: period.end, _jurisdiction: "LC", _notes: `Rebuilt from ${fileName}`.slice(0, 500),
      _rows: rebuilt.map((r, i) => ({ user_id: matches[i], basic_pay: r.basic, overtime_pay: r.overtime, gross_pay: r.gross, employee_nic: r.nicEE, employer_nic: r.nicER, paye: r.paye, total_deductions: r.totalDeductions, net_pay: r.net })),
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    setSavedRun(String(data)); toast.success("Payroll saved. It now appears in Payroll History and Reports.");
  };

  const step = (n: number, done: boolean) => <span className={`mr-2 inline-flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold ${done ? "bg-success text-success-foreground" : "bg-primary text-primary-foreground"}`}>{done ? "✓" : n}</span>;

  return (
    <div className="space-y-4 p-4 pb-24">
      <div>
        <h1 className="text-2xl font-display font-bold flex items-center gap-2"><Receipt className="h-6 w-6 text-primary" />Pay Slip Import · AI Paymaster</h1>
        <p className="text-sm text-muted-foreground">Upload last period's pay slips (PDF). The Paymaster reads every slip, learns your pay rules, rebuilds each payslip and shows any difference before you approve.</p>
      </div>

      <Card><CardHeader><CardTitle className="text-base">{step(1, slips.length > 0)}Upload the pay slips</CardTitle></CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Button asChild className="min-h-11" disabled={reading}><label className="cursor-pointer"><Upload className="mr-2 h-4 w-4" />{reading ? "Reading…" : "Choose PDF"}
            <input type="file" accept="application/pdf,.pdf" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} /></label></Button>
          {fileName && <><Badge variant="secondary">{fileName}</Badge><Badge>{slips.length} pay slips</Badge>
            <Button variant="ghost" className="min-h-11" onClick={reset}><X className="mr-1 h-4 w-4" />Clear</Button></>}
        </CardContent></Card>

      {slips.length > 0 && <Card><CardHeader><CardTitle className="text-base flex items-center">{step(2, !!paye && allMatched)}<Bot className="mr-2 h-4 w-4 text-primary" />The Paymaster's questions</CardTitle></CardHeader>
        <CardContent className="space-y-4 text-sm">
          <div className="space-y-1">
            <p className="font-medium">Which earnings attract NIC?</p>
            {learned && <p className="text-xs text-muted-foreground">Learned from your slips: <strong>{NIC_BASIS_LABELS[learned.basis]}</strong> explains {learned.matches} of {slips.length} slips.</p>}
            <select className="min-h-11 w-full max-w-md rounded-md border bg-background px-3" value={basis} onChange={e => setBasis(e.target.value as NicBasis)}>
              {(Object.keys(NIC_BASIS_LABELS) as NicBasis[]).map(k => <option key={k} value={k}>{NIC_BASIS_LABELS[k]}</option>)}
            </select>
          </div>
          <div className="space-y-1">
            <p className="font-medium">Income tax (PAYE)</p>
            {slips.every(s => s.taxes === 0) && <p className="text-xs text-warning">None of these slips withhold PAYE. Saint Lucia's tax bands would normally take tax from higher earners. Choose what to do.</p>}
            <div className="flex flex-wrap gap-2">
              <Button variant={paye === "as_slips" ? "default" : "outline"} className="min-h-11" onClick={() => setPaye("as_slips")}>Keep what the slips withheld</Button>
              <Button variant={paye === "calculated" ? "default" : "outline"} className="min-h-11" onClick={() => setPaye("calculated")}>Apply Saint Lucia PAYE</Button>
            </div>
          </div>
          <div className="space-y-1">
            <p className="font-medium">Who is each slip for?</p>
            {!people.some(p => p.user_id) && <p className="text-sm text-warning">No employee folders yet. Add each person under Employees first, then come back to these slips — the Paymaster can&apos;t match a slip to someone who isn&apos;t in the directory.</p>}
            {slips.map((s, i) => <div key={i} className="flex flex-wrap items-center gap-2">
              <span className="w-44 font-medium">{s.name}</span>
              <select className="min-h-11 flex-1 rounded-md border bg-background px-3" value={matches[i] || ""} onChange={e => setMatches(m => ({ ...m, [i]: e.target.value }))}>
                <option value="">Choose employee…</option>
                {people.filter(p => p.user_id).map(p => <option key={p.user_id!} value={p.user_id!}>{p.first_name} {p.last_name} · {p.department || "Unassigned"}</option>)}
              </select>
            </div>)}
          </div>
        </CardContent></Card>}

      {rebuilt.length > 0 && <Card><CardHeader><CardTitle className="text-base flex flex-wrap items-center gap-2">{step(3, exact === rebuilt.length)}Comparison: your slips vs the platform
        <Badge className={exact === rebuilt.length ? "bg-success text-success-foreground" : "bg-warning text-warning-foreground"}>{exact} of {rebuilt.length} match to the cent</Badge></CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4 text-sm">
            <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Gross on slips</p><p className="font-bold">{formatCurrency(slipTotal("gross"))}</p></div>
            <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Gross by platform</p><p className="font-bold">{formatCurrency(total("gross"))}</p></div>
            <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Net on slips</p><p className="font-bold">{formatCurrency(slipTotal("net"))}</p></div>
            <div className="rounded-xl border p-3"><p className="text-xs text-muted-foreground">Net by platform</p><p className="font-bold">{formatCurrency(total("net"))}</p></div>
          </div>
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="border-b text-left text-xs text-muted-foreground"><th className="py-2 pr-3">Employee</th><th className="pr-3 text-right">Gross</th><th className="pr-3 text-right">NIC</th><th className="pr-3 text-right">PAYE</th><th className="pr-3 text-right">Other</th><th className="pr-3 text-right">Net (slip)</th><th className="pr-3 text-right">Net (platform)</th><th>Result</th></tr></thead>
            <tbody>{rebuilt.map((r, i) => <tr key={i} className="border-b border-border/60 align-top">
              <td className="py-2 pr-3"><p className="font-medium">{r.slip.name}</p><p className="text-xs text-muted-foreground">{r.slip.earnings.map(e => `${e.label} ${e.current.toFixed(2)}`).join(" · ")}</p>
                {r.slip.otherDeductions.length > 0 && <p className="text-xs text-muted-foreground">Deductions carried from slip: {r.slip.otherDeductions.map(d => `${d.label} ${d.current.toFixed(2)}`).join(", ")}</p>}
                {r.differences.map((d, k) => <p key={k} className="text-xs text-destructive">{d.field}: slip {d.slip.toFixed(2)} vs platform {d.platform.toFixed(2)} — {d.reason}</p>)}</td>
              <td className="pr-3 text-right">{r.gross.toFixed(2)}</td><td className="pr-3 text-right">{r.nicEE.toFixed(2)}</td><td className="pr-3 text-right">{r.paye.toFixed(2)}</td><td className="pr-3 text-right">{r.other.toFixed(2)}</td>
              <td className="pr-3 text-right">{r.slip.net.toFixed(2)}</td><td className="pr-3 text-right font-semibold">{r.net.toFixed(2)}</td>
              <td>{r.differences.length ? <Badge className="bg-warning text-warning-foreground"><AlertTriangle className="mr-1 h-3 w-3" />{r.differences.length}</Badge> : <Badge className="bg-success text-success-foreground"><CheckCircle2 className="mr-1 h-3 w-3" />Match</Badge>}</td>
            </tr>)}</tbody></table></div>
        </CardContent></Card>}

      {rebuilt.length > 0 && <Card><CardHeader><CardTitle className="text-base">{step(4, !!savedRun)}Human review and approval</CardTitle></CardHeader>
        <CardContent className="space-y-3 text-sm">
          {savedRun ? <p className="text-success font-medium">Saved. Period {period?.start} to {period?.end} is now in Payroll History, Reports and payslips.</p> : <>
            <p>Period {period?.start} to {period?.end} · {rebuilt.length} employees · net {formatCurrency(total("net"))}. Nothing is saved until you approve.</p>
            {!allMatched && <p className="text-warning">Choose the employee for every slip first.</p>}
            <label className="flex min-h-11 items-center gap-2"><input type="checkbox" className="h-5 w-5" checked={confirmed} onChange={e => setConfirmed(e.target.checked)} />I reviewed the comparison and approve this payroll.</label>
            <Button className="min-h-11" disabled={!confirmed || !allMatched || saving} onClick={save}>{saving ? "Saving…" : "Approve and save payroll"}</Button></>}
        </CardContent></Card>}
    </div>
  );
}
