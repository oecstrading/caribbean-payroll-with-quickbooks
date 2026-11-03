import { describe, it, expect } from "vitest";
import { computeEdited, type PayLine } from "./pay-edits";
import { getConfigByJurisdiction } from "./payroll-engine";

const LC = getConfigByJurisdiction("LC");
let n = 0;
const L = (label: string, kind: PayLine["kind"], amount: number, nic = true, qty: number | null = null, rate: number | null = null): PayLine => ({ id: String(n++), label, kind, amount, nic, qty, rate });

// Smiley Tints pay slips, 16–31 Oct 2026 (semi-monthly, factor 0.5, PAYE 0 as printed, NIC excludes bonus)
describe("edited payroll matches the October 31 slips", () => {
  it("Ajaye Gideon nets 513.84", () => {
    const r = computeEdited({ paye: 0, lines: [L("Daily pay", "basic", 0, true, 6, 60), L("Sick leave 100%", "addition", 0, true, 3, 60), L("Sick leave 35%", "addition", 0, true, 2, 21), L("Meal deductions", "deduction", 39.06, false)] }, LC, 0.5);
    expect(r.grossMonthly).toBe(582); expect(r.employeeNIC).toBe(29.1); expect(r.netPay).toBe(513.84);
  });
  it("Brian Justin nets 748.56", () => {
    const r = computeEdited({ paye: 0, lines: [L("Fortnight pay", "basic", 600), L("Wages x1.5", "overtime", 0, true, 3.5, 11.25), L("Bonus", "addition", 200, false), L("Meal deductions", "deduction", 58.85, false)] }, LC, 0.5);
    expect(r.employeeNIC).toBe(31.97); expect(r.netPay).toBe(748.56);
  });
  it("Decosta Servais nets 2,284.88", () => {
    const r = computeEdited({ paye: 0, lines: [L("Daily pay", "basic", 0, true, 9, 100), L("Vacation pay", "addition", 0, true, 14, 90), L("Bonus", "addition", 250, false), L("Meal deductions", "deduction", 17.12, false)] }, LC, 0.5);
    expect(r.employeeNIC).toBe(108); expect(r.netPay).toBe(2284.88);
  });
  it("Loriann Hope nets 1,222.56", () => {
    const r = computeEdited({ paye: 0, lines: [L("Fortnight pay", "basic", 750), L("Daily pay", "basic", 0, true, 1, 75), L("Wages x1.5", "overtime", 9.37), L("Bonus", "addition", 500, false), L("Meal deductions", "deduction", 70.09, false)] }, LC, 0.5);
    expect(r.employeeNIC).toBe(41.72); expect(r.netPay).toBe(1222.56);
  });
});
