import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { NativeSelect } from "@/components/ui/native-select";
import { CalendarCheck, MessageSquareWarning, Wrench } from "lucide-react";
import { toast } from "sonner";

type Shift = { id: string; shift_date: string; clock_in: string | null; clock_out: string | null; approved_hours: number | null };
type Req = { id: string; kind: string; shift_date: string | null; reason: string; status: string; review_note: string | null; created_at: string };

const monthRange = () => { const d = new Date(); const s = new Date(d.getFullYear(), d.getMonth(), 1); const e = new Date(d.getFullYear(), d.getMonth() + 1, 0); const f = (x: Date) => x.toLocaleDateString("en-CA"); return { start: f(s), end: f(e) }; };
const localInput = (iso: string | null) => iso ? new Date(new Date(iso).getTime() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16) : "";

type PayPreview = { hours: number; regular: number; overtime: number; pending: number; shifts: number };

/** Staff self-service: worked-hours preview, punch corrections and pay disputes before payroll is approved. */
export default function StaffPayCenter() {
  const range = monthRange();
  const [preview, setPreview] = useState<PayPreview | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [requests, setRequests] = useState<Req[]>([]);
  const [kind, setKind] = useState<"punch_correction" | "pay_dispute">("punch_correction");
  const [shift, setShift] = useState(""); const [inAt, setIn] = useState(""); const [outAt, setOut] = useState(""); const [reason, setReason] = useState(""); const [busy, setBusy] = useState(false);
  const load = useCallback(async () => {
    const [p, s, r] = await Promise.all([
      supabase.rpc("my_pay_preview", { _start: range.start, _end: range.end }),
      supabase.from("workforce_shifts").select("id,shift_date,clock_in,clock_out,approved_hours").order("shift_date", { ascending: false }).limit(31),
      supabase.from("staff_pay_requests").select("id,kind,shift_date,reason,status,review_note,created_at").order("created_at", { ascending: false }).limit(20),
    ]);
    if (!p.error) setPreview(p.data as unknown as PayPreview);
    setShifts(s.data ?? []); setRequests(r.data ?? []);
  }, [range.start, range.end]);
  useEffect(() => { void load(); }, [load]);
  const pick = (id: string) => { setShift(id); const s = shifts.find(x => x.id === id); setIn(localInput(s?.clock_in ?? null)); setOut(localInput(s?.clock_out ?? null)); };
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    const { error } = await supabase.rpc("submit_staff_pay_request", { _kind: kind, _shift: shift || null as unknown as string, _date: range.end, _in: inAt ? new Date(inAt).toISOString() : null as unknown as string, _out: outAt ? new Date(outAt).toISOString() : null as unknown as string, _reason: reason });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Sent to your manager for review"); setReason(""); setShift(""); setIn(""); setOut(""); void load();
  }
  return <div className="border-t border-border pt-4 text-left space-y-4">
    <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 space-y-2">
      <h3 className="font-semibold flex items-center gap-2"><CalendarCheck size={18} className="text-primary" />My hours · this month</h3>
      {preview ? <>
        <div className="grid grid-cols-3 gap-2 text-center text-sm">
          <div><p className="text-xl font-bold">{Number(preview.regular).toFixed(2)}</p><p className="text-muted-foreground">Regular hrs</p></div>
          <div><p className="text-xl font-bold">{Number(preview.overtime).toFixed(2)}</p><p className="text-muted-foreground">Overtime hrs</p></div>
          <div><p className="text-xl font-bold text-warning">{preview.pending}</p><p className="text-muted-foreground">Awaiting review</p></div>
        </div>
        <p className="text-xs text-muted-foreground">Only your hours are shown here — your pay slip shows your final pay after your manager approves payroll. Raise any problem below before pay day.</p>
      </> : <p className="text-sm text-muted-foreground">Your pay preview is not available yet.</p>}
    </div>
    <form onSubmit={submit} className="space-y-3">
      <h3 className="font-semibold flex items-center gap-2"><Wrench size={18} className="text-accent" />Fix a punch or query my pay</h3>
      <NativeSelect aria-label="Request type" value={kind} onChange={e => setKind(e.target.value as typeof kind)}>
        <option value="punch_correction">Correct a clock-in / clock-out</option><option value="pay_dispute">Question my pay</option>
      </NativeSelect>
      <NativeSelect aria-label="Shift" value={shift} onChange={e => pick(e.target.value)} required={kind === "punch_correction"}>
        <option value="">{kind === "punch_correction" ? "Choose the shift" : "Shift (optional)"}</option>
        {shifts.map(s => <option key={s.id} value={s.id}>{s.shift_date} · {s.clock_in ? new Date(s.clock_in).toLocaleTimeString([], { timeStyle: "short" }) : "no in"} – {s.clock_out ? new Date(s.clock_out).toLocaleTimeString([], { timeStyle: "short" }) : "no out"}</option>)}
      </NativeSelect>
      {kind === "punch_correction" && <div className="grid grid-cols-2 gap-2"><div className="space-y-1"><Label htmlFor="fix-in">Actual clock in</Label><Input id="fix-in" type="datetime-local" value={inAt} onChange={e => setIn(e.target.value)} required /></div><div className="space-y-1"><Label htmlFor="fix-out">Actual clock out</Label><Input id="fix-out" type="datetime-local" value={outAt} onChange={e => setOut(e.target.value)} required /></div></div>}
      <Textarea aria-label="Reason" placeholder="What happened?" value={reason} onChange={e => setReason(e.target.value)} minLength={5} maxLength={1000} required />
      <Button type="submit" className="w-full h-11" disabled={busy}><MessageSquareWarning size={16} />Send to manager</Button>
    </form>
    {requests.length > 0 && <div className="space-y-2"><h3 className="font-semibold">My requests</h3>{requests.map(r => <div key={r.id} className="rounded-md border border-border p-3 text-sm"><div className="flex justify-between gap-2"><span className="font-medium">{r.kind === "punch_correction" ? "Punch correction" : "Pay question"}{r.shift_date ? ` · ${r.shift_date}` : ""}</span><span className={r.status === "approved" ? "text-success" : r.status === "rejected" ? "text-destructive" : "text-warning"}>{r.status}</span></div><p className="text-muted-foreground">{r.reason}</p>{r.review_note && <p>Manager: {r.review_note}</p>}</div>)}</div>}
  </div>;
}
