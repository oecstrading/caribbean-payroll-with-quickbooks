import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { CompanySetup } from "@/lib/company-setup";
import { COMPANY_FEATURES } from "@/lib/company-setup";
import { Checkbox } from "@/components/ui/checkbox";
import CompanyIndustrySetup from "@/components/CompanyIndustrySetup";

// Hints show the expected format only; they are never saved. Users replace them with real details.
const fields: { key: Exclude<keyof CompanySetup, "modules" | "onboarding">; label: string; type?: string; hint: string }[] = [
  { key: "company_name", label: "Company name", hint: "e.g. Example Company Ltd" },
  { key: "email", label: "Customer administrator email", type: "email", hint: "e.g. admin@yourcompany.com" },
  { key: "telephone", label: "Telephone", type: "tel", hint: "e.g. +1 758 000 0000" },
  { key: "website", label: "Website", type: "url", hint: "e.g. https://yourcompany.com" },
  { key: "employer_nic_number", label: "Employer NIC / Social Security number", hint: "e.g. EMP-0001 (from NIC / Social Security office)" },
  { key: "tax_id", label: "Tax ID (TIN)", hint: "e.g. TIN-000000 (Inland Revenue)" },
  { key: "vat_number", label: "VAT number", hint: "e.g. VAT-000000 (leave blank if not registered)" },
  { key: "address", label: "Address", hint: "e.g. Example Street, Castries, Saint Lucia" },
];
export default function CompanySetupFields({ value, onChange, hideEmail = false, emailLocked = false }: { value: CompanySetup; onChange: (value: CompanySetup) => void; hideEmail?: boolean; emailLocked?: boolean }) {
  return <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{fields.filter(f => !hideEmail || f.key !== "email").map(field => <div key={field.key} className={field.key === "address" ? "sm:col-span-2 space-y-2" : "space-y-2"}>
    <Label htmlFor={`company-${field.key}`}>{field.label}</Label>
    <Input id={`company-${field.key}`} type={field.type ?? "text"} placeholder={field.hint} required={field.key === "company_name" || field.key === "email"} disabled={field.key === "email" && emailLocked} maxLength={field.key === "address" ? 500 : 160} value={value[field.key]} onChange={e => onChange({ ...value, [field.key]: e.target.value })} />
  </div>)}<div className="sm:col-span-2"><CompanyIndustrySetup value={value} onChange={onChange} /></div><fieldset className="sm:col-span-2 border-t border-border pt-4 space-y-2"><legend className="font-semibold pt-4">Company features</legend>{COMPANY_FEATURES.map(feature => <label key={feature.label} className="flex items-center gap-3 min-h-11 text-sm cursor-pointer"><Checkbox checked={feature.modules.every(m => value.modules.includes(m))} onCheckedChange={checked => onChange({ ...value, onboarding: value.onboarding ? { ...value.onboarding, reviewed: false } : undefined, modules: [...new Set(["settings", ...value.modules.filter(m => !feature.modules.includes(m)), ...(checked ? feature.modules : [])])] })} />{feature.label}</label>)}</fieldset></div>;
}