import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { reviewedHours, roundTimeUp } from "@/lib/hours-rounding";

export function ReviewedHoursInput({ id, value, onChange, wholeHour, onWholeHourChange }: {
  id: string; value: string; onChange: (value: string) => void;
  wholeHour: boolean; onWholeHourChange: (checked: boolean) => void;
}) {
  const number = Number(value);
  const valid = value.trim() !== "" && Number.isFinite(number) && number >= 0 && number <= 24;
  const payable = valid ? reviewedHours(number, wholeHour) : null;
  return <div className="space-y-3">
    <Label htmlFor={id}>Verified payable hours</Label>
    <Input id={id} required type="number" min="0" max="24" step="any" value={value} onChange={e => onChange(e.target.value)} />
    <div className="flex min-h-11 items-center gap-3">
      <Checkbox id={`${id}-whole`} checked={wholeHour} onCheckedChange={checked => onWholeHourChange(checked === true)} />
      <Label htmlFor={`${id}-whole`} className="leading-relaxed">Round up to the next whole hour{valid ? ` (${Math.ceil(roundTimeUp(number))} hours)` : ""}?</Label>
    </div>
    {payable !== null && <p className="text-sm text-primary" role="status">Hours to save: <strong>{payable.toFixed(2)}</strong> · {roundTimeUp(number * 60).toFixed(2)} minutes worked</p>}
  </div>;
}