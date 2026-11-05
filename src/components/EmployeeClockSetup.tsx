import { useEffect, useState } from "react";
import { Clock, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import { NativeSelect } from "@/components/ui/native-select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
type Config = { employee_code: string | null; pin_configured: boolean; shift_start: string; shift_end: string; days_of_week: number[]; break_minutes: number; site_id: string | null; enabled: boolean; allowed_methods: string[] };
export default function EmployeeClockSetup({ employeeId, canManage }: { employeeId: string; canManage: boolean }) {
  const [config, setConfig] = useState<Config | null>(null);
  const [pin, setPin] = useState(""); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const [sites, setSites] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    let cancelled = false;
    void Promise.all([supabase.rpc("employee_clock_configuration", { _employee: employeeId }), supabase.from("client_sites").select("id,name").order("name"), supabase.from("workforce_clock_settings").select("default_shift_start,default_shift_end,default_work_days,default_break_minutes").maybeSingle()]).then(([result, locations, defs]) => {
      const d = defs.data;
      if (cancelled) return;
      if (result.error || locations.error) { setError("Clock setup could not be loaded. Reopen the folder to retry."); return; }
      setSites(locations.data || []);
      setConfig(result.data ? result.data as unknown as Config : { employee_code: employeeId.slice(0, 8), pin_configured: false, shift_start: d?.default_shift_start?.slice(0, 5) ?? "08:00", shift_end: d?.default_shift_end?.slice(0, 5) ?? "16:00", days_of_week: d?.default_work_days ?? [1,2,3,4,5], break_minutes: d?.default_break_minutes ?? 0, site_id: null, enabled: true, allowed_methods: ["account", "pin", "voice"] });
    });
    return () => { cancelled = true; };
  }, [employeeId]);
  const save = async (e: React.FormEvent) => {
    e.preventDefault(); if (!config || !canManage) return; setBusy(true);
    try {
      // Assigning a new PIN means the admin wants this person to clock in, so switch the clock on.
      const enabled = config.enabled || Boolean(pin);
      const { error } = await supabase.rpc("configure_employee_clock_methods", { _employee: employeeId, _code: config.employee_code || "", _pin: pin || null, _start: config.shift_start, _end: config.shift_end, _days: config.days_of_week, _break: config.break_minutes, _site: config.site_id, _enabled: enabled, _methods: config.allowed_methods });
      if (error) throw error;
      setConfig({ ...config, enabled, pin_configured: config.pin_configured || Boolean(pin) }); setPin("");
      if (enabled) toast.success("Employee clock setup saved — clock is on");
      else toast.warning("Saved, but this employee's clock is switched OFF. They cannot clock in until you turn it on.");
    } catch (e) { toast.error(e && typeof e === "object" && "message" in e ? String(e.message) : "Unable to save clock setup"); } finally { setBusy(false); }
  };
  if (error) return <p role="alert" className="text-sm text-destructive">{error}</p>;
  if (!config) return <p className="text-sm text-muted-foreground">Loading clock setup…</p>;
  const disabled = !canManage || busy;
  return <form onSubmit={save} className="space-y-4 border-t border-border pt-5" aria-label="Employee clock setup">
    <h3 className="font-display font-semibold flex gap-2 items-center"><Clock size={18} />Time clock & schedule</h3>
    <Label className="flex justify-between items-center min-h-11 gap-3">Employee clock enabled<Switch checked={config.enabled} disabled={disabled} onCheckedChange={enabled => setConfig({ ...config, enabled })} /></Label>
    {!config.enabled && <p role="alert" className="text-sm text-destructive -mt-2">Clock is off — this employee cannot clock in with their link, code or PIN.</p>}
    <fieldset disabled={disabled} className="grid sm:grid-cols-2 gap-4">
      <div className="space-y-2"><Label htmlFor="folder-clock-code">Employee clock code</Label><Input id="folder-clock-code" required pattern="[A-Za-z0-9_-]{2,40}" maxLength={40} value={config.employee_code || ""} onChange={e => setConfig({ ...config, employee_code: e.target.value })} /></div>
      <div className="space-y-2"><Label htmlFor="folder-clock-pin">Staff clock PIN (4–6 digits)</Label><Input id="folder-clock-pin" type="password" autoComplete="new-password" inputMode="numeric" maxLength={6} pattern="[0-9]{4,6}" required={config.enabled && config.allowed_methods.includes("pin") && !config.pin_configured} value={pin} placeholder={config.pin_configured ? "Leave blank to keep current PIN" : "Assign staff clock PIN"} onChange={e => setPin(e.target.value.replace(/\D/g, ""))} /></div>
      <div className="space-y-2"><Label htmlFor="folder-shift-start">Shift starts</Label><Input id="folder-shift-start" type="time" required value={config.shift_start.slice(0,5)} onChange={e => setConfig({ ...config, shift_start: e.target.value })} /></div>
      <div className="space-y-2"><Label htmlFor="folder-shift-end">Shift ends</Label><Input id="folder-shift-end" type="time" required value={config.shift_end.slice(0,5)} onChange={e => setConfig({ ...config, shift_end: e.target.value })} /></div>
      <div className="space-y-2"><Label htmlFor="folder-clock-break">Unpaid break minutes</Label><Input id="folder-clock-break" type="number" min={0} max={240} value={config.break_minutes} onChange={e => setConfig({ ...config, break_minutes: Number(e.target.value) })} /></div>
      <div className="space-y-2"><Label htmlFor="folder-clock-site">Required work site</Label><NativeSelect id="folder-clock-site" value={config.site_id || ""} onChange={e => setConfig({ ...config, site_id: e.target.value || null })}><option value="">No site restriction</option>{sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}</NativeSelect></div>
    </fieldset>
    <fieldset disabled={disabled} className="space-y-2"><legend className="text-sm font-medium mb-2">Allowed clock methods</legend>{[["account","Signed-in account (email / Google / login PIN)"],["pin","Employee code + staff clock PIN"],["voice","Voice clock commands"]].map(([id,label]) => <Label key={id} className="flex gap-3 items-center min-h-11"><Checkbox checked={config.allowed_methods.includes(id)} onCheckedChange={v => setConfig({ ...config, allowed_methods: v === true ? [...config.allowed_methods,id] : config.allowed_methods.filter(m => m !== id) })} />{label}</Label>)}</fieldset>
    <fieldset disabled={disabled} className="flex flex-wrap gap-4"><legend className="text-sm mb-3">Scheduled days</legend>{["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map((day,id) => <Label key={day} className="flex gap-2 items-center min-h-11"><Checkbox checked={config.days_of_week.includes(id)} onCheckedChange={v => setConfig({ ...config, days_of_week: v === true ? [...config.days_of_week,id] : config.days_of_week.filter(d => d !== id) })} />{day}</Label>)}</fieldset>
    <Button type="submit" disabled={disabled}><Save size={16} />{busy ? "Saving…" : "Save clock setup"}</Button>
  </form>;
}