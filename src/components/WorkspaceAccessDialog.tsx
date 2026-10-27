import { useState, useEffect } from "react";
import { Shield, Save } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/native-select";
import { WORKSPACE_MODULES, roleModules, type WorkspaceRole } from "@/lib/workspace-access";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";

export interface AccessUser { user_id: string; first_name: string; last_name: string; email: string; role: WorkspaceRole }
export default function WorkspaceAccessDialog({ user, onClose, onSaved }: { user: AccessUser | null; onClose: () => void; onSaved: () => void }) {
  const [role, setRole] = useState<WorkspaceRole>("employee");
  const [modules, setModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const { refreshAccess } = useRole();
  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    setRole(user.role); setModules([]); setLoading(true);
    supabase.from("user_workspace_access").select("modules").eq("user_id", user.user_id).maybeSingle().then(({ data, error }) => {
      if (cancelled) return;
      if (error) { toast.error("Could not load workspace access"); onClose(); }
      else setModules(data?.modules ?? roleModules(user.role));
      setLoading(false);
    });
    return () => { cancelled = true; };
  }, [user]);
  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.rpc("set_user_workspace_access", { _user_id: user.user_id, _role: role, _modules: modules });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    await refreshAccess();
    toast.success("Role and workspace access saved"); onSaved(); onClose();
  };
  return <Dialog open={!!user} onOpenChange={open => { if (!open && !saving) onClose(); }}>
    <DialogContent className="sm:max-w-2xl max-h-[85vh] overflow-y-auto">
      <DialogHeader><DialogTitle className="flex items-center gap-2"><Shield /> Roles & access</DialogTitle></DialogHeader>
      <p className="text-sm text-muted-foreground break-all">{user?.first_name} {user?.last_name} · {user?.email}</p>
      <label className="space-y-2 text-sm font-medium">Role
        <NativeSelect aria-label="Workspace role" value={role} disabled={loading || saving || user?.role === "admin"} onChange={e => { const next = e.target.value as WorkspaceRole; setRole(next); setModules(roleModules(next)); }}>
          <option value="employee">Employee</option><option value="manager">Manager</option><option value="admin">Administrator</option>
        </NativeSelect>
      </label>
      {role === "admin" ? <p className="text-sm text-primary">Full administrator access · All pages and user management</p> : <>
        <div className="flex items-center justify-between gap-2"><span className="text-sm text-muted-foreground">Dashboard and personal portal always included</span><Button variant="ghost" size="sm" disabled={loading || saving} onClick={() => setModules(roleModules(role))}>Role defaults</Button></div>
        {["People & payroll", "Operations", "Workspace"].map(group => <section key={group} className="space-y-2 border-t border-border pt-3">
          <h3 className="text-sm font-semibold">{group}</h3>
          <div className="grid sm:grid-cols-2 gap-2">{WORKSPACE_MODULES.filter(m => m.group === group && roleModules(role).includes(m.id)).map(m => <label key={m.id} className="flex items-center gap-3 min-h-11 text-sm cursor-pointer">
            <Checkbox aria-label={m.label} checked={modules.includes(m.id)} disabled={loading || saving} onCheckedChange={checked => setModules(previous => checked ? [...previous, m.id] : previous.filter(id => id !== m.id))} />{m.label}
          </label>)}</div>
        </section>)}
      </>}
      <div className="flex justify-end gap-2 border-t border-border pt-4"><Button variant="outline" onClick={onClose} disabled={saving}>Cancel</Button><Button onClick={save} disabled={loading || saving}><Save />{saving ? "Saving…" : "Save access"}</Button></div>
    </DialogContent>
  </Dialog>;
}