import { useEffect, useState } from "react";
import { Building2, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/native-select";
import { PAYMASTER_DEFAULTS, PAYMASTER_MODULES, WORKSPACE_MODULES } from "@/lib/workspace-access";
import { toast } from "sonner";

type Person = { user_id: string; name: string; email: string | null; home_company: string | null; org_ids: string[] };
type Company = { id: string; name: string };
export default function MultiCompanyPaymasterDialog({ open, onClose, onSaved }: { open: boolean; onClose: () => void; onSaved?: () => void }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [user, setUser] = useState("");
  const [orgs, setOrgs] = useState<string[]>([]);
  const [modules, setModules] = useState<string[]>([...PAYMASTER_DEFAULTS]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    let active = true;
    setBusy(true); setError(""); setUser("");
    Promise.all([supabase.rpc("multi_company_admins"), supabase.rpc("my_companies")]).then(([p, c]) => {
      if (!active) return;
      if (p.error || c.error) setError("Unable to load company assignments. Close and try again.");
      else { setPeople(p.data ?? []); setCompanies(c.data ?? []); }
      setBusy(false);
    });
    return () => { active = false; };
  }, [open]);
  async function choose(id: string) {
    setUser(id); setError(""); setBusy(true);
    const person = people.find(p => p.user_id === id);
    setOrgs(person?.org_ids ?? []);
    const { data, error } = await supabase.rpc("paymaster_assignment_details", { _user: id });
    if (error) { setError(error.message); setUser(""); }
    else setModules(data?.length ? data : [...PAYMASTER_DEFAULTS]);
    setBusy(false);
  }
  async function save() {
    if (!user) return;
    setBusy(true); setError("");
    const { error } = await supabase.rpc("assign_paymaster_companies", { _user: user, _orgs: orgs, _modules: modules });
    setBusy(false);
    if (error) { setError(error.message); return; }
    toast.success("Pay Master and company access saved. Employment details are unchanged.");
    onSaved?.(); onClose();
  }
  const person = people.find(p => p.user_id === user);
  return <Dialog open={open} onOpenChange={value => { if (!value && !busy) onClose(); }}><DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
    <DialogHeader><DialogTitle className="flex items-center gap-2"><Building2 />Multi-company Pay Master</DialogTitle></DialogHeader>
    <label className="space-y-2 text-sm font-medium">Platform user<NativeSelect aria-label="Pay Master user" value={user} disabled={busy} onChange={e => void choose(e.target.value)}><option value="">Choose a user</option>{people.map(p => <option key={p.user_id} value={p.user_id}>{p.name || p.email} · {p.email?.endsWith("@pin.invalid") ? "PIN login" : p.email}</option>)}</NativeSelect></label>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    {user && <>
      <section className="space-y-3 border-t border-border pt-3"><h3 className="font-semibold">Companies</h3><div className="grid sm:grid-cols-2 gap-2">{companies.map(c => { const home = c.name === person?.home_company; return <label key={c.id} className="flex gap-3 items-center min-h-11 text-sm"><Checkbox aria-label={`Pay Master for ${c.name}`} disabled={busy || home} checked={home || orgs.includes(c.id)} onCheckedChange={on => setOrgs(ids => on ? [...ids, c.id] : ids.filter(id => id !== c.id))} />{c.name}{home && " (home)"}</label>; })}</div></section>
      <section className="space-y-3 border-t border-border pt-3"><h3 className="font-semibold">Payroll tabs in assigned companies</h3><div className="grid sm:grid-cols-2 gap-2">{WORKSPACE_MODULES.filter(m => PAYMASTER_MODULES.includes(m.id)).map(m => <label key={m.id} className="flex gap-3 items-center min-h-11 text-sm"><Checkbox aria-label={`Pay Master tab ${m.label}`} disabled={busy || m.id === "payroll"} checked={modules.includes(m.id)} onCheckedChange={on => setModules(ids => on ? [...ids, m.id] : ids.filter(id => id !== m.id))} />{m.label}</label>)}</div></section>
      <p className="text-sm text-muted-foreground">One email or PIN login for every selected company. Company-enabled features still apply. This does not add an employee or grant administrator rights.</p>
    </>}
    <div className="flex justify-end gap-2"><Button variant="outline" disabled={busy} onClick={onClose}>Cancel</Button><Button disabled={busy || !user || !modules.includes("payroll")} onClick={() => void save()}><Save />{busy ? "Please wait…" : "Save Pay Master access"}</Button></div>
  </DialogContent></Dialog>;
}