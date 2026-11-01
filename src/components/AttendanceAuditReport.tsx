import { useEffect, useMemo, useState } from "react";
import { Clock, UserX } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency } from "@/lib/payroll-engine";
import { splitHours, isLate, dailyCost, type ShiftIn } from "@/lib/attendance-audit";

type Emp = { id: string; name: string; salary: number; std: number; users: string[] };
type Shift = ShiftIn & { id: string; employee_id: string };
type Leave = { user_id: string; leave_type: string; start_date: string; end_date: string; status: string };

const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };
const fmtTime = (v: string | null) => v ? new Date(v).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) : "—";

export default function AttendanceAuditReport() {
  const [from, setFrom] = useState(monthStart());
  const [to, setTo] = useState(new Date().toISOString().slice(0, 10));
  const [emps, setEmps] = useState<Map<string, Emp>>(new Map());
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [leave, setLeave] = useState<Leave[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => { void (async () => {
    setLoading(true);
    const [e, s, l] = await Promise.all([
      supabase.from("employee_records").select("id,first_name,last_name,monthly_salary,std_hours_per_day,user_id,login_user_id").is("deleted_at", null),
      supabase.from("workforce_shifts").select("id,employee_id,shift_date,scheduled_start,clock_in,clock_out,break_minutes,approved_hours").gte("shift_date", from).lte("shift_date", to).order("shift_date"),
      supabase.from("leave_requests").select("user_id,leave_type,start_date,end_date,status").lte("start_date", to).gte("end_date", from),
    ]);
    setEmps(new Map((e.data ?? []).map(r => [r.id, { id: r.id, name: `${r.first_name ?? ""} ${r.last_name ?? ""}`.trim() || "Employee", salary: Number(r.monthly_salary) || 0, std: Number(r.std_hours_per_day) || 8, users: [r.user_id, r.login_user_id].filter(Boolean) as string[] }])));
    setShifts((s.data ?? []) as Shift[]); setLeave((l.data ?? []) as Leave[]); setLoading(false);
  })(); }, [from, to]);

  const grid = shifts.map(s => { const emp = emps.get(s.employee_id); return { ...s, name: emp?.name ?? "Employee", ...splitHours(s, emp?.std), late: isLate(s) }; });

  const summary = useMemo(() => {
    const out = new Map<string, { emp: Emp; absent: number; unexcused: number; sick: number; late: number }>();
    for (const s of grid) {
      const emp = emps.get(s.employee_id); if (!emp) continue;
      const row = out.get(emp.id) ?? { emp, absent: 0, unexcused: 0, sick: 0, late: 0 };
      if (s.late) row.late++;
      const past = s.shift_date < new Date().toISOString().slice(0, 10);
      if (!s.clock_in && past) {
        row.absent++;
        const cover = leave.find(l => emp.users.includes(l.user_id) && l.status === "approved" && l.start_date <= s.shift_date && l.end_date >= s.shift_date);
        if (!cover) row.unexcused++; else if (cover.leave_type === "sick") row.sick++;
      }
      out.set(emp.id, row);
    }
    return [...out.values()].filter(r => r.absent || r.late).sort((a, b) => b.unexcused - a.unexcused || b.late - a.late);
  }, [grid, emps, leave]);
  const totalCost = summary.reduce((s, r) => s + r.absent * dailyCost(r.emp.salary), 0);

  return <div className="space-y-5">
    <Card>
      <CardHeader><CardTitle className="font-display flex items-center gap-2"><Clock size={20} className="text-primary" />Time & Attendance Audit</CardTitle>
        <p className="text-sm text-muted-foreground">Regular hours up to each employee's standard day; overtime 1.5× beyond; Sunday hours 2.0×. Late = more than 5 minutes after the scheduled start.</p></CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 max-w-md">
          <div className="space-y-1"><Label htmlFor="ta-from">Pay cycle from</Label><Input id="ta-from" type="date" value={from} onChange={e => setFrom(e.target.value)} /></div>
          <div className="space-y-1"><Label htmlFor="ta-to">To</Label><Input id="ta-to" type="date" value={to} onChange={e => setTo(e.target.value)} /></div>
        </div>
        <div className="overflow-x-auto max-h-[480px]"><table className="w-full text-sm">
          <thead className="sticky top-0 bg-card"><tr className="border-b border-border text-muted-foreground text-left">{["Employee", "Date", "Clock-in", "Clock-out", "Regular", "OT 1.5×", "DT 2.0×"].map((h, i) => <th key={h} className={`py-2 px-2 whitespace-nowrap ${i > 3 ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
          <tbody>{loading ? <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">Loading shifts…</td></tr> : !grid.length ? <tr><td colSpan={7} className="py-6 text-center text-muted-foreground">No shifts in this pay cycle.</td></tr> : grid.map(r => <tr key={r.id} className="border-b border-border/50">
            <td className="py-2 px-2">{r.name}</td><td className="px-2 whitespace-nowrap">{r.shift_date}</td>
            <td className="px-2 whitespace-nowrap">{fmtTime(r.clock_in)} {r.late && <Badge className="ml-1 bg-accent text-accent-foreground">Late</Badge>}{!r.clock_in && <Badge variant="destructive" className="ml-1">No punch</Badge>}</td>
            <td className="px-2">{fmtTime(r.clock_out)}</td>
            {[r.regular, r.overtime, r.double].map((v, i) => <td key={i} className="px-2 text-right tabular-nums">{v ? v.toFixed(2) : "—"}</td>)}</tr>)}</tbody>
          {!!grid.length && <tfoot><tr className="font-semibold border-t-2 border-border"><td className="py-2 px-2" colSpan={4}>Totals</td>{(["regular", "overtime", "double"] as const).map(k => <td key={k} className="px-2 text-right tabular-nums">{grid.reduce((s, r) => s + r[k], 0).toFixed(2)}</td>)}</tr></tfoot>}
        </table></div>
      </CardContent>
    </Card>
    <Card>
      <CardHeader><CardTitle className="font-display flex items-center gap-2"><UserX size={20} className="text-destructive" />Absentee & Leave Summary</CardTitle>
        <p className="text-sm text-muted-foreground">Scheduled days with no clock-in. Approved leave makes an absence excused. Cost = monthly salary ÷ 22 working days per missed day.</p></CardHeader>
      <CardContent className="space-y-3">
        <div className="rounded-xl bg-destructive/10 p-3 inline-block"><p className="text-xs text-muted-foreground">Economic cost of absence this cycle</p><p className="text-xl font-bold font-display text-destructive">{formatCurrency(totalCost)}</p></div>
        {!summary.length ? <p className="text-sm text-muted-foreground">No absences or late arrivals in this pay cycle.</p> : <div className="overflow-x-auto"><table className="w-full text-sm">
          <thead><tr className="border-b border-border text-muted-foreground text-left">{["Employee", "Days absent", "Unexcused", "Sick leave", "Late arrivals", "Cost of absence"].map((h, i) => <th key={h} className={`py-2 px-2 ${i ? "text-right" : ""}`}>{h}</th>)}</tr></thead>
          <tbody>{summary.map(r => <tr key={r.emp.id} className="border-b border-border/50">
            <td className="py-2 px-2">{r.emp.name}</td>
            <td className="px-2 text-right">{r.absent}</td>
            <td className="px-2 text-right">{r.unexcused ? <Badge variant="destructive">{r.unexcused}</Badge> : 0}</td>
            <td className="px-2 text-right">{r.sick ? <Badge variant="secondary">{r.sick}</Badge> : 0}</td>
            <td className="px-2 text-right">{r.late ? <Badge className="bg-accent text-accent-foreground">{r.late}</Badge> : 0}</td>
            <td className="px-2 text-right tabular-nums">{formatCurrency(r.absent * dailyCost(r.emp.salary))}</td></tr>)}</tbody>
        </table></div>}
      </CardContent>
    </Card>
  </div>;
}
