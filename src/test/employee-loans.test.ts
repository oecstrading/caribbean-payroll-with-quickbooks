import { describe, expect, it } from "vitest";
import { loanDeduction, loanSchema } from "@/lib/employee-loans";
import { calculatePeriodPayroll, periodFactor } from "@/lib/pay-period";
import { ST_LUCIA_CONFIG } from "@/lib/payroll-engine";
describe("employee loan repayments", () => {
  it("deducts Marcus's monthly 100 from the 500 balance", () => expect(loanDeduction(500, 100, 1)).toBe(100));
  it("deducts Kurt's monthly 200 from the 1200 balance", () => expect(loanDeduction(1200, 200, 1)).toBe(200));
  it("bounds final repayment by remaining balance", () => expect(loanDeduction(35, 100, 1)).toBe(35));
  it("prorates weekly repayments", () => expect(loanDeduction(500, 100, 12 / 52)).toBe(23.08));
  it("prorates semi-monthly repayments", () => expect(loanDeduction(500, 100, 0.5)).toBe(50));
  it("rejects a balance above principal", () => expect(loanSchema.safeParse({ employee: "11111111-1111-4111-8111-111111111111", creditor: "22222222-2222-4222-8222-222222222222", original: 800, balance: 801, monthly: 100, notes: "" }).success).toBe(false));
  it("reduces net pay by exactly the loan withheld", () => {
    const before = calculatePeriodPayroll(2600, 1, ST_LUCIA_CONFIG);
    const after = calculatePeriodPayroll(2600, 1, ST_LUCIA_CONFIG, [{ creditorName: "Courts", amount: loanDeduction(500, 100, 1) }]);
    expect(after.netPay).toBe(before.netPay - 100);
    expect(after.totalDeductions).toBe(before.totalDeductions + 100);
    expect(after.grossMonthly).toBe(before.grossMonthly);
  });
  it("adds repayments from multiple creditors without double-prorating", () => {
    const f = periodFactor("weekly", "2026-11-02", "2026-11-08");
    const before = calculatePeriodPayroll(2600, f, ST_LUCIA_CONFIG);
    const after = calculatePeriodPayroll(2600, f, ST_LUCIA_CONFIG, [{ creditorName: "Courts", amount: loanDeduction(500, 100, f) }, { creditorName: "Credit union", amount: loanDeduction(1200, 200, f) }]);
    expect(after.totalCreditorDeductions).toBe(69.23);
    expect(before.netPay - after.netPay).toBeCloseTo(69.23, 2);
  });
  it("does not deduct from a repaid loan", () => expect(loanDeduction(0, 100, 1)).toBe(0));
  it("rejects non-finite and negative repayment inputs", () => {
    expect(() => loanDeduction(500, 100, NaN)).toThrow();
    expect(() => loanDeduction(-1, 100, 1)).toThrow();
  });
});
import { loanMonthlyEquivalent } from "@/lib/employee-loans";
describe("loan repayment frequency", () => {
  it("weekly 100 equals 433.33 a month", () => expect(loanMonthlyEquivalent(100, "weekly")).toBe(433.33));
  it("semi-monthly 300 equals 600 a month", () => expect(loanMonthlyEquivalent(300, "semi-monthly")).toBe(600));
  it("bi-weekly 120 equals 260 a month", () => expect(loanMonthlyEquivalent(120, "bi-weekly")).toBe(260));
});
