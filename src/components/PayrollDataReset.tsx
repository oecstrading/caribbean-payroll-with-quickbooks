import { useEffect, useState } from "react";
import { Eraser, CalendarCheck } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Co = { id: string; name: string };
type Res = { org_id: string; runs: number; shifts: number; punches: number; requests: number; drafts: number }[];

export default function PayrollDataReset({ companies }: { companies: Co[] }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [goLive, setGoLive] = useState<Record<string, string>>({});
  const [start, setStart] = useState(""); const [end, setEnd] = useState(""); const [live, setLive] = useState("");
  const [confirm, setConfirm] = useState(""); const [busy, setBusy] = useState(false);

  async function loadLive() {
    const { data } = await supabase.from("payroll_go_live").select("org_id,start_date");
    setGoLive(Object.fromEntries((data ?? []).map(r => [r.org_id, r.start_date])));
  }
  useEffect(() => { void loadLive(); }, []);

  const name = (id: string) => companies.find(c => c.id === id)?.name ?? "Company";
  const report = (r: Res) => r.map(x => `${name(x.org_id)}: ${x.runs} payrolls, ${x.shifts} shifts, ${x.punches} punches, ${x.requests} requests, ${x.drafts} AI drafts erased`).join("\n");

  async function run(mode: "range" | "live") {
    if (!picked.length) return toast.error("Tick at least one company");
    if (confirm !== "ERASE") return toast.error("Type ERASE to confirm");
    setBusy(true);
    const { data, error } = mode === "range"
      ? await supabase.rpc("erase_payroll_data", { _orgs: picked, _start: start, _end: end, _confirmation: confirm })
      : await supabase.rpc("set_payroll_go_live", { _orgs: picked, _start: live, _confirmation: confirm });
    setBusy(false); setConfirm("");
    if (error) return toast.error(error.message);
    toast.success(mode === "live" ? "Go-live date set" : "Payroll data erased", { description: report((data ?? []) as Res), duration: 10000 });
    void loadLive();
  }

  return <section className="space-y-4 border border-destructive/40 rounded-lg p-5 bg-destructive/5">
    <div className="flex items-center gap-2"><Eraser className="text-destructive" /><h2 className="font-display text-lg font-semibold">Clear test payroll & set go-live date</h2></div>
    <p className="text-sm text-muted-foreground">Erases payroll runs, pay slips, clock punches and shifts, staff pay requests and AI Paymaster drafts/alerts. Loan balances taken by erased payrolls are given back. Employees, settings and logins are kept. <strong>This cannot be undone.</strong></p>
    <div className="flex flex-wrap gap-2">{companies.map(c => { const on = picked.includes(c.id); return <label key={c.id} className={`flex items-center gap-2 rounded-md border px-3 min-h-[44px] text-sm cursor-pointer ${on ? "border-destructive bg-destructive/10" : "border-border"}`}>
      <input type="checkbox" checked={on} onChange={e => setPicked(p => e.target.checked ? [...p, c.id] : p.filter(x => x !== c.id))} />{c.name}
      {goLive[c.id] && <span className="text-xs text-success">· live from {goLive[c.id]}</span>}
    </label>; })}</div>
    <div className="grid gap-4 md:grid-cols-2">
      <div className="space-y-2 rounded-md border border-border bg-card p-4">
        <p className="font-medium">Erase a date range</p>
        <div className="grid grid-cols-2 gap-2"><div><Label>From</Label><Input type="date" value={start} onChange={e => setStart(e.target.value)} /></div><div><Label>To</Label><Input type="date" value={end} onChange={e => setEnd(e.target.value)} /></div></div>
        <Button variant="destructive" disabled={busy || !start || !end} onClick={() => void run("range")}><Eraser size={15} className="mr-2" />Erase this range</Button>
      </div>
      <div className="space-y-2 rounded-md border border-border bg-card p-4">
        <p className="font-medium">Go-live (accounting start) date</p>
        <div><Label>Payroll officially starts on</Label><Input type="date" value={live} onChange={e => setLive(e.target.value)} /></div>
        <p className="text-xs text-muted-foreground">Erases everything before this date and blocks any payroll from being saved for earlier dates.</p>
        <Button variant="destructive" disabled={busy || !live} onClick={() => void run("live")}><CalendarCheck size={15} className="mr-2" />Erase earlier data & go live</Button>
      </div>
    </div>
    <div className="max-w-xs"><Label>Type ERASE to confirm</Label><Input value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="ERASE" /></div>
  </section>;
}
