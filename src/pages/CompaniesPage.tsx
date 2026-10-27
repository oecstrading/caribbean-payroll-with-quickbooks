import { useEffect, useState } from "react";
import { Building2, Plus, Link2, Copy, Pencil, XCircle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import CompanySetupFields from "@/components/CompanySetupFields";
import { companySetupSchema, emptyCompanySetup, companySetupLink, type CompanySetup } from "@/lib/company-setup";
import { companyAction } from "@/lib/company-api";
import { toast } from "sonner";

type Company = { id: string; name: string; onboarding_status: string; created_at: string; details: unknown };
type Invitation = { id: string; email: string; company_name: string; expires_at: string; accepted_at: string | null; revoked_at: string | null };
export default function CompaniesPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [form, setForm] = useState<CompanySetup>(emptyCompanySetup);
  const [mode, setMode] = useState("customer");
  const [busy, setBusy] = useState(false);
  const [link, setLink] = useState("");
  async function load() {
    const { data: permitted, error: accessError } = await supabase.rpc("is_platform_admin");
    setAllowed(!accessError && !!permitted);
    if (!permitted || accessError) return;
    const [c, i] = await Promise.all([supabase.rpc("platform_companies"), supabase.from("company_setup_invitations").select("id,email,company_name,expires_at,accepted_at,revoked_at").order("created_at", { ascending: false })]);
    if (c.error || i.error) toast.error(c.error?.message ?? i.error?.message);
    setCompanies(c.data ?? []); setInvitations(i.data ?? []);
  }
  useEffect(() => { void load(); }, []);
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      const details = companySetupSchema.parse({ ...form, email: editing ? "unused@example.com" : form.email });
      if (editing) {
        await companyAction({ action: "update", org_id: editing, details });
        toast.success("Company updated"); setOpen(false);
      } else {
        const { data, error } = await supabase.rpc("issue_company_setup", { _details: details, _create_now: mode === "administrator" });
        if (error) throw error;
        const result = data as { token?: string };
        if (!result.token) throw new Error("Invitation was not created");
        setLink(companySetupLink(result.token, window.location.origin));
        toast.success(mode === "administrator" ? "Company prepared; share the link with its administrator" : "Customer setup link created");
      }
      await load();
    } catch (err) { toast.error(err instanceof Error ? err.message : "Unable to save company"); }
    finally { setBusy(false); }
  }
  async function revoke(id: string) {
    const { error } = await supabase.rpc("revoke_company_setup", { _id: id });
    if (error) toast.error(error.message); else { toast.success("Invitation revoked"); await load(); }
  }
  const copy = async () => { try { await navigator.clipboard.writeText(link); toast.success("Setup link copied"); } catch { toast.error("Select and copy the setup link below"); } };
  if (allowed === null) return <div className="p-6">Loading companies…</div>;
  if (!allowed) return <div className="p-6"><h1 className="text-2xl font-display">Platform administrator access required</h1></div>;
  return <div className="p-4 md:p-6 space-y-8 max-w-6xl mx-auto">
    <header className="flex flex-wrap items-center justify-between gap-4 border-b border-border pb-5"><div><div className="flex items-center gap-3"><Building2 className="text-primary" /><h1 className="text-2xl font-display font-bold">Companies</h1></div><p className="text-muted-foreground mt-2">Platform administration</p></div><div className="flex gap-2"><Button variant="outline" size="icon" title="Refresh companies" onClick={() => void load()}><RefreshCw size={18} /></Button><Button onClick={() => { setEditing(null); setForm(emptyCompanySetup); setLink(""); setOpen(true); }}><Plus size={18} className="mr-2" />Set up company</Button></div></header>
    <section className="space-y-4"><h2 className="font-display text-lg font-semibold">Company directory</h2><div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">{companies.map(c => <article key={c.id} className="border border-border rounded-lg bg-card p-5 border-t-4 border-t-primary space-y-4"><div className="flex justify-between items-start gap-3"><h3 className="font-semibold break-words min-w-0">{c.name}</h3><Building2 size={20} className="text-primary shrink-0" /></div><p className="text-sm text-muted-foreground">{c.onboarding_status === "pending" ? "Awaiting customer activation" : "Active company"}</p><Button variant="outline" onClick={() => { setEditing(c.id); setForm({ ...emptyCompanySetup, ...(c.details as Partial<CompanySetup>), company_name: c.name }); setLink(""); setOpen(true); }}><Pencil size={16} className="mr-2" />Edit company</Button></article>)}</div></section>
    <section className="space-y-4"><h2 className="font-display text-lg font-semibold">Customer invitations</h2>{!invitations.length && <p className="text-muted-foreground">No company invitations yet.</p>}<div className="divide-y divide-border">{invitations.map(i => { const active = !i.accepted_at && !i.revoked_at && Date.parse(i.expires_at)>Date.now(); return <div key={i.id} className="py-4 flex flex-wrap items-center justify-between gap-3"><div className="min-w-0"><p className="font-medium break-words">{i.company_name}</p><p className="text-sm text-muted-foreground break-all">{i.email}</p><p className="text-xs text-muted-foreground mt-1">{i.accepted_at ? "Accepted" : i.revoked_at ? "Revoked" : active ? `Expires ${new Date(i.expires_at).toLocaleDateString()}` : "Expired"}</p></div>{active && <Button variant="outline" onClick={() => void revoke(i.id)}><XCircle size={16} className="mr-2" />Revoke link</Button>}</div>; })}</div></section>
    <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto"><DialogHeader><DialogTitle>{editing ? "Edit company" : "Set up company"}</DialogTitle></DialogHeader>{link ? <div className="space-y-4"><p className="text-sm text-muted-foreground">Share this one-time link with the customer. It expires in 7 days and requires their verified email.</p><Label htmlFor="setup-link">Customer setup link</Label><Input id="setup-link" readOnly value={link} /><Button onClick={() => void copy()}><Copy size={16} className="mr-2" />Copy link</Button><Button variant="outline" onClick={() => setOpen(false)}>Done</Button></div> : <form onSubmit={save} className="space-y-5">{!editing && <div className="space-y-2"><Label htmlFor="setup-mode">Setup method</Label><NativeSelect id="setup-mode" value={mode} onChange={e => setMode(e.target.value)}><option value="customer">Customer sets up company using a link</option><option value="administrator">Administrator prepares company, customer activates</option></NativeSelect></div>}<CompanySetupFields value={form} onChange={setForm} hideEmail={!!editing} /><div className="flex justify-end gap-2"><Button type="button" variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button disabled={busy} type="submit">{!editing && <Link2 size={16} className="mr-2" />}{busy ? "Saving…" : editing ? "Save changes" : "Create setup link"}</Button></div></form>}</DialogContent></Dialog>
  </div>;
}