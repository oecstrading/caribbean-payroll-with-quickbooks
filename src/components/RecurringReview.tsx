import { AlertTriangle, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RecurringDecision, RecurringItem } from "@/lib/recurring-items";

interface Props {
  items: RecurringItem[];
  names: Record<string, string>;
  factor: number;
  decisions: Record<string, RecurringDecision>;
  disabled?: boolean;
  onChange: (key: string, d: RecurringDecision | null) => void;
}

export default function RecurringReview({ items, names, factor, decisions, disabled, onChange }: Props) {
  const pending = items.filter(i => !decisions[i.key]).length;
  const standard = (i: RecurringItem) => i.kind === "deduction" ? Math.round(i.amount * factor * 100) / 100 : i.amount;
  return (
    <div className={`rounded-lg border p-3 space-y-3 ${pending ? "border-destructive bg-destructive/5" : "border-border"}`}>
      <div role={pending ? "alert" : "status"} className="flex items-start gap-2">
        {pending ? <AlertTriangle className="text-destructive shrink-0" size={18} /> : <Check className="text-primary shrink-0" size={18} />}
        <div>
          <p className={`text-sm font-semibold ${pending ? "text-destructive" : "text-foreground"}`}>
            {pending ? `${pending} recurring addition/deduction${pending > 1 ? "s" : ""} need your decision for this pay period` : "All recurring items reviewed"}
          </p>
          <p className="text-xs text-muted-foreground">Standing items such as travel, housing, commission or meal deductions are added to every payroll. Choose Keep, Edit or Zero for each before approving.</p>
        </div>
      </div>
      <div className="overflow-x-auto"><table className="w-full text-sm">
        <thead><tr className="text-left text-muted-foreground"><th className="py-1 pr-2">Employee</th><th className="pr-2">Item</th><th className="pr-2 text-right">Standard</th><th className="pr-2">This period</th><th>Decision</th></tr></thead>
        <tbody>{items.map(i => {
          const d = decisions[i.key]; const std = standard(i);
          return <tr key={i.key} className={`border-t border-border ${d ? "" : "bg-destructive/10"}`}>
            <td className="py-1 pr-2">{names[i.userId] || "Employee"}</td>
            <td className={`pr-2 capitalize ${d ? "" : "text-destructive font-semibold"}`}>{i.kind === "deduction" ? "− " : "+ "}{i.name}</td>
            <td className="pr-2 text-right">{std.toFixed(2)}</td>
            <td className="pr-2">{d?.action === "edit"
              ? <Input aria-label={`amount for ${i.name}`} type="number" min={0} step="0.01" className="w-28" disabled={disabled} value={d.amount} onChange={e => onChange(i.key, { action: "edit", amount: Math.max(0, Number(e.target.value) || 0) })} />
              : <span className={d ? "" : "text-destructive"}>{d?.action === "zero" ? "0.00" : d ? std.toFixed(2) : "Pending"}</span>}</td>
            <td><div className="flex gap-1">
              <Button size="sm" variant={d?.action === "keep" ? "default" : "outline"} disabled={disabled} onClick={() => onChange(i.key, { action: "keep" })}>Keep</Button>
              <Button size="sm" variant={d?.action === "edit" ? "default" : "outline"} disabled={disabled} onClick={() => onChange(i.key, { action: "edit", amount: std })}>Edit</Button>
              <Button size="sm" variant={d?.action === "zero" ? "destructive" : "outline"} disabled={disabled} onClick={() => onChange(i.key, { action: "zero" })}>Zero</Button>
            </div></td>
          </tr>; })}</tbody>
      </table></div>
      {items.length > 1 && <Button size="sm" variant="ghost" disabled={disabled} onClick={() => items.filter(i => !decisions[i.key]).forEach(i => onChange(i.key, { action: "keep" }))}>Keep all remaining as standard</Button>}
    </div>
  );
}
