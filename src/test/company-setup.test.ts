import { describe, it, expect } from "vitest";
import { companySetupSchema, companySetupLink, setupToken } from "@/lib/company-setup";

describe("company onboarding inputs", () => {
  it("preserves selected company features", () => {
    const result = companySetupSchema.parse({ company_name: "Smiley", email: "owner@example.com", modules: ["hr", "payroll", "reports", "leave", "attendance", "quickbooks", "settings"] });
    expect(result.modules).toEqual(["hr", "payroll", "reports", "leave", "attendance", "quickbooks", "settings"]);
  });
  it("rejects unknown company features", () => {
    expect(companySetupSchema.safeParse({ company_name: "Smiley", email: "owner@example.com", modules: ["superpowers"] }).success).toBe(false);
  });
  it("requires a real administrator email", () => {
    expect(companySetupSchema.safeParse({ company_name: "New company", email: "customer" }).success).toBe(false);
  });
  it("rejects executable website addresses", () => {
    expect(companySetupSchema.safeParse({ company_name: "New company", email: "owner@example.com", website: "javascript:alert(1)" }).success).toBe(false);
  });
  it("keeps the high entropy invitation out of query strings", () => {
    const url = new URL(companySetupLink("a".repeat(64), "https://example.com"));
    expect(url.search).toBe("");
    expect(setupToken(url.hash)).toBe("a".repeat(64));
  });
  it("rejects malformed invitation tokens", () => {
    expect(setupToken("#invite=123456")).toBe("");
  });
});
import { describe as d2, it as i2, expect as e2 } from "vitest";
d2("company setup with missing tax details", () => {
  i2("saves with blank VAT, tax and NIC numbers", () => {
    const r = companySetupSchema.parse({ company_name: "New Co", email: "owner@example.com", vat_number: "", tax_id: "", employer_nic_number: "" });
    e2(r.vat_number).toBe("");
  });
  i2("adds https to a bare website", () => {
    e2(companySetupSchema.parse({ company_name: "New Co", email: "o@example.com", website: "newco.lc" }).website).toBe("https://newco.lc");
  });
});
