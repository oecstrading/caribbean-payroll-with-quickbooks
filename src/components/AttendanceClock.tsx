import { useCallback, useEffect, useState } from "react";
import { Clock, CalendarIcon, RotateCcw, LogIn, LogOut, Square, ShieldCheck } from "lucide-react";
import { format } from "date-fns";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";
import { useNavigate } from "react-router-dom";
import { simulatedTime, simulationStartSchema, nextSimulatedPunch } from "@/lib/simulation-time";
import { toast } from "sonner";

type Settings = Database["public"]["Tables"]["organization_simulation_clock"]["Row"];
type Punch = Database["public"]["Tables"]["simulated_attendance_punches"]["Row"];
export default function AttendanceClock() {
  const { user } = useAuth();
  const { isAdminOrManager } = useRole();
  const navigate = useNavigate();
  const [now, setNow] = useState(Date.now());
  const [settings, setSettings] = useState<Settings | null>(null);
  const [punches, setPunches] = useState<Punch[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(() => new Date(2026, 10, 1));
  const [time, setTime] = useState("08:00");
  const load = useCallback(async () => {
    if (!user) return;
    const result = await supabase.from("organization_simulation_clock").select("*").maybeSingle();
    if (result.error) { setError("The simulated clock is unavailable."); setLoading(false); return; }
    setSettings(result.data); setError("");
    if (result.data) {
      const records = await supabase.from("simulated_attendance_punches").select("*").eq("user_id", user.id).eq("run_id", result.data.run_id).order("recorded_at", { ascending: false }).limit(10);
      if (records.error) setError("Test punches could not be loaded.");
      else setPunches(records.data || []);
    } else setPunches([]);
    setLoading(false);
  }, [user]);
  useEffect(() => {
    load();
    const tick = window.setInterval(() => setNow(Date.now()), 1000);
    const poll = window.setInterval(load, 10000);
    window.addEventListener("focus", load);
    return () => { clearInterval(tick); clearInterval(poll); window.removeEventListener("focus", load); };
  }, [load]);
  const reset = async (enabled: boolean) => {
    if (!isAdminOrManager || !date) return;
    const start = new Date(date);
    const [hours, minutes] = time.split(":").map(Number);
    start.setHours(hours, minutes, 0, 0);
    if (!/^\d{2}:\d{2}$/.test(time) || hours > 23 || minutes > 59 || !simulationStartSchema.safeParse(start).success) { toast.error("Choose a valid date and time between 2000 and 2100."); return; }
    setBusy(true);
    const { error } = await supabase.rpc("reset_company_simulation", { _start: start.toISOString(), _enabled: enabled });
    if (error) toast.error(error.message);
    else { await load(); setOpen(false); toast.success(enabled ? "Simulated attendance clock reset" : "Simulation stopped; real attendance unchanged"); }
    setBusy(false);
  };
  const punch = async () => {
    setBusy(true);
    const { error } = await supabase.rpc("record_simulated_punch", { _type: nextSimulatedPunch(punches[0]?.punch_type) });
    if (error) toast.error(error.message);
    else { await load(); toast.success("Test punch recorded — not included in payroll"); }
    setBusy(false);
  };
  const virtual = settings ? simulatedTime(settings.simulated_start, settings.real_start, now) : null;
  const clockedIn = punches[0]?.punch_type === "clock_in";
  return <section aria-label="Time and attendance clock" className="border-y border-border py-5 space-y-4">
    <div className="flex flex-wrap items-center justify-between gap-4">
      <div className="flex items-start gap-3"><Clock className="text-primary mt-1" size={24} /><div>
        <p className="text-xs font-medium text-muted-foreground">Device clock · {Intl.DateTimeFormat().resolvedOptions().timeZone}</p>
        <time className="block font-display font-bold text-3xl tabular-nums text-foreground" data-testid="device-clock">{format(new Date(now), "HH:mm:ss")}</time>
        <p className="text-sm text-muted-foreground">{format(new Date(now), "EEEE, d MMMM yyyy")}</p>
      </div></div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="h-11" onClick={() => navigate("/guard-tour")}><ShieldCheck />Real attendance</Button>
        {isAdminOrManager && <Button variant="secondary" className="h-11" disabled={loading || Boolean(error)} onClick={() => setOpen(true)}><RotateCcw />{settings?.enabled ? "Reset simulated clock" : "Set simulated clock"}</Button>}
      </div>
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error} <Button variant="link" onClick={load}>Retry</Button></p>}
    {settings?.enabled && virtual && <div className="bg-warning/10 border-l-4 border-warning p-4 space-y-4">
      <div className="flex flex-wrap justify-between items-center gap-4"><div>
        <Badge variant="secondary" className="mb-2">SIMULATED · Not payroll</Badge>
        <time className="block font-display font-bold text-2xl tabular-nums text-foreground" data-testid="simulation-clock">{format(virtual, "d MMM yyyy · HH:mm:ss")}</time>
        <p className="text-xs text-muted-foreground mt-1">{clockedIn ? "Test shift in progress" : "No test shift in progress"}</p>
      </div><Button className="h-11" disabled={busy || loading || Boolean(error)} onClick={punch}>{clockedIn ? <LogOut /> : <LogIn />}{busy ? "Recording…" : clockedIn ? "Test clock out" : "Test clock in"}</Button></div>
      {punches.length > 0 && <div className="border-t border-warning/20 pt-3"><p className="text-xs font-medium text-muted-foreground mb-2">Your recent test punches</p><ul className="space-y-1">{punches.map((record) => <li key={record.id} className="flex flex-wrap justify-between gap-2 text-sm text-foreground"><span>{record.punch_type === "clock_in" ? "Clock in" : "Clock out"}</span><time>{format(new Date(record.simulated_at), "d MMM yyyy · HH:mm:ss")}</time></li>)}</ul></div>}
    </div>}
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Simulated attendance clock</DialogTitle><DialogDescription>Starts a new test session for all staff. Previous test punches are retained; real attendance and payroll are unchanged.</DialogDescription></DialogHeader>
      <div className="space-y-4"><div className="space-y-2"><Label>Simulation start date</Label><Popover><PopoverTrigger asChild><Button variant="outline" className="w-full justify-start h-11"><CalendarIcon />{date ? format(date, "d MMMM yyyy") : "Choose date"}</Button></PopoverTrigger><PopoverContent className="w-auto p-0 pointer-events-auto" align="start"><Calendar mode="single" selected={date} onSelect={setDate} captionLayout="dropdown-buttons" fromYear={2000} toYear={2100} initialFocus className="p-3 pointer-events-auto" /></PopoverContent></Popover></div>
        <div className="space-y-2"><Label htmlFor="simulation-start-time">Start time · device timezone</Label><Input id="simulation-start-time" type="time" value={time} onChange={(event) => setTime(event.target.value)} className="h-11" /></div>
        <div className="flex flex-wrap gap-2 justify-end">{settings?.enabled && <Button variant="outline" disabled={busy} onClick={() => reset(false)}><Square />Stop simulation</Button>}<Button disabled={busy || !date} onClick={() => reset(true)}><RotateCcw />{busy ? "Saving…" : "Start / reset simulation"}</Button></div>
      </div></DialogContent></Dialog>
  </section>;
}