import { useCallback, useEffect, useState } from "react";
import { Search, UserPlus, Upload, RefreshCw, MoreHorizontal, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import CSVImportDialog from "@/components/CSVImportDialog";
import EmployeeFolderDialog from "@/components/EmployeeFolderDialog";
import { sampleEmployees } from "@/lib/sample-data";
import { employeePermissions, folderUpdate, profileToFolder, sampleToFolder, type EmployeeFolder, type EmployeeForm } from "@/lib/employee-folder";
import { formatCurrency } from "@/lib/payroll-engine";
import { supabase } from "@/integrations/supabase/client";
import { useRole } from "@/hooks/useRole";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function EmployeesPage() {
  const { role } = useRole();
  const { user } = useAuth();
  const permissions = employeePermissions(role);
  const [live, setLive] = useState<EmployeeFolder[]>([]);
  const [samples, setSamples] = useState(() => sampleEmployees.map(sampleToFolder));
  const [mode, setMode] = useState("live");
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All");
  const [status, setStatus] = useState("All");
  const [selected, setSelected] = useState<EmployeeFolder | null>(null);
  const [creating, setCreating] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const fetchEmployees = useCallback(async () => {
    setLoading(true); setError("");
    const [profiles, records] = await Promise.all([supabase.from("profiles").select("*").order("first_name"), supabase.from("employee_records").select("*").order("first_name")]);
    if (profiles.error || records.error) setError("Employee records could not be loaded. Please try again.");
    else setLive([...(profiles.data || []).map(p => ({ ...profileToFolder(p), accountLinked: true })), ...(records.data || []).map(p => ({ ...profileToFolder(p), accountLinked: false }))]);
    setLoading(false);
  }, []);
  useEffect(() => { fetchEmployees(); }, [fetchEmployees]);
  const records = mode === "sample" ? samples.filter((folder) => !folder.deletedAt) : live.filter((folder) => mode === "deleted" ? Boolean(folder.deletedAt) : !folder.deletedAt);
  const departments = ["All", ...new Set(records.map((folder) => folder.values.department).filter(Boolean))];
  const filtered = records.filter(({ values }) => `${values.first_name} ${values.last_name} ${values.email} ${values.person_id}`.toLowerCase().includes(search.toLowerCase()) && (department === "All" || values.department === department) && (status === "All" || values.status === status));
  const close = () => { setSelected(null); setCreating(false); };
  const save = async (values: EmployeeForm) => {
    if (!permissions.edit) throw new Error("HR access is required");
    if (selected?.source === "sample") {
      const updated = { ...selected, values };
      setSamples((previous) => previous.map((record) => record.id === selected.id ? updated : record));
      setSelected(updated); toast.success("Sample updated for this visit. No live records changed."); return;
    }
    let id = selected?.id;
    if (creating) {
      if (!permissions.create) throw new Error("Only administrators can create employees");
      if (!values.email) {
        const { data, error } = await supabase.from("employee_records").insert({ ...folderUpdate(values), email: "" }).select("*").single();
        if (error || !data) throw new Error(error?.message || "Unable to create employee folder");
        setSelected({ ...profileToFolder(data), accountLinked: false }); setCreating(false); setMode("live");
        await fetchEmployees(); toast.success("Employee saved without a sign-in account"); return;
      }
      const { data, error } = await supabase.functions.invoke("invite-user", { body: { email: values.email, role: "employee", first_name: values.first_name, last_name: values.last_name } });
      if (error || data?.error || !data?.user_id) throw new Error(data?.error || "Unable to create employee account. Check the email and try again.");
      id = data.user_id;
    }
    if (!id) throw new Error("Employee record not found");
    const table = selected?.accountLinked === false ? "employee_records" : "profiles";
    const { data, error } = await supabase.from(table).update(folderUpdate(values)).eq("user_id", id).select("*").single();
    if (error || !data) {
      if (creating) { setCreating(false); await fetchEmployees(); close(); throw new Error("Account created, but HR details were not saved. Open the new employee folder and try saving again."); }
      throw new Error(error?.message || "Unable to save employee details");
    }
    setSelected({ ...profileToFolder(data), accountLinked: table === "profiles" }); setCreating(false); setMode("live");
    await fetchEmployees(); toast.success("Employee saved");
  };
  const remove = async (restore: boolean) => {
    if (!permissions.delete || !selected) throw new Error("Only administrators can delete employee folders");
    if (selected.source === "sample") { setSamples((previous) => previous.filter((record) => record.id !== selected.id)); close(); return; }
    const { data, error } = await supabase.from(selected.accountLinked === false ? "employee_records" : "profiles").update({ deleted_at: restore ? null : new Date().toISOString() }).eq("user_id", selected.id).select("user_id").single();
    if (error || !data) throw new Error(error?.message || "Unable to update employee folder");
    close(); await fetchEmployees(); toast.success(restore ? "Employee folder restored" : "Employee folder deleted; history retained");
  };
  return <div className="p-4 md:p-6 max-w-7xl mx-auto space-y-5">
    <div className="flex items-center justify-between flex-wrap gap-3">
      <div><h1 className="text-xl md:text-2xl font-display font-bold text-foreground">Employees</h1><p className="text-sm text-muted-foreground mt-1">{records.length} {mode === "sample" ? "fictional sample records" : mode === "deleted" ? "deleted folders" : "employee folders"}</p></div>
      <div className="flex gap-2 flex-wrap"><Button variant="outline" className="h-11" disabled={loading} onClick={fetchEmployees} title="Refresh employee records"><RefreshCw />Refresh</Button>
        {permissions.create && <><Button variant="secondary" className="h-11" onClick={() => setShowImport(true)}><Upload />Import CSV</Button><Button className="h-11" onClick={() => { setSelected(null); setCreating(true); }}><UserPlus />Add employee</Button></>}
      </div>
    </div>
    <Tabs value={mode} onValueChange={(value) => { setMode(value); setDepartment("All"); setStatus("All"); }}><TabsList className="h-11"><TabsTrigger value="live">Employees</TabsTrigger><TabsTrigger value="sample">Sample company</TabsTrigger>{permissions.delete && <TabsTrigger value="deleted">Deleted folders</TabsTrigger>}</TabsList></Tabs>
    {mode === "sample" && <p className="text-sm text-muted-foreground">Smiley's Tinting Services, Saint Lucia · Fictional staff and salaries · Not linked to live payroll</p>}
    <div className="flex flex-col sm:flex-row gap-3">
      <div className="relative flex-1"><Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><Input className="pl-9 h-11" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, email or employee number" aria-label="Search employees" /></div>
      <select aria-label="Filter department" value={department} onChange={(event) => setDepartment(event.target.value)} className="h-11 rounded-md border border-input bg-background text-foreground text-sm px-3">{departments.map((value) => <option key={value} value={value}>{value === "All" ? "All departments" : value}</option>)}</select>
      <select aria-label="Filter status" value={status} onChange={(event) => setStatus(event.target.value)} className="h-11 rounded-md border border-input bg-background text-foreground text-sm px-3">{["All", "Active", "Inactive", "On Leave"].map((value) => <option key={value} value={value}>{value === "All" ? "All statuses" : value}</option>)}</select>
    </div>
    {error && mode !== "sample" ? <div role="alert" className="py-12 text-center text-destructive">{error}<Button variant="link" onClick={fetchEmployees}>Retry</Button></div> : loading && mode !== "sample" ? <div className="py-12 text-center text-muted-foreground">Loading employee folders…</div> : <div className="border border-border rounded-lg overflow-hidden bg-card">
      <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="border-b border-border bg-secondary/50">{["Employee", "Department", "Job title", "Employee no.", "Monthly salary", "Status", ""].map((heading, index) => <th key={index} className="text-left py-3 px-4 font-medium text-muted-foreground whitespace-nowrap">{heading}</th>)}</tr></thead><tbody>
        {filtered.map((folder) => <tr key={folder.id} className="border-b border-border/50 hover:bg-secondary/30 transition-colors cursor-pointer" onClick={() => setSelected(folder)}>
          <td className="py-3 px-4"><div className="flex items-center gap-3"><div className="w-10 h-10 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-xs">{folder.values.first_name[0]}{folder.values.last_name[0]}</div><div><p className="font-medium text-foreground">{folder.values.first_name} {folder.values.last_name}</p><p className="text-xs text-muted-foreground">{folder.values.email}</p></div></div></td>
          <td className="py-3 px-4">{folder.values.department || "—"}</td><td className="py-3 px-4">{folder.values.job_title || "—"}</td><td className="py-3 px-4 text-muted-foreground">{folder.values.person_id || "—"}</td><td className="py-3 px-4 whitespace-nowrap">{formatCurrency(folder.values.monthly_salary)}</td><td className="py-3 px-4"><Badge variant={folder.values.status === "Active" ? "default" : "secondary"}>{folder.values.status}</Badge></td>
          <td className="py-3 px-4"><Button variant="ghost" size="icon" className="h-11 w-11" aria-label={`Open ${folder.values.first_name} ${folder.values.last_name} folder`} onClick={(event) => { event.stopPropagation(); setSelected(folder); }}><MoreHorizontal /></Button></td>
        </tr>)}
      </tbody></table></div>
      {!filtered.length && <div className="py-14 text-center text-muted-foreground"><Users className="mx-auto mb-3" /><p>{records.length ? "No employees match these filters" : mode === "deleted" ? "No deleted employee folders" : "No employee folders yet"}</p></div>}
    </div>}
    <EmployeeFolderDialog folder={selected} creating={creating} onClose={close} onSave={save} onDelete={remove} permissions={permissions} ownId={user?.id} directory={(mode === "sample" ? samples : live).filter(record => !record.deletedAt)} />
    {permissions.create && <CSVImportDialog open={showImport} onOpenChange={(open) => { setShowImport(open); if (!open) fetchEmployees(); }} type="employees" />}
  </div>;
}
