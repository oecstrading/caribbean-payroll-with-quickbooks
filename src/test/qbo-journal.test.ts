import { describe, expect, it } from "vitest";
import { buildPayrollJournal } from "../../supabase/functions/_shared/qbo-journal";

const slip = {
  basic_pay: 3000, overtime_pay: 100, gross_pay: 3400,
  employee_nic: 170, employer_nic: 170, paye: 250,
  total_deductions: 500, net_pay: 2900,
};
describe("QuickBooks payroll journal accounting controls", () => {
  it("reproduces and fixes the 300-dollar additional-earnings imbalance", () => {
    const result = buildPayrollJournal([slip], []);
    expect(result.debitTotal).toBe(3570);
    expect(result.creditTotal).toBe(3570);
    expect(result.lines.find(l => l.Description === "gross_wages")?.Amount).toBe(3300);
  });
  it("balances ordinary wages, overtime and employer contributions", () => {
    const result = buildPayrollJournal([{ ...slip, basic_pay: 3300 }], []);
    expect(result.debitTotal).toBe(result.creditTotal);
  });
  it("rejects inconsistent payslip net pay", () => {
    expect(() => buildPayrollJournal([{ ...slip, net_pay: 2901 }], [])).toThrow(/gross does not equal/);
  });
  it("rejects missing account mappings when live posting is requested", () => {
    expect(() => buildPayrollJournal([slip], [], { requireMappedAccounts: true })).toThrow(/Missing QuickBooks account mapping/);
  });
  it("rejects empty payroll runs and nonfinite amounts", () => {
    expect(() => buildPayrollJournal([], [])).toThrow(/empty/);
    expect(() => buildPayrollJournal([{ ...slip, gross_pay: Number.NaN }], [])).toThrow(/Invalid/);
  });
  it("rejects amounts with more than two decimal places", () => {
    expect(() => buildPayrollJournal([{ ...slip, employer_nic: 170.001 }], [])).toThrow(/decimal/);
  });
});
