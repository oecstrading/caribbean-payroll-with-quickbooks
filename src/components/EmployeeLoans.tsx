import { useEffect, useState } from "react";
import { Plus, Pause, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatCurrency } from "@/lib/payroll-engine";
import { loanSchema } from "@/lib/employee-loans";
import { toast } from "sonner";

type Loan = Database["public"]["Tables"]["employee_loans"]["Row"];
type Repayment = Database["public"]["Tables"]["loan_repayments"]["Row"];
const blank = { employee: "", creditor: "", original: "", balance: "", monthly: "", notes: "" };
export default function EmployeeLoans() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [repayments, setRepayments] = useState<Repayment[]>([]);
  const [employees, setEmployees] = useState<{ user_id: string; first_name: string; last_name: string }[]>([]);
  const [archived, setArchived] = useState<{ user_id: string; first_name: string; last_name: string }[]>([]);
  const [creditors, setCreditors] = useState<{ id: string; name: string }[]>([]);
  const [form, setForm] = useState(blank);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const load = async () => {
    const [l, r, e, c, a] = await Promise.all([
      supabase.from("employee_loans").select("*").order("created_at", { ascending: false }),
      supabase.from("loan_repayments").select("*").order("created_at", { ascending: false }),
      supabase.from("payroll_employee_directory").select("user_id,first_name,last_name").is("deleted_at", null),
      supabase.from("creditors").select("id,name").eq("is_active", true).order("name"),
      supabase.from("employee_records").select("user_id,first_name,last_name").not("permanently_deleted_at", "is", null),
    ]);
    const failure = l.error || r.error || e.error || c.error || a.error;
    if (failure) { setError(failure.message); return; }
    setError(""); setLoans(l.data || []); setRepayments(r.data || []); setEmployees(e.data || []); setCreditors(c.data || []); setArchived(a.data || []);
  };
  useEffect(() => { void load(); }, []);
  const save = async () => {
    const parsed = loanSchema.safeParse({ ...form, original: Number(form.original), balance: Number(form.balance), monthly: Number(form.monthly) });
    if (!parsed.success || !form.balance) { toast.error("Choose an employee and creditor, and enter valid loan amounts."); return; }
    setBusy(true);
    const v = parsed.data;
    const { error } = await supabase.rpc("create_employee_loan", { _employee: v.employee, _creditor: v.creditor, _original: v.original, _balance: v.balance, _monthly: v.monthly, _notes: v.notes });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    setOpen(false); setForm(blank); toast.success("Loan saved"); await load();
  };
  const toggle = async (loan: Loan) => {
    setBusy(true);
    const { error } = await supabase.rpc("set_employee_loan_active", { _loan: loan.id, _active: !loan.is_active });
    setBusy(false);
    if (error) toast.error(error.message); else await load();
  };
  const employeeName = (id: string) => { const e = [...employees, ...archived].find(e => e.user_id === id); return e ? `${e.first_name} ${e.last_name}${archived.some(a => a.user_id === id) ? " (removed)" : ""}` : "Archived employee"; };
  return <section className="space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><h2 className="text-lg font-semibold">Employee loans</h2><Button onClick={() => { setForm(blank); setOpen(true); }}><Plus size={16} /> Add loan</Button></div>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <div className="overflow-x-auto border-y border-border"><table className="w-full text-sm"><thead className="bg-secondary text-muted-foreground"><tr>{["Employee", "Creditor", "Original (XCD)", "Balance (XCD)", "Monthly repayment", "Status", ""].map((h, i) => <th key={i} className="p-3 text-left whitespace-nowrap">{h}</th>)}</tr></thead><tbody>
      {!loans.length && <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No employee loans</td></tr>}
      {loans.map(l => <tr key={l.id} className="border-t border-border"><td className="p-3">{employeeName(l.user_id)}</td><td className="p-3">{creditors.find(c => c.id === l.creditor_id)?.name || "Creditor"}</td><td className="p-3 font-mono">{formatCurrency(l.original_amount)}</td><td className="p-3 font-mono">{formatCurrency(l.balance)}</td><td className="p-3 font-mono">{formatCurrency(l.monthly_repayment)}</td><td className="p-3">{l.balance === 0 ? "Repaid" : l.is_active ? "Active" : "Paused"}</td><td className="p-3"><Button variant="ghost" size="icon" title={l.is_active ? "Pause repayments" : "Resume repayments"} aria-label={l.is_active ? "Pause repayments" : "Resume repayments"} disabled={busy || l.balance === 0 || archived.some(a => a.user_id === l.user_id)} onClick={() => toggle(l)}>{l.is_active ? <Pause size={16} /> : <Play size={16} />}</Button></td></tr>)}
    </tbody></table></div>
    <h3 className="font-semibold">Payroll deduction history</h3>
    <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr><th className="p-3 text-left">Date</th><th className="p-3 text-left">Employee</th><th className="p-3 text-left">Amount (XCD)</th><th className="p-3 text-left">Payroll reference</th></tr></thead><tbody>{repayments.map(r => <tr key={r.id} className="border-t border-border"><td className="p-3">{new Date(r.created_at).toLocaleDateString()}</td><td className="p-3">{employeeName(r.user_id)}</td><td className="p-3 font-mono">{formatCurrency(r.amount)}</td><td className="p-3 font-mono">{r.payroll_run_id.slice(0, 8)}</td></tr>)}{!repayments.length && <tr><td colSpan={4} className="p-4 text-muted-foreground">No payroll deductions recorded</td></tr>}</tbody></table></div>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent><DialogHeader><DialogTitle>Add employee loan</DialogTitle></DialogHeader><form className="space-y-3" onSubmit={e => { e.preventDefault(); void save(); }}>
      <div><Label htmlFor="loan-employee">Employee</Label><NativeSelect id="loan-employee" required value={form.employee} onChange={e => setForm({ ...form, employee: e.target.value })}><option value="">Select employee</option>{employees.map(e => <option key={e.user_id} value={e.user_id}>{e.first_name} {e.last_name}</option>)}</NativeSelect></div>
      <div><Label htmlFor="loan-creditor">Creditor</Label><NativeSelect id="loan-creditor" required value={form.creditor} onChange={e => setForm({ ...form, creditor: e.target.value })}><option value="">Select creditor</option>{creditors.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></div>
      {([['original', 'Original amount (XCD)'], ['balance', 'Current balance (XCD)'], ['monthly', 'Monthly repayment (XCD)']] as const).map(([k, label]) => <div key={k}><Label htmlFor={`loan-${k}`}>{label}</Label><Input id={`loan-${k}`} required type="number" min={k === "balance" ? 0 : 0.01} max={100000000} step="0.01" value={form[k]} onChange={e => setForm({ ...form, [k]: e.target.value })} /></div>)}
      <div><Label htmlFor="loan-notes">Notes</Label><Input id="loan-notes" maxLength={500} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} /></div><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Save loan"}</Button>
    </form></DialogContent></Dialog>
  </section>;
}