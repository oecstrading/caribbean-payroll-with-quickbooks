import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CompanySetup } from "@/lib/company-setup";
import { COMPANY_FEATURES } from "@/lib/company-setup";
import { Checkbox } from "@/components/ui/checkbox";

const fields: { key: Exclude<keyof CompanySetup, "modules">; label: string; type?: string }[] = [
  { key: "company_name", label: "Company name" },
  { key: "email", label: "Customer administrator email", type: "email" },
  { key: "telephone", label: "Telephone", type: "tel" },
  { key: "website", label: "Website", type: "url" },
  { key: "employer_nic_number", label: "Employer NIC number" },
  { key: "tax_id", label: "Tax ID" },
  { key: "vat_number", label: "VAT number" },
  { key: "address", label: "Address" },
];
export default function CompanySetupFields({ value, onChange, hideEmail = false, emailLocked = false }: { value: CompanySetup; onChange: (value: CompanySetup) => void; hideEmail?: boolean; emailLocked?: boolean }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{fields.filter(f => !hideEmail || f.key !== "email").map(field => <div key={field.key} className={field.key === "address" ? "sm:col-span-2 space-y-2" : "space-y-2"}>
    <Label htmlFor={`company-${field.key}`}>{field.label}</Label>
    <Input id={`company-${field.key}`} type={field.type ?? "text"} required={field.key === "company_name" || field.key === "email"} disabled={field.key === "email" && emailLocked} maxLength={field.key === "address" ? 500 : 160} value={value[field.key]} onChange={e => onChange({ ...value, [field.key]: e.target.value })} />
  </div>)}<fieldset className="sm:col-span-2 border-t border-border pt-4 space-y-2"><legend className="font-semibold pt-4">Company features</legend>{COMPANY_FEATURES.map(feature => <label key={feature.label} className="flex items-center gap-3 min-h-11 text-sm cursor-pointer"><Checkbox checked={feature.modules.every(m => value.modules.includes(m))} onCheckedChange={checked => onChange({ ...value, modules: [...new Set(["settings", ...value.modules.filter(m => !feature.modules.includes(m)), ...(checked ? feature.modules : [])])] })} />{feature.label}</label>)}</fieldset></div>;
}