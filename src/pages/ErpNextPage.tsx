import { useCallback, useEffect, useState } from "react";
import { BookOpenCheck, CheckCircle2, AlertCircle, Eye, Send, Link2Off, RefreshCw } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { NativeSelect } from "@/components/ui/native-select";
import { supabase } from "@/integrations/supabase/client";
import { formatCurrency } from "@/lib/payroll-engine";
import { toast } from "sonner";

export const ERP_ITEMS: { id: string; label: string; hint: string }[] = [
  { id: "gross_wages", label: "Salaries & wages (expense)", hint: "Salary" },
  { id: "overtime", label: "Overtime (expense)", hint: "Salary" },
  { id: "employer_nic", label: "Employer NIC (expense)", hint: "Social Security" },
  { id: "employee_nic_payable", label: "NIC payable (liability)", hint: "NIC" },
  { id: "paye_payable", label: "PAYE / income tax payable", hint: "PAYE" },
  { id: "creditor_deductions", label: "Other deductions payable", hint: "Payroll Payable" },
  { id: "net_pay_clearing", label: "Net pay / bank clearing", hint: "Payroll Payable" },
];

type Conn = { base_url: string; erp_company: string; auto_post: boolean; status: string; last_message: string | null; last_tested_at: string | null };
type Preview = { lines: { item: string; account: string; debit: number; credit: number }[]; total: number; missing: string[]; period: string };

async function call(body: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("erpnext-sync", { body });
  if (error) { let m = error.message; if (error.context instanceof Response) { const d = await error.context.json().catch(() => null); m = d?.error ?? m; } throw new Error(m); }
  if (data?.error) throw new Error(data.error);
  return data;
}

export default function ErpNextPage() {
  const [conn, setConn] = useState<Conn | null>(null);
  const [form, setForm] = useState({ base_url: "", erp_company: "", api_key: "", api_secret: "", auto_post: true });
  const [accounts, setAccounts] = useState<{ name: string; root_type: string }[]>([]);
  const [maps, setMaps] = useState<Record<string, string>>({});
  const [runs, setRuns] = useState<{ id: string; period: string; total_net: number }[]>([]);
  const [runId, setRunId] = useState("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [log, setLog] = useState<{ id: string; created_at: string; status: string; qbo_entity_id: string | null; payroll_run_id: string | null }[]>([]);
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    const [c, m, r, l] = await Promise.all([
      supabase.from("erpnext_connection").select("base_url,erp_company,auto_post,status,last_message,last_tested_at").maybeSingle(),
      supabase.from("erpnext_account_mappings").select("payroll_item,erp_account"),
      supabase.from("payroll_runs").select("id,period,total_net").order("run_date", { ascending: false }).limit(24),
      supabase.from("qbo_sync_log").select("id,created_at,status,qbo_entity_id,payroll_run_id").eq("sync_type", "erpnext_journal_entry").order("created_at", { ascending: false }).limit(20),
    ]);
    setConn(c.data ?? null);
    if (c.data) setForm(f => ({ ...f, base_url: c.data!.base_url, erp_company: c.data!.erp_company, auto_post: c.data!.auto_post }));
    setMaps(Object.fromEntries((m.data ?? []).map(x => [x.payroll_item, x.erp_account])));
    setRuns(r.data ?? []); setLog(l.data ?? []);
  }, []);
  useEffect(() => { void load(); }, [load]);

  const run = async (key: string, fn: () => Promise<void>) => { setBusy(key); try { await fn(); } catch (e) { toast.error(e instanceof Error ? e.message : "ERPNext request failed"); } finally { setBusy(""); } };

  const save = () => run("save", async () => {
    await call({ action: "save", ...form, base_url: /^https?:\/\//i.test(form.base_url) ? form.base_url : `https://${form.base_url}` });
    setForm(f => ({ ...f, api_key: "", api_secret: "" }));
    const t = await call({ action: "test" }); toast.success(t.message); await load(); await loadAccounts();
  });
  const test = () => run("test", async () => { const t = await call({ action: "test" }); toast.success(t.message); await load(); });
  const loadAccounts = async () => {
    const a = await call({ action: "accounts" }); setAccounts(a.accounts);
    // Suggest accounts for unmapped items by name match.
    setMaps(cur => { const next = { ...cur }; ERP_ITEMS.forEach(i => { if (!next[i.id]) { const hit = a.accounts.find((x: { name: string }) => x.name.toLowerCase().includes(i.hint.toLowerCase())); if (hit) next[i.id] = hit.name; } }); return next; });
  };
  const saveMaps = () => run("maps", async () => {
    const { data: org } = await supabase.rpc("current_org_id");
    const rows = Object.entries(maps).filter(([, v]) => v).map(([payroll_item, erp_account]) => ({ org_id: org as string, payroll_item, erp_account, updated_at: new Date().toISOString() }));
    const { error } = await supabase.from("erpnext_account_mappings").upsert(rows, { onConflict: "org_id,payroll_item" });
    if (error) throw error; toast.success("Account mapping saved");
  });
  const doPreview = () => run("preview", async () => setPreview(await call({ action: "preview", payroll_run_id: runId })));
  const post = () => run("post", async () => { const r = await call({ action: "sync", payroll_run_id: runId }); toast.success(`Posted to ERPNext as ${r.name}`); await load(); });
  const disconnect = () => run("disc", async () => { await call({ action: "disconnect" }); setAccounts([]); setPreview(null); await load(); toast.success("ERPNext disconnected"); });

  const connected = conn?.status === "connected";
  const accountOptions = accounts.length ? accounts : Object.values(maps).filter(Boolean).map(name => ({ name, root_type: "" }));

  return (
    <div className="space-y-6 p-4 sm:p-6 max-w-5xl mx-auto">
      <header className="rounded-xl bg-gradient-to-r from-primary to-secondary p-6 text-primary-foreground shadow-card">
        <h1 className="font-display text-2xl font-bold flex items-center gap-2"><BookOpenCheck />ERPNext Accounting</h1>
        <p className="opacity-90 text-sm mt-1">Free, open-source books. Approved payroll posts as a balanced journal entry — works alongside or instead of QuickBooks.</p>
      </header>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between"><CardTitle>1 · Connect your ERPNext site</CardTitle>
          {conn && <Badge variant={connected ? "default" : "destructive"}>{connected ? <><CheckCircle2 size={14} className="mr-1" />Connected</> : <><AlertCircle size={14} className="mr-1" />{conn.status === "error" ? "Error" : "Not tested"}</>}</Badge>}
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-sm text-muted-foreground">In ERPNext: open your user → <b>API Access</b> → <b>Generate Keys</b>. Paste the key and secret here. They are stored securely on the server and never shown again.</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2"><Label htmlFor="erp-url">ERPNext address</Label><Input id="erp-url" placeholder="https://yourcompany.erpnext.com" value={form.base_url} onChange={e => setForm({ ...form, base_url: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="erp-co">Company name in ERPNext</Label><Input id="erp-co" placeholder="Smiley's Tinting Services" value={form.erp_company} onChange={e => setForm({ ...form, erp_company: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="erp-key">API key</Label><Input id="erp-key" autoComplete="off" placeholder={conn ? "Saved — leave blank to keep" : ""} value={form.api_key} onChange={e => setForm({ ...form, api_key: e.target.value })} /></div>
            <div className="space-y-2"><Label htmlFor="erp-secret">API secret</Label><Input id="erp-secret" type="password" autoComplete="off" placeholder={conn ? "Saved — leave blank to keep" : ""} value={form.api_secret} onChange={e => setForm({ ...form, api_secret: e.target.value })} /></div>
          </div>
          <label className="flex items-center gap-3 text-sm"><Switch checked={form.auto_post} onCheckedChange={v => setForm({ ...form, auto_post: v })} />Post automatically after a payroll is approved</label>
          {conn?.last_message && <p className={`text-sm ${connected ? "text-success" : "text-destructive"}`}>{conn.last_message}</p>}
          <div className="flex flex-wrap gap-2">
            <Button onClick={save} disabled={!!busy || !form.base_url || !form.erp_company}>{busy === "save" ? "Saving…" : "Save & test connection"}</Button>
            {conn && <Button variant="outline" onClick={test} disabled={!!busy}><RefreshCw size={16} />Test again</Button>}
            {conn && <Button variant="ghost" onClick={disconnect} disabled={!!busy}><Link2Off size={16} />Disconnect</Button>}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between"><CardTitle>2 · Match payroll items to ERPNext accounts</CardTitle>
          <Button variant="outline" size="sm" disabled={!connected || !!busy} onClick={() => run("acc", loadAccounts)}><RefreshCw size={14} />Load accounts</Button></CardHeader>
        <CardContent className="space-y-3">
          {!accounts.length && <p className="text-sm text-muted-foreground">Tap <b>Load accounts</b> to fetch your ERPNext chart of accounts. Likely matches are picked for you.</p>}
          {ERP_ITEMS.map(i => (
            <div key={i.id} className="grid sm:grid-cols-2 gap-2 items-center">
              <Label htmlFor={`map-${i.id}`}>{i.label}</Label>
              <NativeSelect id={`map-${i.id}`} value={maps[i.id] ?? ""} onChange={e => setMaps({ ...maps, [i.id]: e.target.value })}>
                <option value="">— Choose account —</option>
                {accountOptions.map(a => <option key={a.name} value={a.name}>{a.name}{a.root_type ? ` (${a.root_type})` : ""}</option>)}
              </NativeSelect>
            </div>
          ))}
          <Button onClick={saveMaps} disabled={!!busy || !Object.values(maps).some(Boolean)}>Save mapping</Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>3 · Preview & post a payroll</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2 items-end">
            <div className="space-y-2 min-w-60"><Label htmlFor="erp-run">Approved payroll</Label>
              <NativeSelect id="erp-run" value={runId} onChange={e => { setRunId(e.target.value); setPreview(null); }}>
                <option value="">— Choose payroll —</option>
                {runs.map(r => <option key={r.id} value={r.id}>{r.period} · net {formatCurrency(Number(r.total_net))}</option>)}
              </NativeSelect></div>
            <Button variant="outline" disabled={!runId || !!busy} onClick={doPreview}><Eye size={16} />Preview entry</Button>
            <Button disabled={!runId || !connected || !preview || preview.missing.length > 0 || !!busy} onClick={post}><Send size={16} />{busy === "post" ? "Posting…" : "Post to ERPNext"}</Button>
          </div>
          {preview && <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-muted-foreground text-left"><th className="py-2">Item</th><th>ERPNext account</th><th className="text-right">Debit</th><th className="text-right">Credit</th></tr></thead>
            <tbody>{preview.lines.map(l => <tr key={l.item} className="border-t border-border"><td className="py-2">{ERP_ITEMS.find(i => i.id === l.item)?.label}</td><td className={l.account ? "" : "text-destructive"}>{l.account || "Not mapped"}</td><td className="text-right">{l.debit ? formatCurrency(l.debit) : ""}</td><td className="text-right">{l.credit ? formatCurrency(l.credit) : ""}</td></tr>)}
              <tr className="border-t-2 border-border font-semibold"><td className="py-2" colSpan={2}>Balanced total</td><td className="text-right">{formatCurrency(preview.total)}</td><td className="text-right">{formatCurrency(preview.total)}</td></tr></tbody></table></div>}
          {log.length > 0 && <div className="space-y-1"><h3 className="font-semibold text-sm">Posting history</h3>{log.map(l => <p key={l.id} className="text-sm"><Badge variant={l.status === "synced" ? "default" : "destructive"} className="mr-2">{l.status}</Badge>{new Date(l.created_at).toLocaleString()} · {runs.find(r => r.id === l.payroll_run_id)?.period ?? "payroll"} {l.qbo_entity_id ? `· ${l.qbo_entity_id}` : ""}</p>)}</div>}
        </CardContent>
      </Card>
    </div>
  );
}
