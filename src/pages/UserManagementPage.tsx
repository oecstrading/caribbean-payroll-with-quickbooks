import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, Shield, Mail, Search, MoreHorizontal, UserPlus, Ban, CheckCircle, Hash } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";
import type { Database } from "@/integrations/supabase/types";

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
}

const roleColors: Record<AppRole, string> = {
  admin: "bg-destructive/10 text-destructive",
  manager: "bg-primary/10 text-primary",
  employee: "bg-secondary text-muted-foreground",
};

export default function UserManagementPage() {
  const { isAdmin } = useRole();
  const [users, setUsers] = useState<UserWithRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<AppRole>("employee");
  const [inviting, setInviting] = useState(false);
  const [editUser, setEditUser] = useState<UserWithRole | null>(null);
  const [editForm, setEditForm] = useState({ department: "", job_title: "", monthly_salary: 0, status: "Active" });
  const [pinUser, setPinUser] = useState<UserWithRole | null>(null);
  const [pinValue, setPinValue] = useState("");
  const [settingPin, setSettingPin] = useState(false);
  const fetchUsers = async () => {
    // Fetch profiles joined with roles
    const { data: profiles } = await supabase.from("profiles").select("*");
    const { data: roles } = await supabase.from("user_roles").select("*");

    if (profiles && roles) {
      const merged: UserWithRole[] = profiles.map((p) => {
        const userRole = roles.find((r) => r.user_id === p.user_id);
        return {
          user_id: p.user_id,
          first_name: p.first_name,
          last_name: p.last_name,
          email: p.email,
          department: p.department || "",
          job_title: p.job_title || "",
          status: p.status,
          phone: p.phone || "",
          monthly_salary: Number(p.monthly_salary) || 0,
          role: (userRole?.role as AppRole) || "employee",
        };
      });
      setUsers(merged);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const filtered = users.filter(
    (u) =>
      `${u.first_name} ${u.last_name} ${u.email}`.toLowerCase().includes(search.toLowerCase())
  );

  const handleRoleChange = async (userId: string, newRole: AppRole) => {
    try {
      const { error } = await supabase
        .from("user_roles")
        .update({ role: newRole })
        .eq("user_id", userId);
      if (error) throw error;
      toast.success(`Role updated to ${newRole}`);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to update role");
    }
  };

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

  const handleInvite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    try {
      // Create user via signup (they'll receive email verification)
      const { data, error } = await supabase.auth.signUp({
        email: inviteEmail.trim(),
        password: Math.random().toString(36).slice(-12) + "A1!", // temp password
        options: {
          data: { first_name: "", last_name: "" },
          emailRedirectTo: window.location.origin,
        },
      });
      if (error) throw error;

      // Update role if not default employee
      if (data.user && inviteRole !== "employee") {
        await supabase
          .from("user_roles")
          .update({ role: inviteRole })
          .eq("user_id", data.user.id);
      }

      toast.success(`Invitation sent to ${inviteEmail}`);
      setShowInvite(false);
      setInviteEmail("");
      setInviteRole("employee");
      setTimeout(fetchUsers, 1000);
    } catch (err: any) {
      toast.error(err.message || "Failed to send invite");
    } finally {
      setInviting(false);
    }
  };

  const handleEditSave = async () => {
    if (!editUser) return;
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          department: editForm.department,
          job_title: editForm.job_title,
          monthly_salary: editForm.monthly_salary,
          status: editForm.status,
        })
        .eq("user_id", editUser.user_id);
      if (error) throw error;
      toast.success("Profile updated");
      setEditUser(null);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.message || "Failed to update");
    }
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
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">User Management</h1>
          <p className="text-sm text-muted-foreground mt-1">{users.length} users • Manage roles, access, and profiles</p>
        </div>
        <button
          onClick={() => setShowInvite(true)}
          className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
        >
          <UserPlus size={16} />
          Invite Employee
        </button>
      </div>

      {/* Role Stats */}
      <div className="grid grid-cols-3 gap-4">
        {(["admin", "manager", "employee"] as AppRole[]).map((r) => (
          <Card key={r} className="shadow-card border-border/60">
            <CardContent className="p-4 flex items-center gap-3">
              <div className={`p-2 rounded-lg ${roleColors[r]}`}>
                <Shield size={18} />
              </div>
              <div>
                <p className="text-lg font-display font-bold text-foreground">{users.filter((u) => u.role === r).length}</p>
                <p className="text-xs text-muted-foreground capitalize">{r}s</p>
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
                          <p className="text-xs text-muted-foreground">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 px-4 text-foreground">{u.department || "—"}</td>
                    <td className="py-3 px-4">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.user_id, e.target.value as AppRole)}
                        className={`px-2 py-1 rounded-md text-xs font-medium border-0 cursor-pointer ${roleColors[u.role]}`}
                      >
                        <option value="employee">Employee</option>
                        <option value="manager">Manager</option>
                        <option value="admin">Admin</option>
                      </select>
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
                        <button
                          onClick={() => {
                            setEditUser(u);
                            setEditForm({
                              department: u.department,
                              job_title: u.job_title,
                              monthly_salary: u.monthly_salary,
                              status: u.status,
                            });
                          }}
                          className="p-1.5 rounded-md hover:bg-secondary transition-colors text-xs text-primary font-medium"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => handleDeactivate(u.user_id, u.status)}
                          className="p-1.5 rounded-md hover:bg-secondary transition-colors"
                          title={u.status === "Active" ? "Deactivate" : "Activate"}
                        >
                          {u.status === "Active" ? (
                            <Ban size={14} className="text-destructive" />
                          ) : (
                            <CheckCircle size={14} className="text-success" />
                          )}
                        </button>
                      </div>
                    </td>
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Invite Dialog */}
      <Dialog open={showInvite} onOpenChange={setShowInvite}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <UserPlus size={18} className="text-primary" />
              Invite Employee
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Email Address</label>
              <div className="relative">
                <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="employee@company.com"
                  className="w-full pl-9 pr-4 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as AppRole)}
                className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                <option value="employee">Employee</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button
              onClick={handleInvite}
              disabled={inviting || !inviteEmail.trim()}
              className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {inviting ? "Sending..." : "Send Invitation"}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Profile Dialog */}
      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent className="sm:max-w-md">
          {editUser && (
            <>
              <DialogHeader>
                <DialogTitle className="font-display">Edit {editUser.first_name} {editUser.last_name}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-2">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Department</label>
                  <input
                    type="text"
                    value={editForm.department}
                    onChange={(e) => setEditForm({ ...editForm, department: e.target.value })}
                    className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Job Title</label>
                  <input
                    type="text"
                    value={editForm.job_title}
                    onChange={(e) => setEditForm({ ...editForm, job_title: e.target.value })}
                    className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Monthly Salary (XCD)</label>
                  <input
                    type="number"
                    value={editForm.monthly_salary}
                    onChange={(e) => setEditForm({ ...editForm, monthly_salary: Number(e.target.value) })}
                    className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                    className="w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    <option value="Active">Active</option>
                    <option value="Inactive">Inactive</option>
                    <option value="On Leave">On Leave</option>
                  </select>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleEditSave}
                    className="flex-1 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
                  >
                    Save Changes
                  </button>
                  <button
                    onClick={() => setEditUser(null)}
                    className="px-4 py-2.5 bg-secondary text-foreground rounded-lg text-sm font-medium hover:bg-muted transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
