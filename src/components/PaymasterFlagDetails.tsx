import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

type Row = { key: string; cols: string[] };
type Detail = { head: string[]; rows: Row[]; path: string; label: string };

export function flagKind(title: string) {
  const t = title.toLowerCase();
  if (t.includes("payroll cost")) return "cost";
  if (t.includes("missing punch")) return "missing";
  if (t.includes("awaiting review")) return "pending";
  if (t.includes("nic or tax")) return "ids";
  if (t.includes("no pay rate")) return "zero";
  if (t.includes("clock incident")) return "incident";
  if (t === "staff") return "staff";
  if (t === "loans") return "loans";
  return "other";
}

const t = (v?: string | null) => (v ? new Date(v).toLocaleString([], { dateStyle: "medium", timeStyle: "short" }) : "—");
const monthStart = () => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10); };

async function names() {
  const { data } = await supabase.from("payroll_employee_directory").select("user_id,first_name,last_name,monthly_salary,nic_number,tan_number,status").is("deleted_at", null);
  const m: Record<string, string> = {};
  (data ?? []).forEach(e => { if (e.user_id) m[e.user_id] = `${e.first_name ?? ""} ${e.last_name ?? ""}`.trim(); });
  return { m, staff: data ?? [] };
}

async function load(kind: string): Promise<Detail> {
  const { m, staff } = await names();
  const n = (id?: string | null) => (id && m[id]) || "Unknown employee";
  if (kind === "missing") {
    const { data } = await supabase.from("workforce_alerts").select("id,employee_id,missing_type,created_at,shift_id").is("resolved_at", null).order("created_at", { ascending: false }).limit(100);
    return { head: ["Employee", "Missing", "Detected"], rows: (data ?? []).map(a => ({ key: a.id, cols: [n(a.employee_id), String(a.missing_type ?? "").replace(/_/g, " "), t(a.created_at)] })), path: "/attendance", label: "Fix on Attendance" };
  }
  if (kind === "pending") {
    const { data } = await supabase.from("workforce_shifts").select("id,employee_id,shift_date,clock_in,clock_out").eq("review_status", "pending").gte("shift_date", monthStart()).order("shift_date", { ascending: false }).limit(100);
    return { head: ["Employee", "Date", "Clock in", "Clock out"], rows: (data ?? []).map(s => ({ key: s.id, cols: [n(s.employee_id), s.shift_date, t(s.clock_in), t(s.clock_out)] })), path: "/attendance", label: "Review on Attendance" };
  }
  if (kind === "cost") {
    const { data } = await supabase.from("payroll_runs").select("id,period,period_start,period_end,employee_count,total_gross,total_net,status").order("created_at", { ascending: false }).limit(6);
    return { head: ["Period", "Staff", "Gross", "Net", "Status"], rows: (data ?? []).map(r => ({ key: r.id, cols: [r.period_start && r.period_end ? `${r.period_start} → ${r.period_end}` : String(r.period ?? ""), String(r.employee_count ?? 0), Number(r.total_gross ?? 0).toFixed(2), Number(r.total_net ?? 0).toFixed(2), String(r.status ?? "")] })), path: "/payroll-history", label: "Open Payroll History" };
  }
  if (kind === "ids" || kind === "zero") {
    const act = staff.filter(e => String(e.status ?? "active").toLowerCase() === "active");
    const list = kind === "ids" ? act.filter(e => !e.nic_number || !e.tan_number) : act.filter(e => !Number(e.monthly_salary));
    return { head: kind === "ids" ? ["Employee", "NIC", "Tax no."] : ["Employee", "Pay rate"], rows: list.map((e, i) => ({ key: e.user_id ?? String(i), cols: kind === "ids" ? [n(e.user_id), e.nic_number || "missing", e.tan_number || "missing"] : [n(e.user_id), "none set"] })), path: "/employees", label: "Open Employees" };
  }
  if (kind === "incident") {
    const { data } = await supabase.from("clock_incidents").select("id,title,detail,severity,last_detected_at").neq("status", "resolved").order("last_detected_at", { ascending: false }).limit(50);
    return { head: ["Incident", "Detail", "Last seen"], rows: (data ?? []).map(c => ({ key: c.id, cols: [c.title, c.detail ?? "", t(c.last_detected_at)] })), path: "/clock-devices", label: "Open Clock devices" };
  }
  if (kind === "staff") {
    const act = staff.filter(e => String(e.status ?? "active").toLowerCase() === "active");
    return { head: ["Employee", "Monthly pay", "NIC", "Tax no."], rows: act.map((e, i) => ({ key: e.user_id ?? String(i), cols: [n(e.user_id), Number(e.monthly_salary ?? 0).toFixed(2), e.nic_number || "missing", e.tan_number || "missing"] })), path: "/employees", label: "Edit on Employees" };
  }
  if (kind === "loans") {
    const { data } = await supabase.from("employee_loans").select("*").order("created_at", { ascending: false }).limit(100);
    const rows = (data ?? []) as Record<string, unknown>[];
    return { head: ["Employee", "Balance", "Repayment", "Status"], rows: rows.map(l => ({ key: String(l.id), cols: [n(l.user_id as string), Number(l.balance ?? 0).toFixed(2), `${Number(l.repayment_amount ?? l.monthly_repayment ?? 0).toFixed(2)} ${String(l.repayment_frequency ?? "")}`.trim(), l.is_active ? "Active" : "Stopped"] })), path: "/deductions", label: "Edit loans on Deductions" };
  }
  return { head: [], rows: [], path: "/payroll", label: "Open Payroll" };
}

export function PaymasterFlagDetails({ title }: { title: string }) {
  const navigate = useNavigate();
  const kind = flagKind(title);
  const { data, isLoading } = useQuery({ queryKey: ["paymaster-flag", kind], queryFn: () => load(kind) });
  if (isLoading || !data) return <p className="text-sm text-muted-foreground mt-2">Loading details…</p>;
  return (
    <div className="mt-3 space-y-2">
      {data.rows.length === 0 ? <p className="text-sm text-muted-foreground">No matching records right now.</p> : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50"><tr>{data.head.map(h => <th key={h} className="px-2 py-1.5 text-left font-medium">{h}</th>)}</tr></thead>
            <tbody>{data.rows.map(r => <tr key={r.key} className="border-t">{r.cols.map((c, i) => <td key={i} className="px-2 py-1.5">{c}</td>)}</tr>)}</tbody>
          </table>
        </div>
      )}
      <Button size="sm" variant="outline" onClick={() => navigate(data.path)}><ExternalLink className="mr-1 h-3.5 w-3.5" />{data.label}</Button>
    </div>
  );
}
