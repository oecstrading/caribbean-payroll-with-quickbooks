import { useEffect, useState } from "react";
import { Copy, HelpCircle, Mail, MessageCircle, RefreshCw, Trash2, WifiOff } from "lucide-react";
import { QRCodeCanvas } from "qrcode.react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { CLOCK_STATUS_LABELS, explainClock, type MonitoredClock } from "@/lib/clock-monitoring";
import { kioskActivationLink } from "@/lib/kiosk-setup";
import type { Database } from "@/integrations/supabase/types";

type Shift = Database["public"]["Tables"]["workforce_shifts"]["Row"];
type Punch = { id: string; shift_id: string | null; punched_at: string; direction: string; captured_offline: boolean; latitude: number | null; longitude: number | null };
export default function ClockRepairDialog({ clock, onClose, onChanged }: { clock: MonitoredClock | null; onClose: () => void; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [issued, setIssued] = useState<{code: string; expires_at: string} | null>(null);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [punches, setPunches] = useState<Punch[]>([]);
  const [editing, setEditing] = useState<Shift | null>(null);
  const [hours, setHours] = useState("");
  const [note, setNote] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [reason, setReason] = useState("");
  const loadReview = async (id: string) => {
    const result = await supabase.from("workforce_shifts").select("*").eq("employee_id", id).eq("review_status", "pending").is("reviewed_at", null).order("shift_date", { ascending: false });
    if (result.error) throw result.error;
    const rows = result.data ?? [];
    setShifts(rows);
    if (!rows.length) { setPunches([]); return; }
    const p = await supabase.from("workforce_punches").select("id,shift_id,punched_at,direction,captured_offline,latitude,longitude").in("shift_id", rows.map(s => s.id)).order("punched_at");
    if (p.error) throw p.error;
    setPunches(p.data ?? []);
  };
  useEffect(() => {
    setIssued(null); setError(""); setShifts([]); setPunches([]); setEditing(null); setDeleting(false); setReason("");
    if (clock?.type === "personal") void loadReview(clock.id).catch(e => setError(e.message));
  }, [clock?.id, clock?.type]);
  if (!clock) return null;
  const explanation = explainClock(clock, clock.last_seen_at ? new Date(clock.last_seen_at).toLocaleString() : "activation");
  const steps = clock.status === "sync_review" ? ["Select a pending shift below and compare its punches with the employee’s actual work and location.", "Enter verified payable hours and a confirmation note. Do not assume the scheduled hours were worked.", "Save each review, then refresh the clock status. Payroll still requires separate approval."]
    : clock.type === "shared" ? ["Ask the person at the PC or tablet to check power, internet and open Time Clock. Allow location on that device when requested.", "If already activated, reconnect first and refresh here. Only reset if the device was replaced or activation is missing; resetting disconnects the old device.", "Generate an activation link here and send it privately to the intended device. Open it within 15 minutes; one link activates one device.", "Refresh here to verify the status. Switch off or delete only if this clock is no longer used."]
    : ["Verify the employee’s identity and ask them to use their registered phone and correct code/PIN.", "For a replaced phone or temporary PIN lock, reset here. The old phone is unlinked and the next successful punch registers the new one.", "For a missing or forgotten PIN, use the employee folder’s Login & clock settings and give the PIN separately.", "Review pending shifts below, then refresh to verify the result."];
  const perform = async (action: "activate" | "reset" | "off" | "delete") => {
    if (action === "reset" && !confirm(`Reset ${clock.name}? This clears the PIN lock and unlinks the old phone. Verify the employee first.`)) return;
    if (action === "activate" && clock.activated_at && !confirm(`Reset ${clock.name} and create a new link? The existing PC/tablet will stop accepting punches until activated again.`)) return;
    if (action === "off" && !confirm(`Switch off ${clock.name}? It will stop accepting punches.`)) return;
    setBusy(true); setError("");
    try {
      const result = action === "activate" ? await supabase.rpc("renew_clock_device_code", { _id: clock.id })
        : action === "reset" ? await supabase.rpc("admin_reset_employee_clock", { _employee: clock.id })
        : action === "off" ? await supabase.rpc("revoke_clock_device", { _id: clock.id })
        : clock.type === "shared" ? await supabase.rpc("delete_clock_device", { _id: clock.id })
        : await supabase.rpc("delete_employee_clock", { _employee: clock.id, _reason: reason.trim() });
      if (result.error) throw result.error;
      if (action === "activate") setIssued(result.data as {code: string; expires_at: string});
      toast.success(action === "activate" ? "New activation link ready" : action === "delete" ? "Clock deleted; hours and pay history kept" : action === "off" ? "Clock switched off" : "Phone and PIN lock reset");
      await onChanged();
      if (action === "delete") onClose();
    } catch (e) { setError(e && typeof e === "object" && "message" in e ? String(e.message) : "Action failed. Try again."); }
    finally { setBusy(false); }
  };
  const saveReview = async () => {
    if (!editing) return;
    setBusy(true); setError("");
    const r = await supabase.rpc("review_workforce_shift", { _shift: editing.id, _hours: Number(hours), _notes: note.trim() });
    if (r.error) setError(r.error.message);
    else { setEditing(null); toast.success("Verified hours saved; payroll not approved"); await loadReview(clock.id).catch(e => setError(e.message)); await onChanged(); }
    setBusy(false);
  };
  const link = issued ? kioskActivationLink(issued.code) : "";
  const shareText = `Activate ${clock.name} on its intended company PC/tablet: ${link}. This private single-use link expires in 15 minutes. Open it on that device, not your phone.`;
  return <Dialog open onOpenChange={open => { if (!open && !busy) onClose(); }}><DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto"><DialogHeader><DialogTitle>{clock.name} · Clock help & actions</DialogTitle></DialogHeader>
    <p className="text-sm"><strong>{CLOCK_STATUS_LABELS[clock.status]}:</strong> {explanation?.why ?? "No failure is currently reported for this clock. A closed personal-phone app is not an offline failure."}</p>
    <div className="flex items-center gap-2"><h3 className="font-semibold">Steps to resolve</h3><Tooltip><TooltipTrigger asChild><Button size="icon" variant="ghost" aria-label="About these clock repair steps"><HelpCircle className="h-4 w-4" /></Button></TooltipTrigger><TooltipContent className="max-w-xs">Follow the steps in order. Repairs never create punches or approve payroll. Device power and permission changes require the person at that device.</TooltipContent></Tooltip></div>
    <ol className="list-decimal space-y-2 pl-5 text-sm text-muted-foreground">{steps.map(step => <li key={step}>{step}</li>)}</ol>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex flex-wrap gap-2">
      <Button variant="outline" disabled={busy} onClick={() => void onChanged()}><RefreshCw className="mr-2 h-4 w-4" />Refresh status</Button>
      {clock.type === "shared" ? <><Button disabled={busy} title="Creates a private single-use link valid for 15 minutes. The old device is disconnected." onClick={() => void perform("activate")}><RefreshCw className="mr-2 h-4 w-4" />{clock.activated_at ? "Reset & resend link" : "Activate / resend link"}</Button>{clock.status !== "switched_off" && <Button variant="outline" disabled={busy} onClick={() => void perform("off")}><WifiOff className="mr-2 h-4 w-4" />Switch off</Button>}</>
        : <><Button disabled={busy} title="Verify identity first. Clears failed PIN attempts and unlinks the registered phone." onClick={() => void perform("reset")}>Reset phone / PIN lock</Button><Button variant="outline" asChild><a href="/employees">Employee folder · Login & clock</a></Button></>}
      <Button variant="destructive" disabled={busy} onClick={() => setDeleting(true)}><Trash2 className="mr-2 h-4 w-4" />Delete clock</Button>
    </div>
    {issued && <div className="space-y-3 border-t pt-4"><h3 className="font-semibold">Send to the intended PC or tablet</h3><p className="text-sm text-muted-foreground">Expires {new Date(issued.expires_at).toLocaleString()}. Keep this link private.</p><QRCodeCanvas value={link} size={180} includeMargin /><p className="break-all text-sm">{link}</p><div className="flex flex-wrap gap-2"><Button variant="outline" onClick={() => void navigator.clipboard.writeText(link).then(() => toast.success("Link copied"), () => toast.error("Unable to copy; use email or WhatsApp"))}><Copy className="mr-2 h-4 w-4" />Copy link</Button><Button variant="outline" asChild><a href={`https://wa.me/?text=${encodeURIComponent(shareText)}`} target="_blank" rel="noreferrer"><MessageCircle className="mr-2 h-4 w-4" />WhatsApp</a></Button><Button variant="outline" asChild><a href={`mailto:?subject=${encodeURIComponent(`Activate ${clock.name}`)}&body=${encodeURIComponent(shareText)}`}><Mail className="mr-2 h-4 w-4" />Email</a></Button></div></div>}
    {clock.type === "personal" && <div className="space-y-3 border-t pt-4"><h3 className="font-semibold">Pending shift reviews ({shifts.length})</h3>{shifts.map(s => <div key={s.id} className="border-b pb-3 text-sm"><p className="font-semibold">{s.shift_date} · {s.review_status}</p><p>Clock in: {s.clock_in ? new Date(s.clock_in).toLocaleString() : "Missing"} · Clock out: {s.clock_out ? new Date(s.clock_out).toLocaleString() : "Missing"}</p><ul className="my-2 space-y-1 text-muted-foreground">{punches.filter(p => p.shift_id === s.id).map(p => <li key={p.id}>{new Date(p.punched_at).toLocaleString()} · {p.direction.replaceAll("_", " ")} {p.captured_offline && "· Offline"} {p.latitude != null && p.longitude != null && <a className="text-primary underline" href={`https://www.google.com/maps/search/?api=1&query=${p.latitude},${p.longitude}`} target="_blank" rel="noreferrer">Location</a>}</li>)}</ul><Button size="sm" variant="outline" disabled={busy} onClick={() => { setEditing(s); setHours(s.approved_hours == null ? "" : String(s.approved_hours)); setNote(""); }}>Review this shift</Button></div>)}{!shifts.length && <p className="text-sm text-muted-foreground">No pending shifts found.</p>}
      {editing && <div className="space-y-2"><p className="font-semibold">Confirm {editing.shift_date}</p><Label htmlFor="repair-hours">Verified payable hours</Label><Input id="repair-hours" type="number" min={0} max={24} step="0.01" value={hours} onChange={e => setHours(e.target.value)} /><Label htmlFor="repair-note">Confirmation note</Label><Input id="repair-note" maxLength={500} value={note} onChange={e => setNote(e.target.value)} /><Button disabled={busy || hours.trim() === "" || !Number.isFinite(Number(hours)) || Number(hours) < 0 || Number(hours) > 24 || note.trim().length < 3} onClick={() => void saveReview()}>Confirm worked hours</Button></div>}
    </div>}
    {deleting && <div className="space-y-3 border-t pt-4"><h3 className="font-semibold text-destructive">Confirm clock deletion</h3><p className="text-sm">This stops the old device immediately. The employee, recorded hours and payroll history remain. A replacement clock must be set up again.</p><Label htmlFor="delete-clock-reason">Reason (left, lost phone, stolen device, or no longer used)</Label><Input id="delete-clock-reason" value={reason} maxLength={200} onChange={e => setReason(e.target.value)} /><div className="flex gap-2"><Button variant="outline" disabled={busy} onClick={() => setDeleting(false)}>Cancel deletion</Button><Button variant="destructive" disabled={busy || reason.trim().length < 3} onClick={() => void perform("delete")}>Confirm delete clock</Button></div></div>}
  </DialogContent></Dialog>;
}