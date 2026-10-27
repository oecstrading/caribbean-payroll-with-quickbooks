import { z } from "zod";

export const companySetupSchema = z.object({
  company_name: z.string().trim().min(2, "Enter the company name").max(160),
  email: z.string().trim().email("Enter the customer's administrator email").max(255),
  telephone: z.string().trim().max(80).default(""),
  address: z.string().trim().max(500).default(""),
  website: z.string().trim().max(255).refine(v => !v || /^https?:\/\//i.test(v), "Use an https:// website address").default(""),
  employer_nic_number: z.string().trim().max(100).default(""),
  tax_id: z.string().trim().max(100).default(""),
  vat_number: z.string().trim().max(100).default(""),
});
export type CompanySetup = z.infer<typeof companySetupSchema>;
export const emptyCompanySetup: CompanySetup = { company_name: "", email: "", telephone: "", address: "", website: "", employer_nic_number: "", tax_id: "", vat_number: "" };
export function setupToken(hash: string) {
  const token = new URLSearchParams(hash.replace(/^#/, "")).get("invite") ?? "";
  return /^[a-f0-9]{64}$/.test(token) ? token : "";
}
export function companySetupLink(token: string, origin: string) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("Invalid invitation");
  return `${new URL(origin).origin}/company-setup#invite=${token}`;
}