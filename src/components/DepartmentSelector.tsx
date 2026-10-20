import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";

export default function DepartmentSelector({ departments, selected, onChange, disabled = false }: {
  departments: string[]; selected: string[]; onChange: (departments: string[]) => void; disabled?: boolean;
}) {
  return <fieldset disabled={disabled} className="space-y-2 min-w-0">
    <div className="flex items-center justify-between flex-wrap gap-2">
      <legend className="text-sm font-semibold text-foreground">Departments ({selected.length} / {departments.length})</legend>
      <div className="flex gap-1"><Button size="sm" variant="ghost" disabled={disabled} onClick={() => onChange(departments)}>Select all</Button>
        <Button size="sm" variant="ghost" disabled={disabled} onClick={() => onChange([])}>Clear</Button></div>
    </div>
    <div className="flex flex-wrap gap-x-6 gap-y-2">
      {departments.map(department => <label key={department} className="flex items-center gap-2 min-h-11 text-sm text-foreground cursor-pointer">
        <Checkbox disabled={disabled} checked={selected.includes(department)} onCheckedChange={checked => onChange(checked ? [...selected, department] : selected.filter(d => d !== department))} />
        <span className="break-words">{department}</span>
      </label>)}
    </div>
  </fieldset>;
}