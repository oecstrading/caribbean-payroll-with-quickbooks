import { describe, it, expect } from "vitest";
import { TEMPLATE_PLACEHOLDERS } from "@/lib/onboarding-sheet";
describe("template placeholders", () => {
  it("lists the company examples the importer rejects", () => {
    expect(TEMPLATE_PLACEHOLDERS.company_name).toBe("Example Company Ltd");
    expect(TEMPLATE_PLACEHOLDERS.employer_nic_number).toBe("EMP-0001");
    expect(TEMPLATE_PLACEHOLDERS.tax_id).toBe("TIN-000000");
  });
});
