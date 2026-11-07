import { useEffect, useState } from "react";
import { Building2, Users, AlertTriangle, Wallet, ArrowRight, ShieldCheck, Save, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { switchCompany } from "@/lib/multi-company";
import { loadCompanySummaries, consolidateCompanies, dashboardMoney, type CompanySummary } from '@/lib/company-dashboard';
import PayrollDataReset from "@/components/PayrollDataReset";
import MultiCompanyPaymasterDialog from "@/components/MultiCompanyPaymasterDialog";
import { useRole } from "@/hooks/useRole";

type Overview = CompanySummary;
type Admin = { user_id: string; name: string; email: string | null; home_company: string | null; org_ids: string[] };

export default function MyCompaniesPage() {
  const { canAccess } = useRole();
  const [showPaymaster, setShowPaymaster] = useState(false);
  const [rows, setRows] = useState<Overview[] | null>(null);
  const [error, setError] = useState("");
  const [platform, setPlatform] = useState(false);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [draft, setDraft] = useState<Record<string, string[]>>({});
  const [saving, setSaving] = useState("");
  const [current, setCurrent] = useState("");
  const [superAdmin, setSuperAdmin] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true); setError("");
    let overview: Overview[];
    try { overview = await loadCompanySummaries(true); }
    catch { setError("Company totals could not be loaded. Please retry."); setRows([]); setBusy(false); return; }
    const [p, c] = await Promise.all([supabase.rpc("is_platform_admin"), supabase.rpc("current_org_id")]);
    setRows(overview); setBusy(false); setCurrent(c.data ?? "");
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
  if (error) return <div className="p-6 space-y-4"><h1 className="text-2xl font-display font-bold">All companies dashboard</h1><p role="alert" className="text-destructive">{error}</p><Button variant="outline" disabled={busy} onClick={() => void load()}><RefreshCw />Retry</Button></div>;
  const visible = selected.length ? rows.filter(r => selected.includes(r.id)) : rows;
  const totals = consolidateCompanies(visible);

  return <div className="p-4 md:p-6 space-y-8 max-w-6xl mx-auto">
    <header className="border-b border-border pb-5 flex flex-wrap items-center justify-between gap-3">
      <div><div className="flex items-center gap-3"><Building2 className="text-primary" /><h1 className="text-2xl font-display font-bold">All companies dashboard</h1></div><p className="text-muted-foreground mt-2">{visible.length} authorized companies · Latest approved payroll by company</p></div>
      <Button variant="outline" disabled={busy} onClick={() => void load()}><RefreshCw className={busy ? 'animate-spin' : ''} />Refresh totals</Button>
    </header>
    {error && <p role="alert" className="text-destructive">{error}</p>}
    <section className="flex flex-wrap gap-3 items-center border-b border-border pb-4">
      <Button variant={selected.length ? 'outline' : 'default'} onClick={() => setSelected([])}>All authorized companies</Button>
      {rows.map(r => <label key={r.id} className="flex items-center gap-2 min-h-11 text-sm"><input type="checkbox" checked={selected.includes(r.id)} onChange={e => setSelected(ids => e.target.checked ? [...ids, r.id] : ids.filter(id => id !== r.id))} />{r.name}</label>)}
    </section>
    <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {[['Employees', totals.employees, 'carib-sea'], ['Active employees', totals.active, 'carib-palm'], ['On clock today', totals.onClock, 'carib-coral'], ['Open alerts', totals.alerts, 'carib-mango']].map(([label, value, tile]) => <div key={String(label)} className={`carib-tile ${tile} rounded-lg p-4`}><p className="text-sm font-medium">{label}</p><p className="text-2xl font-bold">{value}</p></div>)}
    </section>
    {totals.currencies.map(group => <section key={group.currency} className="space-y-3 border-y border-border py-4"><h2 className="font-display font-semibold">{group.currency} financial totals</h2><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[['Active monthly salary equivalents', group.monthly], ['Latest approved gross', group.gross], ['Latest approved deductions', group.deductions], ['Latest approved net', group.net]].map(([label, amount]) => <div key={String(label)}><p className="text-sm text-muted-foreground">{label}</p><p className="text-lg font-semibold">{dashboardMoney(Number(amount), group.currency)}</p></div>)}</div></section>)}
    <section className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {visible.map(r => <article key={r.id} className={`border rounded-lg bg-card p-5 border-t-4 space-y-3 ${r.id === current ? "border-t-success border-success/40" : "border-t-primary border-border"}`}>
        <div className="flex justify-between gap-2"><h2 className="font-semibold break-words min-w-0">{r.name}</h2>{r.id === current && <span className="text-xs rounded-full bg-success/15 text-success px-2 py-0.5 h-fit">Open now</span>}</div>
        <ul className="text-sm space-y-1.5">
          <li className="flex items-center gap-2"><Users size={15} className="text-primary" />{r.employees ?? "—"} employees · {r.active_employees ?? "—"} active</li>
          <li className="flex items-center gap-2"><Wallet size={15} className="text-success" />Last payroll: {r.period ?? "none yet"} · {dashboardMoney(r.net, r.currency)} net</li>
          <li>Monthly salaries: {dashboardMoney(r.monthly_salaries, r.currency)}</li>
          <li>Gross: {dashboardMoney(r.gross, r.currency)} · Deductions: {dashboardMoney(r.deductions, r.currency)}</li>
          <li>{r.on_clock ?? "—"} on clock · {r.pending_runs ?? "—"} pending payroll runs</li>
          <li className={`flex items-center gap-2 ${Number(r.open_alerts) ? "text-warning" : ""}`}><AlertTriangle size={15} />{r.open_alerts ?? "—"} open alerts</li>
        </ul>
        <Button className="w-full" variant={r.id === current ? "outline" : "default"} onClick={() => switchCompany(r.id).catch(e => toast.error(e.message))}>
          {r.id === current ? "Go to dashboard" : "Open this company"}<ArrowRight size={16} className="ml-2" />
        </Button>
        {canAccess('/payroll') && <Button variant="secondary" className="w-full" onClick={() => switchCompany(r.id, '/payroll').catch(e => toast.error(e.message))}><Wallet size={16} />Manage payroll</Button>}
      </article>)}
    </section>

    {(platform || superAdmin) && <PayrollDataReset companies={rows.map(r => ({ id: r.id, name: r.name }))} />}

    {platform && <section className="space-y-4">
      <Button onClick={() => setShowPaymaster(true)}><Users />Assign multi-company Pay Master</Button>
      <div className="flex items-center gap-2"><ShieldCheck className="text-coral" /><h2 className="font-display text-lg font-semibold">Who can see which companies</h2></div>
      <p className="text-sm text-muted-foreground">Tick the companies each administrator, Pay Master or manager may open. They always keep their home company. You see all companies automatically.</p>
      {!admins.length && <p className="text-muted-foreground">No other administrators or managers yet.</p>}
      <div className="space-y-3">{admins.map(a => <div key={a.user_id} className="border border-border rounded-lg p-4 bg-card space-y-3">
        <div><p className="font-medium">{a.name || a.email}</p><p className="text-xs text-muted-foreground">{a.email} · Home: {a.home_company ?? "none"}</p></div>
        <div className="flex flex-wrap gap-2">{rows.map(r => { const on = (draft[a.user_id] ?? []).includes(r.id); const home = r.name === a.home_company; return <label key={r.id} className={`flex items-center gap-2 rounded-md border px-3 min-h-[44px] text-sm cursor-pointer ${on || home ? "border-primary bg-primary/10" : "border-border"}`}>
          <input type="checkbox" disabled={home} checked={on || home} onChange={e => setDraft(d => ({ ...d, [a.user_id]: e.target.checked ? [...(d[a.user_id] ?? []), r.id] : (d[a.user_id] ?? []).filter(x => x !== r.id) }))} />{r.name}{home && " (home)"}
        </label>; })}</div>
        <Button size="sm" disabled={saving === a.user_id} onClick={() => void saveAccess(a.user_id)}><Save size={15} className="mr-2" />{saving === a.user_id ? "Saving…" : "Save access"}</Button>
      </div>)}</div>
    </section>}
    <MultiCompanyPaymasterDialog open={showPaymaster} onClose={() => setShowPaymaster(false)} onSaved={() => void load()} />
  </div>;
}
