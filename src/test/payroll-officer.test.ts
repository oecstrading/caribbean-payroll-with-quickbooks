import { describe, expect, it } from "vitest";
import { anonymousReviewRows } from "@/lib/payroll-review";
import { mayReviewPayroll } from "../../supabase/functions/payroll-officer/policy";

describe("AI Payroll Officer", () => {
  it("allows managers to request a review", () => { expect(mayReviewPayroll(["manager"])).toBe(true); });
  it("allows administrators to request a review", () => { expect(mayReviewPayroll(["admin"])).toBe(true); });
  it("denies employees and signed-out callers", () => { expect(mayReviewPayroll(["employee"])).toBe(false); expect(mayReviewPayroll([])).toBe(false); });
  it("sends payroll amounts without employee or company identifiers", () => {
    const rows = anonymousReviewRows([{ department: "Smiley Tinting", nicNumber: "NIC123", tanNumber: "TAN456", compliance: { compliant: false }, payroll: { basicPay: 1000, grossMonthly: 1100, employeeNIC: 55, employerNIC: 55, paye: 0, totalDeductions: 55, totalAdditions: 100, netPay: 1045 } }]);
    expect(rows).toEqual([{ reference: "Employee 1", department: "Department 1", basic: 1000, gross: 1100, nic: 55, employerNic: 55, paye: 0, deductions: 55, additions: 100, net: 1045, minimumWageFlag: true, missingNic: false, missingTan: false }]);
    expect(JSON.stringify(rows)).not.toMatch(/Smiley|NIC123|TAN456/);
  });
});