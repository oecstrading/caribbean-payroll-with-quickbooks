import { useEffect, useState } from "react";
import { Building2, Users, AlertTriangle, Wallet, ArrowRight, ShieldCheck, Save } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { switchCompany } from "@/lib/multi-company";
import PayrollDataReset from "@/components/PayrollDataReset";

type Overview = { id: string; name: string; active_employees: number; last_period: string | null; last_net: number | null; open_alerts: number; pending_runs: number };
type Admin = { user_id: string; name: string; email: string | null; home_company: string | null; org_ids: string[] };

const money = (n: number | null) => n == null ? "—" : `$${Number(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export default function MyCompaniesPage() {
  const [rows, setRows] = useState<Overview[] | null>(null);
  const [error, setError] = useState("");
  const [platform, setPlatform] = useState(false);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState("");
  const [current, setCurrent] = useState("");
  const [superAdmin, setSuperAdmin] = useState(false);

  async function load() {
    const [o, p, c] = await Promise.all([supabase.rpc("companies_overview"), supabase.rpc("is_platform_admin"), supabase.rpc("current_org_id")]);
    if (o.error) { setError(o.error.message); setRows([]); return; }
    setRows((o.data ?? []) as Overview[]); setCurrent(c.data ?? "");
    if (c.data) { const s = await supabase.rpc("can_erase_payroll", { _org: c.data }); setSuperAdmin(!!s.data); }
    const isPlatform = !p.error && !!p.data; setPlatform(isPlatform);
    if (isPlatform) {
      const a = await supabase.rpc("multi_company_admins");
      if (a.error) toast.error(a.error.message);
      const list = (a.data ?? []) as Admin[]; setAdmins(list);
      setDraft(Object.fromEntries(list.map(x => [x.user_id, x.org_ids ?? []])));
    }
  }
  useEffect(() => { void load(); }, []);

  async function saveAccess(userId: string) {
    setSaving(userId);
    const { error } = await supabase.rpc("set_company_admin_access", { _user: userId, _orgs: draft[userId] ?? [] });
    setSaving("");
    if (error) toast.error(error.message); else { toast.success("Company access saved"); void load(); }
  }

  if (!rows) return <div className="p-6">Loading companies…</div>;
  const totals = rows.reduce((t, r) => ({ staff: t.staff + Number(r.active_employees), alerts: t.alerts + Number(r.open_alerts), net: t.net + Number(r.last_net ?? 0) }), { staff: 0, alerts: 0, net: 0 });

  return <div className="p-4 md:p-6 space-y-8 max-w-6xl mx-auto">
    <header className="border-b border-border pb-5">
      <div className="flex items-center gap-3"><Building2 className="text-primary" /><h1 className="text-2xl font-display font-bold">My companies</h1></div>
      <p className="text-muted-foreground mt-2">Every company you can manage, side by side. Open one to work inside it.</p>
    </header>
    {error && <p className="text-destructive">{error}</p>}
    <section className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-lg bg-primary/10 border border-primary/30 p-4"><p className="text-sm text-muted-foreground">Companies</p><p className="text-2xl font-bold">{rows.length}</p></div>
      <div className="rounded-lg bg-success/10 border border-success/30 p-4"><p className="text-sm text-muted-foreground">Active staff</p><p className="text-2xl font-bold">{totals.staff}</p></div>
      <div className="rounded-lg bg-warning/10 border border-warning/30 p-4"><p className="text-sm text-muted-foreground">Open missing-punch alerts</p><p className="text-2xl font-bold">{totals.alerts}</p></div>
    </section>
    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {rows.map(r => <article key={r.id} className={`border rounded-lg bg-card p-5 border-t-4 space-y-3 ${r.id === current ? "border-t-success border-success/40" : "border-t-primary border-border"}`}>
        <div className="flex justify-between gap-2"><h2 className="font-semibold break-words min-w-0">{r.name}</h2>{r.id === current && <span className="text-xs rounded-full bg-success/15 text-success px-2 py-0.5 h-fit">Open now</span>}</div>
        <ul className="text-sm space-y-1.5">
          <li className="flex items-center gap-2"><Users size={15} className="text-primary" />{r.active_employees} active staff</li>
          <li className="flex items-center gap-2"><Wallet size={15} className="text-success" />Last payroll: {r.last_period ?? "none yet"} · {money(r.last_net)} net</li>
          <li className={`flex items-center gap-2 ${Number(r.open_alerts) ? "text-warning" : ""}`}><AlertTriangle size={15} />{r.open_alerts} open alerts</li>
        </ul>
        <Button className="w-full" variant={r.id === current ? "outline" : "default"} onClick={() => switchCompany(r.id).catch(e => toast.error(e.message))}>
          {r.id === current ? "Go to dashboard" : "Open this company"}<ArrowRight size={16} className="ml-2" />
        </Button>
      </article>)}
    </section>

    {(platform || superAdmin) && <PayrollDataReset companies={rows.map(r => ({ id: r.id, name: r.name }))} />}

    {platform && <section className="space-y-4">
      <div className="flex items-center gap-2"><ShieldCheck className="text-coral" /><h2 className="font-display text-lg font-semibold">Who can see which companies</h2></div>
      <p className="text-sm text-muted-foreground">Tick the companies each administrator or manager may open. They always keep their own (home) company. You see all companies automatically.</p>
      {!admins.length && <p className="text-muted-foreground">No other administrators or managers yet.</p>}
      <div className="space-y-3">{admins.map(a => <div key={a.user_id} className="border border-border rounded-lg p-4 bg-card space-y-3">
        <div><p className="font-medium">{a.name || a.email}</p><p className="text-xs text-muted-foreground">{a.email} · Home: {a.home_company ?? "none"}</p></div>
        <div className="flex flex-wrap gap-2">{rows.map(r => { const on = (draft[a.user_id] ?? []).includes(r.id); const home = r.name === a.home_company; return <label key={r.id} className={`flex items-center gap-2 rounded-md border px-3 min-h-[44px] text-sm cursor-pointer ${on || home ? "border-primary bg-primary/10" : "border-border"}`}>
          <input type="checkbox" disabled={home} checked={on || home} onChange={e => setDraft(d => ({ ...d, [a.user_id]: e.target.checked ? [...(d[a.user_id] ?? []), r.id] : (d[a.user_id] ?? []).filter(x => x !== r.id) }))} />{r.name}{home && " (home)"}
        </label>; })}</div>
        <Button size="sm" disabled={saving === a.user_id} onClick={() => void saveAccess(a.user_id)}><Save size={15} className="mr-2" />{saving === a.user_id ? "Saving…" : "Save access"}</Button>
      </div>)}</div>
    </section>}
  </div>;
}
