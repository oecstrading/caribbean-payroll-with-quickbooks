import { useState } from "react";
import { Plus, Trash2, RotateCcw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { NativeSelect } from "@/components/ui/native-select";
import { formatCurrency, type CountryTaxConfig } from "@/lib/payroll-engine";
import { computeEdited, lineAmount, newLineId, type PayEdit, type PayLine, type PayLineKind } from "@/lib/pay-edits";

const kindLabels: Record<PayLineKind, string> = { basic: "Basic / regular pay", overtime: "Overtime", addition: "Addition (bonus, allowance, leave pay…)", deduction: "Deduction (meals, policy, advance…)" };
const quick: { label: string; kind: PayLineKind; nic: boolean }[] = [
  { label: "Bonus", kind: "addition", nic: false }, { label: "Meal allowance", kind: "addition", nic: true }, { label: "Sick leave pay", kind: "addition", nic: true },
  { label: "Vacation pay", kind: "addition", nic: true }, { label: "Commission", kind: "addition", nic: true }, { label: "Wages x1.5", kind: "overtime", nic: true },
  { label: "Wages x2.0", kind: "overtime", nic: true }, { label: "Meal deductions", kind: "deduction", nic: false }, { label: "Policy deduction", kind: "deduction", nic: false },
];

export default function PayEditDialog({ open, name, initial, config, factor, onSave, onReset, onClose }: {
  open: boolean; name: string; initial: PayEdit | null; config: CountryTaxConfig; factor: number;
  onSave: (e: PayEdit) => void; onReset: () => void; onClose: () => void;
}) {
  const [edit, setEdit] = useState<PayEdit | null>(initial);
  if (!edit) return null;
  const result = computeEdited(edit, config, factor);
  const update = (id: string, patch: Partial<PayLine>) => setEdit({ ...edit, lines: edit.lines.map(l => l.id === id ? { ...l, ...patch } : l) });
  const add = (q: { label: string; kind: PayLineKind; nic: boolean }) => setEdit({ ...edit, lines: [...edit.lines, { id: newLineId(), label: q.label, kind: q.kind, qty: null, rate: null, amount: 0, nic: q.nic }] });
  const num = (v: string) => v === "" ? null : Math.max(0, Number(v));
  return <Dialog open={open} onOpenChange={o => !o && onClose()}>
    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
      <DialogHeader><DialogTitle>Edit pay — {name}</DialogTitle>
        <DialogDescription>Correct amounts, add bonuses, allowances or deductions. Enter quantity × rate (days or hours) or just an amount. NIC and net pay recalculate as you type.</DialogDescription></DialogHeader>
      <div className="flex flex-wrap gap-2">{quick.map(q => <Button key={q.label} type="button" size="sm" variant="outline" className={q.kind === "deduction" ? "border-destructive/40 text-destructive" : q.kind === "overtime" ? "border-accent/50" : "border-success/40 text-success"} onClick={() => add(q)}><Plus size={14} className="mr-1" />{q.label}</Button>)}
        <Button type="button" size="sm" variant="outline" onClick={() => add({ label: "", kind: "addition", nic: true })}><Plus size={14} className="mr-1" />Other line</Button></div>
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="text-left text-muted-foreground"><th className="py-1 pr-2">Description</th><th className="pr-2">Type</th><th className="pr-2">Qty</th><th className="pr-2">Rate</th><th className="pr-2">Amount</th><th className="pr-2" title="Counts towards NIC">NIC</th><th /></tr></thead>
        <tbody>{edit.lines.map(l => { const calc = l.qty !== null && l.rate !== null; return <tr key={l.id} className="border-t border-border">
          <td className="py-1 pr-2"><Input aria-label="Description" value={l.label} maxLength={80} disabled={l.locked} onChange={e => update(l.id, { label: e.target.value })} className="min-w-36" /></td>
          <td className="pr-2"><NativeSelect aria-label="Type" value={l.kind} disabled={l.locked} onChange={e => { const kind = e.target.value as PayLineKind; update(l.id, { kind, nic: kind === "deduction" ? false : l.nic }); }}>{(Object.keys(kindLabels) as PayLineKind[]).map(k => <option key={k} value={k}>{kindLabels[k]}</option>)}</NativeSelect></td>
          <td className="pr-2"><Input aria-label="Quantity" type="number" min={0} step="0.25" className="w-20" disabled={l.locked} value={l.qty ?? ""} onChange={e => update(l.id, { qty: num(e.target.value) })} /></td>
          <td className="pr-2"><Input aria-label="Rate" type="number" min={0} step="0.01" className="w-24" disabled={l.locked} value={l.rate ?? ""} onChange={e => update(l.id, { rate: num(e.target.value) })} /></td>
          <td className="pr-2"><Input aria-label="Amount" type="number" min={0} step="0.01" className="w-28" disabled={l.locked || calc} value={calc ? lineAmount(l) : (l.amount || "")} onChange={e => update(l.id, { amount: num(e.target.value) ?? 0 })} /></td>
          <td className="pr-2"><Checkbox aria-label="Counts towards NIC" className="h-4 w-4" checked={l.nic} disabled={l.kind === "deduction"} onCheckedChange={c => update(l.id, { nic: c === true })} /></td>
          <td>{!l.locked && <Button type="button" variant="ghost" size="icon" aria-label="Remove line" onClick={() => setEdit({ ...edit, lines: edit.lines.filter(x => x.id !== l.id) })}><Trash2 size={16} /></Button>}</td>
        </tr>; })}</tbody>
      </table></div>
      <div className="grid sm:grid-cols-2 gap-4 items-end">
        <div className="space-y-2"><Label htmlFor="edit-paye">PAYE income tax</Label>
          <div className="flex gap-2"><Input id="edit-paye" type="number" min={0} step="0.01" placeholder={`Calculated: ${formatCurrency(result.paye)}`} value={edit.paye ?? ""} onChange={e => setEdit({ ...edit, paye: num(e.target.value) })} />
            <Button type="button" variant="outline" onClick={() => setEdit({ ...edit, paye: null })}>Calculate</Button></div>
          <p className="text-xs text-muted-foreground">Leave blank to calculate from the tax tables, or type the amount (0 if no tax).</p></div>
        <div className="rounded-lg border border-border p-3 text-sm space-y-1">
          <div className="flex justify-between"><span>Gross</span><span className="font-mono">{formatCurrency(result.grossMonthly)}</span></div>
          <div className="flex justify-between text-destructive"><span>NIC (employee)</span><span className="font-mono">−{formatCurrency(result.employeeNIC)}</span></div>
          <div className="flex justify-between text-destructive"><span>PAYE</span><span className="font-mono">−{formatCurrency(result.paye)}</span></div>
          <div className="flex justify-between text-destructive"><span>Other deductions</span><span className="font-mono">−{formatCurrency(result.totalCreditorDeductions)}</span></div>
          <div className="flex justify-between font-semibold text-success border-t border-border pt-1"><span>Net pay</span><span className="font-mono">{formatCurrency(result.netPay)}</span></div>
          <p className="text-xs text-muted-foreground">Employer NIC: {formatCurrency(result.employerNIC)}</p>
        </div>
      </div>
      <div className="flex flex-wrap justify-between gap-2">
        <Button type="button" variant="outline" onClick={() => { onReset(); onClose(); }}><RotateCcw size={16} className="mr-2" />Undo my edits</Button>
        <div className="flex gap-2"><Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" disabled={!edit.lines.some(l => l.kind === "basic" || l.kind === "addition" || l.kind === "overtime") || result.netPay < 0} onClick={() => { onSave(edit); onClose(); }}>Save changes</Button></div>
      </div>
    </DialogContent>
  </Dialog>;
}
