import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Building2, Plus, Trash2, Edit2, DollarSign, Users, Search, Save, X, TrendingUp, Upload, FileDown, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { toast } from "sonner";
import EmployeeLoans from "@/components/EmployeeLoans";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/native-select";

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

interface EmployeeAddition {
  id: string;
  user_id: string;
  addition_type: string;
  description: string;
  amount: number;
  frequency: string;
  is_active: boolean;
  period: string | null;
  start_date: string | null;
  end_date: string | null;
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

const additionTypes = [
  { value: "bonus", label: "Bonus" },
  { value: "overtime", label: "Overtime" },
  { value: "double_time", label: "Double Time" },
  { value: "vacation_pay", label: "Vacation Pay" },
  { value: "commission", label: "Commission" },
  { value: "allowance", label: "Allowance" },
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

const additionTypeColors: Record<string, string> = {
  bonus: "bg-success/10 text-success",
  overtime: "bg-primary/10 text-primary",
  double_time: "bg-warning/10 text-warning",
  vacation_pay: "bg-accent/20 text-accent-foreground",
  commission: "bg-primary/10 text-primary",
  allowance: "bg-success/10 text-success",
  other: "bg-muted text-muted-foreground",
};

export default function DeductionsPage() {
  const { isAdminOrManager } = useRole();
  const [tab, setTab] = useState<"creditors" | "deductions" | "additions" | "loans">("creditors");
  const [creditors, setCreditors] = useState<Creditor[]>([]);
  const [deductions, setDeductions] = useState<EmployeeDeduction[]>([]);
  const [additions, setAdditions] = useState<EmployeeAddition[]>([]);
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
  const [editingDeductionId, setEditingDeductionId] = useState<string | null>(null);
  const [editingAdditionId, setEditingAdditionId] = useState<string | null>(null);
  const [deductionForm, setDeductionForm] = useState({ user_id: "", creditor_id: "", amount: 0, frequency: "monthly", notes: "", start_date: "", end_date: "" });
  const [savingDeduction, setSavingDeduction] = useState(false);

  // Addition form
  const [showAdditionForm, setShowAdditionForm] = useState(false);
  const [additionForm, setAdditionForm] = useState({ user_id: "", addition_type: "bonus", description: "", amount: 0, frequency: "one-time", notes: "", start_date: "", end_date: "" });
  const [savingAddition, setSavingAddition] = useState(false);

  const fetchData = async () => {
    const [credRes, dedRes, addRes, profRes] = await Promise.all([
      supabase.from("creditors").select("*").order("name"),
      supabase.from("employee_deductions").select("*").order("created_at", { ascending: false }),
      supabase.from("employee_additions").select("*").order("created_at", { ascending: false }),
      supabase.from("payroll_employee_directory").select("user_id, first_name, last_name, email, department").is("deleted_at", null),
    ]);
    setCreditors((credRes.data as Creditor[]) || []);
    setDeductions((dedRes.data as EmployeeDeduction[]) || []);
    setAdditions((addRes.data as unknown as EmployeeAddition[]) || []);
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
      const row = { ...deductionForm, start_date: deductionForm.start_date || null, end_date: deductionForm.end_date || null };
      const { error } = editingDeductionId
        ? await supabase.from("employee_deductions").update(row).eq("id", editingDeductionId)
        : await supabase.from("employee_deductions").insert(row);
      if (error) throw error;
      toast.success(editingDeductionId ? "Deduction updated" : "Deduction added");
      setEditingDeductionId(null);
      setShowDeductionForm(false);
      setDeductionForm({ user_id: "", creditor_id: "", amount: 0, frequency: "monthly", notes: "", start_date: "", end_date: "" });
      fetchData();
    } catch (err: any) { toast.error(err.message); }
    finally { setSavingDeduction(false); }
  };

  const handleDeleteDeduction = async (id: string) => {
    if (!confirm("Delete this deduction? It will no longer be taken from future payrolls.")) return;
    const { error } = await supabase.from("employee_deductions").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Deduction removed"); fetchData(); }
  };

  const handleSaveAddition = async () => {
    if (!additionForm.user_id || additionForm.amount <= 0) {
      toast.error("Employee and amount are required");
      return;
    }
    setSavingAddition(true);
    try {
      const row = {
        user_id: additionForm.user_id,
        addition_type: additionForm.addition_type as any,
        description: additionForm.description || additionTypes.find(t => t.value === additionForm.addition_type)?.label || "",
        amount: additionForm.amount,
        frequency: additionForm.frequency,
        notes: additionForm.notes,
        start_date: additionForm.start_date || null,
        end_date: additionForm.end_date || null,
      } as any;
      const { error } = editingAdditionId
        ? await supabase.from("employee_additions").update(row).eq("id", editingAdditionId)
        : await supabase.from("employee_additions").insert(row);
      if (error) throw error;
      toast.success(editingAdditionId ? "Addition updated" : "Addition added");
      setEditingAdditionId(null);
      setShowAdditionForm(false);
      setAdditionForm({ user_id: "", addition_type: "bonus", description: "", amount: 0, frequency: "one-time", notes: "", start_date: "", end_date: "" });
      fetchData();
    } catch (err: any) { toast.error(err.message); }
    finally { setSavingAddition(false); }
  };

  const handleDeleteAddition = async (id: string) => {
    if (!confirm("Delete this addition? It will no longer be paid in future payrolls.")) return;
    const { error } = await supabase.from("employee_additions").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Addition removed"); fetchData(); }
  };

  const handleToggleDeduction = async (id: string, isActive: boolean) => {
    const { error } = await supabase.from("employee_deductions").update({ is_active: !isActive }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(isActive ? "Deduction stopped" : "Deduction restarted"); fetchData(); }
  };

  const handleToggleAddition = async (id: string, isActive: boolean) => {
    const { error } = await supabase.from("employee_additions").update({ is_active: !isActive }).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success(isActive ? "Addition stopped" : "Addition restarted"); fetchData(); }
  };

  const csvFileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);

  const handleCSVImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    try {
      const text = await file.text();
      const lines = text.split("\n").map(l => l.trim()).filter(Boolean);
      if (lines.length < 2) { toast.error("CSV must have a header row and at least one data row"); return; }
      
      // Expected: email, type, description, amount, frequency, notes
      const rows = lines.slice(1).map(line => {
        const parts = line.split(",").map(s => s.trim().replace(/^"|"$/g, ""));
        return { email: parts[0], type: parts[1] || "bonus", description: parts[2] || "", amount: parseFloat(parts[3]) || 0, frequency: parts[4] || "one-time", notes: parts[5] || "" };
      }).filter(r => r.email && r.amount > 0);

      if (rows.length === 0) { toast.error("No valid rows found in CSV"); setImporting(false); return; }

      // Map emails to user_ids
      let inserted = 0;
      let skipped = 0;
      for (const row of rows) {
        const profile = profiles.find(p => p.email.toLowerCase() === row.email.toLowerCase());
        if (!profile) { skipped++; continue; }
        
        const validTypes = ["bonus", "overtime", "double_time", "vacation_pay", "commission", "allowance", "other"];
        const addType = validTypes.includes(row.type) ? row.type : "other";

        const { error } = await supabase.from("employee_additions").insert({
          user_id: profile.user_id,
          addition_type: addType,
          description: row.description || additionTypes.find(t => t.value === addType)?.label || "",
          amount: row.amount,
          frequency: row.frequency,
          notes: row.notes,
        } as any);
        if (error) { skipped++; } else { inserted++; }
      }

      toast.success(`Imported ${inserted} additions${skipped > 0 ? `, ${skipped} skipped` : ""}`);
      fetchData();
    } catch (err: any) {
      toast.error("Failed to parse CSV: " + err.message);
    } finally {
      setImporting(false);
      if (csvFileRef.current) csvFileRef.current.value = "";
    }
  };

  const downloadSampleCSV = () => {
    const header = "email,type,description,amount,frequency,notes";
    const sample = [
      "john@example.com,bonus,Q1 Performance Bonus,500.00,one-time,Approved by HR",
      "jane@example.com,overtime,March OT 20hrs,350.00,one-time,",
      "mike@example.com,vacation_pay,Vacation Payout,1200.00,one-time,Unused vacation days",
    ].join("\n");
    const blob = new Blob([header + "\n" + sample], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "additions-template.csv"; a.click();
    URL.revokeObjectURL(url);
    toast.success("Template downloaded");
  };

  const filteredCreditors = creditors.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) || c.type.includes(search.toLowerCase())
  );

  const inputClass = "w-full px-3 py-2.5 bg-secondary border border-border rounded-lg text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20";

  if (!isAdminOrManager) {
    return (
      <div className="p-6 text-center">
        <p className="text-muted-foreground">You don't have permission to manage deductions and additions.</p>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-display font-bold text-foreground">Deductions & Additions</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage creditors, employee deductions, and pay additions</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap rounded-lg bg-secondary p-1 w-fit gap-1">
        <Button variant={tab === "loans" ? "default" : "ghost"} onClick={() => setTab("loans")}><DollarSign size={14} />Loans</Button>
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
          Deductions ({deductions.length})
        </button>
        <button
          onClick={() => setTab("additions")}
          className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors ${
            tab === "additions" ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
          }`}
        >
          <TrendingUp size={14} />
          Additions ({additions.length})
        </button>
      </div>

      {/* Creditors Tab */}
      {tab === "loans" && <EmployeeLoans />}
      {tab === "creditors" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
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
              onClick={() => { setDeductionForm({ user_id: "", creditor_id: "", amount: 0, frequency: "monthly", notes: "", start_date: "", end_date: "" }); setShowDeductionForm(true); }}
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
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Loading...</td></tr>
                  ) : deductions.length === 0 ? (
                    <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No deductions configured</td></tr>
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
                            <Badge variant="secondary" className="text-[10px]">{d.frequency}</Badge><p className="text-[10px] text-muted-foreground mt-1">{d.start_date || d.end_date ? `${d.start_date || "now"} → ${d.end_date || "no end"}` : "No end date"}</p>
                          </td>
                          <td className="py-3 px-4 text-xs text-muted-foreground max-w-[150px] truncate">{d.notes || "—"}</td>
                          <td className="py-3 px-4">
                            <button onClick={() => handleToggleDeduction(d.id, d.is_active)} className={`text-xs px-2 py-1 rounded-full font-medium transition-colors ${d.is_active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
                              {d.is_active ? "Active · Stop" : "Stopped · Restart"}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button aria-label="Edit deduction" title="Edit deduction" onClick={() => { setEditingDeductionId(d.id); setDeductionForm({ user_id: d.user_id, creditor_id: d.creditor_id, amount: Number(d.amount), frequency: d.frequency, notes: d.notes || "", start_date: d.start_date || "", end_date: d.end_date || "" }); setShowDeductionForm(true); }} className="p-1.5 rounded-md hover:bg-secondary transition-colors">
                              <Edit2 size={14} className="text-primary" />
                            </button>
                            <button aria-label="Delete deduction" title="Delete deduction" onClick={() => handleDeleteDeduction(d.id)} className="p-1.5 rounded-md hover:bg-secondary transition-colors">
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

      {/* Additions Tab */}
      {tab === "additions" && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2 justify-end">
            <input
              ref={csvFileRef}
              type="file"
              accept=".csv"
              onChange={handleCSVImport}
              className="hidden"
            />
            <button
              onClick={downloadSampleCSV}
              className="flex items-center gap-2 px-3 py-2 bg-secondary text-foreground rounded-lg text-xs font-medium hover:bg-muted transition-colors"
            >
              <FileDown size={14} />
              Download Template
            </button>
            <button
              onClick={() => csvFileRef.current?.click()}
              disabled={importing}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {importing ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
              {importing ? "Importing..." : "Import CSV"}
            </button>
            <button
              onClick={() => { setAdditionForm({ user_id: "", addition_type: "bonus", description: "", amount: 0, frequency: "one-time", notes: "", start_date: "", end_date: "" }); setShowAdditionForm(true); }}
              className="flex items-center gap-2 px-4 py-2.5 bg-success text-success-foreground rounded-lg text-sm font-medium hover:bg-success/90 transition-colors"
            >
              <Plus size={16} />
              Add Addition
            </button>
          </div>

          <Card className="shadow-card border-border/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/50">
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Employee</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Type</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Description</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Amount</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Frequency</th>
                    <th className="text-left py-3 px-4 font-medium text-muted-foreground">Status</th>
                    <th className="text-right py-3 px-4 font-medium text-muted-foreground">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">Loading...</td></tr>
                  ) : additions.length === 0 ? (
                    <tr><td colSpan={7} className="py-8 text-center text-muted-foreground">No additions configured. Add bonuses, overtime, vacation pay, etc.</td></tr>
                  ) : (
                    additions.map((a) => {
                      const profile = profiles.find(p => p.user_id === a.user_id);
                      return (
                        <tr key={a.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors">
                          <td className="py-3 px-4">
                            <p className="font-medium text-foreground">
                              {profile ? `${profile.first_name} ${profile.last_name}` : "Unknown"}
                            </p>
                            <p className="text-xs text-muted-foreground">{profile?.email}</p>
                          </td>
                          <td className="py-3 px-4">
                            <Badge variant="secondary" className={`${additionTypeColors[a.addition_type] || additionTypeColors.other} text-[10px]`}>
                              {additionTypes.find(t => t.value === a.addition_type)?.label || a.addition_type}
                            </Badge>
                          </td>
                          <td className="py-3 px-4 text-foreground text-xs">{a.description || "—"}</td>
                          <td className="py-3 px-4 text-right font-mono font-semibold text-success">+${Number(a.amount).toFixed(2)}</td>
                          <td className="py-3 px-4">
                            <Badge variant="secondary" className="text-[10px]">{a.frequency}</Badge><p className="text-[10px] text-muted-foreground mt-1">{a.start_date || a.end_date ? `${a.start_date || "now"} → ${a.end_date || "no end"}` : "No end date"}</p>
                          </td>
                          <td className="py-3 px-4">
                            <button
                              onClick={() => handleToggleAddition(a.id, a.is_active)}
                              className={`text-xs px-2 py-1 rounded-full font-medium transition-colors ${
                                a.is_active ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"
                              }`}
                            >
                              {a.is_active ? "Active · Stop" : "Stopped · Restart"}
                            </button>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button aria-label="Edit addition" title="Edit addition" onClick={() => { setEditingAdditionId(a.id); setAdditionForm({ user_id: a.user_id, addition_type: a.addition_type, description: a.description || "", amount: Number(a.amount), frequency: a.frequency, notes: a.notes || "", start_date: a.start_date || "", end_date: a.end_date || "" }); setShowAdditionForm(true); }} className="p-1.5 rounded-md hover:bg-secondary transition-colors">
                              <Edit2 size={14} className="text-primary" />
                            </button>
                            <button aria-label="Delete addition" title="Delete addition" onClick={() => handleDeleteAddition(a.id)} className="p-1.5 rounded-md hover:bg-secondary transition-colors">
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
              <NativeSelect value={creditorForm.type} onChange={(e) => setCreditorForm({ ...creditorForm, type: e.target.value })} className={inputClass}>
                {creditorTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </NativeSelect>
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
      <Dialog open={showDeductionForm} onOpenChange={o => { setShowDeductionForm(o); if (!o) setEditingDeductionId(null); }}>
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
              <NativeSelect value={deductionForm.user_id} onChange={(e) => setDeductionForm({ ...deductionForm, user_id: e.target.value })} className={inputClass}>
                <option value="">Select employee...</option>
                {profiles.map(p => <option key={p.user_id} value={p.user_id}>{p.first_name} {p.last_name} — {p.email}</option>)}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Creditor</label>
              <NativeSelect value={deductionForm.creditor_id} onChange={(e) => setDeductionForm({ ...deductionForm, creditor_id: e.target.value })} className={inputClass}>
                <option value="">Select creditor...</option>
                {creditors.filter(c => c.is_active).map(c => <option key={c.id} value={c.id}>{c.name} ({creditorTypes.find(t => t.value === c.type)?.label})</option>)}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Amount (XCD)</label>
              <input type="number" step="0.01" value={deductionForm.amount || ""} onChange={(e) => setDeductionForm({ ...deductionForm, amount: Number(e.target.value) })} placeholder="0.00" className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Frequency</label>
              <NativeSelect value={deductionForm.frequency} onChange={(e) => setDeductionForm({ ...deductionForm, frequency: e.target.value })} className={inputClass}>
                <option value="monthly">Monthly (Recurring)</option>
                <option value="semi-monthly">Semi-Monthly (Recurring)</option>
                <option value="bi-weekly">Bi-Weekly (Recurring)</option>
                <option value="weekly">Weekly (Recurring)</option>
                <option value="one-time">One-Time</option>
              </NativeSelect>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Starts</label>
                <input type="date" value={deductionForm.start_date} onChange={(e) => setDeductionForm({ ...deductionForm, start_date: e.target.value })} className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ends (optional)</label>
                <input type="date" value={deductionForm.end_date} onChange={(e) => setDeductionForm({ ...deductionForm, end_date: e.target.value })} className={inputClass} />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground -mt-2">Recurring lines repeat every payroll inside these dates. Leave "Ends" blank to keep going until you stop it.</p>
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

      {/* Addition Form Dialog */}
      <Dialog open={showAdditionForm} onOpenChange={o => { setShowAdditionForm(o); if (!o) setEditingAdditionId(null); }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <TrendingUp size={18} className="text-success" />
              Add Employee Addition
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Employee</label>
              <NativeSelect value={additionForm.user_id} onChange={(e) => setAdditionForm({ ...additionForm, user_id: e.target.value })} className={inputClass}>
                <option value="">Select employee...</option>
                {profiles.map(p => <option key={p.user_id} value={p.user_id}>{p.first_name} {p.last_name} — {p.email}</option>)}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Type</label>
              <NativeSelect value={additionForm.addition_type} onChange={(e) => setAdditionForm({ ...additionForm, addition_type: e.target.value })} className={inputClass}>
                {additionTypes.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </NativeSelect>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Description</label>
              <input value={additionForm.description} onChange={(e) => setAdditionForm({ ...additionForm, description: e.target.value })} placeholder="e.g. Q1 Performance Bonus" className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Amount (XCD)</label>
              <input type="number" step="0.01" value={additionForm.amount || ""} onChange={(e) => setAdditionForm({ ...additionForm, amount: Number(e.target.value) })} placeholder="0.00" className={inputClass} />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Frequency</label>
              <NativeSelect value={additionForm.frequency} onChange={(e) => setAdditionForm({ ...additionForm, frequency: e.target.value })} className={inputClass}>
                <option value="one-time">One-Time</option>
                <option value="monthly">Monthly (Recurring)</option>
                <option value="semi-monthly">Semi-Monthly (Recurring)</option>
                <option value="bi-weekly">Bi-Weekly (Recurring)</option>
                <option value="weekly">Weekly (Recurring)</option>
              </NativeSelect>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Starts</label>
                <input type="date" value={additionForm.start_date} onChange={(e) => setAdditionForm({ ...additionForm, start_date: e.target.value })} className={inputClass} />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Ends (optional)</label>
                <input type="date" value={additionForm.end_date} onChange={(e) => setAdditionForm({ ...additionForm, end_date: e.target.value })} className={inputClass} />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground -mt-2">Recurring lines repeat every payroll inside these dates. Leave "Ends" blank to keep going until you stop it.</p>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Notes (optional)</label>
              <input value={additionForm.notes} onChange={(e) => setAdditionForm({ ...additionForm, notes: e.target.value })} placeholder="e.g. Approved by HR Manager" className={inputClass} />
            </div>
            <button onClick={handleSaveAddition} disabled={savingAddition} className="w-full px-4 py-2.5 bg-success text-success-foreground rounded-lg text-sm font-medium hover:bg-success/90 transition-colors disabled:opacity-50">
              <span className="flex items-center justify-center gap-2"><TrendingUp size={14} />{savingAddition ? "Saving..." : "Add Addition"}</span>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
