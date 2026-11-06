import { useState, useEffect } from "react";
import { Shield, Save } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/native-select";
import { WORKSPACE_MODULES, ACCESS_TITLES, titleAllowedModules, titleDefaultModules, type AccessTitle, type WorkspaceRole } from "@/lib/workspace-access";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";

export interface AccessUser { user_id: string; first_name: string; last_name: string; email: string; role: WorkspaceRole; title?: AccessTitle | null }
export default function WorkspaceAccessDialog({ user, onClose, onSaved }: { user: AccessUser | null; onClose: () => void; onSaved: () => void }) {
  const [role, setRole] = useState<AccessTitle>("employee");
  const [modules, setModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [companySuper, setCompanySuper] = useState(false);
  const [platformSuper, setPlatformSuper] = useState(false);
  const { refreshAccess, isCompanySuperAdmin, isPlatformAdmin } = useRole();
  const canAssign = isCompanySuperAdmin || isPlatformAdmin;
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setRole(user.title ?? user.role); setModules([]); setLoading(true);
    setCompanySuper(false); setPlatformSuper(false);
    Promise.all([supabase.from("user_workspace_access").select("modules, access_title").eq("user_id", user.user_id).maybeSingle(), supabase.rpc("administrator_authority", { _user: user.user_id })]).then(([{ data, error }, authority]) => {
      if (cancelled) return;
      if (error || authority.error) { toast.error("Could not load workspace access"); onClose(); }
      else {
        const t = (data?.access_title as AccessTitle | null) ?? user.role; setRole(t); setModules(data?.modules ?? titleDefaultModules(t));
        const trusted = authority.data as { company_super_admin?: boolean; platform_super_admin?: boolean } | null;
        setCompanySuper(trusted?.company_super_admin === true); setPlatformSuper(trusted?.platform_super_admin === true);
      }
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [user]);
  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.rpc("set_user_workspace_access_titled", { _user_id: user.user_id, _title: role, _modules: role === "admin" ? WORKSPACE_MODULES.map(m => m.id) : modules });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    await refreshAccess();
    toast.success("Role and workspace access saved"); onSaved(); onClose();
  };
  const saveAuthority = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.rpc("set_administrator_authority", { _user: user.user_id, _company: companySuper, _platform: platformSuper });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    await refreshAccess(); onSaved(); onClose(); toast.success("Super administrator authority saved");
  };
  return <Dialog open={!!user} onOpenChange={open => { if (!open && !saving) onClose(); }}>
    <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle className="flex items-center gap-2"><Shield /> Roles & access</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground break-all">{user?.first_name} {user?.last_name} · {user?.email}</p>
      <label className="space-y-2 text-sm font-medium">Role
        <NativeSelect aria-label="Workspace role" value={role} disabled={!canAssign || loading || saving || (user?.role === "admin" && (companySuper || platformSuper))} onChange={e => { const next = e.target.value as AccessTitle; setRole(next); setModules(titleDefaultModules(next)); }}>
          {ACCESS_TITLES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </NativeSelect>
      </label>
      <p className="text-sm text-muted-foreground">{ACCESS_TITLES.find(t => t.id === role)?.hint}</p>
      {!canAssign && <p className="text-sm text-destructive">Only the Super Admin can change roles and access.</p>}
      {role === "admin" ? <p className="text-sm text-primary">Administrator access · Enabled company pages and user management</p> : <>
        <div className="flex items-center justify-between gap-2"><span className="text-sm text-muted-foreground">Dashboard and personal portal always included</span><Button variant="ghost" size="sm" disabled={loading || saving} onClick={() => setModules(titleDefaultModules(role))}>Role defaults</Button></div>
        {["People & payroll", "Operations", "Workspace"].map(group => <section key={group} className="space-y-2 border-t border-border pt-3">
          <h3 className="text-sm font-semibold">{group}</h3>
          <div className="grid sm:grid-cols-2 gap-2">{WORKSPACE_MODULES.filter(m => m.group === group && titleAllowedModules(role).includes(m.id)).map(m => <label key={m.id} className="flex items-center gap-3 min-h-11 text-sm cursor-pointer">
            <Checkbox aria-label={m.label} checked={modules.includes(m.id)} disabled={!canAssign || loading || saving} onCheckedChange={checked => setModules(previous => checked ? [...previous, m.id] : previous.filter(id => id !== m.id))} />{m.label}
          </label>)}</div>
        </section>)}
      </>}
      {user?.role === "admin" && isCompanySuperAdmin && <section className="space-y-3 border-t border-border pt-4">
        <h3 className="text-sm font-semibold">Super administrator authority</h3>
        <label className="flex items-center gap-3 min-h-11 text-sm"><Checkbox aria-label="Company super administrator" checked={companySuper} disabled={loading || saving} onCheckedChange={v => setCompanySuper(v === true)} />Company super administrator</label>
        <label className="flex items-center gap-3 min-h-11 text-sm"><Checkbox aria-label="Platform super administrator" checked={platformSuper} disabled={loading || saving || !isPlatformAdmin} onCheckedChange={v => setPlatformSuper(v === true)} />Platform super administrator</label>
        <p className="text-sm text-muted-foreground">Platform authority includes company setup and feature configuration, not access to other companies’ payroll or HR records.</p>
        <Button variant="secondary" onClick={saveAuthority} disabled={loading || saving}><Shield />Save super admin authority</Button>
      </section>}
      <div className="flex justify-end gap-2 border-t border-border pt-4"><Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button><Button onClick={save} disabled={!canAssign || loading || saving}><Save />{saving ? "Saving…" : "Save access"}</Button></div>
    </DialogContent>
  </Dialog>;
}