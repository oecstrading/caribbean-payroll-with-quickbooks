import { useState } from "react";
import { Plus, Trash2, Edit2, Layers } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { NativeSelect } from "@/components/ui/native-select";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export interface PayItemTemplate {
  id: string; kind: "deduction" | "addition"; name: string; creditor_id: string | null;
  addition_type: string | null; amount: number; frequency: string; notes: string | null;
}

const blank = { kind: "deduction" as "deduction" | "addition", name: "", creditor_id: "", addition_type: "allowance", amount: 0, frequency: "monthly", notes: "" };

export default function PayItemTemplates({ templates, creditors, additionTypes, onChanged, inputClass }: {
  templates: PayItemTemplate[]; creditors: { id: string; name: string; is_active: boolean }[];
  additionTypes: { value: string; label: string }[]; onChanged: () => void; inputClass: string;
}) {
  const [open, setOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState(blank);
  const [saving, setSaving] = useState(false);

  const save = async () => {
    if (!form.name.trim() || form.amount <= 0) { toast.error("Name and amount are required"); return; }
    setSaving(true);
    const row = {
      kind: form.kind, name: form.name.trim(), amount: form.amount, frequency: form.frequency, notes: form.notes || null,
      creditor_id: form.kind === "deduction" ? form.creditor_id || null : null,
      addition_type: form.kind === "addition" ? form.addition_type : null,
    };
    const { error } = editId
      ? await supabase.from("pay_item_templates").update(row).eq("id", editId)
      : await supabase.from("pay_item_templates").insert(row);
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(editId ? "Template updated" : "Template saved");
    setOpen(false); setEditId(null); setForm(blank); onChanged();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this template? Employees already given it keep their lines.")) return;
    const { error } = await supabase.from("pay_item_templates").delete().eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Template deleted"); onChanged(); }
  };

  const label = "text-xs font-medium text-muted-foreground uppercase tracking-wide";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Save deductions and additions once, without an employee. Pick them later when adding a line for anyone.</p>
        <button onClick={() => { setEditId(null); setForm(blank); setOpen(true); }} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90">
          <Plus size={16} />New template
        </button>
      </div>
      <Card className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead><tr className="border-b border-border text-left text-xs text-muted-foreground uppercase">
            <th className="p-3">Name</th><th className="p-3">Kind</th><th className="p-3">Details</th><th className="p-3">Amount</th><th className="p-3">Frequency</th><th className="p-3"></th>
          </tr></thead>
          <tbody>
            {templates.length === 0 ? (
              <tr><td colSpan={6} className="p-6 text-center text-muted-foreground">No templates yet.</td></tr>
            ) : templates.map(t => (
              <tr key={t.id} className="border-b border-border/50">
                <td className="p-3 font-medium">{t.name}</td>
                <td className="p-3"><Badge variant="secondary">{t.kind === "deduction" ? "Deduction" : "Addition"}</Badge></td>
                <td className="p-3 text-muted-foreground">{t.kind === "deduction" ? creditors.find(c => c.id === t.creditor_id)?.name || "No creditor" : additionTypes.find(a => a.value === t.addition_type)?.label || t.addition_type}</td>
                <td className="p-3">XCD {Number(t.amount).toFixed(2)}</td>
                <td className="p-3">{t.frequency}</td>
                <td className="p-3"><div className="flex gap-1 justify-end">
                  <button aria-label="Edit template" onClick={() => { setEditId(t.id); setForm({ kind: t.kind, name: t.name, creditor_id: t.creditor_id || "", addition_type: t.addition_type || "allowance", amount: Number(t.amount), frequency: t.frequency, notes: t.notes || "" }); setOpen(true); }} className="p-1.5 rounded-md hover:bg-secondary"><Edit2 size={14} className="text-primary" /></button>
                  <button aria-label="Delete template" onClick={() => remove(t.id)} className="p-1.5 rounded-md hover:bg-secondary"><Trash2 size={14} className="text-destructive" /></button>
                </div></td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle className="font-display flex items-center gap-2"><Layers size={18} className="text-primary" />{editId ? "Edit template" : "New template"}</DialogTitle></DialogHeader>
          <div className="space-y-4 mt-2">
            <div className="space-y-1.5"><label className={label}>Kind</label>
              <NativeSelect value={form.kind} onChange={e => setForm({ ...form, kind: e.target.value as any })} className={inputClass}>
                <option value="deduction">Deduction</option><option value="addition">Addition</option>
              </NativeSelect></div>
            <div className="space-y-1.5"><label className={label}>Name</label>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Union dues" className={inputClass} /></div>
            {form.kind === "deduction" ? (
              <div className="space-y-1.5"><label className={label}>Creditor (optional)</label>
                <NativeSelect value={form.creditor_id} onChange={e => setForm({ ...form, creditor_id: e.target.value })} className={inputClass}>
                  <option value="">Choose when assigning</option>
                  {creditors.filter(c => c.is_active).map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </NativeSelect></div>
            ) : (
              <div className="space-y-1.5"><label className={label}>Type</label>
                <NativeSelect value={form.addition_type} onChange={e => setForm({ ...form, addition_type: e.target.value })} className={inputClass}>
                  {additionTypes.map(a => <option key={a.value} value={a.value}>{a.label}</option>)}
                </NativeSelect></div>
            )}
            <div className="space-y-1.5"><label className={label}>Amount (XCD)</label>
              <input type="number" step="0.01" value={form.amount || ""} onChange={e => setForm({ ...form, amount: Number(e.target.value) })} placeholder="0.00" className={inputClass} /></div>
            <div className="space-y-1.5"><label className={label}>Frequency</label>
              <NativeSelect value={form.frequency} onChange={e => setForm({ ...form, frequency: e.target.value })} className={inputClass}>
                <option value="one-time">One-Time</option><option value="monthly">Monthly (Recurring)</option>
                <option value="semi-monthly">Semi-Monthly (Recurring)</option><option value="bi-weekly">Bi-Weekly (Recurring)</option>
                <option value="weekly">Weekly (Recurring)</option>
              </NativeSelect></div>
            <div className="space-y-1.5"><label className={label}>Notes (optional)</label>
              <input value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} className={inputClass} /></div>
            <button onClick={save} disabled={saving} className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50">{saving ? "Saving..." : "Save template"}</button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
