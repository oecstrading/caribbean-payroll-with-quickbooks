import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, Shield, Mail, Search, MoreHorizontal, UserPlus, Ban, CheckCircle, Hash, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";
import WorkspaceAccessDialog from "@/components/WorkspaceAccessDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/useAuth";
import UserAccountDialog from "@/components/UserAccountDialog";

type AppRole = Database["public"]["Enums"]["app_role"];

interface UserWithRole {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  department: string;
  job_title: string;
  status: string;
  phone: string;
  monthly_salary: number;
  role: AppRole;
  companySuper: boolean;
  platformSuper: boolean;
  login_username: string | null;
  is_employee: boolean;
}

const roleColors: Record<AppRole, string> = {
  admin: "bg-destructive/10 text-destructive",
  manager: "bg-primary/10 text-primary",
  employee: "bg-secondary text-muted-foreground",
};

export default function UserManagementPage() {
  const { isAdmin, isCompanySuperAdmin, isPlatformAdmin } = useRole();
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<AppRole | null>(null);
  const [showInvite, setShowInvite] = useState(false);
  const [editUser, setEditUser] = useState<UserWithRole | null>(null);
  const [pinUser, setPinUser] = useState<UserWithRole | null>(null);
  const [pinValue, setPinValue] = useState("");
  const [settingPin, setSettingPin] = useState(false);
  const [accessUser, setAccessUser] = useState<UserWithRole | null>(null);
  const [deleteUser, setDeleteUser] = useState<UserWithRole | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleting, setDeleting] = useState(false);
  const fetchUsers = async () => {
    // Fetch profiles joined with roles
    const { data: profiles } = await supabase.from("profiles").select("*").is("deleted_at", null);
    const { data: roles } = await supabase.from("user_roles").select("*");
    const authorityResults = await Promise.all((profiles ?? []).map(p => supabase.rpc("administrator_authority", { _user: p.user_id })));

    if (profiles && roles) {
      const merged: UserWithRole[] = profiles.map((p, index) => {
        const userRole = roles.find((r) => r.user_id === p.user_id);
        const authority = authorityResults[index]?.data as { company_super_admin?: boolean; platform_super_admin?: boolean } | null;
        return {
          user_id: p.user_id,
          login_username: p.login_username,
          is_employee: p.is_employee,
          first_name: p.first_name,
          last_name: p.last_name,
          email: p.email,
          department: p.department || "",
          job_title: p.job_title || "",
          status: p.status,
          phone: p.phone || "",
          monthly_salary: Number(p.monthly_salary) || 0,
          role: (userRole?.role as AppRole) || "employee",
          companySuper: authority?.company_super_admin === true,
          platformSuper: authority?.platform_super_admin === true,
        };
      });
      setUsers(merged);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isAdmin) fetchUsers();
  }, [isAdmin]);

  const filtered = users.filter(
    (u) =>
      `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(search.toLowerCase()) &&
      (!roleFilter || u.role === roleFilter)
  );

  const handleDeactivate = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === "Active" ? "Inactive" : "Active";
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ status: newStatus })
        .eq("user_id", userId);
      if (error) throw error;
      toast.success(`User ${newStatus === "Active" ? "activated" : "deactivated"}`);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to update status");
    }
  };
  const handleDelete = async () => {
    if (!deleteUser || deleteConfirmation !== "DELETE") return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-employee", { body: { employee_id: deleteUser.user_id, confirmation: deleteConfirmation } });
      let detail = data?.error;
      if (error) { try { detail = detail || (await error.context?.json())?.error; } catch { /* response unavailable */ } }
      if (error || detail) throw new Error(detail || error?.message || "Removal failed");
      toast.success("Account removed; financial records retained"); setDeleteUser(null); await fetchUsers();
    } catch (error) { toast.error(error instanceof Error ? error.message : "Removal failed"); }
    finally { setDeleting(false); }
  };

  const resendInvitation = async (u: UserWithRole) => {
    try {
      const {data,error} = await supabase.functions.invoke("invite-user", {body:{action:"resend",user_id:u.user_id}});
      let detail = data?.error;
      if(error){try{detail=detail||(await error.context.json()).error}catch{/* fallback */}}
      if(error||detail) throw new Error(detail||"Invitation could not be sent");
      toast.success("Invitation / password setup email sent");
    }catch(error){toast.error(error instanceof Error?error.message:"Unable to send invitation")}
  };

  const handleSetPin = async () => {
    if (!pinUser || !/^\d{4,6}$/.test(pinValue)) {
      toast.error("PIN must be 4-6 digits");
      return;
    }
    setSettingPin(true);
    try {
      const { data, error } = await supabase.functions.invoke("set-pin", {
        body: { user_id: pinUser.user_id, pin: pinValue },
      });
      if (error || data?.error) throw new Error(data?.error || error?.message || "Failed to set PIN");
      toast.success(`PIN set for ${pinUser.first_name} ${pinUser.last_name}`);
      setPinUser(null);
      setPinValue("");
    } catch (err: any) {
      toast.error(err.message || "Failed to set PIN");
    } finally {
      setSettingPin(false);
    }
  };
  

  if (!isAdmin) {
    return (
      <div className="p-6 max-w-4xl mx-auto text-center">
        <Shield size={48} className="mx-auto text-muted-foreground/30 mb-4" />
        <h2 className="text-xl font-display font-bold text-foreground">Access Denied</h2>
        <p className="text-sm text-muted-foreground mt-2">Only administrators can access user management.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4 md:space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl md:text-2xl font-display font-bold text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">{users.length} accounts • Platform access & employee links</p>
        </div>
        <Button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <UserPlus size={16} />
          Add user
        </Button>
      </div>

      {/* Role Stats */}
      <div className="grid grid-cols-3 gap-3 md:gap-4">
        {(["admin", "manager", "employee"] as AppRole[]).map((r) => (
          <Card
            key={r}
            onClick={() => setRoleFilter(roleFilter === r ? null : r)}
            className={cn(
              "shadow-card border-border/60 cursor-pointer transition-all hover:shadow-md",
              roleFilter === r && "ring-2 ring-primary border-primary"
            )}
          >
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${roleColors[r]}`}>
                <Shield size={18} />
              </div>
              <div>
                <p className="text-lg font-display font-bold text-foreground">{users.filter((u) => u.role === r).length}</p>
                <p className="text-xs text-muted-foreground">{r === "employee" ? "Staff access" : `${r}s`}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search users..."
          className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      {/* Users Table */}
      <Card className="shadow-card border-border/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-secondary/50">
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">User</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Department</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Role</th>
                <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">Loading...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No users found</td></tr>
              ) : (
                filtered.map((u, i) => (
                  <motion.tr
                    key={u.user_id}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.02 }}
                    className="border-b border-border/50 hover:bg-secondary/30 transition-colors"
                  >
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-primary">
                            {(u.first_name?.[0] || "").toUpperCase()}{(u.last_name?.[0] || "").toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <p className="font-medium text-foreground">{u.first_name} {u.last_name}</p>
                          <p className="text-xs text-muted-foreground">{u.email.endsWith("@pin.invalid") ? u.login_username : u.email}</p>
                          <Badge variant="outline">{u.is_employee ? "Employee + user" : "Platform user"}</Badge>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-foreground">{u.department || "—"}</td>
                    <td className="py-3 px-4">
                      <Badge className={roleColors[u.role]} variant="secondary">{u.role}</Badge>
                      {u.companySuper && <Badge variant="outline">Company super admin</Badge>}
                      {u.platformSuper && <Badge variant="outline">Platform super admin</Badge>}
                    </td>
                    <td className="py-3 px-4">
                      <Badge
                        variant="secondary"
                        className={u.status === "Active" ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}
                      >
                        {u.status}
                      </Badge>
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" title="Send invitation / password setup" aria-label={`Send invitation to ${u.email}`} disabled={u.email.endsWith("@pin.invalid")} onClick={() => resendInvitation(u)}><Mail size={16}/></Button>
                        <Button variant="ghost" size="sm" onClick={() => setAccessUser(u)}><Shield size={14} />Roles & access</Button>
                        {u.user_id !== currentUser?.id && (!u.companySuper || isCompanySuperAdmin) && (!u.platformSuper || isPlatformAdmin) && (u.role !== "admin" || isCompanySuperAdmin) && <Button variant="ghost" size="icon" title={`Delete ${u.email}`} aria-label={`Delete ${u.email}`} onClick={() => { setDeleteUser(u); setDeleteConfirmation(""); }}><Trash2 className="text-destructive" size={16} /></Button>}
                        <Button
                          onClick={() => {
                            setEditUser(u);
                          }}
                          className="p-1.5 rounded-md hover:bg-secondary transition-colors text-xs text-primary font-medium"
                        >
                          Edit
                        </Button>
                        <Button
                          onClick={() => handleDeactivate(u.user_id, u.status)}
                          className="p-1.5 rounded-md hover:bg-secondary transition-colors"
                          title={u.status === "Active" ? "Deactivate" : "Activate"}
                        >
                          {u.status === "Active" ? (
                            <Ban size={14} className="text-destructive" />
                          ) : (
                            <CheckCircle size={14} className="text-success" />
                          )}
                        </Button>
                        <Button
                          onClick={() => { setPinUser(u); setPinValue(""); }}
                          className="p-1.5 rounded-md hover:bg-secondary transition-colors text-xs text-primary font-medium"
                          title="Set PIN"
                        >
                          <Hash size={14} />
                        </Button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <WorkspaceAccessDialog user={accessUser} onClose={() => setAccessUser(null)} onSaved={fetchUsers} />
      <Dialog open={!!deleteUser} onOpenChange={open => { if (!open && !deleting) setDeleteUser(null); }}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Delete account permanently</DialogTitle></DialogHeader>
          <p className="text-sm break-all">{deleteUser?.email}</p>
          <p className="text-sm text-muted-foreground">Sign-in access, HR files and attendance history will be removed. Approved payroll and loan repayment records will be retained. This cannot be undone.</p>
          <Input aria-label="Delete confirmation" placeholder="Type DELETE" value={deleteConfirmation} disabled={deleting} onChange={e => setDeleteConfirmation(e.target.value)} />
          <div className="flex justify-end gap-2"><Button variant="outline" disabled={deleting} onClick={() => setDeleteUser(null)}>Cancel</Button><Button variant="destructive" disabled={deleting || deleteConfirmation !== "DELETE"} onClick={handleDelete}><Trash2 />{deleting ? "Removing…" : "Delete permanently"}</Button></div>
        </DialogContent>
      </Dialog>
      <UserAccountDialog open={showInvite || !!editUser} user={editUser} canAddAdmin={isCompanySuperAdmin} onClose={() => {setShowInvite(false);setEditUser(null);}} onSaved={fetchUsers} />
      {/* Set PIN Dialog */}
      <Dialog open={!!pinUser} onOpenChange={(o) => !o && setPinUser(null)}>
        <DialogContent className="sm:max-w-sm">
          {pinUser && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display flex items-center gap-2">
                  <Hash size={18} className="text-primary" />
                  Set PIN for {pinUser.first_name} {pinUser.last_name}
                </DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <p className="text-sm text-muted-foreground">
                  Set a 4-6 digit PIN to allow this user to sign in with their email or username and PIN instead of a password.
                </p>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">PIN (4-6 digits)</label>
                  <input
                    type="password"
                    inputMode="numeric"
                    maxLength={6}
                    value={pinValue}
                    onChange={(e) => setPinValue(e.target.value.replace(/\D/g, ""))}
                    placeholder="e.g. 1234"
                    className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground text-center tracking-[0.5em] focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <Button
                  onClick={handleSetPin}
                  disabled={settingPin || pinValue.length < 4}
                  className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {settingPin ? "Setting PIN..." : "Set PIN & Enable Login"}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
