import { describe, it, expect } from "vitest";
import { makeOnboardingPack, industryPacks, onboardingTemplates } from "@/lib/company-onboarding";
import { companySetupSchema } from "@/lib/company-setup";
const company = { company_name: "Construction Customer", email: "owner@example.com" };
describe("reviewed industry onboarding", () => {
  it("provides construction departments and project operations without guards or a fabricated QuickBooks connection", () => {
    const pack = makeOnboardingPack("construction");
    expect(pack.departments).toEqual(["Site Operations", "Project Management", "Plant & Equipment", "Administration", "Finance"]);
    expect(industryPacks.construction.modules).toContain("field");
    expect(industryPacks.construction.modules).not.toContain("security");
    expect(industryPacks.construction.modules).not.toContain("quickbooks");
  });
  it("requires human review before a pack can be saved", () => {
    const pack = makeOnboardingPack("construction");
    expect(companySetupSchema.safeParse({ ...company, onboarding: pack }).success).toBe(false);
    expect(companySetupSchema.safeParse({ ...company, onboarding: { ...pack, reviewed: true } }).success).toBe(true);
  });
  it("preserves configurable non-40-hour workweeks", () => {
    const onboarding = { ...makeOnboardingPack("construction"), weekly_hours: 36, reviewed: true };
    expect(companySetupSchema.parse({ ...company, onboarding }).onboarding?.weekly_hours).toBe(36);
  });
  it("rejects arbitrary payroll tax or authority fields in packs", () => {
    expect(companySetupSchema.safeParse({ ...company, onboarding: { ...makeOnboardingPack("construction"), reviewed: true, nic_rate: 0, role: "admin" } }).success).toBe(false);
  });
  it("keeps old company setup compatible without a pack", () => {
    expect(companySetupSchema.parse(company).onboarding).toBeUndefined();
  });
  it("keeps pack edits isolated and generates four editable starter templates", () => {
    const a = makeOnboardingPack("construction"); const b = makeOnboardingPack("construction");
    a.departments.push("Custom department");
    expect(b.departments).toHaveLength(5);
    expect(onboardingTemplates(b)).toHaveLength(4);
  });
});