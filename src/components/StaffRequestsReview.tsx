import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Inbox, Check, X } from "lucide-react";
import { toast } from "sonner";

type Req = { id: string; employee_id: string; kind: string; shift_date: string | null; requested_clock_in: string | null; requested_clock_out: string | null; reason: string; created_at: string };

/** Manager queue for staff punch corrections and pay questions. */
export default function StaffRequestsReview() {
  const [rows, setRows] = useState<Req[]>([]); const [names, setNames] = useState<Record<string, string>>({}); const [notes, setNotes] = useState<Record<string, string>>({}); const [busy, setBusy] = useState("");
  const load = useCallback(async () => {
    const [r, d] = await Promise.all([
      supabase.from("staff_pay_requests").select("id,employee_id,kind,shift_date,requested_clock_in,requested_clock_out,reason,created_at").eq("status", "pending").order("created_at"),
      supabase.from("payroll_employee_directory").select("user_id,first_name,last_name"),
    ]);
    setRows(r.data ?? []); setNames(Object.fromEntries((d.data ?? []).map(x => [x.user_id ?? "", `${x.first_name} ${x.last_name}`])));
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function decide(id: string, approve: boolean) {
    setBusy(id);
    const { error } = await supabase.rpc("review_staff_pay_request", { _id: id, _approve: approve, _note: notes[id] ?? "" });
    setBusy("");
    if (error) toast.error(error.message); else { toast.success(approve ? "Approved — hours updated for payroll" : "Request declined"); void load(); }
  }
  const t = (x: string | null) => x ? new Date(x).toLocaleString([], { dateStyle: "short", timeStyle: "short" }) : "—";
  return <section className="space-y-3 rounded-lg border border-accent/40 bg-accent/5 p-4">
    <h2 className="font-display text-lg font-semibold flex items-center gap-2"><Inbox size={18} className="text-accent" />Staff requests <span className="text-sm text-muted-foreground">({rows.length} waiting)</span></h2>
    {!rows.length && <p className="text-sm text-muted-foreground">No punch corrections or pay questions waiting.</p>}
    {rows.map(r => <div key={r.id} className="rounded-md border border-border bg-background p-3 space-y-2 text-sm">
      <div className="flex flex-wrap justify-between gap-2"><strong>{names[r.employee_id] ?? "Employee"}</strong><span>{r.kind === "punch_correction" ? "Punch correction" : "Pay question"}{r.shift_date ? ` · ${r.shift_date}` : ""}</span></div>
      {r.kind === "punch_correction" && <p>Requested: {t(r.requested_clock_in)} → {t(r.requested_clock_out)}</p>}
      <p className="text-muted-foreground">“{r.reason}”</p>
      <div className="flex flex-wrap gap-2"><Input className="flex-1 min-w-48" aria-label="Review note" placeholder="Review note (required)" value={notes[r.id] ?? ""} onChange={e => setNotes({ ...notes, [r.id]: e.target.value })} />
        <Button disabled={busy === r.id} onClick={() => void decide(r.id, true)}><Check size={16} />Approve</Button>
        <Button variant="outline" disabled={busy === r.id} onClick={() => void decide(r.id, false)}><X size={16} />Decline</Button></div>
    </div>)}
  </section>;
}
