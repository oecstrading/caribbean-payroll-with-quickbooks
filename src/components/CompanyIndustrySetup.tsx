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
import { downloadFile } from "@/lib/download-file";
import { TEMPLATE_FILE, TEMPLATE_NAME } from "@/lib/onboarding-sheet";
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
      <fieldset className="space-y-3 rounded-lg border border-border p-3">
        <legend className="px-1 text-sm font-semibold">Default work schedule</legend>
        <div className="flex flex-wrap gap-2">{["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => { const days = pack.work_days ?? [1, 2, 3, 4, 5]; const on = days.includes(i);
          return <Button key={d} type="button" size="sm" variant={on ? "default" : "outline"} aria-pressed={on} className="min-h-11 min-w-14" onClick={() => change({ work_days: on ? days.filter(x => x !== i) : [...days, i].sort() })}>{d}</Button>; })}</div>
        <div className="grid sm:grid-cols-3 gap-3">
          <div className="space-y-2"><Label htmlFor="company-shift-start">Start time</Label><Input id="company-shift-start" type="time" value={pack.shift_start ?? "08:30"} onChange={e => change({ shift_start: e.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="company-shift-end">End time</Label><Input id="company-shift-end" type="time" value={pack.shift_end ?? "17:30"} onChange={e => change({ shift_end: e.target.value })} /></div>
          <div className="space-y-2"><Label htmlFor="company-break">Unpaid break (minutes)</Label><Input id="company-break" type="number" min={0} max={240} step={5} value={pack.break_minutes ?? 60} onChange={e => change({ break_minutes: Math.max(0, Math.round(Number(e.target.value) || 0)) })} /></div>
        </div>
        <p className="text-xs text-muted-foreground">{(() => { const [sh, sm] = (pack.shift_start ?? "08:30").split(":").map(Number); const [eh, em] = (pack.shift_end ?? "17:30").split(":").map(Number); let mins = eh * 60 + em - (sh * 60 + sm); if (mins <= 0) mins += 1440; const h = Math.max(0, mins - (pack.break_minutes ?? 60)) / 60; const n = (pack.work_days ?? [1, 2, 3, 4, 5]).length; return `${Math.round(h * 100) / 100} paid hours a day × ${n} days = ${Math.round(h * n * 100) / 100} hours a week. New staff clocks start with this schedule.`; })()}</p>
        {(() => { const [sh, sm] = (pack.shift_start ?? "08:30").split(":").map(Number); const [eh, em] = (pack.shift_end ?? "17:30").split(":").map(Number); let mins = eh * 60 + em - (sh * 60 + sm); if (mins <= 0) mins += 1440; const weekly = Math.round(Math.max(0, mins - (pack.break_minutes ?? 60)) / 60 * (pack.work_days ?? [1, 2, 3, 4, 5]).length * 100) / 100;
          return weekly >= 1 && weekly <= 80 && weekly !== pack.weekly_hours ? <Button type="button" variant="outline" size="sm" onClick={() => change({ weekly_hours: weekly })}>Set weekly hours to {weekly}</Button> : null; })()}
      </fieldset>
      <div className="space-y-2"><Label htmlFor="company-departments">Department templates (one per line)</Label><Textarea id="company-departments" value={pack.departments.join("\n")} onChange={e => change({ departments: e.target.value.split("\n") })} /></div>
      <div className="flex flex-wrap gap-2">{onboardingTemplates(pack).map(t => <Button key={t.name} type="button" variant="outline" size="sm" onClick={() => {
        const url = URL.createObjectURL(new Blob([t.text], { type: "text/plain" })); const a = document.createElement("a"); a.href = url; a.download = `${pack.industry}-${t.name.toLowerCase().replace(/ /g, "-")}.txt`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
      }}><Download size={14} className="mr-2" />{t.name}</Button>)}
        <Button type="button" variant="outline" size="sm" onClick={() => void downloadFile(TEMPLATE_FILE, TEMPLATE_NAME)}><Download size={14} className="mr-2" />Payroll onboarding template (Excel)</Button>
      </div>
      <Button type="button" variant="outline" disabled={busy} onClick={() => void recommend()}><Sparkles size={16} className="mr-2" />{busy ? "Preparing recommendations…" : "AI onboarding review"}</Button>
      {pack.ai_notes && <div className="whitespace-pre-wrap text-sm border-l-4 border-primary pl-4">{pack.ai_notes}</div>}
      <p className="text-sm text-muted-foreground">Suggested starting points, not certified legal standards. Confirm local taxes, overtime, safety requirements and pay dates with your accountant. No employees, rates, sites or QuickBooks connections are invented.</p>
      <label className="flex items-start gap-3 text-sm"><Checkbox checked={pack.reviewed} onCheckedChange={checked => onChange({ ...value, onboarding: { ...pack, reviewed: checked === true } })} /><span>I reviewed these defaults and selected features. For a new company, initialize the time zone and weekly overtime threshold; attendance payroll remains off. Existing clock and payroll settings are preserved.</span></label>
    </>}
  </section>;
}