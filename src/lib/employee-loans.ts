import { z } from "zod";

const money = z.number().finite().min(0).max(100000000).refine(n => Math.abs(n * 100 - Math.round(n * 100)) < 0.000001, "Use at most two decimal places");
export const loanSchema = z.object({
  employee: z.string().uuid(), creditor: z.string().uuid(),
  original: money.refine(n => n > 0), balance: money,
  monthly: money.refine(n => n > 0), notes: z.string().trim().max(500),
}).refine(v => v.balance <= v.original && v.monthly <= v.original, "Balance and repayment cannot exceed the original loan");

export function loanDeduction(balance: number, monthly: number, factor: number): number {
  if (![balance, monthly, factor].every(Number.isFinite) || balance < 0 || monthly < 0 || factor < 0) throw new Error("Invalid loan repayment");
  return Math.min(balance, Math.round((monthly * factor + Number.EPSILON) * 100) / 100);
}
export const LOAN_FREQUENCIES = [
  { value: "weekly", label: "Weekly" },
  { value: "bi-weekly", label: "Bi-Weekly" },
  { value: "semi-monthly", label: "Semi-Monthly" },
  { value: "monthly", label: "Monthly" },
] as const;
const PER_MONTH: Record<string, number> = { weekly: 52 / 12, "bi-weekly": 26 / 12, "semi-monthly": 2, monthly: 1 };
/** Mirrors SQL loan_monthly_equivalent: payroll prorates this monthly figure by the period factor. */
export function loanMonthlyEquivalent(amount: number, frequency: string): number {
  const m = PER_MONTH[frequency];
  if (!m || !Number.isFinite(amount) || amount < 0) throw new Error("Invalid repayment");
  return Math.round((amount * m + Number.EPSILON) * 100) / 100;
}
