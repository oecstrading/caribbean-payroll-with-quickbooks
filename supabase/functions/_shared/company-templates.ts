export const INDUSTRIES = ["general", "construction", "security", "services"] as const;
export const ONBOARDING_COUNTRIES = ["LC", "AG", "KN", "DM", "GD"] as const;
export const industryPacks = {
  general: { label: "General business", departments: ["Operations", "Administration", "Finance"], modules: ["hr", "payroll", "reports", "leave", "attendance", "training", "settings"] },
  construction: { label: "Construction", departments: ["Site Operations", "Project Management", "Plant & Equipment", "Administration", "Finance"], modules: ["hr", "payroll", "reports", "leave", "attendance", "field", "billing", "training", "settings"] },
  security: { label: "Security services", departments: ["Guard Operations", "Supervision", "Administration", "Finance"], modules: ["hr", "payroll", "reports", "leave", "attendance", "security", "recruitment", "training", "settings"] },
  services: { label: "Professional services", departments: ["Client Services", "Operations", "Administration", "Finance"], modules: ["hr", "payroll", "reports", "leave", "attendance", "field", "training", "settings"] },
};
export const countryTimezones = { LC: "America/St_Lucia", AG: "America/Antigua", KN: "America/St_Kitts", DM: "America/Dominica", GD: "America/Grenada" };
export type OnboardingPack = {
  version: 1; industry: typeof INDUSTRIES[number]; jurisdiction: typeof ONBOARDING_COUNTRIES[number];
  weekly_hours: number; pay_frequency: "weekly" | "semi_monthly" | "monthly";
  departments: string[]; reviewed: boolean; ai_notes: string;
  work_days?: number[]; shift_start?: string; shift_end?: string; break_minutes?: number;
};
export function makeOnboardingPack(industry: OnboardingPack["industry"], jurisdiction: OnboardingPack["jurisdiction"] = "LC"): OnboardingPack {
  return { version: 1, industry, jurisdiction, weekly_hours: 40, pay_frequency: industry === "construction" ? "weekly" : "monthly", departments: [...industryPacks[industry].departments], reviewed: false, ai_notes: "", work_days: [1, 2, 3, 4, 5], shift_start: "08:30", shift_end: "17:30", break_minutes: 60 };
}
export function onboardingTemplates(pack: OnboardingPack) {
  const construction = pack.industry === "construction";
  return [
    { name: "Employee intake", text: `Name:\nDepartment (${pack.departments.join(", ")}):\nJob title:\nPay basis and rate:\nContracted weekly hours (suggested ${pack.weekly_hours}):\nNIC / tax identifier:\nBank details:\nEmergency contact:\nContract and certification expiry:\nLogin email or PIN username:\nAssigned work site:` },
    { name: construction ? "Site induction & safety checklist" : "Workplace induction checklist", text: `Company:\n${construction ? "Project / site:\nSite supervisor:\nPPE issued:\nSafety induction date:\nToolbox talk:\nEquipment operator certificates:\nEmergency assembly point:" : "Work location:\nSupervisor:\nPolicies acknowledged:\nRequired certifications:"}\nExpiry review date:\nEmployee acknowledgement:\nManager sign-off:\nReview against local safety requirements before use.` },
    { name: "Timesheet approval", text: `Employee:\nDepartment:\n${construction ? "Project / cost code:\nSite / crew:" : "Work location:"}\nPay period:\nClock-in / clock-out and location:\nRegular hours:\nOvertime hours:\nMissing punches / corrections:\nSupervisor confirmation:\nPayroll manager approval:\nNever use estimated hours without confirmation.` },
    { name: "Payroll launch checklist", text: `Confirm country and statutory configuration with accountant.\nConfirm ${pack.pay_frequency} pay cycle, pay date and ${pack.weekly_hours}-hour suggested workweek.\nConfirm employee rates, deductions and loan balances.\nCreate departments: ${pack.departments.join(", ")}.\nAssign sites and geofences before enabling clocks.\nConfirm overtime, leave and safety requirements locally.\nReview AI Paymaster exceptions.\nReconcile gross, deductions and net.\nAdministrator approves payroll.\nDownload departmental and consolidated reports.\nConnect QuickBooks and map accounts only if selected.\nVerify payslip and external-accountant recipients before sending.` },
  ];
}