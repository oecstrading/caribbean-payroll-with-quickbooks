import { describe, it, expect } from "vitest";
import { registerRow } from "@/lib/statutory-levies";

describe("payroll register split", () => {
  it("OECS payslip: remaining deductions are voluntary, no levy", () => {
    const r = registerRow({ gross_pay: 3000, paye: 200, employee_nic: 150, employer_nic: 150, total_deductions: 450, net_pay: 2550 }, "LC");
    expect(r.levy).toBe(0); expect(r.other).toBe(100); expect(r.employerLevy).toBe(0);
  });
  it("Barbados adds a 0.5% employer training levy", () => {
    expect(registerRow({ gross_pay: 4000, paye: 0, employee_nic: 0, employer_nic: 0, total_deductions: 0, net_pay: 4000 }, "BB").employerLevy).toBe(20);
  });
});
