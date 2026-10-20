import { NativeSelect } from "@/components/ui/native-select";
import { useEffect, useState } from "react";
import { Save, Pencil, FileText, Trash2, RotateCcw, User, Briefcase, Wallet, Heart, StickyNote } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel, AlertDialogAction } from "@/components/ui/alert-dialog";
import { employeeFolderSchema, emptyEmployee, payBases, rateLabels, effectiveMonthlySalary, type EmployeeFolder, type EmployeeForm } from "@/lib/employee-folder";
import { calculatePayroll, ST_LUCIA_CONFIG, formatCurrency } from "@/lib/payroll-engine";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";
import EmployeeDocuments from "@/components/EmployeeDocuments";
import { ValuePicker } from "@/components/ui/value-picker";

type Field = { key: keyof EmployeeForm; label: string; type?: string; options?: string[]; wide?: boolean };
const sections: { id: string; label: string; icon: typeof User; fields: Field[] }[] = [
  { id: "personal", label: "Personal", icon: User, fields: [
    { key: "first_name", label: "First name *" }, { key: "last_name", label: "Last name *" },
    { key: "email", label: "Work email (optional)", type: "email" }, { key: "phone", label: "Phone", type: "tel" },
    { key: "date_of_birth", label: "Date of birth", type: "date" }, { key: "gender", label: "Gender", options: ["Female", "Male", "Non-binary", "Prefer not to say"] },
    { key: "marital_status", label: "Marital status", options: ["Single", "Married", "Divorced", "Widowed", "Prefer not to say"] }, { key: "nationality", label: "Nationality" },
    { key: "personal_email", label: "Personal email", type: "email" }, { key: "address", label: "Residential address", wide: true }, { key: "city", label: "City / district" }, { key: "country", label: "Country" },
  ] },
  { id: "employment", label: "Employment", icon: Briefcase, fields: [
    { key: "person_id", label: "Employee number" }, { key: "status", label: "Employment status", options: ["Active", "Inactive", "On Leave"] },
    { key: "department", label: "Department" }, { key: "job_title", label: "Job title" },
    { key: "employment_type", label: "Employment type", options: ["Full-time", "Part-time", "Contract", "Temporary", "Intern"] },
    { key: "start_date", label: "Start date", type: "date" }, { key: "supervisor", label: "Reporting manager" }, { key: "work_location", label: "Work location" },
    { key: "probation_end", label: "Probation end", type: "date" }, { key: "contract_end", label: "Contract end", type: "date" },
    { key: "termination_date", label: "Termination date", type: "date" }, { key: "termination_reason", label: "Termination reason", wide: true },
  ] },
  { id: "payroll", label: "Payroll", icon: Wallet, fields: [
    { key: "jurisdiction", label: "Payroll jurisdiction", options: ["LC", "AG", "KN", "DM", "GD", "VC"] },
    { key: "pay_frequency", label: "How the employee is paid", options: [...payBases] }, { key: "pay_rate", label: "Pay rate", type: "number" },
    { key: "monthly_salary", label: "Monthly salary", type: "number" },
    { key: "nic_number", label: "NIC / social insurance number" }, { key: "tan_number", label: "Tax account number" },
    { key: "schedule", label: "Work schedule" }, { key: "std_hours_per_day", label: "Standard daily hours" }, { key: "weekly_hours", label: "Hours per work week" }, { key: "ot_rate", label: "Overtime multiplier", type: "number" },
  ] },
  { id: "emergency", label: "Emergency", icon: Heart, fields: [
    { key: "emergency_name", label: "Emergency contact name" }, { key: "emergency_relationship", label: "Relationship" }, { key: "emergency_phone", label: "Emergency phone", type: "tel" },
  ] },
  { id: "notes", label: "Notes", icon: StickyNote, fields: [{ key: "notes", label: "Confidential HR notes", type: "textarea", wide: true }] },
];

export default function EmployeeFolderDialog({ folder, creating, onClose, onSave, onDelete, permissions, ownId, directory = [] }: {
  folder: EmployeeFolder | null; creating: boolean; onClose: () => void;
  onSave: (values: EmployeeForm) => Promise<void>; onDelete: (restore: boolean) => Promise<void>;
  permissions: { edit: boolean; create: boolean; delete: boolean }; ownId?: string;
  directory?: EmployeeFolder[];
}) {
  const [values, setValues] = useState<EmployeeForm>(emptyEmployee);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [tab, setTab] = useState("personal");
  const navigate = useNavigate();
  useEffect(() => { setValues(folder?.values || { ...emptyEmployee }); setEditing(creating); setErrors({}); }, [folder, creating]);
  useEffect(() => { setTab("personal"); }, [folder?.id, creating]);
  const save = async () => {
    const parsed = employeeFolderSchema.safeParse(values);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) next[String(issue.path[0])] = issue.message;
      setErrors(next);
      const section = sections.find((section) => section.fields.some((field) => next[field.key]));
      if (section) setTab(section.id);
      return;
    }
    setBusy(true);
    try { await onSave(parsed.data); setEditing(false); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to save employee"); } finally { setBusy(false); }
  };
  const remove = async (restore: boolean) => {
    setBusy(true);
    try { await onDelete(restore); setConfirmDelete(false); } catch (error) { toast.error(error instanceof Error ? error.message : "Unable to update folder"); } finally { setBusy(false); }
  };
  const preview = calculatePayroll(effectiveMonthlySalary(values), ST_LUCIA_CONFIG);
  const pickerOptions: Partial<Record<keyof EmployeeForm, string[]>> = {
    department: ["Administration", "Accounts / Finance", "Human Resources", "Operations", "Sales", "Customer Service", "Installation", "Tinting", "Security", "Maintenance", "Logistics", "IT", ...directory.map(record => record.values.department)],
    job_title: ["Managing Director", "General Manager", "Supervisor", "Team Lead", "Accountant", "Accounts Clerk", "HR Officer", "Administrative Assistant", "Receptionist", "Sales Representative", "Customer Service Representative", "Technician", "Installer", "Driver", "Security Officer", "Cleaner", "Apprentice", ...directory.map(record => record.values.job_title)],
    supervisor: [...directory.map(record => record.values.supervisor), ...directory.filter(record => record.id !== folder?.id && record.values.status === "Active").map(record => `${record.values.first_name} ${record.values.last_name}`)],
    work_location: ["Head Office", "Main Branch", "Workshop", "Warehouse", "Client Site", "Remote", "Field / Mobile", ...directory.map(record => record.values.work_location)],
    country: ["Saint Lucia", "Antigua and Barbuda", "Saint Kitts and Nevis", "Dominica", "Grenada", "Saint Vincent and the Grenadines", "Barbados", "Trinidad and Tobago", "Jamaica", "Guyana", "Belize", "The Bahamas", "Haiti", "Dominican Republic", "Cuba", "Suriname", ...directory.map(record => record.values.country)],
    nationality: ["Saint Lucian", "Antiguan", "Kittitian / Nevisian", "Dominican", "Grenadian", "Vincentian", "Barbadian", "Trinidadian", "Jamaican", "Guyanese", ...directory.map(record => record.values.nationality)],
    city: ["Castries", "Gros Islet", "Rodney Bay", "Babonneau", "Dennery", "Micoud", "Vieux Fort", "Laborie", "Choiseul", "Soufrière", "Canaries", "Anse La Raye", "St. John's", "Basseterre", "Roseau", "St. George's", "Kingstown", ...directory.map(record => record.values.city)],
    schedule: ["Mon–Fri, 8am–4pm", "Mon–Fri, 8am–5pm", "Mon–Fri, 9am–5pm", "Mon–Sat", "Rotating shifts", "Day shift (12 hours)", "Night shift (12 hours)", "Part-time", "Flexible", ...directory.map(record => record.values.schedule)],
    std_hours_per_day: ["4", "6", "7", "7.5", "8", "9", "10", "12"],
    weekly_hours: ["40", "37.5", "36", "35", "32", "30", "24", "20", "45", "48"],
    emergency_relationship: ["Spouse", "Partner", "Parent", "Child", "Sibling", "Friend", "Other", ...directory.map(record => record.values.emergency_relationship)],
  };
  return <>
    <Dialog open={creating || Boolean(folder)} onOpenChange={(open) => { if (!open && !busy) onClose(); }}>
      <DialogContent className="sm:max-w-3xl max-h-[90dvh] flex flex-col overflow-hidden p-0 gap-0">
        <DialogHeader className="px-6 pt-6 pb-4 border-b border-border">
          <DialogTitle className="font-display flex items-center gap-3 pr-6">
            <span className="w-11 h-11 shrink-0 rounded-full bg-primary/10 text-primary flex items-center justify-center text-sm">{creating ? <User size={20} /> : `${values.first_name[0] || ""}${values.last_name[0] || ""}`}</span>
            <span className="min-w-0 break-words">{creating ? "Add employee" : `${folder?.values.first_name} ${folder?.values.last_name}`}</span>
          </DialogTitle>
          <DialogDescription>{creating ? "New employee folder · Email is optional; without email, no sign-in account is created" : folder?.source === "sample" ? "Fictional sample • Changes last for this visit only" : folder?.deletedAt ? "Deleted folder • Historical records retained; sign-in access unchanged" : `${values.job_title || "Employee folder"} · ${values.department || "Unassigned department"}`}</DialogDescription>
        </DialogHeader>
        <Tabs value={tab} onValueChange={setTab} className="flex-1 overflow-y-auto">
          <div className="px-4 sm:px-6 pt-4 overflow-x-auto">
            <TabsList className="w-full min-w-[590px] grid grid-cols-6 h-11">{sections.map((section) => <TabsTrigger key={section.id} value={section.id} className="gap-1.5"><section.icon size={14} /><span>{section.label}</span></TabsTrigger>)}<TabsTrigger value="documents" className="gap-1.5"><FileText size={14} />Documents</TabsTrigger></TabsList>
          </div>
          {sections.map((section) => <TabsContent key={section.id} value={section.id} className="px-6 pb-6 pt-3 mt-0">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-5 gap-y-4">{section.fields.map((field) => {
              const computed = field.key === "monthly_salary" && Boolean(values.pay_frequency && values.pay_rate);
              const disabled = !editing || (field.key === "email" && !creating) || computed || (field.key === "pay_rate" && !values.pay_frequency);
              const label = field.key === "pay_rate" ? `${rateLabels[values.pay_frequency] || "Pay rate"} (XCD)` : computed ? "Monthly equivalent (calculated)" : field.label;
              return <div key={field.key} className={field.wide ? "sm:col-span-2 space-y-1.5" : "space-y-1.5"}>
                <Label htmlFor={`hr-${field.key}`} className="text-xs text-muted-foreground">{label}</Label>
                {field.options ? <NativeSelect id={`hr-${field.key}`} value={String(values[field.key])} disabled={disabled} onChange={(event) => setValues({ ...values, [field.key]: event.target.value })} className="w-full h-11 rounded-md border border-input bg-background px-3 text-sm text-foreground disabled:opacity-70 focus:outline-none focus:ring-2 focus:ring-ring"><option value="">Not specified</option>{field.options.map((option) => <option key={option}>{option}</option>)}</NativeSelect>
                  : pickerOptions[field.key] ? <ValuePicker id={`hr-${field.key}`} label={field.label} value={String(values[field.key])} options={pickerOptions[field.key] || []} disabled={disabled} invalid={Boolean(errors[field.key])} onChange={value => setValues({ ...values, [field.key]: value })} />
                  : field.type === "textarea" ? <Textarea id={`hr-${field.key}`} value={String(values[field.key])} disabled={disabled} maxLength={2000} rows={7} onChange={(event) => setValues({ ...values, [field.key]: event.target.value })} />
                  : <Input id={`hr-${field.key}`} type={field.type || "text"} className="h-11" value={computed ? effectiveMonthlySalary(values) : values[field.key]} disabled={disabled} min={field.type === "number" ? 0 : undefined} step={field.type === "number" ? "0.01" : undefined} maxLength={field.key === "email" ? 255 : field.wide ? 500 : field.type === "tel" ? 40 : 100} onChange={(event) => setValues({ ...values, [field.key]: event.target.value })} aria-invalid={Boolean(errors[field.key])} />}
                {errors[field.key] && <p role="alert" className="text-xs text-destructive">{errors[field.key]}</p>}
                {field.key === "pay_rate" && values.pay_frequency === "Hourly" && <p className="text-xs text-muted-foreground">Monthly pay uses standard daily hours × 260 working days ÷ 12.</p>}
                {field.key === "pay_rate" && !values.pay_frequency && editing && <p className="text-xs text-muted-foreground">Choose how the employee is paid first.</p>}
                {field.key === "email" && !creating && editing && <p className="text-xs text-muted-foreground">Account email is managed separately from HR details.</p>}
              </div>;
            })}</div>
            {section.id === "payroll" && values.jurisdiction === "LC" && <div className="mt-6 border-t border-border pt-4">
              <p className="text-xs text-muted-foreground mb-3">Estimated monthly pay · XCD · Before additional allowances or deductions</p>
              <div className="grid grid-cols-3 gap-3 text-center">{[["Gross", preview.grossMonthly], ["Deductions", preview.totalDeductions], ["Net pay", preview.netPay]].map(([label, amount]) => <div key={String(label)} className="bg-secondary rounded-md px-2 py-3"><p className="text-xs text-muted-foreground">{label}</p><p className="font-semibold text-sm sm:text-base text-foreground break-all">{formatCurrency(Number(amount))}</p></div>)}</div>
            </div>}
          </TabsContent>)}
          <TabsContent value="documents" className="px-6 pb-6 pt-4 mt-0">{folder?.source === "live" ? <EmployeeDocuments employeeKey={folder.id} canManage={permissions.edit && !folder.deletedAt} accountLinked={folder.accountLinked !== false} /> : <p className="text-sm text-muted-foreground">{creating ? "Save the employee folder before adding documents." : "Documents are available for live employee folders only."}</p>}</TabsContent>
        </Tabs>
        <div className="border-t border-border p-4 sm:px-6 flex flex-wrap gap-2 justify-between bg-background">
          <div className="flex gap-2">
            {folder && permissions.delete && folder.id !== ownId && !editing && <Button className="h-11" variant={folder.deletedAt ? "secondary" : "ghost"} disabled={busy} onClick={() => folder.deletedAt ? remove(true) : setConfirmDelete(true)}>{folder.deletedAt ? <RotateCcw /> : <Trash2 />} {folder.deletedAt ? "Restore" : "Delete"}</Button>}
            {folder?.source === "live" && !folder.deletedAt && !editing && <Button className="h-11" variant="outline" onClick={() => { onClose(); navigate(`/reports`); }}><FileText />Payroll reports</Button>}
          </div>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" className="h-11" disabled={busy} onClick={() => { if (editing && folder && !creating) { setValues(folder.values); setErrors({}); setEditing(false); } else onClose(); }}>{editing ? "Cancel" : "Close"}</Button>
            {editing ? <Button className="h-11" disabled={busy} onClick={save}><Save />{busy ? "Saving…" : creating ? "Create employee" : "Save changes"}</Button>
              : permissions.edit && !folder?.deletedAt && <Button className="h-11" onClick={() => setEditing(true)}><Pencil />Edit employee</Button>}
          </div>
        </div>
      </DialogContent>
    </Dialog>
    <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
      <AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Delete this employee folder?</AlertDialogTitle><AlertDialogDescription>{folder?.source === "sample" ? "This removes the fictional record for this visit only." : "The folder will move to Deleted folders and can be restored. Payroll history is retained. This does not delete the sign-in account or revoke access."}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel><AlertDialogAction disabled={busy} onClick={(event) => { event.preventDefault(); remove(false); }}>Delete folder</AlertDialogAction></AlertDialogFooter></AlertDialogContent>
    </AlertDialog>
  </>;
}