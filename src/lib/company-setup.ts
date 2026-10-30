import { z } from "zod";
import { WORKSPACE_MODULES } from "./workspace-access";
import { onboardingSchema } from "./company-onboarding";
import type { OnboardingPack } from "../../supabase/functions/_shared/company-templates";

export const COMPANY_FEATURES = [
  { label: "Would you use Payroll and HR?", modules: ["hr", "payroll", "reports", "leave"] },
  { label: "Would you use Time and attendance?", modules: ["attendance"] },
  { label: "Would you sync with QuickBooks?", modules: ["quickbooks"] },
  { label: "Would you use Guards and security?", modules: ["security"] },
  { label: "Would you use Applicant tracking?", modules: ["recruitment"] },
  { label: "Would you use Projects, crews and equipment?", modules: ["field"] },
  { label: "Would you use Contractors and client billing?", modules: ["billing"] },
  { label: "Would you use the Training Hub?", modules: ["training"] },
];

export const companySetupSchema = z.object({
  company_name: z.string().trim().min(2, "Enter the company name").max(160),
  email: z.string().trim().email("Enter the customer's administrator email").max(255),
  telephone: z.string().trim().max(80).default(""),
  address: z.string().trim().max(500).default(""),
  website: z.string().trim().max(255).refine(v => !v || /^https?:\/\//i.test(v), "Use an https:// website address").default(""),
  employer_nic_number: z.string().trim().max(100).default(""),
  tax_id: z.string().trim().max(100).default(""),
  vat_number: z.string().trim().max(100).default(""),
  modules: z.array(z.string().refine(v => WORKSPACE_MODULES.some(m => m.id === v))).max(13).default(["hr", "payroll", "reports", "leave", "settings"]),
  onboarding: onboardingSchema.refine(v => v.reviewed, "Review and confirm the industry defaults before saving").optional(),
});
export type CompanySetup = Omit<z.infer<typeof companySetupSchema>, "onboarding"> & { onboarding?: OnboardingPack };
export const emptyCompanySetup: CompanySetup = { company_name: "", email: "", telephone: "", address: "", website: "", employer_nic_number: "", tax_id: "", vat_number: "", modules: ["hr", "payroll", "reports", "leave", "settings"] };
export function setupToken(hash: string) {
  const token = new URLSearchParams(hash.replace(/^#/, "")).get("invite") ?? "";
  return /^[a-f0-9]{64}$/.test(token) ? token : "";
}
export function companySetupLink(token: string, origin: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("Invalid invitation");
  return `${new URL(origin).origin}/company-setup#invite=${token}`;
}