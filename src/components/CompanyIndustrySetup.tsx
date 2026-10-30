import { useState } from "react";
import { HardHat, Sparkles, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { type CompanySetup } from "@/lib/company-setup";
import { industryPacks, makeOnboardingPack, onboardingTemplates, ONBOARDING_COUNTRIES } from "@/lib/company-onboarding";
import { companyAction } from "@/lib/company-api";
import { toast } from "sonner";

export default function CompanyIndustrySetup({ value, onChange }: { value: CompanySetup; onChange: (v: CompanySetup) => void }) {
  const [busy, setBusy] = useState(false);
  const pack = value.onboarding;
  const change = (patch: Partial<NonNullable<CompanySetup["onboarding"]>>) => { if (pack) onChange({ ...value, onboarding: { ...pack, ...patch, reviewed: false } }); };
  async function recommend() {
    if (!pack) return;
    setBusy(true);
    try {
      const token = new URLSearchParams(window.location.hash.slice(1)).get("invite") || sessionStorage.getItem("company-setup-invite");
      const data = await companyAction({ action: "recommend", token, industry: pack.industry, jurisdiction: pack.jurisdiction, weekly_hours: pack.weekly_hours, pay_frequency: pack.pay_frequency });
      change({ ai_notes: data.review });
    } catch (err) { toast.error(err instanceof Error ? err.message : "AI recommendations unavailable; your template is retained."); }
    finally { setBusy(false); }
  }
  return <section className="space-y-4 border-t border-border pt-5">
    <div className="carib-sea text-primary-foreground rounded-lg p-4 flex items-center gap-3"><HardHat size={24} /><h3 className="font-display font-semibold">Industry onboarding pack</h3></div>
    <div className="space-y-2"><Label htmlFor="company-industry">Industry template</Label><NativeSelect id="company-industry" value={pack?.industry ?? ""} onChange={e => {
      const industry = e.target.value;
      if (!industry) { onChange({ ...value, onboarding: undefined }); return; }
      if (industry in industryPacks) {
        const next = makeOnboardingPack(industry as keyof typeof industryPacks, pack?.jurisdiction);
        onChange({ ...value, onboarding: next, modules: [...industryPacks[next.industry].modules] });
      }
    }}><option value="">No industry pack — keep existing settings</option>{Object.entries(industryPacks).map(([id, p]) => <option key={id} value={id}>{p.label}</option>)}</NativeSelect></div>
    {pack && <>
      <div className="grid sm:grid-cols-3 gap-3">
        <div className="space-y-2"><Label htmlFor="company-country">Payroll country</Label><NativeSelect id="company-country" value={pack.jurisdiction} onChange={e => change({ jurisdiction: e.target.value as typeof pack.jurisdiction })}>{ONBOARDING_COUNTRIES.map(c => <option key={c} value={c}>{{ LC: "Saint Lucia", AG: "Antigua & Barbuda", KN: "Saint Kitts & Nevis", DM: "Dominica", GD: "Grenada" }[c]}</option>)}</NativeSelect></div>
        <div className="space-y-2"><Label htmlFor="company-frequency">Suggested pay cycle</Label><NativeSelect id="company-frequency" value={pack.pay_frequency} onChange={e => change({ pay_frequency: e.target.value as typeof pack.pay_frequency })}><option value="weekly">Weekly</option><option value="semi_monthly">Semi-monthly</option><option value="monthly">Monthly</option></NativeSelect></div>
        <div className="space-y-2"><Label htmlFor="company-hours">Weekly hours</Label><Input id="company-hours" type="number" min={1} max={80} value={pack.weekly_hours} onChange={e => change({ weekly_hours: Number(e.target.value) })} /></div>
      </div>
      <div className="space-y-2"><Label htmlFor="company-departments">Department templates (one per line)</Label><Textarea id="company-departments" value={pack.departments.join("\n")} onChange={e => change({ departments: e.target.value.split("\n") })} /></div>
      <div className="flex flex-wrap gap-2">{onboardingTemplates(pack).map(t => <Button key={t.name} type="button" variant="outline" size="sm" onClick={() => {
        const url = URL.createObjectURL(new Blob([t.text], { type: "text/plain" })); const a = document.createElement("a"); a.href = url; a.download = `${pack.industry}-${t.name.toLowerCase().replaceAll(" ", "-")}.txt`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}><Download size={14} className="mr-2" />{t.name}</Button>)}</div>
      <Button type="button" variant="outline" disabled={busy} onClick={() => void recommend()}><Sparkles size={16} className="mr-2" />{busy ? "Preparing recommendations…" : "AI onboarding review"}</Button>
      {pack.ai_notes && <div className="whitespace-pre-wrap text-sm border-l-4 border-primary pl-4">{pack.ai_notes}</div>}
      <p className="text-sm text-muted-foreground">Suggested starting points, not certified legal standards. Confirm local taxes, overtime, safety requirements and pay dates with your accountant. No employees, rates, sites or QuickBooks connections are invented.</p>
      <label className="flex items-start gap-3 text-sm"><Checkbox checked={pack.reviewed} onCheckedChange={checked => onChange({ ...value, onboarding: { ...pack, reviewed: checked === true } })} /><span>I reviewed these defaults and selected features. For a new company, initialize the time zone and weekly overtime threshold; attendance payroll remains off. Existing clock and payroll settings are preserved.</span></label>
    </>}
  </section>;
}