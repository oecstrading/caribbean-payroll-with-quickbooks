// Line-by-line payroll edits made during Run Payroll.
// Server check: public.validate_pay_lines (sums must match the row totals).
import type { CountryTaxConfig, PayrollResult } from "@/lib/payroll-engine";
import { calculatePeriodPayroll } from "@/lib/pay-period";

export type PayLineKind = "basic" | "overtime" | "addition" | "deduction";
export interface PayLine { id: string; label: string; kind: PayLineKind; qty: number | null; rate: number | null; amount: number; nic: boolean; locked?: boolean }
export interface PayEdit { lines: PayLine[]; paye: number | null }

const r2 = (n: number) => Math.round(n * 100) / 100;
let seq = 0;
export const newLineId = () => `l${Date.now().toString(36)}${(seq++).toString(36)}`;

export function lineAmount(l: PayLine) {
  return l.qty !== null && l.rate !== null && Number.isFinite(l.qty) && Number.isFinite(l.rate) ? r2(l.qty * l.rate) : r2(l.amount || 0);
}

/** Build editable lines from the platform's calculated result. */
export function linesFromResult(r: PayrollResult, nicOnBasicOnly: boolean, loanAmount = 0): PayEdit {
  const lines: PayLine[] = [{ id: newLineId(), label: "Basic pay", kind: "basic", qty: null, rate: null, amount: r.basicPay, nic: true }];
  if (r.overtimePay > 0) lines.push({ id: newLineId(), label: "Overtime", kind: "overtime", qty: null, rate: null, amount: r.overtimePay, nic: !nicOnBasicOnly });
  for (const a of r.additions) lines.push({ id: newLineId(), label: a.description || a.type, kind: "addition", qty: null, rate: null, amount: a.amount, nic: !nicOnBasicOnly });
  let loanLeft = loanAmount;
  for (const d of r.creditorDeductions) {
    const isLoan = loanLeft > 0 && d.creditorName === "Employee loan repayment";
    if (isLoan) loanLeft = 0;
    lines.push({ id: newLineId(), label: d.creditorName, kind: "deduction", qty: null, rate: null, amount: d.amount, nic: false });
  }
  return { lines, paye: r.paye };
}

/** Recalculate NIC, PAYE (unless overridden), deductions and net from edited lines. */
export function computeEdited(edit: PayEdit, config: CountryTaxConfig, factor: number): PayrollResult {
  const lines = edit.lines.map(l => ({ ...l, amount: lineAmount(l) }));
  const sum = (k: PayLineKind) => r2(lines.filter(l => l.kind === k).reduce((t, l) => t + l.amount, 0));
  const basic = sum("basic"), overtime = sum("overtime"), extra = sum("addition"), other = sum("deduction");
  const gross = r2(basic + overtime + extra);
  const nicBase = lines.filter(l => l.kind !== "deduction" && l.nic).reduce((t, l) => t + l.amount, 0);
  const cap = config.nic.maxContribution * factor;
  const employeeNIC = r2(Math.min(nicBase * config.nic.employeeRate, cap));
  const employerNIC = r2(Math.min(nicBase * config.nic.employerRate, cap));
  const paye = edit.paye !== null && Number.isFinite(edit.paye) ? r2(Math.max(0, edit.paye))
    : calculatePeriodPayroll(0, factor, config, [], [{ type: "other", description: "Gross", amount: gross }]).paye;
  const totalDeductions = r2(employeeNIC + paye + other);
  return {
    grossMonthly: gross, basicPay: basic, overtimePay: overtime, sundayPay: 0, holidayPay: 0,
    additions: lines.filter(l => l.kind === "addition").map(l => ({ type: "other", description: l.label, amount: l.amount })),
    totalAdditions: extra, employeeNIC, employerNIC, paye,
    creditorDeductions: lines.filter(l => l.kind === "deduction").map(l => ({ creditorName: l.label, amount: l.amount })),
    totalCreditorDeductions: other, totalDeductions, netPay: r2(gross - totalDeductions),
  };
}

/** Lines in the shape the approval check expects. */
export const serverLines = (edit: PayEdit) => edit.lines.map(l => ({ label: l.label.slice(0, 80), kind: l.kind, amount: lineAmount(l) }));
