import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, Plus, Trash2, Edit2, DollarSign, Users, Search, Save, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";

interface Creditor {
  id: string;
  name: string;
  type: string;
  account_number: string;
  contact_info: string;
  is_active: boolean;
}

interface EmployeeDeduction {
  id: string;
  user_id: string;
  creditor_id: string;
  amount: number;
  frequency: string;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean;
  notes: string;
}

interface Profile {
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  department: string | null;
}

const creditorTypes = [
  { value: "bank", label: "Bank" },
  { value: "credit_union", label: "Credit Union" },
  { value: "government", label: "Government" },
  { value: "insurance", label: "Insurance" },
  { value: "loan", label: "Loan Company" },
  { value: "other", label: "Other" },
];

const typeColors: Record<string, string> = {
  bank: "bg-primary/10 text-primary",
  credit_union: "bg-success/10 text-success",
  government: "bg-warning/10 text-warning",
  insurance: "bg-accent/20 text-accent-foreground",
  loan: "bg-destructive/10 text-destructive",
  other: "bg-muted text-muted-foreground",
};

export default function DeductionsPage() {
  const { isAdminOrManager } = useRole();
  const [tab, setTab] = useState<"creditors" | "deductions">("creditors");
  const [creditors, setCreditors] = useState<Creditor[]>([]);
  const [deductions, setDeductions] = useState<EmployeeDeduction[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Creditor form
  const [showCreditorForm, setShowCreditorForm] = useState(false);
  const [editingCreditor, setEditingCreditor] = useState<Creditor | null>(null);
  const [creditorForm, setCreditorForm] = useState({ name: "", type: "other", account_number: "", contact_info: "" });
  const [savingCreditor, setSavingCreditor] = useState(false);

  // Deduction form
  const [showDeductionForm, setShowDeductionForm] = useState(false);
  const [deductionForm, setDeductionForm] = useState({ user_id: "", creditor_id: "", amount: 0, frequency: "monthly", notes: "" });
  const [savingDeduction, setSavingDeduction] = useState(false);

  const fetchData = async () => {
    const [credRes, dedRes, profRes] = await Promise.all([
      supabase.from("creditors").select("*").order("name"),
      supabase.from("employee_deductions").select("*").order("created_at", { ascending: false }),
      supabase.from("profiles").select("user_id, first_name, last_name, email, department"),
    ]);
    setCreditors((credRes.data as Creditor[]) || []);
    setDeductions((dedRes.data as EmployeeDeduction[]) || []);
    setProfiles((profRes.data as Profile[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSaveCreditor = async () => {
    if (!creditorForm.name.trim()) { toast.error("Name is required"); return; }
    setSavingCreditor(true);
    try {
      if (editingCreditor) {
        const { error } = await supabase.from("creditors").update(creditorForm).eq("id", editingCreditor.id);
        if (error) throw error;
        toast.success("Creditor updated");
      } else {
        const { error } = await supabase.from("creditors").insert(creditorForm);
        if (error) throw error;
        toast.success("Creditor added");
      }
      setShowCreditorForm(false);
      setEditingCreditor(null);
      setCreditorForm({ name: "", type: "other", account_number: "", contact_info: "" });
      fetchData();
    } catch (err: any) { toast.error(err.message); }
    finally { setSavingCreditor(false); }
  };

  const handleDeleteCreditor = async (id: string) => {
    if (!confirm("Delete this creditor? This will also remove all associated deductions.")) return;
    const { error } = await supabase.from("creditors").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Creditor deleted"); fetchData(); }
  };

  const handleSaveDeduction = async () => {
    if (!deductionForm.user_id || !deductionForm.creditor_id || deductionForm.amount <= 0) {
      toast.error("Employee, creditor, and amount are required");
      return;
    }
    setSavingDeduction(true);
    try {
      const { error } = await supabase.from("employee_deductions").insert(deductionForm);
      if (error) throw error;
      toast.success("Deduction added");
      setShowDeductionForm(false);
      setDeductionForm({ user_id: "", creditor_id: "", amount: 0, frequency: "monthly", notes: "" });
      fetchData();
    } catch (err: any) { toast.error(err.message); }
    finally { setSavingDeduction(false); }
  };

  const handleDeleteDeduction = async (id: string) => {
    const { error } = await supabase.from("employee_deductions").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deduction removed"); fetchData(); }
  };

  const filteredCreditors = creditors.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.type.includes(search.toLowerCase())
  );

  const inputClass = "w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20";

  if (!isAdminOrManager) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">You don't have permission to manage deductions.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Deductions Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage creditors and employee deductions</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex rounded-lg bg-secondary p-1 w-fit">
        <button
          onClick={() => setTab("creditors")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "creditors" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          <Building2 size={14} />
          Creditors ({creditors.length})
        </button>
        <button
          onClick={() => setTab("deductions")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "deductions" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          <DollarSign size={14} />
          Employee Deductions ({deductions.length})
        </button>
      </div>

      {/* Creditors Tab */}
      {tab === "creditors" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search creditors..."
                className="w-full pl-9 pr-4 py-2.5 bg-card border border-border rounded-lg text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <button
              onClick={() => { setEditingCreditor(null); setCreditorForm({ name: "", type: "other", account_number: "", contact_info: "" }); setShowCreditorForm(true); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus size={16} />
              Add Creditor
            </button>
          </div>

          <Card className="shadow-card border-border/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Creditor</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Type</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Account #</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Contact</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">Loading...</td></tr>
                  ) : filteredCreditors.length === 0 ? (
                    <tr><td colSpan={5} className="py-8 text-center text-muted-foreground">No creditors found</td></tr>
                  ) : (
                    filteredCreditors.map((c) => (
                      <tr key={c.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                        <td className="py-3 px-4 font-medium text-foreground">{c.name}</td>
                        <td className="py-3 px-4">
                          <Badge variant="secondary" className={`${typeColors[c.type] || typeColors.other} text-[10px]`}>
                            {creditorTypes.find(t => t.value === c.type)?.label || c.type}
                          </Badge>
                        </td>
                        <td className="py-3 px-4 font-mono text-foreground">{c.account_number || "—"}</td>
                        <td className="py-3 px-4 text-muted-foreground">{c.contact_info || "—"}</td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              onClick={() => {
                                setEditingCreditor(c);
                                setCreditorForm({ name: c.name, type: c.type, account_number: c.account_number, contact_info: c.contact_info });
                                setShowCreditorForm(true);
                              }}
                              className="p-1.5 rounded-md hover:bg-secondary transition-colors"
                            >
                              <Edit2 size={14} className="text-primary" />
                            </button>
                            <button onClick={() => handleDeleteCreditor(c.id)} className="p-1.5 rounded-md hover:bg-secondary transition-colors">
                              <Trash2 size={14} className="text-destructive" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Deductions Tab */}
      {tab === "deductions" && (
        <div className="space-y-4">
          <div className="flex justify-end">
            <button
              onClick={() => { setDeductionForm({ user_id: "", creditor_id: "", amount: 0, frequency: "monthly", notes: "" }); setShowDeductionForm(true); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
            >
              <Plus size={16} />
              Add Deduction
            </button>
          </div>

          <Card className="shadow-card border-border/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Employee</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Creditor</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Amount</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Frequency</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Notes</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">Loading...</td></tr>
                  ) : deductions.length === 0 ? (
                    <tr><td colSpan={6} className="py-8 text-center text-muted-foreground">No deductions configured</td></tr>
                  ) : (
                    deductions.map((d) => {
                      const profile = profiles.find(p => p.user_id === d.user_id);
                      const creditor = creditors.find(c => c.id === d.creditor_id);
                      return (
                        <tr key={d.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                          <td className="py-3 px-4">
                            <p className="font-medium text-foreground">
                              {profile ? `${profile.first_name} ${profile.last_name}` : "Unknown"}
                            </p>
                            <p className="text-xs text-muted-foreground">{profile?.email}</p>
                          </td>
                          <td className="py-3 px-4 text-foreground">{creditor?.name || "—"}</td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-destructive">${Number(d.amount).toFixed(2)}</td>
                          <td className="py-3 px-4">
                            <Badge variant="secondary" className="text-[10px]">{d.frequency}</Badge>
                          </td>
                          <td className="py-3 px-4 text-xs text-muted-foreground max-w-[150px] truncate">{d.notes || "—"}</td>
                          <td className="py-3 px-4 text-right">
                            <button onClick={() => handleDeleteDeduction(d.id)} className="p-1.5 rounded-md hover:bg-secondary transition-colors">
                              <Trash2 size={14} className="text-destructive" />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Creditor Form Dialog */}
      <Dialog open={showCreditorForm} onOpenChange={setShowCreditorForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Building2 size={18} className="text-primary" />
              {editingCreditor ? "Edit Creditor" : "Add Creditor"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Name</label>
              <input value={creditorForm.name} onChange={(e) => setCreditorForm({ ...creditorForm, name: e.target.value })} placeholder="e.g. Bank of Saint Lucia" className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Type</label>
              <select value={creditorForm.type} onChange={(e) => setCreditorForm({ ...creditorForm, type: e.target.value })} className={inputClass}>
                {creditorTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Account Number</label>
              <input value={creditorForm.account_number} onChange={(e) => setCreditorForm({ ...creditorForm, account_number: e.target.value })} placeholder="Optional" className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Contact Info</label>
              <input value={creditorForm.contact_info} onChange={(e) => setCreditorForm({ ...creditorForm, contact_info: e.target.value })} placeholder="Phone or email" className={inputClass} />
            </div>
            <button onClick={handleSaveCreditor} disabled={savingCreditor} className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
              <span className="flex items-center justify-center gap-2"><Save size={14} />{savingCreditor ? "Saving..." : editingCreditor ? "Update Creditor" : "Add Creditor"}</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deduction Form Dialog */}
      <Dialog open={showDeductionForm} onOpenChange={setShowDeductionForm}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <DollarSign size={18} className="text-primary" />
              Add Employee Deduction
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Employee</label>
              <select value={deductionForm.user_id} onChange={(e) => setDeductionForm({ ...deductionForm, user_id: e.target.value })} className={inputClass}>
                <option value="">Select employee...</option>
                {profiles.map(p => <option key={p.user_id} value={p.user_id}>{p.first_name} {p.last_name} — {p.email}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Creditor</label>
              <select value={deductionForm.creditor_id} onChange={(e) => setDeductionForm({ ...deductionForm, creditor_id: e.target.value })} className={inputClass}>
                <option value="">Select creditor...</option>
                {creditors.filter(c => c.is_active).map(c => <option key={c.id} value={c.id}>{c.name} ({creditorTypes.find(t => t.value === c.type)?.label})</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Amount (XCD)</label>
              <input type="number" step="0.01" value={deductionForm.amount || ""} onChange={(e) => setDeductionForm({ ...deductionForm, amount: Number(e.target.value) })} placeholder="0.00" className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Frequency</label>
              <select value={deductionForm.frequency} onChange={(e) => setDeductionForm({ ...deductionForm, frequency: e.target.value })} className={inputClass}>
                <option value="monthly">Monthly</option>
                <option value="bi-weekly">Bi-Weekly</option>
                <option value="weekly">Weekly</option>
                <option value="one-time">One-Time</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes (optional)</label>
              <input value={deductionForm.notes} onChange={(e) => setDeductionForm({ ...deductionForm, notes: e.target.value })} placeholder="e.g. Loan repayment" className={inputClass} />
            </div>
            <button onClick={handleSaveDeduction} disabled={savingDeduction} className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50">
              {savingDeduction ? "Saving..." : "Add Deduction"}
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
