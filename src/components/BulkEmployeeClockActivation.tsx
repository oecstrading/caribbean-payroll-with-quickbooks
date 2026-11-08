import { useEffect, useMemo, useState } from "react";
import { Copy, Mail, MessageCircle, Smartphone, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { staffClockLink } from "@/lib/staff-clock-link";

type Emp = { employee_id: string; org_id: string; company: string; name: string; code: string | null; has_credential: boolean; enabled: boolean; bound: boolean; last_seen_at: string | null };
const key = (e: Emp) => `${e.org_id}:${e.employee_id}`;

export default function BulkEmployeeClockActivation() {
  const [emps, setEmps] = useState<Emp[]>([]);
  const [companies, setCompanies] = useState<Set<string>>(new Set());
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState<Emp[]>([]);

  const load = async () => {
    const { data, error } = await supabase.rpc("list_activatable_employee_clocks" as never);
    if (!error) setEmps((data as unknown as Emp[]) ?? []);
  };
  useEffect(() => { void load(); }, []);

  const orgs = useMemo(() => Array.from(new Map(emps.map((e) => [e.org_id, e.company])).entries()), [emps]);
  if (!emps.length) return null;
  const shown = emps.filter((e) => !companies.size || companies.has(e.org_id));
  const ready = shown.filter((e) => e.has_credential);
  const allPicked = ready.length > 0 && ready.every((e) => picked.has(key(e)));

  const toggleCompany = (id: string) => setCompanies((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggle = (k: string) => setPicked((p) => { const n = new Set(p); n.has(k) ? n.delete(k) : n.add(k); return n; });
  const toggleAll = () => setPicked((p) => { const n = new Set(p); ready.forEach((e) => allPicked ? n.delete(key(e)) : n.add(key(e))); return n; });

  const activate = async () => {
    const chosen = emps.filter((e) => picked.has(key(e)));
    if (!chosen.length) return;
    if (!confirm(`Switch on the personal clock for ${chosen.length} employee(s)? Their PIN and phone lock stay the same.`)) return;
    setBusy(true);
    const { data, error } = await supabase.rpc("bulk_enable_employee_clocks" as never, { _items: chosen.map((e) => ({ org_id: e.org_id, employee_id: e.employee_id })) } as never);
    setBusy(false);
    if (error) return void toast.error((error as { message: string }).message);
    toast.success(`${data as unknown as number} employee clock(s) switched on`);
    setSent(chosen); setPicked(new Set()); void load();
  };

  const msg = (e: Emp) => `Hi ${e.name.split(" ")[0]}! Your ${e.company} time clock is ready: ${staffClockLink(e.org_id, e.code ?? undefined)}\nOpen it on your OWN phone in Chrome or Safari, tap "Add app to my home screen", enter your PIN, allow location and tap Clock in. Your clock locks to your phone only, and your phone can only clock for you. A selfie is optional. Never share your link or PIN.`;
  const all = sent.map(msg).join("\n\n");

  return (
    <div className="rounded-2xl border border-sidebar-border bg-sidebar-accent p-4 text-sidebar-accent-foreground">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="flex items-center gap-2 font-semibold"><Smartphone className="h-4 w-4 text-sidebar-primary" />Activate employee clocks</h3>
          <p className="text-xs opacity-75">Pick companies, then one, several or all employees. Their phone clocks switch on and you get each person's link.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="min-h-11 text-foreground" onClick={toggleAll}>{allPicked ? "Clear" : "Select all"}</Button>
          <Button className="min-h-11" disabled={!picked.size || busy} onClick={() => void activate()}><UserCheck className="mr-2 h-4 w-4" />Activate {picked.size || ""} selected</Button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-2" role="group" aria-label="Companies">
        <Button size="sm" variant={companies.size ? "outline" : "default"} className="min-h-11" onClick={() => setCompanies(new Set())}>All companies</Button>
        {orgs.map(([id, name]) => <Button key={id} size="sm" aria-pressed={companies.has(id)} variant={companies.has(id) ? "default" : "outline"} className={companies.has(id) ? "min-h-11" : "min-h-11 text-foreground"} onClick={() => toggleCompany(id)}>{name}</Button>)}
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {shown.map((e) => (
          <li key={key(e)}>
            <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-xl border border-sidebar-border bg-sidebar p-3 text-sidebar-foreground">
              <Checkbox disabled={!e.has_credential} checked={picked.has(key(e))} onCheckedChange={() => toggle(key(e))} aria-label={`Select ${e.name}`} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{e.name}</span>
                <span className="block truncate text-xs opacity-70">{e.company} · {!e.has_credential ? "Needs a PIN first (Employee folder → Login & clock)" : e.enabled ? (e.bound ? "On · phone linked" : "On · waiting for phone") : "Switched off"}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>

      <Dialog open={sent.length > 0} onOpenChange={(o) => !o && setSent([])}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Send {sent.length} personal clock link{sent.length === 1 ? "" : "s"}</DialogTitle></DialogHeader>
          <p className="text-sm text-muted-foreground">Each link is personal. Send it only to that employee.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => { void navigator.clipboard.writeText(all); toast.success("All messages copied"); }}><Copy className="mr-2 h-4 w-4" />Copy all</Button>
            <Button variant="outline" asChild><a href={`mailto:?subject=${encodeURIComponent("Your time clock")}&body=${encodeURIComponent(all)}`}><Mail className="mr-2 h-4 w-4" />Email all</a></Button>
          </div>
          <ul className="grid gap-2">
            {sent.map((e) => (
              <li key={key(e)} className="flex items-center justify-between gap-2 rounded-xl border p-3 text-sm">
                <span className="min-w-0"><span className="block font-medium">{e.name}</span><span className="text-xs text-muted-foreground">{e.company}</span></span>
                <span className="flex gap-2">
                  <Button size="sm" variant="outline" aria-label="Copy" onClick={() => { void navigator.clipboard.writeText(msg(e)); toast.success("Copied"); }}><Copy className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" asChild><a aria-label="WhatsApp" href={`https://wa.me/?text=${encodeURIComponent(msg(e))}`} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" /></a></Button>
                </span>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </div>
  );
}
