import { useEffect, useMemo, useState } from "react";
import { History } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

type Punch = { id: string; punched_at: string; direction: string; mode: string; employee_id: string; device_id: string | null; captured_offline: boolean };
const pad = (n: number) => String(n).padStart(2, "0");
const toLocal = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
const label: Record<string, string> = { clock_in: "Clock in", clock_out: "Clock out", lunch_out: "Lunch start", lunch_in: "Lunch end" };

/** Worked hours = time between each "in" and the following "out" for the same person. */
export function workedHours(punches: Punch[]) {
  let total = 0, start: number | null = null;
  [...punches].sort((a, b) => a.punched_at.localeCompare(b.punched_at)).forEach(p => {
    const t = new Date(p.punched_at).getTime();
    if (p.direction === "clock_in" || p.direction === "lunch_in") start = t;
    else if (start != null) { total += t - start; start = null; }
  });
  return total / 3600000;
}

export default function ClockActivityReport() {
  const now = new Date();
  const [from, setFrom] = useState(toLocal(new Date(now.getFullYear(), now.getMonth(), now.getDate())));
  const [to, setTo] = useState(toLocal(now));
  const [employee, setEmployee] = useState("");
  const [device, setDevice] = useState("");
  const [punches, setPunches] = useState<Punch[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [devices, setDevices] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const preset = (hours: number | "today") => {
    const end = new Date();
    const start = hours === "today" ? new Date(end.getFullYear(), end.getMonth(), end.getDate()) : new Date(end.getTime() - hours * 3600000);
    setFrom(toLocal(start)); setTo(toLocal(end));
  };

  useEffect(() => {
    void (async () => {
      const [e, d] = await Promise.all([
        supabase.from("employee_records").select("id,first_name,last_name,user_id,login_user_id"),
        supabase.from("clock_devices").select("id,name"),
      ]);
      const m: Record<string, string> = {};
      (e.data || []).forEach(r => { const n = `${r.first_name} ${r.last_name}`; [r.id, r.user_id, r.login_user_id].forEach(k => { if (k) m[k] = n; }); });
      setNames(m);
      setDevices(Object.fromEntries((d.data || []).map(x => [x.id, x.name])));
    })();
  }, []);

  useEffect(() => {
    const start = new Date(from), end = new Date(to);
    if (isNaN(+start) || isNaN(+end) || start >= end) { setError("Choose a start before the end."); return; }
    setBusy(true);
    void (async () => {
      let q = supabase.from("workforce_punches").select("id,punched_at,direction,mode,employee_id,device_id,captured_offline")
        .gte("punched_at", start.toISOString()).lte("punched_at", end.toISOString()).order("punched_at", { ascending: false }).limit(2000);
      if (employee) q = q.eq("employee_id", employee);
      if (device === "personal") q = q.is("device_id", null); else if (device) q = q.eq("device_id", device);
      const { data, error } = await q;
      setBusy(false);
      if (error) { setError(error.message); return; }
      setError(""); setPunches(data || []);
    })();
  }, [from, to, employee, device]);

  const people = useMemo(() => {
    const g: Record<string, Punch[]> = {};
    punches.forEach(p => (g[p.employee_id] ||= []).push(p));
    return Object.entries(g).map(([id, list]) => ({ id, list, hours: workedHours(list), first: list[list.length - 1].punched_at, last: list[0].punched_at }))
      .sort((a, b) => (names[a.id] || "").localeCompare(names[b.id] || ""));
  }, [punches, names]);
  const fmt = (s: string) => new Date(s).toLocaleString([], { dateStyle: "medium", timeStyle: "short" });
  const nameOf = (id: string) => names[id] || "Employee";
  const clockOf = (id: string | null) => id ? devices[id] || "Shared tablet" : "Own phone";

  return <section className="space-y-4 rounded-2xl border border-sidebar-border bg-sidebar-accent p-4 text-sidebar-accent-foreground">
    <div className="flex items-center gap-2"><History size={18} /><h2 className="text-lg font-semibold">Clock & employee activity</h2></div>
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" onClick={() => preset(1)}>Last hour</Button>
      <Button size="sm" variant="secondary" onClick={() => preset("today")}>Today</Button>
      <Button size="sm" variant="secondary" onClick={() => preset(24)}>Last 24 hours</Button>
      <Button size="sm" variant="secondary" onClick={() => preset(24 * 7)}>Last 7 days</Button>
      <Button size="sm" variant="secondary" onClick={() => preset(24 * 30)}>Last 30 days</Button>
    </div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <label className="text-xs">From<Input type="datetime-local" value={from} onChange={e => setFrom(e.target.value)} /></label>
      <label className="text-xs">To<Input type="datetime-local" value={to} onChange={e => setTo(e.target.value)} /></label>
      <label className="text-xs">Employee<NativeSelect value={employee} onChange={e => setEmployee(e.target.value)}><option value="">All employees</option>{[...new Set(Object.entries(names).map(([, n]) => n))].sort().map(n => { const id = Object.keys(names).find(k => names[k] === n && punches.some(p => p.employee_id === k)) || Object.keys(names).find(k => names[k] === n)!; return <option key={n} value={id}>{n}</option>; })}</NativeSelect></label>
      <label className="text-xs">Clock<NativeSelect value={device} onChange={e => setDevice(e.target.value)}><option value="">All clocks</option><option value="personal">Personal phones</option>{Object.entries(devices).map(([id, n]) => <option key={id} value={id}>{n}</option>)}</NativeSelect></label>
    </div>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <p className="text-sm text-muted-foreground">{busy ? "Loading…" : `${punches.length} punches by ${people.length} employees · ${people.reduce((s, p) => s + p.hours, 0).toFixed(2)} hours worked`}</p>
    {people.length > 0 && <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-muted-foreground"><th className="p-2">Employee</th><th className="p-2">Punches</th><th className="p-2">Hours</th><th className="p-2">First</th><th className="p-2">Last</th></tr></thead><tbody>
      {people.map(p => <tr key={p.id} className="border-t border-sidebar-border"><td className="p-2">{nameOf(p.id)}</td><td className="p-2">{p.list.length}</td><td className="p-2 font-mono">{p.hours.toFixed(2)}</td><td className="p-2">{fmt(p.first)}</td><td className="p-2">{fmt(p.last)}</td></tr>)}
    </tbody></table></div>}
    {punches.length > 0 && <details><summary className="cursor-pointer text-sm font-medium">Show every punch</summary><div className="mt-2 max-h-96 overflow-auto"><table className="w-full text-sm"><tbody>
      {punches.map(p => <tr key={p.id} className="border-t border-sidebar-border"><td className="p-2 whitespace-nowrap">{fmt(p.punched_at)}</td><td className="p-2">{nameOf(p.employee_id)}</td><td className="p-2">{label[p.direction] || p.direction}</td><td className="p-2">{clockOf(p.device_id)}</td><td className="p-2 text-muted-foreground">{p.mode}{p.captured_offline ? " · offline" : ""}</td></tr>)}
    </tbody></table></div></details>}
    {!busy && !punches.length && !error && <p className="text-sm text-muted-foreground">No clock activity in this period.</p>}
  </section>;
}
