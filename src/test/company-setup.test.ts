import { describe, it, expect } from "vitest";
import { companySetupSchema, companySetupLink, setupToken } from "@/lib/company-setup";

describe("company onboarding inputs", () => {
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